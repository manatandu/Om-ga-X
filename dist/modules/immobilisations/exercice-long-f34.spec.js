"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const amortissement_degressif_1 = require("./amortissement-degressif");
const mois_entre_1 = require("../../common/mois-entre");
const LONG = { dateDebut: '2025-07-01', dateFin: '2026-12-31' };
async function dotation(c) {
    const exercice = c.exercice ?? LONG;
    let montant = 0;
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: c.smt ? client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE : client_1.SystemeComptableSyscohada.NORMAL,
                jeuEtatsFinanciersSycebnl: null,
            }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'i1',
                designation: 'Camion',
                statut: 'EN_SERVICE',
                valeurOrigine: 12_000_000,
                valeurResiduelle: 0,
                dureeAmortissementAns: 5,
                dateMiseEnService: new Date(c.dateMiseEnService),
                amortissementAnterieur: c.amortissementAnterieur ?? 0,
                modeAmortissement: 'LINEAIRE',
                compteDotationId: 'cd',
                compteAmortissementId: 'ca',
                compteImmobilisation: { numero: '24510000' },
                dotations: [],
                depreciations: [],
            }),
        },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'exN',
                dateDebut: new Date(exercice.dateDebut),
                dateFin: new Date(exercice.dateFin),
            }),
        },
        dotationAmortissement: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'd1' }),
        },
        ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma.$transaction = jest.fn((f) => f(prisma));
    prisma.$queryRaw = jest.fn().mockResolvedValue([]);
    const ecritures = {
        creer: jest.fn().mockImplementation((_t, _u, dto) => {
            montant = dto.lignes[0].debit ?? 0;
            return Promise.resolve({ id: 'e1' });
        }),
    };
    const svc = new immobilisation_service_1.ImmobilisationService(prisma, ecritures);
    await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' });
    return Math.round(montant * 100) / 100;
}
describe('F34 · le décompte des mois, écrit une fois', () => {
    it('compte les mois traversés, bornes comprises, sans plafond', () => {
        expect((0, mois_entre_1.moisEntre)(new Date('2026-01-01'), new Date('2026-12-31'))).toBe(12);
        expect((0, mois_entre_1.moisEntre)(new Date('2025-07-01'), new Date('2026-12-31'))).toBe(18);
        expect((0, mois_entre_1.moisEntre)(new Date('2026-03-15'), new Date('2026-04-02'))).toBe(2);
        expect((0, mois_entre_1.moisEntre)(new Date('2026-05-01'), new Date('2026-04-30'))).toBe(0);
    });
});
describe('F34 · la dotation comptable suit la durée de l’exercice', () => {
    it('un bien en service dès l’ouverture d’un exercice de dix-huit mois reçoit dix-huit douzièmes', async () => {
        expect(await dotation({ dateMiseEnService: '2025-07-10' })).toBe(3_600_000);
    });
    it('mis en service en mars de la seconde année, de mars à décembre · dix mois', async () => {
        expect(await dotation({ dateMiseEnService: '2026-03-20' })).toBe(2_000_000);
    });
    it('un bien repris dote aussi la période entière, bornée au reliquat', async () => {
        expect(await dotation({ dateMiseEnService: '2020-01-01', amortissementAnterieur: 6_000_000 })).toBe(3_600_000);
        expect(await dotation({ dateMiseEnService: '2020-01-01', amortissementAnterieur: 10_000_000 })).toBe(2_000_000);
    });
    it('un exercice civil garde ses douze mois', async () => {
        expect(await dotation({ dateMiseEnService: '2020-01-01', amortissementAnterieur: 1, exercice: { dateDebut: '2027-01-01', dateFin: '2027-12-31' } })).toBe(2_400_000);
    });
    it('au SMT SYSCOHADA, « sans prorata temporis » garde une annuité par exercice', async () => {
        expect(await dotation({ dateMiseEnService: '2025-07-10', smt: true })).toBe(2_400_000);
    });
});
describe('F34 · le plan fiscal dégressif compte ses périodes imposables', () => {
    const exercices = [
        { id: 'ex1', dateDebut: new Date('2025-07-01'), dateFin: new Date('2026-12-31') },
        { id: 'ex2', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') },
    ];
    it('un exercice de dix-huit mois reçoit deux annuités, la première proratisée', () => {
        const plan = (0, amortissement_degressif_1.planFiscalDegressif)({ base: 10_000_000, dureeFiscaleAns: 5, dateMiseEnService: new Date('2025-07-01'), exercices });
        expect(plan[0]).toMatchObject({ exerciceId: 'ex1', valeurResiduelleDebut: 10_000_000, annuite: 5_200_000 });
        expect(plan[1]).toMatchObject({ exerciceId: 'ex2', valeurResiduelleDebut: 4_800_000, annuite: 1_920_000 });
    });
    it('la bascule en linéaire de l’art. 35 se compte depuis la mise en service, par période', () => {
        const suite = [2028, 2029, 2030].map((a) => ({ id: `ex${a}`, dateDebut: new Date(`${a}-01-01`), dateFin: new Date(`${a}-12-31`) }));
        const plan = (0, amortissement_degressif_1.planFiscalDegressif)({
            base: 10_000_000,
            dureeFiscaleAns: 5,
            dateMiseEnService: new Date('2025-07-01'),
            exercices: [...exercices, ...suite],
        });
        expect(plan.find((l) => l.exerciceId === 'ex2029')).toMatchObject({ annuite: 1_152_000, mode: 'LINEAIRE_ART_35' });
        expect(plan.find((l) => l.exerciceId === 'ex2030')).toMatchObject({ annuite: 576_000, mode: 'LINEAIRE_ART_35' });
        expect(plan.reduce((t, l) => t + l.annuite, 0)).toBeCloseTo(10_000_000, 2);
    });
    it('mis en service pendant la seconde période, une seule annuité, proratisée dans son année', () => {
        const plan = (0, amortissement_degressif_1.planFiscalDegressif)({ base: 10_000_000, dureeFiscaleAns: 5, dateMiseEnService: new Date('2026-04-15'), exercices });
        expect(plan[0]).toMatchObject({ exerciceId: 'ex1', annuite: 3_000_000 });
    });
    it('un exercice civil garde une seule période', () => {
        const plan = (0, amortissement_degressif_1.planFiscalDegressif)({
            base: 10_000_000,
            dureeFiscaleAns: 5,
            dateMiseEnService: new Date('2027-01-01'),
            exercices: [exercices[1]],
        });
        expect(plan).toEqual([{ exerciceId: 'ex2', valeurResiduelleDebut: 10_000_000, annuite: 4_000_000, mode: 'DEGRESSIF' }]);
    });
});
//# sourceMappingURL=exercice-long-f34.spec.js.map