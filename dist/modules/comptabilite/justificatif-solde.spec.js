"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const ecriture_service_1 = require("./ecriture.service");
const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'ecriture.service.ts'), 'utf8');
let n = 0;
function ligne(date, debit, credit, options = {}) {
    n += 1;
    return {
        id: `l${n}`,
        libelle: `Opération ${n}`,
        debit,
        credit,
        lettre: options.lettre ?? null,
        montantDevise: null,
        devise: null,
        ecriture: {
            date: new Date(date),
            libelle: `Écriture ${n}`,
            reference: `PJ-${n}`,
            numeroPiece: n,
            estGenereeParCloture: (options.aNouveau || options.soldeDeGestion) ?? false,
            estSoldeDesComptesDeGestion: options.soldeDeGestion ?? false,
            journal: { code: 'OD' },
        },
    };
}
function harnais(lignes, soldeBalance = { debit: 0, credit: 0 }) {
    const findMany = jest.fn().mockResolvedValue(lignes);
    const prisma = {
        compte: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.id === 'c1' && where.tenantId === 't' ? { id: 'c1', numero: '469150', intitule: 'Débiteurs divers' } : null)),
        },
        exercice: {
            findFirst: jest.fn(({ where }) => {
                if (where.tenantId !== 't')
                    return Promise.resolve(null);
                if (where.id === undefined)
                    return Promise.resolve({ id: 'ex2020' });
                return Promise.resolve(where.id === 'ex2025' ? { id: 'ex2025', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') } : null);
            }),
            findMany: jest.fn().mockResolvedValue([]),
        },
        ligneEcriture: {
            findMany,
            count: jest.fn().mockResolvedValue(lignes.length),
            aggregate: jest.fn().mockResolvedValue({ _sum: { debit: soldeBalance.debit, credit: soldeBalance.credit } }),
        },
    };
    return { service: new ecriture_service_1.EcritureService(prisma, {}, {}, {}), findMany };
}
const AU_31_12 = { compteId: 'c1', exerciceId: 'ex2025' };
describe('justificatif de solde', () => {
    it('n’est pas borné à l’exercice · aucun filtre exerciceId sur la liste', () => {
        expect(service).toContain('date: { lte: arret }');
        expect(service).not.toContain('exerciceId: params.exerciceId },\n        include');
    });
    it('écarte les à-nouveaux de clôture, garde ceux du premier exercice', async () => {
        const { service: svc, findMany } = harnais([]);
        await svc.justificatifSolde('t', AU_31_12);
        const where = findMany.mock.calls[0][0].where;
        expect(where.ecriture.NOT).toEqual({
            AND: [{ estGenereeParCloture: true }, { estSoldeDesComptesDeGestion: false }, { exerciceId: { not: 'ex2020' } }],
        });
        expect(where.ecriture.exerciceId).toBeUndefined();
    });
    it('garde l’écriture de solde des comptes de gestion, et ne la dit pas à-nouveau', async () => {
        const { service: svc } = harnais([
            ligne('2024-05-10', 1000, 0),
            ligne('2024-12-31', 0, 1000, { soldeDeGestion: true }),
            ligne('2025-03-02', 500, 0),
        ]);
        const r = await svc.justificatifSolde('t', AU_31_12);
        expect({ solde: r.totaux.solde, aNouveau: r.lignes[1].estANouveau }).toEqual({ solde: 500, aNouveau: false });
    });
    it('totalise débit, crédit et solde sur les lignes retenues', async () => {
        const { service: svc } = harnais([
            ligne('2020-10-01', 1208.93, 0, { aNouveau: true }),
            ligne('2023-06-14', 4322.76, 0),
            ligne('2023-07-12', 0, 2338.18),
            ligne('2025-02-28', 163.55, 0),
        ]);
        const r = await svc.justificatifSolde('t', AU_31_12);
        expect(r.totaux.debit).toBe(5695.24);
        expect(r.totaux.credit).toBe(2338.18);
        expect(r.totaux.solde).toBe(3357.06);
        expect(r.lignes[0].estANouveau).toBe(true);
    });
    it('recoupe avec la balance par un AUTRE chemin, et signale l’écart', async () => {
        const { service: svc } = harnais([ligne('2025-03-01', 1000, 0)], { debit: 1000, credit: 0 });
        const r = await svc.justificatifSolde('t', AU_31_12);
        expect(r.recoupement.applicable).toBe(true);
        expect(r.recoupement.concordant).toBe(true);
        const { service: svc2 } = harnais([ligne('2025-03-01', 1000, 0)], { debit: 1400, credit: 0 });
        const r2 = await svc2.justificatifSolde('t', AU_31_12);
        expect(r2.recoupement.concordant).toBe(false);
        expect(r2.recoupement.ecart).toBe(-400);
    });
    it('n’annonce pas de recoupement à une date intermédiaire', async () => {
        const { service: svc } = harnais([ligne('2025-03-01', 1000, 0)], { debit: 4000, credit: 0 });
        const r = await svc.justificatifSolde('t', { ...AU_31_12, dateArret: '2025-06-30' });
        expect(r.recoupement.applicable).toBe(false);
    });
    it('n’annonce pas de recoupement quand on masque les lignes lettrées', async () => {
        const { service: svc } = harnais([ligne('2025-03-01', 1000, 0)], { debit: 1000, credit: 0 });
        const r = await svc.justificatifSolde('t', { ...AU_31_12, masquerLettrees: true });
        expect(r.recoupement.applicable).toBe(false);
    });
    it('borne un arrêté postérieur à la clôture', async () => {
        const { service: svc } = harnais([]);
        const r = await svc.justificatifSolde('t', { ...AU_31_12, dateArret: '2026-06-30' });
        expect(r.dateArret).toBe('2025-12-31');
    });
    it('prend le libellé de la LIGNE, et retombe sur celui de l’écriture', async () => {
        const l = ligne('2025-03-01', 100, 0);
        const sansLibelle = { ...ligne('2025-03-02', 200, 0), libelle: null };
        const { service: svc } = harnais([l, sansLibelle]);
        const r = await svc.justificatifSolde('t', AU_31_12);
        expect(r.lignes[0].libelle).toBe(l.libelle);
        expect(r.lignes[1].libelle).toBe(sansLibelle.ecriture.libelle);
    });
});
describe('justificatif de solde · il ne se tronque pas (audit final F185)', () => {
    it('au-delà du plafond d’une fenêtre, il se refuse et dit par où passer', async () => {
        const { service: svc } = harnais([]);
        const prisma = svc.prisma;
        prisma.ligneEcriture.count.mockResolvedValue(ecriture_service_1.PLAFOND_LIGNES_GRAND_LIVRE + 1);
        await expect(svc.justificatifSolde('t', { compteId: 'c1', exerciceId: 'ex2025' })).rejects.toThrow(/Le justificatif du compte 469150 porte .* Masquez les lignes lettrées, ou avancez la date d'arrêt\./);
    });
    it('compte sur le MÊME périmètre que celui qu’il lit', async () => {
        const { service: svc, findMany } = harnais([ligne('2025-03-01', 10, 0)]);
        await svc.justificatifSolde('t', { compteId: 'c1', exerciceId: 'ex2025', masquerLettrees: true });
        const prisma = svc.prisma;
        expect(prisma.ligneEcriture.count.mock.calls[0][0].where).toEqual(findMany.mock.calls[0][0].where);
    });
});
//# sourceMappingURL=justificatif-solde.spec.js.map