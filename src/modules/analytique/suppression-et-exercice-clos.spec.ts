import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AnalytiqueService } from './analytique.service';
import { ExerciceService } from '../exercice/exercice.service';
import { PrismaService } from '../../common/prisma.service';
import { JournalService } from '../journaux/journal.service';

/**
 * AUDIT FINAL F142 ET F143.
 *
 * F142 · la suppression d'une section ne comptait ni ses engagements, ni rien
 * d'autre que ses ventilations · la clé étrangère refusait avec une erreur
 * technique, et les budgets, effacés d'abord hors transaction, étaient perdus.
 *
 * F143 · les budgets et les engagements d'un exercice clôturé se retouchaient,
 * et la note d'exécution budgétaire d'un exercice arrêté changeait après coup.
 */

type Faux = Record<string, unknown>;

/**
 * La doublure HONORE les filtres que le service pose · le décompte des
 * références se fait relation par relation, lue dans le schéma, et une
 * doublure qui répondrait « un » partout validerait une liste qu'aucune
 * requête ne ramène.
 */
function prismaSuppression(usages: { engagements?: number; ventilations?: number; lignesOd?: number; ods?: number; budgetsClos?: number; cles?: number; repartitionsPaie?: number; documents?: number; grilles?: number } = {}) {
  const ops: string[] = [];
  const compteur = (n: number | undefined, champ: string) =>
    jest.fn(({ where }: { where: Record<string, unknown> }) => {
      const v = where[champ];
      const vise = v === 's1' || (typeof v === 'object' && v !== null && (v as { in: string[] }).in?.includes('s1')) || v === 'p1';
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
    // Ligne A20 · une clé de répartition retient la section qu'elle répartit
    // ou qui la reçoit, et les données du coût de production la leur.
    cleRepartition: { count: compteur(usages.cles, 'sectionSourceId') },
    ligneCleRepartition: { count: compteur(undefined, 'sectionCibleId') },
    coutProductionDeclare: { count: compteur(undefined, 'sectionId') },
    // Ligne sage-l5, fonction 88 · la répartition analytique de la paie retient sa section et son plan.
    ligneRepartitionAnalytiquePaie: { count: compteur(usages.repartitionsPaie, 'sectionId') },
    repartitionAnalytiquePaie: { count: compteur(undefined, 'planId') },
    // Ligne analytique, fonction n° 48 · la grille d'un compte retient sa section et son plan.
    ligneGrilleAnalytique: { count: compteur(usages.grilles, 'sectionId') },
    grilleAnalytique: { count: compteur(undefined, 'planId') },
    // Ligne immos, n° 70 · un bien et une famille retiennent la section de leur dotation.
    immobilisation: { count: compteur(undefined, 'sectionAnalytiqueId') },
    familleImmobilisation: { count: compteur(undefined, 'sectionAnalytiqueId') },
    // Ligne microfina-m2 · la ligne et l'exécution d'un bon de commande retiennent leur section.
    ligneBonCommande: { count: compteur(undefined, 'sectionId') },
    executionBonCommande: { count: compteur(undefined, 'sectionId') },
    // Ligne sage-l6, fonction n° 22 · le document d'une section la retient.
    pieceJointeSection: {
      count: compteur(usages.documents, 'sectionId'),
      // Les sections du plan qui portent un document, nommées au refus (mineur 5).
      groupBy: jest.fn(({ where }: { where: { sectionId: { in: string[] } } }) =>
        Promise.resolve(usages.documents && where.sectionId.in.includes('s1') ? [{ sectionId: 's1' }] : []),
      ),
    },
    budgetSection: {
      deleteMany: tx.budgetSection.deleteMany,
      count: jest.fn(({ where }: { where: { exercice?: { statut: string } } }) =>
        Promise.resolve(where.exercice?.statut === 'CLOTURE' ? (usages.budgetsClos ?? 0) : 0),
      ),
    },
    $transaction: jest.fn(async (fn: (t: Faux) => Promise<unknown>) => fn(tx as unknown as Faux)),
  } as Faux;
  return { prisma, ops };
}

const service = (prisma: Faux) => new AnalytiqueService(prisma as unknown as PrismaService);

describe('F142 · une section utilisée ne se supprime pas, et le refus la nomme', () => {
  it('un engagement retient la section · rien n’est effacé, budgets compris', async () => {
    const { prisma, ops } = prismaSuppression({ engagements: 1 });
    await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(/section EAU.*engagements de dépense \(1\)/);
    expect(ops).toEqual([]);
  });

  it('les ventilations et les lignes d’OD aussi, chacune par son nom', async () => {
    const { prisma } = prismaSuppression({ ventilations: 2, lignesOd: 1 });
    await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(
      /ventilations analytiques \(2\).*lignes d'OD analytique \(1\)|lignes d'OD analytique \(1\).*ventilations analytiques \(2\)/,
    );
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

  it('une grille analytique de compte retient sa section (fonction n° 48), et le refus la nomme', async () => {
    const { prisma, ops } = prismaSuppression({ grilles: 3 });
    await expect(service(prisma).supprimerSection('t1', 's1')).rejects.toThrow(/grilles analytiques des comptes \(3\)/);
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
    await expect(service(prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(
      /Sections qui portent un document \(1\) · EAU\. Retirez-les depuis le volet Documents de chaque section, ou mettez le plan en sommeil\./,
    );
    expect(ops).toEqual([]);
  });

  it('au-delà de vingt sections porteuses, vingt codes et le total dit', async () => {
    const { prisma } = prismaSuppression({ documents: 1 });
    const sections = Array.from({ length: 23 }, (_, i) => ({ id: `s${i + 1}`, code: `S${String(i + 1).padStart(2, '0')}` }));
    (prisma.sectionAnalytique as { findMany: jest.Mock }).findMany.mockResolvedValue(sections);
    (prisma.pieceJointeSection as { groupBy: jest.Mock }).groupBy.mockResolvedValue(sections.map((x) => ({ sectionId: x.id })));
    await expect(service(prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(/Sections qui portent un document \(23\) · S01, S02,.* S20 et 3 autre\(s\)\./);
  });

  it('un document joint PENDANT la suppression · 409 nommé, jamais une erreur technique (mineur 4)', async () => {
    const fk = new Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', { code: 'P2003', clientVersion: 'x' });
    const plan = prismaSuppression();
    (plan.prisma.planAnalytique as { delete: jest.Mock }).delete.mockRejectedValueOnce(fk);
    await expect(service(plan.prisma).supprimerPlan('t1', 'p1')).rejects.toThrow(/Le plan PROJ a reçu un usage .* pendant sa suppression/);
    const section = prismaSuppression();
    (section.prisma.sectionAnalytique as { delete: jest.Mock }).delete.mockRejectedValueOnce(fk);
    await expect(service(section.prisma).supprimerSection('t1', 's1')).rejects.toBeInstanceOf(ConflictException);
    const retiree = prismaSuppression();
    (retiree.prisma.sectionAnalytique as { delete: jest.Mock }).delete.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record to delete does not exist.', { code: 'P2025', clientVersion: 'x' }),
    );
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
    } as Faux;
    await expect(service(prisma).doterBudget('t1', 's1', { exerciceId: 'ex1', montantAnnuel: 1200 })).rejects.toThrow(/exercice est clôturé/);
    await expect(service(prisma).modifierBudgetMois('t1', 's1', { exerciceId: 'ex1', mois: 3, montant: 100 })).rejects.toThrow(/exercice est clôturé/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('le report des budgets ne se pose pas sur un exercice suivant clôturé', async () => {
    const createMany = jest.fn();
    const prisma = {
      exercice: {
        findFirst: jest.fn(({ where }: { where: { id?: string } }) =>
          Promise.resolve(
            where.id
              ? { id: 'ex1', statut: 'CLOTURE', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }
              : { id: 'ex2', statut: 'CLOTURE', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') },
          ),
        ),
      },
      budgetSection: { findMany: jest.fn().mockResolvedValue([]), createMany },
      sectionAnalytique: { findMany: jest.fn().mockResolvedValue([]) },
    } as Faux;
    const exercices = new ExerciceService(prisma as unknown as PrismaService, {} as JournalService);
    await expect(exercices.reporterBudgets('t1', 'ex1')).rejects.toThrow(/exercice est clôturé/);
    expect(createMany).not.toHaveBeenCalled();
  });
});
