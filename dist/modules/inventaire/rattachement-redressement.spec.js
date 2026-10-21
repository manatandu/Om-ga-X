"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const inventaire_service_1 = require("./inventaire.service");
const CREDIT_JUSTE = [
    { debit: 150000, credit: 0, compte: { numero: '65800000' } },
    { debit: 0, credit: 150000, compte: { numero: '31100000' } },
];
function service(options) {
    const ecart = {
        id: 'ec1',
        tenantId: 't1',
        compteId: 'cpt31',
        ecart: -150000,
        decision: options.decision === undefined ? client_1.DecisionEcartInventaire.A_REDRESSER : options.decision,
        ecritureId: options.lien ?? null,
        campagne: { exerciceId: 'ex1' },
        compte: { numero: '31100000' },
    };
    const prisma = {
        ecartInventaire: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'ec1' && where.tenantId === 't1' ? ecart : null)),
            count: jest.fn().mockResolvedValue(options.dejaTenue ?? 0),
            updateMany: jest.fn().mockResolvedValue({ count: options.gagne === false ? 0 : 1 }),
        },
        ecriture: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'e1' && where.tenantId === 't1'
                ? {
                    exerciceId: options.exerciceEcriture ?? 'ex1',
                    estGenereeParCloture: false,
                    statut: options.statutEcriture ?? 'BROUILLARD',
                    numeroPiece: 12,
                    lignes: options.lignes ?? CREDIT_JUSTE,
                }
                : null)),
        },
    };
    return {
        svc: new inventaire_service_1.InventaireService(prisma, {}),
        prisma,
    };
}
describe("rattacher l'écriture de redressement d'un manquant", () => {
    it('pose le lien sur une colonne encore libre', async () => {
        const { svc, prisma } = service({});
        await svc.rattacherEcritureRedressement('t1', 'ec1', 'e1');
        expect(prisma.ecartInventaire.updateMany).toHaveBeenCalledWith({
            where: { id: 'ec1', tenantId: 't1', ecritureId: null },
            data: { ecritureId: 'e1' },
        });
    });
    it("refuse un écart qui n'est pas arbitré « à redresser »", async () => {
        const { svc, prisma } = service({ decision: null });
        await expect(svc.rattacherEcritureRedressement('t1', 'ec1', 'e1')).rejects.toThrow(/à redresser/);
        expect(prisma.ecartInventaire.updateMany).not.toHaveBeenCalled();
    });
    it("refuse l'écriture d'un autre dossier", async () => {
        const { svc } = service({});
        await expect(svc.rattacherEcritureRedressement('t1', 'ec1', 'e-voisin')).rejects.toThrow(/n'existe pas dans ce dossier/);
    });
    it("refuse une écriture d'un autre exercice que celui inventorié", async () => {
        const { svc } = service({ exerciceEcriture: 'ex2' });
        await expect(svc.rattacherEcritureRedressement('t1', 'ec1', 'e1')).rejects.toThrow(/exercice inventorié/);
    });
    it('refuse une écriture qui ne crédite pas le compte inventorié du manquant, en le nommant', async () => {
        const { svc, prisma } = service({
            lignes: [
                { debit: 0, credit: 150000, compte: { numero: '65800000' } },
                { debit: 150000, credit: 0, compte: { numero: '31100000' } },
            ],
        });
        await expect(svc.rattacherEcritureRedressement('t1', 'ec1', 'e1')).rejects.toThrow(/31100000 au crédit/);
        expect(prisma.ecartInventaire.updateMany).not.toHaveBeenCalled();
    });
    it('refuse une écriture qui redresse déjà un autre écart du même compte', async () => {
        const { svc, prisma } = service({ dejaTenue: 1 });
        await expect(svc.rattacherEcritureRedressement('t1', 'ec1', 'e1')).rejects.toThrow(/deux manquants/);
        expect(prisma.ecartInventaire.count).toHaveBeenCalledWith({
            where: { tenantId: 't1', compteId: 'cpt31', ecritureId: 'e1' },
        });
    });
    it('refuse une écriture de situation, qui ne redresse rien (ligne sage-l1, relecture B3)', async () => {
        const { svc, prisma } = service({ statutEcriture: 'SITUATION' });
        await expect(svc.rattacherEcritureRedressement('t1', 'ec1', 'e1')).rejects.toThrow(/écriture de situation/);
        expect(prisma.ecartInventaire.updateMany).not.toHaveBeenCalled();
    });
    it('le perdant de deux demandes simultanées est refusé', async () => {
        const { svc } = service({ gagne: false });
        await expect(svc.rattacherEcritureRedressement('t1', 'ec1', 'e1')).rejects.toThrow(/autre demande/);
    });
});
describe("détacher l'écriture de redressement", () => {
    it('se fait au brouillard, sur le lien tel qu’il était lu', async () => {
        const { svc, prisma } = service({ lien: 'e1' });
        await svc.detacherEcritureRedressement('t1', 'ec1');
        expect(prisma.ecartInventaire.updateMany).toHaveBeenCalledWith({
            where: { id: 'ec1', tenantId: 't1', ecritureId: 'e1' },
            data: { ecritureId: null },
        });
    });
    it("ne se fait plus une fois l'écriture validée", async () => {
        const { svc, prisma } = service({ lien: 'e1', statutEcriture: 'VALIDEE' });
        await expect(svc.detacherEcritureRedressement('t1', 'ec1')).rejects.toThrow(/validée/);
        expect(prisma.ecartInventaire.updateMany).not.toHaveBeenCalled();
    });
    it('une simulation rattachée avant la règle se détache, sans être dite validée (relecture B3)', async () => {
        const { svc, prisma } = service({ lien: 'e1', statutEcriture: 'SITUATION' });
        await svc.detacherEcritureRedressement('t1', 'ec1');
        expect(prisma.ecartInventaire.updateMany).toHaveBeenCalledWith({
            where: { id: 'ec1', tenantId: 't1', ecritureId: 'e1' },
            data: { ecritureId: null },
        });
    });
});
//# sourceMappingURL=rattachement-redressement.spec.js.map