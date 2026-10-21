"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
async function dotation(c) {
    const exercice = c.exercice ?? { dateDebut: '2026-01-01', dateFin: '2026-12-31' };
    let montant = 0;
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(c.regime ?? {
                referentiel: client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
            }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'i1',
                designation: 'Bien',
                statut: 'EN_SERVICE',
                valeurOrigine: c.valeurOrigine,
                valeurResiduelle: c.valeurResiduelle ?? 0,
                dureeAmortissementAns: c.dureeAns,
                dateMiseEnService: new Date(c.dateMiseEnService),
                amortissementAnterieur: c.amortissementAnterieur ?? 0,
                compteDotationId: 'cd',
                compteAmortissementId: 'ca',
                compteImmobilisation: { numero: '24510000' },
                dotations: (c.dotations ?? []).map((m, i) => ({ montant: m, exerciceId: `ex${i}` })),
                depreciations: c.depreciations ?? [],
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
describe('Amortissement antérieur d’un bien repris', () => {
    const BIEN = { valeurOrigine: 5_000_000, dureeAns: 5, dateMiseEnService: '2020-04-10' };
    it('sans lui, le bien repart pour une durée ENTIÈRE · le défaut', async () => {
        const m = await dotation(BIEN);
        expect(m).toBe(1_000_000);
    });
    it('avec lui, le reliquat seul est doté', async () => {
        const m = await dotation({ ...BIEN, amortissementAnterieur: 4_000_000 });
        expect(m).toBe(1_000_000);
    });
    it('et le bien entièrement amorti ne dote plus rien', async () => {
        await expect(dotation({ ...BIEN, amortissementAnterieur: 5_000_000 })).rejects.toThrow(/déjà entièrement amorti/);
    });
    it('le reliquat est PLAFONNÉ · on ne dote jamais au-delà de ce qui reste', async () => {
        const m = await dotation({ ...BIEN, amortissementAnterieur: 4_600_000 });
        expect(m).toBe(400_000);
    });
    it('ferme la porte au PRORATA de première annuité', async () => {
        const proratise = await dotation({ ...BIEN, dateMiseEnService: '2026-10-05' });
        expect(proratise).toBe(250_000);
        const repris = await dotation({
            ...BIEN,
            dateMiseEnService: '2020-10-05',
            amortissementAnterieur: 1_000_000,
        });
        expect(repris).toBe(1_000_000);
    });
    it('s’ajoute aux dotations déjà passées dans le logiciel', async () => {
        const m = await dotation({ ...BIEN, amortissementAnterieur: 3_000_000, dotations: [1_000_000] });
        expect(m).toBe(1_000_000);
        const solde = await dotation({
            ...BIEN,
            amortissementAnterieur: 3_000_000,
            dotations: [1_000_000, 800_000],
        });
        expect(solde).toBe(200_000);
    });
    it('tient compte de la valeur résiduelle · la base amortissable, pas la valeur d’origine', async () => {
        const m = await dotation({ ...BIEN, valeurResiduelle: 500_000, amortissementAnterieur: 3_600_000 });
        expect(m).toBe(900_000);
    });
});
describe('SMT SYSCOHADA · l’amortissement se fait sans prorata temporis', () => {
    const MATERIEL = { valeurOrigine: 1_200_000, dureeAns: 5, dateMiseEnService: '2026-10-01' };
    const SMT = {
        referentiel: client_1.Referentiel.SYSCOHADA,
        systemeComptableSyscohada: client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE,
    };
    it('dote l’année ENTIÈRE la première année, quelle que soit la date d’acquisition', async () => {
        expect(await dotation({ ...MATERIEL, regime: SMT })).toBe(240_000);
    });
    it('le Système normal garde le prorata · c’est la règle de l’art. 45', async () => {
        expect(await dotation({
            ...MATERIEL,
            regime: { referentiel: client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL },
        })).toBe(60_000);
    });
    it('un dossier SYCEBNL garde le prorata · sa Partie 4 ch. 4 n’est pas encodée', async () => {
        expect(await dotation({
            ...MATERIEL,
            regime: { referentiel: client_1.Referentiel.SYCEBNL, systemeComptableSyscohada: null },
        })).toBe(60_000);
    });
    it('n’invente aucune dotation d’avance · un bien entré APRÈS la clôture ne dote rien', async () => {
        await expect(dotation({
            ...MATERIEL,
            dateMiseEnService: '2027-03-01',
            exercice: { dateDebut: '2026-01-01', dateFin: '2026-12-31' },
            regime: SMT,
        })).rejects.toThrow(/déjà entièrement amorti ou hors période/);
    });
    it('la deuxième annuité est pleine dans les deux systèmes · seule la première changeait', async () => {
        expect(await dotation({ ...MATERIEL, dotations: [240_000], regime: SMT })).toBe(240_000);
        expect(await dotation({
            ...MATERIEL,
            dotations: [60_000],
            regime: { referentiel: client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL },
        })).toBe(240_000);
    });
});
//# sourceMappingURL=amortissement-anterieur.spec.js.map