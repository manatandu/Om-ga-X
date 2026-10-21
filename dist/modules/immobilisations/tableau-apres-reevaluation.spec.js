"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const D = (s) => new Date(`${s}T00:00:00.000Z`);
const EXERCICES = {
    ex2024: { id: 'ex2024', dateDebut: D('2024-01-01'), dateFin: D('2024-12-31') },
    ex2025: { id: 'ex2025', dateDebut: D('2025-01-01'), dateFin: D('2025-12-31') },
};
function service(reprises) {
    const batiment = {
        id: 'bat',
        designation: 'Bâtiment industriel',
        numeroInventaire: null,
        compteImmobilisationId: 'c2311',
        compteImmobilisation: { id: 'c2311', numero: '23110000', intitule: 'Bâtiments industriels' },
        compteEnCours: null,
        dateAcquisition: D('2020-01-01'),
        dateMiseEnService: D('2020-01-01'),
        valeurOrigine: 360_000_000,
        valeurResiduelle: 0,
        dureeAmortissementAns: 30,
        amortissementAnterieur: 0,
        amortissementsReevaluation: 10_000_000,
        modeAmortissement: 'LINEAIRE',
        statut: 'EN_SERVICE',
        dateSortie: null,
        dureeNonLimitee: false,
        dotations: [
            ...[2020, 2021, 2022, 2023, 2024].map((a) => ({ montant: 10_000_000, exerciceId: `ex${a}`, exercice: { dateFin: D(`${a}-12-31`) } })),
            { montant: 12_000_000, exerciceId: 'ex2025', exercice: { dateFin: D('2025-12-31') } },
        ],
        depreciations: [],
        consommationsUniteOeuvre: [],
        lignesReevaluation: [
            {
                coefficientRetenu: 1.2,
                brutAvant: 300_000_000,
                brutApres: 360_000_000,
                amortissementsAvant: 50_000_000,
                amortissementsApres: 60_000_000,
                reevaluation: { dateReevaluation: D('2024-12-31') },
            },
        ],
        ecritureSortieEcartReevaluation: null,
    };
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL }),
        },
        exercice: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.tenantId === 'tn' ? (EXERCICES[where.id] ?? null) : null)),
        },
        immobilisation: { findMany: jest.fn().mockResolvedValue([batiment]) },
        repriseProvisionReevaluation: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.tenantId === 'tn' ? (reprises.find((r) => r.exerciceId === where.exerciceId) ?? null) : null)),
        },
    };
    return new immobilisation_service_1.ImmobilisationService(prisma, {});
}
describe('A15 · tableau des amortissements après réévaluation (art. 135)', () => {
    it('l’exercice suivant · cumul d’ouverture 60 000 000, annuité 12 000 000 dont 2 000 000 de supplément, reprise de l’exercice 2 000 000', async () => {
        const t = await service([{ exerciceId: 'ex2025', detail: [{ immobilisationId: 'bat', montant: 2_000_000 }] }]).tableauAmortissements('tn', 'ex2025');
        const l = t.groupes[0].lignes[0];
        expect(l).toMatchObject({
            valeurBrute: 360_000_000,
            cumulN1: 60_000_000,
            dotation: 12_000_000,
            cumulN: 72_000_000,
            valeurNette: 288_000_000,
            ajustementReevaluation: 0,
            reevaluation: { produitAnterieur: 1.2, supplement: 2_000_000, repriseEcart: 2_000_000 },
        });
        expect(t.totaux).toMatchObject({ supplementReevaluation: 2_000_000, repriseEcart: 2_000_000 });
    });
    it('l’exercice de la réévaluation, relu après · cumul d’ouverture 40 000 000 (sans la hausse de clôture), la hausse portée à part, net 300 000 000', async () => {
        const t = await service([]).tableauAmortissements('tn', 'ex2024');
        const l = t.groupes[0].lignes[0];
        expect(l).toMatchObject({
            valeurBrute: 360_000_000,
            cumulN1: 40_000_000,
            dotation: 10_000_000,
            ajustementReevaluation: 10_000_000,
            cumulN: 60_000_000,
            valeurNette: 300_000_000,
            reevaluation: { produitAnterieur: 1, supplement: 0, repriseEcart: 0 },
        });
        expect(t.totaux.ajustementReevaluation).toBe(10_000_000);
    });
});
//# sourceMappingURL=tableau-apres-reevaluation.spec.js.map