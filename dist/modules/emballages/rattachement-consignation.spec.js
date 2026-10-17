"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const emballages_service_1 = require("./emballages.service");
const TIERS = {
    nom: 'Brasserie du Fleuve',
    comptesRattaches: [{ estPrincipal: true, compte: { numero: '41110001', intitule: 'Brasserie du Fleuve' } }],
};
const OUVERTURE_JUSTE = [
    { debit: 12000, credit: 0, compte: { numero: '41110001' } },
    { debit: 0, credit: 12000, compte: { numero: '41940000' } },
];
function service(options) {
    const consignation = {
        id: 'c1',
        tenantId: 't1',
        sens: 'EMISE',
        nature: 'EMBALLAGE',
        montant: 12000,
        designation: 'Casiers',
        etat: options.etat ?? client_1.EtatConsignation.EN_COURS,
        prixDeReprise: options.prixDeReprise ?? null,
        ecritureConsignationId: options.liens?.ecritureConsignationId ?? null,
        ecritureDenouementId: options.liens?.ecritureDenouementId ?? null,
        tiers: TIERS,
    };
    const prisma = {
        consignation: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'c1' && where.tenantId === 't1' ? consignation : null)),
            count: jest.fn().mockResolvedValue(options.dejaTenue ?? 0),
            updateMany: jest.fn().mockResolvedValue({ count: options.gagne === false ? 0 : 1 }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        ecriture: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'e1' && where.tenantId === 't1'
                ? {
                    id: 'e1',
                    statut: options.statutEcriture ?? 'BROUILLARD',
                    numeroPiece: 7,
                    estGenereeParCloture: false,
                    lignes: options.lignes ?? OUVERTURE_JUSTE,
                }
                : null)),
        },
    };
    return { svc: new emballages_service_1.EmballagesService(prisma), prisma };
}
describe('rattacher une écriture à une consignation', () => {
    it("pose l'écriture d'ouverture sur une colonne encore libre", async () => {
        const { svc, prisma } = service({});
        await svc.rattacherEcriture('t1', 'c1', 'ouverture', 'e1');
        expect(prisma.consignation.updateMany).toHaveBeenCalledWith({
            where: { id: 'c1', tenantId: 't1', ecritureConsignationId: null },
            data: { ecritureConsignationId: 'e1' },
        });
    });
    it("pose l'écriture de dénouement sur l'autre colonne, pour le dénouement enregistré", async () => {
        const { svc, prisma } = service({
            etat: client_1.EtatConsignation.RESTITUEE,
            lignes: [
                { debit: 12000, credit: 0, compte: { numero: '41940000' } },
                { debit: 0, credit: 12000, compte: { numero: '41110001' } },
            ],
        });
        await svc.rattacherEcriture('t1', 'c1', 'denouement', 'e1');
        expect(prisma.consignation.updateMany).toHaveBeenCalledWith({
            where: { id: 'c1', tenantId: 't1', ecritureDenouementId: null },
            data: { ecritureDenouementId: 'e1' },
        });
    });
    it("la reprise sous le prix relit le prix enregistré · l'écriture doit porter le boni", async () => {
        const { svc, prisma } = service({
            etat: client_1.EtatConsignation.REPRISE_SOUS_PRIX,
            prixDeReprise: 9000,
            lignes: [
                { debit: 12000, credit: 0, compte: { numero: '41940000' } },
                { debit: 0, credit: 12000, compte: { numero: '41110001' } },
            ],
        });
        await expect(svc.rattacherEcriture('t1', 'c1', 'denouement', 'e1')).rejects.toThrow(/7074 au crédit/);
        expect(prisma.consignation.updateMany).not.toHaveBeenCalled();
    });
    it("refuse l'écriture d'un autre dossier", async () => {
        const { svc, prisma } = service({});
        await expect(svc.rattacherEcriture('t1', 'c1', 'ouverture', 'e-voisin')).rejects.toThrow(/n'existe pas dans ce dossier/);
        expect(prisma.ecriture.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e-voisin', tenantId: 't1' } }));
    });
    it('refuse une écriture qui ne passe pas le compte d’attente, en le nommant', async () => {
        const { svc, prisma } = service({
            lignes: [
                { debit: 12000, credit: 0, compte: { numero: '41110001' } },
                { debit: 0, credit: 12000, compte: { numero: '70110000' } },
            ],
        });
        await expect(svc.rattacherEcriture('t1', 'c1', 'ouverture', 'e1')).rejects.toThrow(/4194 au crédit/);
        expect(prisma.consignation.updateMany).not.toHaveBeenCalled();
    });
    it("refuse une écriture de dénouement tant que le registre n'a rien dénoué", async () => {
        const { svc } = service({});
        await expect(svc.rattacherEcriture('t1', 'c1', 'denouement', 'e1')).rejects.toThrow(/pas dénouée au registre/);
    });
    it('refuse une écriture qui tient déjà une autre consignation', async () => {
        const { svc, prisma } = service({ dejaTenue: 1 });
        await expect(svc.rattacherEcriture('t1', 'c1', 'ouverture', 'e1')).rejects.toThrow(/deux consignations/);
        expect(prisma.consignation.updateMany).not.toHaveBeenCalled();
    });
    it('refuse une écriture de situation, qui ne passe aucune consignation (ligne sage-l1, relecture B3)', async () => {
        const { svc, prisma } = service({ statutEcriture: 'SITUATION' });
        await expect(svc.rattacherEcriture('t1', 'c1', 'ouverture', 'e1')).rejects.toThrow(/écriture de situation/);
        expect(prisma.consignation.updateMany).not.toHaveBeenCalled();
    });
    it('le perdant de deux demandes simultanées est refusé', async () => {
        const { svc } = service({ gagne: false });
        await expect(svc.rattacherEcriture('t1', 'c1', 'ouverture', 'e1')).rejects.toThrow(/autre demande/);
    });
    it('un rôle inconnu est refusé', async () => {
        const { svc } = service({});
        await expect(svc.rattacherEcriture('t1', 'c1', 'reprise', 'e1')).rejects.toThrow(/ouverture/);
    });
});
describe('détacher une écriture de consignation', () => {
    it('se fait au brouillard, sur le lien tel qu’il était lu', async () => {
        const { svc, prisma } = service({ liens: { ecritureConsignationId: 'e1' } });
        await svc.detacherEcriture('t1', 'c1', 'ouverture');
        expect(prisma.consignation.updateMany).toHaveBeenCalledWith({
            where: { id: 'c1', tenantId: 't1', ecritureConsignationId: 'e1' },
            data: { ecritureConsignationId: null },
        });
    });
    it("ne se fait plus une fois l'écriture validée", async () => {
        const { svc, prisma } = service({ liens: { ecritureConsignationId: 'e1' }, statutEcriture: 'VALIDEE' });
        await expect(svc.detacherEcriture('t1', 'c1', 'ouverture')).rejects.toThrow(/validée/);
        expect(prisma.consignation.updateMany).not.toHaveBeenCalled();
    });
    it('une simulation rattachée avant la règle se détache, sans être dite validée (relecture B3)', async () => {
        const { svc, prisma } = service({ liens: { ecritureConsignationId: 'e1' }, statutEcriture: 'SITUATION' });
        await svc.detacherEcriture('t1', 'c1', 'ouverture');
        expect(prisma.consignation.updateMany).toHaveBeenCalledWith({
            where: { id: 'c1', tenantId: 't1', ecritureConsignationId: 'e1' },
            data: { ecritureConsignationId: null },
        });
    });
});
//# sourceMappingURL=rattachement-consignation.spec.js.map