"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const etats_analytiques_service_1 = require("./etats-analytiques.service");
const rubriques_budgetaires_1 = require("./rubriques-budgetaires");
const SECTIONS = [
    { id: 'r1', code: '1', type: client_1.TypeCompteDetailTotal.TOTAL },
    { id: 's11', code: '11', type: client_1.TypeCompteDetailTotal.DETAIL },
    { id: 's12', code: '12', type: client_1.TypeCompteDetailTotal.DETAIL },
    { id: 's2', code: '2', type: client_1.TypeCompteDetailTotal.DETAIL },
];
const MONTANTS = { s11: 300, s12: 200, s2: 500 };
const mesure = (id) => MONTANTS[id] ?? 0;
describe('Règle d’agrégation des rubriques', () => {
    it('une RUBRIQUE vaut la somme de ses feuilles, une FEUILLE vaut la sienne', () => {
        expect((0, rubriques_budgetaires_1.valeurDeLaLigne)(SECTIONS[0], SECTIONS, mesure)).toBe(500);
        expect((0, rubriques_budgetaires_1.valeurDeLaLigne)(SECTIONS[1], SECTIONS, mesure)).toBe(300);
    });
    it('LE TOTAL GÉNÉRAL NE SOMME QUE LES FEUILLES', () => {
        expect((0, rubriques_budgetaires_1.totalDesFeuilles)(SECTIONS, mesure)).toBe(1_000);
    });
    it('les rubriques S’EMBOÎTENT · une feuille compte dans chacune de ses racines', () => {
        const imbriquees = [
            { id: 'r1', code: '1', type: client_1.TypeCompteDetailTotal.TOTAL },
            { id: 'r11', code: '11', type: client_1.TypeCompteDetailTotal.TOTAL },
            { id: 's111', code: '111', type: client_1.TypeCompteDetailTotal.DETAIL },
        ];
        const m = (id) => (id === 's111' ? 700 : 0);
        expect((0, rubriques_budgetaires_1.valeurDeLaLigne)(imbriquees[0], imbriquees, m)).toBe(700);
        expect((0, rubriques_budgetaires_1.valeurDeLaLigne)(imbriquees[1], imbriquees, m)).toBe(700);
        expect((0, rubriques_budgetaires_1.totalDesFeuilles)(imbriquees, m)).toBe(700);
    });
});
function serviceAnalytique(options) {
    const prisma = {
        planAnalytique: {
            findFirst: jest.fn().mockResolvedValue({ id: 'p1', code: 'BUD', intitule: 'Budget', gererBudgets: true }),
        },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'e1',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
        },
        sectionAnalytique: {
            findMany: jest.fn(({ where }) => Promise.resolve(where?.type ? options.sections.filter((s) => s.type === where.type) : options.sections)),
        },
        budgetSection: { findMany: jest.fn().mockResolvedValue(options.budgets ?? []) },
        ventilationAnalytique: {
            groupBy: jest.fn().mockResolvedValue((options.ventilations ?? []).map((v) => ({ sectionId: v.sectionId, _sum: { debit: v.debit, credit: v.credit } }))),
        },
        ligneOdAnalytique: {
            groupBy: jest.fn(({ where }) => Promise.resolve(where?.od?.planId === 'p1'
                ? (options.od ?? []).map((v) => ({ sectionId: v.sectionId, _sum: { debit: v.debit, credit: v.credit } }))
                : [])),
        },
    };
    return new etats_analytiques_service_1.EtatsAnalytiquesService(prisma);
}
const NOMENCLATURE = [
    { id: 'r1', code: '1', intitule: 'Personnel', type: client_1.TypeCompteDetailTotal.TOTAL },
    { id: 's11', code: '11', intitule: 'Salaires', type: client_1.TypeCompteDetailTotal.DETAIL },
    { id: 's12', code: '12', intitule: 'Charges sociales', type: client_1.TypeCompteDetailTotal.DETAIL },
];
describe('État budgétaire · prévu, réalisé, écart', () => {
    it('REND LA RUBRIQUE, avec le budget et le réalisé de ses feuilles', async () => {
        const s = serviceAnalytique({
            sections: NOMENCLATURE,
            budgets: [
                { sectionId: 's11', montant: 800 },
                { sectionId: 's12', montant: 200 },
            ],
            ventilations: [
                { sectionId: 's11', debit: 600, credit: 0 },
                { sectionId: 's12', debit: 150, credit: 0 },
            ],
        });
        const etat = await s.etatBudgetaire('t1', { planId: 'p1', exerciceId: 'e1' });
        const personnel = etat.lignes.find((l) => l.code === '1');
        expect(personnel.estRubrique).toBe(true);
        expect(personnel.budget).toBe(1_000);
        expect(personnel.realise).toBe(750);
        expect(personnel.ecart).toBe(250);
    });
    it('le TOTAL ne double pas la rubrique', async () => {
        const s = serviceAnalytique({
            sections: NOMENCLATURE,
            budgets: [
                { sectionId: 's11', montant: 800 },
                { sectionId: 's12', montant: 200 },
            ],
            ventilations: [{ sectionId: 's11', debit: 600, credit: 0 }],
        });
        const etat = await s.etatBudgetaire('t1', { planId: 'p1', exerciceId: 'e1' });
        expect(etat.totaux.budget).toBe(1_000);
        expect(etat.totaux.realise).toBe(600);
    });
    it('une RUBRIQUE n’est jamais « hors budget » · le signalement appartient à la feuille', async () => {
        const s = serviceAnalytique({
            sections: NOMENCLATURE,
            budgets: [],
            ventilations: [{ sectionId: 's12', debit: 50, credit: 0 }],
        });
        const etat = await s.etatBudgetaire('t1', { planId: 'p1', exerciceId: 'e1' });
        const rubrique = etat.lignes.find((l) => l.code === '1');
        expect(rubrique.budget).toBe(0);
        expect(rubrique.realise).toBe(50);
        expect(rubrique.horsBudget).toBe(false);
        expect(etat.lignes.find((l) => l.code === '12').horsBudget).toBe(true);
    });
});
describe('Balance analytique', () => {
    it('totalise ses rubriques et ne les compte pas dans le total', async () => {
        const s = serviceAnalytique({
            sections: NOMENCLATURE,
            ventilations: [
                { sectionId: 's11', debit: 600, credit: 100 },
                { sectionId: 's12', debit: 150, credit: 0 },
            ],
        });
        const b = await s.balance('t1', { planId: 'p1', exerciceId: 'e1' });
        expect(b.lignes.find((l) => l.code === '1').debit).toBe(750);
        expect(b.lignes.find((l) => l.code === '1').credit).toBe(100);
        expect(b.totaux.debit).toBe(750);
        expect(b.totaux.solde).toBe(650);
    });
});
describe('OD analytiques dans les états analytiques', () => {
    it("DÉPLACE le réalisé d'une section à l'autre sans changer le total du plan", async () => {
        const s = serviceAnalytique({
            sections: NOMENCLATURE,
            budgets: [
                { sectionId: 's11', montant: 800 },
                { sectionId: 's12', montant: 200 },
            ],
            ventilations: [{ sectionId: 's11', debit: 600, credit: 0 }],
            od: [
                { sectionId: 's11', debit: 0, credit: 100 },
                { sectionId: 's12', debit: 100, credit: 0 },
            ],
        });
        const etat = await s.etatBudgetaire('t1', { planId: 'p1', exerciceId: 'e1' });
        expect(etat.lignes.find((l) => l.code === '11').realise).toBe(500);
        expect(etat.lignes.find((l) => l.code === '12').realise).toBe(100);
        expect(etat.totaux.realise).toBe(600);
        const balance = await s.balance('t1', { planId: 'p1', exerciceId: 'e1' });
        expect(balance.lignes.find((l) => l.code === '12').debit).toBe(100);
        expect(balance.totaux.solde).toBe(600);
    });
});
//# sourceMappingURL=rubriques-budgetaires.spec.js.map