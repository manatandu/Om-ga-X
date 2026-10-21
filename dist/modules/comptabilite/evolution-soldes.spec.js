"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ecriture_service_1 = require("./ecriture.service");
function harnais(exercices, agregatsParExercice, comptes = [
    { id: 'c1', numero: '471500', intitule: 'Provision fiscale', classe: 4 },
    { id: 'c2', numero: '411001', intitule: 'Clients', classe: 4 },
]) {
    const groupBy = jest.fn().mockImplementation(({ where }) => {
        const id = where.ecriture.exerciceId;
        const sansSolde = where.ecriture.estSoldeDesComptesDeGestion === false;
        const regroupes = new Map();
        for (const a of agregatsParExercice[id] ?? []) {
            if (a.soldeGestion && sansSolde)
                continue;
            const g = regroupes.get(a.compteId) ?? { debit: 0, credit: 0 };
            g.debit += a.debit;
            g.credit += a.credit;
            regroupes.set(a.compteId, g);
        }
        return Promise.resolve([...regroupes.entries()].map(([compteId, a]) => ({ compteId, ...a })).map((a) => ({
            compteId: a.compteId,
            _sum: { debit: a.debit, credit: a.credit },
        })));
    });
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue(exercices.map((e) => ({
                id: e.id,
                dateDebut: new Date(`${e.annee}-01-01`),
                dateFin: new Date(`${e.annee}-12-31`),
                statut: 'CLOTURE',
            }))),
        },
        compte: { findMany: jest.fn().mockResolvedValue(comptes) },
        ligneEcriture: { groupBy },
    };
    return { service: new ecriture_service_1.EcritureService(prisma, {}, {}, {}), prisma, groupBy };
}
describe('évolution pluriannuelle des soldes', () => {
    it('rend la charge d’un exercice CLOS pour son total de l’année, pas zéro (régression de F4)', async () => {
        const { service } = harnais([{ id: 'e2025', annee: '2025' }], {
            e2025: [
                { compteId: 'c6', debit: 1_000, credit: 0 },
                { compteId: 'c6', debit: 0, credit: 1_000, soldeGestion: true },
                { compteId: 'c13', debit: 1_000, credit: 0, soldeGestion: true },
            ],
        }, [
            { id: 'c6', numero: '60500000', intitule: 'Autres achats', classe: 6 },
            { id: 'c13', numero: '13900000', intitule: 'Résultat net · perte', classe: 1 },
        ]);
        const r = await service.evolutionSoldes('t');
        expect(r.lignes.map((l) => [l.numero, l.soldes])).toEqual([['60500000', [1_000]]]);
    });
    it('distingue un solde NUL d’un compte NON MOUVEMENTÉ', () => {
        const { service } = harnais([
            { id: 'e2025', annee: '2025' },
            { id: 'e2024', annee: '2024' },
        ], {
            e2025: [{ compteId: 'c1', debit: 500, credit: 500 }],
            e2024: [],
        });
        return service.evolutionSoldes('t').then((r) => {
            expect(r.lignes[0].soldes).toEqual([0, null]);
        });
    });
    it('range les exercices du plus récent au plus ancien', async () => {
        const { service, prisma } = harnais([{ id: 'e2025', annee: '2025' }], { e2025: [] });
        await service.evolutionSoldes('t');
        expect(prisma.exercice.findMany.mock.calls[0][0].orderBy).toEqual({ dateDebut: 'desc' });
    });
    it('rend le solde SIGNÉ de clôture, à-nouveaux compris', async () => {
        const { service, groupBy } = harnais([{ id: 'e2025', annee: '2025' }], {
            e2025: [
                { compteId: 'c1', debit: 0, credit: 1200.5 },
                { compteId: 'c2', debit: 900, credit: 250 },
            ],
        });
        const r = await service.evolutionSoldes('t');
        expect(r.lignes.find((l) => l.numero === '471500').soldes).toEqual([-1200.5]);
        expect(r.lignes.find((l) => l.numero === '411001').soldes).toEqual([650]);
        expect(groupBy.mock.calls[0][0].where.ecriture.estGenereeParCloture).toBeUndefined();
    });
    it('écarte les comptes que rien n’a touché sur toute la fenêtre', async () => {
        const { service } = harnais([{ id: 'e2025', annee: '2025' }], {
            e2025: [{ compteId: 'c1', debit: 100, credit: 0 }],
        });
        const r = await service.evolutionSoldes('t');
        expect(r.lignes.map((l) => l.numero)).toEqual(['471500']);
    });
    it('borne la fenêtre demandée', async () => {
        const { service, prisma } = harnais([{ id: 'e2025', annee: '2025' }], { e2025: [] });
        await service.evolutionSoldes('t', { nbExercices: 500 });
        expect(prisma.exercice.findMany.mock.calls[0][0].take).toBe(20);
        const b = harnais([{ id: 'e2025', annee: '2025' }], { e2025: [] });
        await b.service.evolutionSoldes('t', { nbExercices: 1 });
        expect(b.prisma.exercice.findMany.mock.calls[0][0].take).toBe(2);
    });
    it('écarte les comptes de Total, qui ne reçoivent jamais d’écriture', async () => {
        const { service, prisma } = harnais([{ id: 'e2025', annee: '2025' }], { e2025: [] });
        await service.evolutionSoldes('t');
        expect(prisma.compte.findMany.mock.calls[0][0].where.typeCompte).toEqual({ not: 'TOTAL' });
    });
});
//# sourceMappingURL=evolution-soldes.spec.js.map