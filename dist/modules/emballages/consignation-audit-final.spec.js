"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const emballages_service_1 = require("./emballages.service");
function monter(opts = {}) {
    const registre = opts.registre ?? [];
    const create = jest.fn(async ({ data }) => {
        const c = { id: 'nouvelle', ...data, etat: client_1.EtatConsignation.EN_COURS, ecritureConsignationId: null, ecritureDenouementId: null };
        registre.push(c);
        return c;
    });
    const tiers = {
        id: 'tr1',
        nom: 'Brasserie',
        comptesRattaches: opts.avecCompte === false ? [] : [{ estPrincipal: true, compte: { numero: '41110001', intitule: 'Client Brasserie' } }],
    };
    const prisma = {
        tiers: { findFirst: jest.fn(async ({ where }) => (where.tenantId === 't1' && where.id === 'tr1' ? tiers : null)) },
        tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: client_1.Referentiel.SYSCOHADA })) },
        consignation: {
            create,
            findFirst: jest.fn(async ({ where }) => {
                const c = registre.find((x) => x.id === where.id && x.tenantId === where.tenantId);
                return c ? { ...c, tiers, montant: 100, sens: client_1.SensConsignation.EMISE, nature: 'EMBALLAGE', designation: 'Casiers', prixDeReprise: null } : null;
            }),
            delete: jest.fn(async ({ where }) => {
                const i = registre.findIndex((x) => x.id === where.id);
                registre.splice(i, 1);
                return {};
            }),
        },
    };
    return { svc: new emballages_service_1.EmballagesService(prisma), create, registre };
}
const dto = (montant = 50_000) => ({ tiersId: 'tr1', sens: client_1.SensConsignation.EMISE, nature: 'EMBALLAGE', designation: 'Casiers', dateConsignation: '2026-05-10', montant });
describe('F137 · la proposition se calcule AVANT l’enregistrement', () => {
    it('un tiers sans compte rattaché est refusé, et rien n’est enregistré', async () => {
        const m = monter({ avecCompte: false });
        await expect(m.svc.creer('t1', 'u', dto())).rejects.toThrow(/aucun compte rattaché/);
        expect(m.create).not.toHaveBeenCalled();
    });
    it('un montant que la proposition refuse n’est pas enregistré non plus', async () => {
        const m = monter();
        await expect(m.svc.creer('t1', 'u', dto(0))).rejects.toThrow(/strictement positif/);
        expect(m.create).not.toHaveBeenCalled();
    });
    it('une consignation calculable s’enregistre, avec sa proposition', async () => {
        const m = monter();
        const r = await m.svc.creer('t1', 'u', dto());
        expect(r.proposition.refus).toBeNull();
        expect(m.create).toHaveBeenCalledTimes(1);
    });
});
describe('F137 · une consignation se retire tant que rien ne la tient', () => {
    const enCours = (id, extra = {}) => ({
        id, tenantId: 't1', etat: client_1.EtatConsignation.EN_COURS, ecritureConsignationId: null, ecritureDenouementId: null, ...extra,
    });
    it('en cours et sans écriture, elle part', async () => {
        const m = monter({ registre: [enCours('c1')] });
        await expect(m.svc.supprimer('t1', 'c1')).resolves.toEqual({ supprimee: true });
        expect(m.registre).toEqual([]);
    });
    it('dénouée, rattachée, ou d’un autre dossier, elle reste', async () => {
        const m = monter({
            registre: [
                enCours('c2', { etat: client_1.EtatConsignation.RESTITUEE }),
                enCours('c3', { ecritureConsignationId: 'e1' }),
                enCours('c4', { tenantId: 't2' }),
            ],
        });
        await expect(m.svc.supprimer('t1', 'c2')).rejects.toThrow(/dénouée/);
        await expect(m.svc.supprimer('t1', 'c3')).rejects.toThrow(/rattachée à une écriture/);
        await expect(m.svc.supprimer('t1', 'c4')).rejects.toThrow(/introuvable/);
        expect(m.registre).toHaveLength(3);
    });
});
//# sourceMappingURL=consignation-audit-final.spec.js.map