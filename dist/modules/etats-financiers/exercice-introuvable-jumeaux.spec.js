"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const exercice_introuvable_1 = require("../../common/exercice-introuvable");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const immobilisation_service_1 = require("../immobilisations/immobilisation.service");
const etats_financiers_projet_budget_service_1 = require("./etats-financiers-projet-budget.service");
const etats_financiers_projet_service_1 = require("./etats-financiers-projet.service");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const EXERCICE = {
    id: 'e1',
    tenantId: 't1',
    dateDebut: new Date('2026-01-01T00:00:00Z'),
    dateFin: new Date('2026-12-31T00:00:00Z'),
};
const COMPTE = { id: 'c1', tenantId: 't1', numero: '47100000', intitule: 'Débiteurs divers' };
function p2025(modele) {
    return new client_1.Prisma.PrismaClientKnownRequestError(`No ${modele} found`, { code: 'P2025', clientVersion: '5' });
}
function prismaFactice(avecPlan) {
    const exercice = ({ where }) => where.id !== undefined
        ? where.id === EXERCICE.id && where.tenantId === EXERCICE.tenantId
            ? EXERCICE
            : null
        : where.tenantId === EXERCICE.tenantId
            ? EXERCICE
            : null;
    return {
        exercice: {
            findFirst: jest.fn().mockImplementation((a) => Promise.resolve(exercice(a))),
            findFirstOrThrow: jest.fn().mockImplementation((a) => {
                const e = exercice(a);
                return e ? Promise.resolve(e) : Promise.reject(p2025('Exercice'));
            }),
        },
        compte: {
            findFirst: jest
                .fn()
                .mockImplementation(({ where }) => Promise.resolve(where.id === COMPTE.id && where.tenantId === COMPTE.tenantId ? COMPTE : null)),
            findFirstOrThrow: jest.fn().mockImplementation(({ where }) => where.id === COMPTE.id && where.tenantId === COMPTE.tenantId ? Promise.resolve(COMPTE) : Promise.reject(p2025('Compte'))),
            findMany: jest.fn().mockResolvedValue([]),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYCEBNL,
                systemeComptableSyscohada: null,
                jeuEtatsFinanciersSycebnl: 'PROJETS',
            }),
        },
        planAnalytique: {
            findFirst: jest
                .fn()
                .mockImplementation(({ where }) => Promise.resolve(avecPlan && where.tenantId === 't1' ? { id: 'p1', tenantId: 't1' } : null)),
        },
    };
}
function ecritures(prisma) {
    return new ecriture_service_1.EcritureService(prisma, {}, {}, {});
}
const CAS = [
    ['l’exercice d’un AUTRE dossier', 't2', 'e1'],
    ['un exercice inconnu', 't1', 'inconnu'],
];
async function attendreLeRefus(appel) {
    const refus = await appel.then(() => null, (e) => e);
    expect(refus).toBeInstanceOf(common_1.NotFoundException);
    expect(refus.message).toBe(exercice_introuvable_1.MOTIF_EXERCICE_INTROUVABLE);
}
describe('exercice inconnu du dossier · les jumeaux de F222', () => {
    it('le porteur rend l’exercice lu, refuse l’absence, et les états réexportent le même motif', () => {
        expect((0, exercice_introuvable_1.exerciceDuDossierOuRefus)(EXERCICE)).toBe(EXERCICE);
        expect(() => (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(null)).toThrow(common_1.NotFoundException);
        expect(() => (0, exercice_introuvable_1.exerciceDuDossierOuRefus)(null)).toThrow(exercice_introuvable_1.MOTIF_EXERCICE_INTROUVABLE);
        expect(etats_financiers_communs_1.MOTIF_EXERCICE_INTROUVABLE).toBe(exercice_introuvable_1.MOTIF_EXERCICE_INTROUVABLE);
    });
    describe.each(CAS)('%s', (_libelle, tenantId, exerciceId) => {
        it('la balance âgée est un 404 nommé', async () => {
            await attendreLeRefus(ecritures(prismaFactice(true)).balanceAgee(tenantId, { exerciceId }));
        });
        it('le justificatif de solde est un 404 nommé', async () => {
            await attendreLeRefus(ecritures(prismaFactice(true)).justificatifSolde(tenantId, { compteId: COMPTE.id, exerciceId }));
        });
        it('la balance cumulée est un 404 nommé', async () => {
            await attendreLeRefus(ecritures(prismaFactice(true)).balanceCumulee(tenantId, exerciceId));
        });
        it('la Note 9 des fonds du bailleur, qui lit la balance cumulée, est un 404 nommé', async () => {
            const prisma = prismaFactice(true);
            const projet = new etats_financiers_projet_service_1.EtatsFinanciersProjetService(ecritures(prisma), {}, prisma);
            await attendreLeRefus(projet.noteBailleur(tenantId, exerciceId));
        });
        it('le tableau des amortissements est un 404 nommé', async () => {
            const prisma = prismaFactice(true);
            await attendreLeRefus(new immobilisation_service_1.ImmobilisationService(prisma, ecritures(prisma)).tableauAmortissements(tenantId, exerciceId));
        });
        it('le tableau d’exécution budgétaire est un 404 nommé quand le plan à budgets existe', async () => {
            const prisma = prismaFactice(true);
            const budget = new etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService(ecritures(prisma), prisma, {});
            await attendreLeRefus(budget.executionBudgetaire(tenantId, exerciceId));
        });
        it('le tableau d’exécution budgétaire est un 404 nommé, et PAS « aucun plan à budgets », quand le plan manque', async () => {
            const prisma = prismaFactice(false);
            const budget = new etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService(ecritures(prisma), prisma, {});
            const refus = await budget.executionBudgetaire(tenantId, exerciceId).catch((e) => e);
            expect(refus).not.toBeInstanceOf(etats_financiers_projet_budget_service_1.AucunPlanABudgetsException);
            await attendreLeRefus(Promise.reject(refus));
        });
        it('le tableau de réconciliation de trésorerie est un 404 nommé', async () => {
            const prisma = prismaFactice(true);
            const budget = new etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService(ecritures(prisma), prisma, {});
            await attendreLeRefus(budget.reconciliationTresorerie(tenantId, exerciceId));
        });
    });
    it('le justificatif d’un compte d’un autre dossier est un 404 nommé, l’exercice étant du dossier', async () => {
        const refus = await ecritures(prismaFactice(true))
            .justificatifSolde('t1', { compteId: 'compte-voisin', exerciceId: EXERCICE.id })
            .catch((e) => e);
        expect(refus).toBeInstanceOf(common_1.NotFoundException);
        expect(refus.message).toMatch(/^Compte introuvable dans ce dossier/);
    });
});
//# sourceMappingURL=exercice-introuvable-jumeaux.spec.js.map