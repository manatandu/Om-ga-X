"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const analytique_service_1 = require("./analytique.service");
const exercice_service_1 = require("../exercice/exercice.service");
function prismaSuppression(usages = {}) {
    const ops = [];
    const compteur = (n, champ) => jest.fn(({ where }) => {
        const v = where[champ];
        const vise = v === 's1' || (typeof v === 'object' && v !== null && v.in?.includes('s1')) || v === 'p1';
        return Promise.resolve(vise ? (n ?? 0) : 0);
    });
    const tx = {
        budgetSection: { deleteMany: jest.fn(() => (ops.push('budgets'), Promise.resolve({ count: 1 }))) },
        sectionAnalytique: {
            delete: jest.fn(() => (ops.push('section'), Promise.resolve({}))),
            deleteMany: jest.fn(() => (ops.push('sections'), Promise.resolve({ count: 1 }))),
        },
        planAnalytique: { delete: jest.fn(() => (ops.push('plan'), Promise.resolve({}))) },
    };
    const prisma = {
        sectionAnalytique: {
            findFirst: jest.fn().mockResolvedValue({ id: 's1', code: 'EAU', plan: { code: 'PROJ' } }),
            findMany: jest.fn().mockResolvedValue([{ id: 's1', code: 'EAU' }]),
            delete: tx.sectionAnalytique.delete,
            deleteMany: tx.sectionAnalytique.deleteMany,
            count: jest.fn().mockResolvedValue(0),
        },
        planAnalytique: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', code: 'PROJ' }), delete: tx.planAnalytique.delete },
        engagementDepense: { count: compteur(usages.engagements, 'sectionId') },
        ventilationAnalytique: { count: compteur(usages.ventilations, 'sectionId') },
        ligneOdAnalytique: { count: compteur(usages.lignesOd, 'sectionId') },
        odAnalytique: { count: compteur(usages.ods, 'planId') },
        cleRepartition: { count: compteur(usages.cles, 'sectionSourceId') },
        ligneCleRepartition: { count: compteur(undefined, 'sectionCibleId') },
        coutProductionDeclare: { count: compteur(undefined, 'sectionId') },
        ligneRepartitionAnalytiquePaie: { count: compteur(usages.repartitionsPaie, 'sectionId') },
        repartitionAnalytiquePaie: { count: compteur(undefined, 'planId') },
        pieceJointeSection: {
            count: compteur(usages.documents, 'sectionId'),
            groupBy: jest.fn(({ where }) => Promise.resolve(usages.documents && where.sectionId.in.includes('s1') ? [{ sectionId: 's1' }] : [])),
        },
        budgetSection: {
            deleteMany: tx.budgetSection.deleteMany,
            count: jest.fn(({ where }) => Promise.resolve(where.exercice?.statut === 'CLOTURE' ? (usages.budgetsClos ?? 0) : 0)),
        },
        $transaction: jest.fn(async (fn) => fn(tx)),
    };
    return { prisma, ops };
}
const service = (prisma) => new analytique_service_1.AnalytiqueService(prisma);
describe('F142 · une section utilisée ne se supprime pas, et le refus la nomme', () => {
    it('un engagement retient la section · rien n’est effacé, budgets compris', async () => {
        const { prisma, ops } = prismaSuppression({ engagements: 1 });
        await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(/section EAU.*engagements de dépense \(1\)/);
        expect(ops).toEqual([]);
    });
    it('les ventilations et les lignes d’OD aussi, chacune par son nom', async () => {
        const { prisma } = prismaSuppression({ ventilations: 2, lignesOd: 1 });
        await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(/ventilations analytiques \(2\).*lignes d'OD analytique \(1\)|lignes d'OD analytique \(1\).*ventilations analytiques \(2\)/);
    });
    it('une clé de répartition retient la section qu’elle répartit (ligne A20), et le refus la nomme', async () => {
        const { prisma } = prismaSuppression({ cles: 1 });
        await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(/clés de répartition \(section répartie\) \(1\)/);
    });
    it('une répartition analytique de la paie retient sa section (ligne sage-l5, fonction 88), et le refus la nomme', async () => {
        const { prisma, ops } = prismaSuppression({ repartitionsPaie: 2 });
        await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(/répartitions analytiques de la paie \(2\)/);
        expect(ops).toEqual([]);
    });
    it('un document joint retient la section (ligne sage-l6, fonction n° 22), et le refus le nomme', async () => {
        const { prisma, ops } = prismaSuppression({ documents: 2 });
        await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(/documents joints \(volet Documents de la section\) \(2\)/);
        expect(ops).toEqual([]);
    });
    it('libre, la section part avec ses budgets, dans une seule transaction', async () => {
        const { prisma, ops } = prismaSuppression();
        await expect(service(prisma).supprimerSection('t1', 's1')).resolves.toEqual({ supprime: true });
        expect(ops).toEqual(['budgets', 'section']);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
    it('un plan dont une section est engagée ne se supprime pas non plus', async () => {
        const { prisma, ops } = prismaSuppression({ engagements: 3 });
        await expect(service(prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(/plan PROJ.*engagements de dépense \(3\)/);
        expect(ops).toEqual([]);
    });
    it('un plan qui porte des OD se nomme aussi', async () => {
        const { prisma } = prismaSuppression({ ods: 1 });
        await expect(service(prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(/OD analytiques \(1\)/);
    });
    it('un plan dont une section porte un document NOMME la section (relecture sage-l6, mineur 5)', async () => {
        const { prisma, ops } = prismaSuppression({ documents: 2 });
        await expect(service(prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(/Sections qui portent un document \(1\) · EAU\. Retirez-les depuis le volet Documents de chaque section, ou mettez le plan en sommeil\./);
        expect(ops).toEqual([]);
    });
    it('au-delà de vingt sections porteuses, vingt codes et le total dit', async () => {
        const { prisma } = prismaSuppression({ documents: 1 });
        const sections = Array.from({ length: 23 }, (_, i) => ({ id: `s${i + 1}`, code: `S${String(i + 1).padStart(2, '0')}` }));
        prisma.sectionAnalytique.findMany.mockResolvedValue(sections);
        prisma.pieceJointeSection.groupBy.mockResolvedValue(sections.map((x) => ({ sectionId: x.id })));
        await expect(service(prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(/Sections qui portent un document \(23\) · S01, S02,.* S20 et 3 autre\(s\)\./);
    });
    it('un document joint PENDANT la suppression · 409 nommé, jamais une erreur technique (mineur 4)', async () => {
        const fk = new client_1.Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', { code: 'P2003', clientVersion: 'x' });
        const plan = prismaSuppression();
        plan.prisma.planAnalytique.delete.mockRejectedValueOnce(fk);
        await expect(service(plan.prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(/Le plan PROJ a reçu un usage .* pendant sa suppression/);
        const section = prismaSuppression();
        section.prisma.sectionAnalytique.delete.mockRejectedValueOnce(fk);
        await expect(service(section.prisma).supprimerSection('t1', 's1')).rejects.toBeInstanceOf(common_1.ConflictException);
        const retiree = prismaSuppression();
        retiree.prisma.sectionAnalytique.delete.mockRejectedValueOnce(new client_1.Prisma.PrismaClientKnownRequestError('Record to delete does not exist.', { code: 'P2025', clientVersion: 'x' }));
        await expect(service(retiree.prisma).supprimerSection('t1', 's1')).rejects.toThrow(/Un autre geste a déjà supprimé la section EAU/);
    });
    it('un plan libre part avec ses sections, dans une seule transaction', async () => {
        const { prisma, ops } = prismaSuppression();
        await expect(service(prisma).supprimerPlan('t1', 'p1')).resolves.toEqual({ supprime: true });
        expect(ops).toEqual(['sections', 'plan']);
    });
});
describe('F143 · un exercice clôturé garde son budget', () => {
    it('une section dotée sur un exercice clôturé ne se supprime pas', async () => {
        const { prisma, ops } = prismaSuppression({ budgetsClos: 13 });
        await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(/budgets d'un exercice clôturé \(13\)/);
        expect(ops).toEqual([]);
    });
    it('ni le plan qui la porte', async () => {
        const { prisma, ops } = prismaSuppression({ budgetsClos: 13 });
        await expect(service(prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(/budgets d'un exercice clôturé/);
        expect(ops).toEqual([]);
    });
    it('la dotation et la retouche d’un mois sont refusées sur un exercice clôturé', async () => {
        const transaction = jest.fn();
        const prisma = {
            sectionAnalytique: {
                findFirst: jest.fn().mockResolvedValue({ id: 's1', code: 'EAU', type: 'DETAIL', dateDebut: null, dateFin: null, plan: { gererBudgets: true, code: 'PROJ' } }),
            },
            exercice: {
                findFirst: jest.fn().mockResolvedValue({ id: 'ex1', statut: 'CLOTURE', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }),
            },
            $transaction: transaction,
        };
        await expect(service(prisma).doterBudget('t1', 's1', { exerciceId: 'ex1', montantAnnuel: 1200 })).rejects.toThrow(/exercice est clôturé/);
        await expect(service(prisma).modifierBudgetMois('t1', 's1', { exerciceId: 'ex1', mois: 3, montant: 100 })).rejects.toThrow(/exercice est clôturé/);
        expect(transaction).not.toHaveBeenCalled();
    });
    it('le report des budgets ne se pose pas sur un exercice suivant clôturé', async () => {
        const createMany = jest.fn();
        const prisma = {
            exercice: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.id
                    ? { id: 'ex1', statut: 'CLOTURE', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }
                    : { id: 'ex2', statut: 'CLOTURE', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') })),
            },
            budgetSection: { findMany: jest.fn().mockResolvedValue([]), createMany },
            sectionAnalytique: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const exercices = new exercice_service_1.ExerciceService(prisma, {});
        await expect(exercices.reporterBudgets('t1', 'ex1')).rejects.toThrow(/exercice est clôturé/);
        expect(createMany).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=suppression-et-exercice-clos.spec.js.map