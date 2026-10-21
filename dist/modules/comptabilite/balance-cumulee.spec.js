"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ecriture_service_1 = require("./ecriture.service");
function service(exercices, ecritures) {
    const correspond = (e, where) => {
        const f = where.ecriture;
        if (f.estGenereeParCloture !== undefined && e.estGenereeParCloture !== f.estGenereeParCloture)
            return false;
        if (f.estSoldeDesComptesDeGestion !== undefined &&
            (e.estSoldeDesComptesDeGestion ?? false) !== f.estSoldeDesComptesDeGestion) {
            return false;
        }
        if (f.statut !== undefined && (e.statut ?? 'VALIDEE') !== f.statut)
            return false;
        const cible = f.exerciceId;
        if (cible === undefined)
            return true;
        if (typeof cible === 'object' && cible.in)
            return cible.in.includes(e.exerciceId);
        return cible === e.exerciceId;
    };
    const prisma = {
        exercice: {
            findFirst: jest.fn(({ where }) => {
                const e = where.tenantId === 't1' ? exercices.find((x) => x.id === where.id) : undefined;
                return Promise.resolve(e ? { id: e.id, dateDebut: new Date(`${e.annee}-01-01`) } : null);
            }),
            findMany: jest.fn(({ where }) => {
                const borne = new Date(where.dateDebut.lte).getUTCFullYear();
                return Promise.resolve(exercices.filter((e) => e.annee <= borne).sort((a, b) => a.annee - b.annee).map((e) => ({ id: e.id })));
            }),
        },
        compte: {
            findMany: jest.fn().mockResolvedValue([
                { id: 'c-462', numero: '46200000', intitule: 'Bailleur', classe: 'CLASSE_4', typeCompte: 'DETAIL' },
            ]),
        },
        ligneEcriture: {
            groupBy: jest.fn(({ where }) => {
                const retenues = ecritures.filter((e) => correspond(e, where));
                const parCompte = new Map();
                for (const l of retenues) {
                    const a = parCompte.get(l.compteId) ?? { debit: 0, credit: 0 };
                    a.debit += l.debit;
                    a.credit += l.credit;
                    parCompte.set(l.compteId, a);
                }
                return Promise.resolve([...parCompte].map(([compteId, a]) => ({ compteId, _sum: a })));
            }),
        },
    };
    return new ecriture_service_1.EcritureService(prisma, {}, {}, {});
}
const EXERCICES = [
    { id: 'e2024', annee: 2024 },
    { id: 'e2025', annee: 2025 },
    { id: 'e2026', annee: 2026 },
];
describe('Balance cumulée depuis l’origine', () => {
    it('N’ADDITIONNE PAS LES REPORTS À-NOUVEAU, qui rejouent le solde de l’année précédente', async () => {
        const s = service(EXERCICES, [
            { exerciceId: 'e2024', estGenereeParCloture: false, compteId: 'c-462', debit: 0, credit: 300_000 },
            { exerciceId: 'e2025', estGenereeParCloture: true, compteId: 'c-462', debit: 0, credit: 300_000 },
            { exerciceId: 'e2025', estGenereeParCloture: false, compteId: 'c-462', debit: 0, credit: 500_000 },
            { exerciceId: 'e2026', estGenereeParCloture: true, compteId: 'c-462', debit: 0, credit: 800_000 },
        ]);
        const { lignes } = await s.balanceCumulee('t1', 'e2026');
        expect(lignes[0].totalCredit).toBe(800_000);
        expect(lignes[0].solde).toBe(-800_000);
    });
    it('GARDE le report du PREMIER exercice · c’est le bilan d’ouverture du dossier', async () => {
        const s = service(EXERCICES, [
            { exerciceId: 'e2024', estGenereeParCloture: true, compteId: 'c-462', debit: 0, credit: 1_000_000 },
            { exerciceId: 'e2025', estGenereeParCloture: false, compteId: 'c-462', debit: 0, credit: 200_000 },
        ]);
        const { lignes } = await s.balanceCumulee('t1', 'e2026');
        expect(lignes[0].totalCredit).toBe(1_200_000);
        expect(lignes[0].reportCredit).toBe(1_000_000);
    });
    it('NE PREND PAS l’écriture de solde des comptes de gestion du premier exercice pour une ouverture', async () => {
        const s = service(EXERCICES, [
            { exerciceId: 'e2024', estGenereeParCloture: false, compteId: 'c-462', debit: 0, credit: 400_000 },
            {
                exerciceId: 'e2024',
                estGenereeParCloture: true,
                estSoldeDesComptesDeGestion: true,
                compteId: 'c-462',
                debit: 400_000,
                credit: 0,
            },
        ]);
        const { lignes } = await s.balanceCumulee('t1', 'e2025');
        expect({ total: lignes[0].totalCredit - lignes[0].totalDebit, ouverture: lignes[0].reportDebit }).toEqual({
            total: 400_000,
            ouverture: 0,
        });
    });
    it('S’ARRÊTE À L’EXERCICE DEMANDÉ · la colonne « cumul début » ne voit pas l’exercice en cours', async () => {
        const s = service(EXERCICES, [
            { exerciceId: 'e2024', estGenereeParCloture: false, compteId: 'c-462', debit: 0, credit: 300_000 },
            { exerciceId: 'e2026', estGenereeParCloture: false, compteId: 'c-462', debit: 0, credit: 500_000 },
        ]);
        const { lignes } = await s.balanceCumulee('t1', 'e2025');
        expect(lignes[0].totalCredit).toBe(300_000);
    });
    it('NE LIT PAS LE BROUILLARD · un état financier n’engage personne sur des écritures non validées', async () => {
        const s = service(EXERCICES, [
            { exerciceId: 'e2025', estGenereeParCloture: false, compteId: 'c-462', debit: 0, credit: 300_000 },
            { exerciceId: 'e2025', estGenereeParCloture: false, statut: 'BROUILLARD', compteId: 'c-462', debit: 0, credit: 900_000 },
        ]);
        const { lignes } = await s.balanceCumulee('t1', 'e2026');
        expect(lignes[0].totalCredit).toBe(300_000);
    });
});
//# sourceMappingURL=balance-cumulee.spec.js.map