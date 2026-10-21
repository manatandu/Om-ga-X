"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const analytique_service_1 = require("./analytique.service");
function service(prisma) {
    return new analytique_service_1.AnalytiqueService(prisma);
}
describe('budget · répartition sur les mois couverts par la convention', () => {
    const exercice = { id: 'ex1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
    function prismaAvecSection(section) {
        const creees = [];
        return {
            creees,
            prisma: {
                sectionAnalytique: { findFirst: jest.fn().mockResolvedValue(section) },
                exercice: { findFirst: jest.fn().mockResolvedValue(exercice) },
                budgetSection: { findMany: jest.fn().mockResolvedValue([]) },
                $transaction: jest.fn(async (fn) => {
                    await fn({
                        budgetSection: {
                            deleteMany: jest.fn(),
                            create: jest.fn(),
                            createMany: jest.fn(({ data }) => {
                                creees.push(...data);
                                return Promise.resolve();
                            }),
                        },
                    });
                }),
            },
        };
    }
    it('sans convention, répartit sur les douze mois de l’exercice', async () => {
        const { prisma, creees } = prismaAvecSection({
            id: 's1',
            tenantId: 't1',
            type: 'DETAIL',
            dateDebut: null,
            dateFin: null,
            plan: { gererBudgets: true, code: 'PROJ' },
        });
        await service(prisma).doterBudget('t1', 's1', { exerciceId: 'ex1', montantAnnuel: 1200 });
        expect(creees).toHaveLength(12);
        expect(creees.map((c) => c.mois)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(creees.every((c) => Number(c.montant) === 100)).toBe(true);
    });
    it('convention de huit mois : huit dotations, pas douze', async () => {
        const { prisma, creees } = prismaAvecSection({
            id: 's1',
            tenantId: 't1',
            type: 'DETAIL',
            dateDebut: new Date('2026-03-01'),
            dateFin: new Date('2026-10-31'),
            plan: { gererBudgets: true, code: 'PROJ' },
        });
        await service(prisma).doterBudget('t1', 's1', { exerciceId: 'ex1', montantAnnuel: 800 });
        expect(creees).toHaveLength(8);
        expect(creees.map((c) => c.mois)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
        expect(creees.every((c) => Number(c.montant) === 100)).toBe(true);
    });
    it('le reliquat d’arrondi tombe sur le dernier mois, la somme reste exacte', async () => {
        const { prisma, creees } = prismaAvecSection({
            id: 's1',
            tenantId: 't1',
            type: 'DETAIL',
            dateDebut: null,
            dateFin: null,
            plan: { gererBudgets: true, code: 'PROJ' },
        });
        await service(prisma).doterBudget('t1', 's1', { exerciceId: 'ex1', montantAnnuel: 1000 });
        const somme = creees.reduce((t, c) => t + Number(c.montant), 0);
        expect(Math.round(somme * 100) / 100).toBe(1000);
        expect(Number(creees[11].montant)).toBeCloseTo(83.37, 2);
    });
    it('refuse de doter une section Total', async () => {
        const { prisma } = prismaAvecSection({
            id: 's1',
            tenantId: 't1',
            type: 'TOTAL',
            dateDebut: null,
            dateFin: null,
            plan: { gererBudgets: true, code: 'PROJ' },
        });
        await expect(service(prisma).doterBudget('t1', 's1', { exerciceId: 'ex1', montantAnnuel: 1000 })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse quand la convention ne recouvre aucun mois de l’exercice', async () => {
        const { prisma } = prismaAvecSection({
            id: 's1',
            tenantId: 't1',
            type: 'DETAIL',
            dateDebut: new Date('2027-01-01'),
            dateFin: new Date('2027-12-31'),
            plan: { gererBudgets: true, code: 'PROJ' },
        });
        await expect(service(prisma).doterBudget('t1', 's1', { exerciceId: 'ex1', montantAnnuel: 1000 })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
});
describe('ventilation · équilibre par plan', () => {
    const ligne = {
        id: 'l1',
        debit: 1000,
        credit: 0,
        compte: { numero: '60410000', classe: 'CLASSE_6' },
    };
    const sections = [
        { id: 'sA', planId: 'p1', code: 'EAU', type: 'DETAIL', estActive: true, plan: { code: 'PROJ', classesVentilees: '2,6,7' } },
        { id: 'sB', planId: 'p1', code: 'SANTE', type: 'DETAIL', estActive: true, plan: { code: 'PROJ', classesVentilees: '2,6,7' } },
        { id: 'sC', planId: 'p2', code: 'UE', type: 'DETAIL', estActive: true, plan: { code: 'BAIL', classesVentilees: '2,6,7' } },
    ];
    const ecritureDeLigne = { date: new Date('2026-03-01'), journalId: 'jACH', journal: { code: 'ACH' }, exercice: { statut: 'OUVERT' } };
    function prisma(sectionsRenvoyees = sections, clotures = []) {
        return {
            ligneEcriture: {
                findFirst: jest.fn().mockResolvedValue(ligne),
                findMany: jest.fn().mockResolvedValue([{ id: 'l1', ecriture: ecritureDeLigne }]),
            },
            cloture: { findMany: jest.fn().mockResolvedValue(clotures) },
            sectionAnalytique: {
                findMany: jest.fn(({ where }) => Promise.resolve(sectionsRenvoyees.filter((s) => where.id.in.includes(s.id)))),
            },
            ventilationAnalytique: { findMany: jest.fn().mockResolvedValue([]) },
            $transaction: jest.fn(async (fn) => {
                await fn({
                    ventilationAnalytique: { deleteMany: jest.fn(), createMany: jest.fn() },
                });
            }),
        };
    }
    it('accepte une dépense partagée entre deux projets du même plan', async () => {
        await expect(service(prisma()).ventilerLigne('t1', 'l1', [
            { sectionId: 'sA', debit: 600 },
            { sectionId: 'sB', debit: 400 },
        ])).resolves.toBeDefined();
    });
    it('accepte deux plans à la fois, chacun couvrant la ligne en totalité', async () => {
        await expect(service(prisma()).ventilerLigne('t1', 'l1', [
            { sectionId: 'sA', debit: 1000 },
            { sectionId: 'sC', debit: 1000 },
        ])).resolves.toBeDefined();
    });
    it('refuse une ligne à moitié ventilée sur un plan', async () => {
        await expect(service(prisma()).ventilerLigne('t1', 'l1', [{ sectionId: 'sA', debit: 600 }])).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse une section Total', async () => {
        const totales = [{ ...sections[0], type: 'TOTAL' }];
        await expect(service(prisma(totales)).ventilerLigne('t1', 'l1', [{ sectionId: 'sA', debit: 1000 }])).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse de ventiler, et d’effacer la ventilation, sur une ligne d’un journal clôturé totalement', async () => {
        const totale = [{ granularite: 'TOTALE', journalId: 'jACH', dateLimite: new Date('2026-12-31') }];
        const p = prisma(sections, totale);
        p.ventilationAnalytique.deleteMany = jest.fn();
        await expect(service(p).ventilerLigne('t1', 'l1', [{ sectionId: 'sA', debit: 1000 }])).rejects.toThrow(/ventiler.*clôturé totalement/);
        await expect(service(p).effacerVentilation('t1', 'l1')).rejects.toThrow(/Impossible d'effacer la ventilation/);
        expect(p.ventilationAnalytique.deleteMany).not.toHaveBeenCalled();
        expect(p.$transaction).not.toHaveBeenCalled();
    });
    it('une clôture PARTIELLE laisse ventiler · Sage i7 le dit en toutes lettres', async () => {
        const partielle = [{ granularite: 'PARTIELLE', journalId: 'jACH', dateLimite: new Date('2026-12-31') }];
        await expect(service(prisma(sections, partielle)).ventilerLigne('t1', 'l1', [{ sectionId: 'sA', debit: 1000 }])).resolves.toBeDefined();
    });
    it('refuse une section en sommeil', async () => {
        const dormantes = [{ ...sections[0], estActive: false }];
        await expect(service(prisma(dormantes)).ventilerLigne('t1', 'l1', [{ sectionId: 'sA', debit: 1000 }])).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('F141 · refuse une ligne dont la classe n’est pas ventilée par le plan', async () => {
        const plansDeCharges = sections.map((s) => ({ ...s, plan: { ...s.plan, classesVentilees: '6,7' } }));
        const p = prisma(plansDeCharges);
        p.ligneEcriture.findFirst.mockResolvedValue({ ...ligne, compte: { numero: '24410000', classe: 'CLASSE_2' } });
        await expect(service(p).ventilerLigne('t1', 'l1', [{ sectionId: 'sA', debit: 1000 }])).rejects.toThrow(/Plan PROJ/);
    });
    it('F141 · refuse un montant négatif, même quand la somme équilibre', async () => {
        await expect(service(prisma()).ventilerLigne('t1', 'l1', [
            { sectionId: 'sA', debit: 1500 },
            { sectionId: 'sB', debit: -500 },
        ])).rejects.toThrow(/négatif/);
    });
    it('F141 · refuse une ventilation portée au débit ET au crédit', async () => {
        await expect(service(prisma()).ventilerLigne('t1', 'l1', [{ sectionId: 'sA', debit: 1000, credit: 1000 }])).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
});
describe('ventilation obligatoire', () => {
    function prisma(plans) {
        return {
            planAnalytique: { findMany: jest.fn().mockResolvedValue(plans) },
            compte: {
                findMany: jest.fn().mockResolvedValue([{ id: 'c1', numero: '60410000', classe: 'CLASSE_6' }]),
            },
            sectionAnalytique: { findMany: jest.fn().mockResolvedValue([{ id: 'sA', planId: 'p1' }]) },
        };
    }
    it('ne dit rien quand aucun plan n’est obligatoire', async () => {
        await expect(service(prisma([])).verifierVentilationObligatoire('t1', [{ compteId: 'c1' }])).resolves.toBeUndefined();
    });
    it('refuse une charge non ventilée quand le plan l’exige', async () => {
        const plans = [{ id: 'p1', code: 'PROJ', classesVentilees: '2,6,7,9' }];
        await expect(service(prisma(plans)).verifierVentilationObligatoire('t1', [{ compteId: 'c1' }])).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('laisse passer une classe hors périmètre du plan', async () => {
        const plans = [{ id: 'p1', code: 'PROJ', classesVentilees: '2,7' }];
        await expect(service(prisma(plans)).verifierVentilationObligatoire('t1', [{ compteId: 'c1' }])).resolves.toBeUndefined();
    });
});
//# sourceMappingURL=analytique.service.spec.js.map