"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const controles_service_1 = require("./controles.service");
function service(lignes) {
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex1',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        compte: {
            findMany: jest.fn().mockResolvedValue([
                {
                    id: 'c1',
                    numero: '57100000',
                    intitule: 'Caisse siège',
                    typeCompte: 'DETAIL',
                    journauxTresorerie: [{ code: 'CA', intitule: 'Caisse' }],
                },
            ]),
        },
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue(lignes.map((l) => ({
                compteId: 'c1',
                debit: l.debit,
                credit: l.credit,
                ecriture: { date: new Date(l.date) },
            }))),
        },
    };
    return new controles_service_1.ControlesService(prisma);
}
describe('contrôle de caisse', () => {
    it('ne signale rien quand la caisse reste positive', async () => {
        const r = await service([
            { date: '2026-03-01', debit: 500000, credit: 0 },
            { date: '2026-03-05', debit: 0, credit: 200000 },
        ]).controleCaisse('t1', 'ex1');
        expect(r[0].nombreJoursNegatifs).toBe(0);
        expect(r[0].premierJourNegatif).toBeNull();
        expect(r[0].soldeFinal).toBe(300000);
    });
    it('nomme le jour exact du passage sous zéro', async () => {
        const r = await service([
            { date: '2026-03-01', debit: 100000, credit: 0 },
            { date: '2026-03-04', debit: 0, credit: 250000 },
            { date: '2026-03-10', debit: 400000, credit: 0 },
        ]).controleCaisse('t1', 'ex1');
        expect(r[0].premierJourNegatif).toBe('2026-03-04');
        expect(r[0].nombreJoursNegatifs).toBe(1);
        expect(r[0].soldeFinal).toBe(250000);
    });
    it('attrape une dépense saisie avant son approvisionnement le même jour n’est PAS une anomalie', async () => {
        const r = await service([
            { date: '2026-03-01', debit: 0, credit: 250000 },
            { date: '2026-03-01', debit: 400000, credit: 0 },
        ]).controleCaisse('t1', 'ex1');
        expect(r[0].nombreJoursNegatifs).toBe(0);
    });
    it('tolère le centime : un arrondi ne déclenche pas d’alerte', async () => {
        const r = await service([
            { date: '2026-03-01', debit: 100, credit: 0 },
            { date: '2026-03-02', debit: 0, credit: 100.004 },
        ]).controleCaisse('t1', 'ex1');
        expect(r[0].nombreJoursNegatifs).toBe(0);
    });
    it('compte chaque journée négative, pas seulement la première', async () => {
        const r = await service([
            { date: '2026-03-01', debit: 0, credit: 100000 },
            { date: '2026-03-02', debit: 0, credit: 50000 },
            { date: '2026-03-03', debit: 200000, credit: 0 },
        ]).controleCaisse('t1', 'ex1');
        expect(r[0].nombreJoursNegatifs).toBe(2);
        expect(r[0].premierJourNegatif).toBe('2026-03-01');
        expect(r[0].journees.map((j) => j.soldeFinJournee)).toEqual([-100000, -150000, 50000]);
    });
});
describe('instrument de monnaie électronique (compte 55 · R1-B5, R5-C4)', () => {
    function serviceMonnaie(lignes) {
        const comptes = [
            { id: 'c55', numero: '55100000', intitule: 'Mobile money', typeCompte: 'DETAIL', journauxTresorerie: [] },
            { id: 'c57', numero: '57100000', intitule: 'Caisse siège', typeCompte: 'DETAIL', journauxTresorerie: [] },
        ];
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex1' }) },
            compte: {
                findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(comptes.filter((c) => !where.numero || c.numero.startsWith(where.numero.startsWith)))),
            },
            ligneEcriture: {
                findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(lignes
                    .filter((l) => where.compteId.in.includes(l.compteId))
                    .map((l, i) => ({ id: `l${i}`, compteId: l.compteId, debit: l.debit, credit: l.credit, ecriture: { date: new Date(l.date) } })))),
            },
        };
        return new controles_service_1.ControlesService(prisma);
    }
    it('nomme le jour où le 55 passe créditeur, et lui seul', async () => {
        const r = await serviceMonnaie([
            { compteId: 'c55', date: '2026-03-01', debit: 0, credit: 30_000 },
            { compteId: 'c55', date: '2026-03-02', debit: 50_000, credit: 0 },
            { compteId: 'c57', date: '2026-03-01', debit: 0, credit: 1 },
        ]).controleMonnaieElectronique('t1', 'ex1');
        expect(r.map((c) => [c.numero, c.premierJourNegatif, c.nombreJoursNegatifs])).toEqual([['55100000', '2026-03-01', 1]]);
    });
});
//# sourceMappingURL=controle-caisse.spec.js.map