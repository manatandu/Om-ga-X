import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Prisma, TypeCompteDetailTotal } from '@prisma/client';
import type { LigneBalanceAnalytique, LigneEtatBudgetaire } from './analytique.service';
import { totalDesFeuilles, valeurDeLaLigne } from './rubriques-budgetaires';
import { fusionnerCumuls } from './od-analytique';
import { OdAnalytiqueService } from './od-analytique.service';
import { moisEntre } from '../../common/mois-entre';
import { bornesDuMois } from './mois-de-l-exercice';
import { filtrerBalance, type FiltreBalanceAnalytique } from './filtres-balance-analytique';
import {
  PLAFOND_LIGNES_JOURNAL_ANALYTIQUE,
  classesDuPlan,
  perimetreDuPlan,
  premieresDeLUnion,
  sansRepartitionSur,
  type LigneJournalAnalytique,
  type OrigineJournalAnalytique,
} from './journal-analytique';

/** Une ligne du grand livre analytique : le détail d'une section. */
export interface LigneGrandLivreAnalytique {
  /**
   * La ligne d'écriture ventilée, pour que l'écran puisse en effacer la
   * ventilation · null sur une ligne d'OD analytique, qui n'a pas de ligne
   * d'écriture et se retire depuis sa propre fenêtre.
   */
  ligneEcritureId: string | null;
  date: string;
  journal: string;
  numeroPiece: number | null;
  compteNumero: string;
  compteIntitule: string;
  libelle: string;
  debit: number;
  credit: number;
  soldeProgressif: number;
}

/** Une ligne du contrôle des cumuls : la preuve que l'analytique boucle. */
export interface LigneControleCumuls {
  planId: string;
  planCode: string;
  planIntitule: string;
  mouvementsGenerauxDebit: number;
  mouvementsGenerauxCredit: number;
  mouvementsAnalytiquesDebit: number;
  mouvementsAnalytiquesCredit: number;
  ecartDebit: number;
  ecartCredit: number;
  /**
   * Nombre EXACT de lignes sans répartition sur la période (audit final
   * F186) · la liste ci-dessous n'en montre que les premières quand il y en a
   * plus que le plafond, et « 500 » ne doit jamais se lire comme le total.
   */
  nombreSansRepartition: number;
  /** Vrai quand la liste ne montre pas toutes les lignes sans répartition. */
  tronque: boolean;
  /**
   * Lignes qui auraient dû être ventilées et ne le sont pas, par date, pièce
   * puis identifiant, au plus `PLAFOND_LIGNES_SANS_REPARTITION` par plan.
   */
  lignesSansRepartition: {
    /** La ligne à ventiler · c'est elle, pas l'écriture, que la route de ventilation attend. */
    ligneId: string;
    ecritureId: string;
    date: string;
    journal: string;
    compteNumero: string;
    compteIntitule: string;
    libelle: string;
    debit: number;
    credit: number;
  }[];
}

/**
 * Plafond des lignes sans répartition que le contrôle des cumuls montre par
 * plan (audit final F186). C'est un écran de TRAVAIL (§ 8 bis) · la liste se
 * ventile ligne à ligne, elle montre une tranche et le DIT, et les cumuls
 * comme les écarts restent pris sur la période entière, par la base.
 */
export const PLAFOND_LIGNES_SANS_REPARTITION = 500;

/**
 * Tri total de la liste · la date seule laisserait deux lignes du même jour
 * dans l'ordre du plan d'exécution, et la tranche montrée changerait d'un
 * appel à l'autre sur un dossier au-delà du plafond. L'identifiant final
 * rend l'ordre déterministe (même règle que le grand livre).
 */
const TRI_SANS_REPARTITION = [
  { ecriture: { date: 'asc' } },
  { ecriture: { numeroPiece: 'asc' } },
  { id: 'asc' },
] satisfies Prisma.LigneEcritureOrderByWithRelationInput[];

/**
 * ÉTATS ANALYTIQUES ET BUDGÉTAIRES.
 *
 * Quatre états, repris des manuels Sage et recalés sur le SYCEBNL (voir
 * docs/analytique-et-budget.md) :
 *
 *  - la BALANCE analytique : mouvements et solde par section ;
 *  - le GRAND LIVRE analytique : le détail d'une section, solde progressif ;
 *  - le CONTRÔLE DES CUMULS : cumuls généraux face aux cumuls analytiques,
 *    écarts, et liste des écritures qui auraient dû être ventilées. C'est
 *    l'état qui prouve à un bailleur que le total par projet égale le total
 *    comptable · sans lui, un rapport d'exécution n'est pas défendable ;
 *  - l'ÉTAT BUDGÉTAIRE : prévu, réalisé, écart, avec les sections mouvementées
 *    sans budget marquées « hors budget » (option « comptes non budgétisés »
 *    de Sage) · c'est précisément ce qu'un financeur veut voir.
 */
@Injectable()
export class EtatsAnalytiquesService {
  /**
   * LES OD ANALYTIQUES ENTRENT DANS LES TROIS ÉTATS DE SAGE, par une seule
   * lecture · « Les OD analytiques apparaissent dans les États analytiques du
   * menu État » (manuel i7). Balance, grand livre et état budgétaire les
   * ajoutent aux ventilations ; le contrôle des cumuls ne les lit pas, il
   * mesure la ventilation des lignes du grand livre, et une OD équilibrée n'y
   * change rien par construction.
   */
  private readonly od: OdAnalytiqueService;

  constructor(private readonly prisma: PrismaService) {
    this.od = new OdAnalytiqueService(prisma);
  }

  /** Ventilations + OD d'un plan sur une fenêtre, section par section. */
  private async cumulsPlan(tenantId: string, planId: string, exerciceId: string, du: Date, au: Date) {
    const ventilations = await this.prisma.ventilationAnalytique.groupBy({
      by: ['sectionId'],
      where: { planId, ligne: { ecriture: { tenantId, exerciceId, date: { gte: du, lte: au }, ...HORS_SITUATION } } },
      _sum: { debit: true, credit: true },
    });
    const v = new Map(
      ventilations.map((x) => [x.sectionId, { debit: Number(x._sum.debit ?? 0), credit: Number(x._sum.credit ?? 0) }]),
    );
    return fusionnerCumuls(v, await this.od.cumulsParSection(tenantId, planId, exerciceId, du, au));
  }

  private async plan(tenantId: string, planId: string) {
    const plan = await this.prisma.planAnalytique.findFirst({ where: { id: planId, tenantId } });
    if (!plan) throw new NotFoundException('Plan analytique introuvable pour ce dossier');
    return plan;
  }

  private async bornes(tenantId: string, exerciceId: string, dateDebut?: string, dateFin?: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
    if (!exercice) throw new BadRequestException('Exercice introuvable pour ce dossier');
    return {
      exercice,
      du: dateDebut ? new Date(dateDebut) : exercice.dateDebut,
      au: dateFin ? new Date(dateFin) : exercice.dateFin,
    };
  }

  /**
   * Balance analytique. Les sections Total ne portent pas de ventilation :
   * elles totalisent leurs sections Détail de même racine, exactement comme
   * un compte Total totalise ses comptes Détail dans la balance générale.
   */
  async balance(
    tenantId: string,
    params: { planId: string; exerciceId: string; dateDebut?: string; dateFin?: string; filtre?: FiltreBalanceAnalytique },
  ): Promise<{
    lignes: LigneBalanceAnalytique[];
    totaux: { debit: number; credit: number; solde: number };
    filtre: FiltreBalanceAnalytique;
    masquees: number;
  }> {
    await this.plan(tenantId, params.planId);
    const { du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);

    const sections = await this.prisma.sectionAnalytique.findMany({
      where: { planId: params.planId, tenantId },
      orderBy: { code: 'asc' },
    });
    const cumuls = await this.cumulsPlan(tenantId, params.planId, params.exerciceId, du, au);

    // La règle d'agrégation des rubriques vit dans `rubriques-budgetaires.ts`
    // et sert les TROIS états budgétaires · la balance analytique était le seul
    // à la porter, et les deux autres en avaient chacun une lecture différente.
    const debitDe = (id: string) => Number(cumuls.get(id)?.debit ?? 0);
    const creditDe = (id: string) => Number(cumuls.get(id)?.credit ?? 0);

    const lignes: LigneBalanceAnalytique[] = sections.map((s) => {
      const debit = valeurDeLaLigne(s, sections, debitDe);
      const credit = valeurDeLaLigne(s, sections, creditDe);
      return { sectionId: s.id, code: s.code, intitule: s.intitule, type: s.type, debit, credit, solde: debit - credit };
    });

    // Les totaux sont ceux de TOUTES les feuilles, filtre ou non · le filtre
    // masque des lignes, il ne change pas ce que l'axe a reçu (fonction n° 53).
    const debit = totalDesFeuilles(sections, debitDe);
    const credit = totalDesFeuilles(sections, creditDe);
    const filtre = params.filtre ?? 'TOUTES';
    const filtrees = filtrerBalance(lignes, filtre);
    return { lignes: filtrees.lignes, totaux: { debit, credit, solde: debit - credit }, filtre, masquees: filtrees.masquees };
  }

  /** Grand livre analytique d'une section, avec solde progressif. */
  async grandLivre(
    tenantId: string,
    params: { sectionId: string; exerciceId: string; dateDebut?: string; dateFin?: string },
  ) {
    const section = await this.prisma.sectionAnalytique.findFirst({
      where: { id: params.sectionId, tenantId },
      include: { plan: { select: { code: true, intitule: true } } },
    });
    if (!section) throw new NotFoundException('Section analytique introuvable pour ce dossier');
    const { du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);

    const ventilations = await this.prisma.ventilationAnalytique.findMany({
      where: {
        sectionId: params.sectionId,
        ligne: { ecriture: { tenantId, exerciceId: params.exerciceId, date: { gte: du, lte: au }, ...HORS_SITUATION } },
      },
      include: {
        ligne: {
          include: {
            compte: { select: { numero: true, intitule: true } },
            ecriture: { select: { id: true, date: true, libelle: true, numeroPiece: true, journal: { select: { code: true } } } },
          },
        },
      },
    });

    // Les lignes d'OD s'intercalent à leur date · le journal affiché est
    // « OD ANA », pour qu'une correction extra-comptable ne se lise jamais
    // comme une pièce du livre-journal.
    const lignesOd = await this.prisma.ligneOdAnalytique.findMany({
      where: {
        tenantId,
        sectionId: params.sectionId,
        od: { tenantId, exerciceId: params.exerciceId, date: { gte: du, lte: au } },
      },
      include: { od: { include: { compte: { select: { numero: true, intitule: true } } } } },
    });
    const brutes = [
      ...ventilations.map((v) => ({
        ligneEcritureId: v.ligne.id as string | null,
        date: v.ligne.ecriture.date,
        journal: v.ligne.ecriture.journal.code,
        numeroPiece: v.ligne.ecriture.numeroPiece,
        compteNumero: v.ligne.compte.numero,
        compteIntitule: v.ligne.compte.intitule,
        libelle: v.ligne.libelle ?? v.ligne.ecriture.libelle,
        debit: Number(v.debit),
        credit: Number(v.credit),
      })),
      ...lignesOd.map((l) => ({
        ligneEcritureId: null,
        date: l.od.date,
        journal: 'OD ANA',
        numeroPiece: null,
        compteNumero: l.od.compte.numero,
        compteIntitule: l.od.compte.intitule,
        libelle: l.od.libelle,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    ];
    brutes.sort((a, b) => {
      const d = a.date.getTime() - b.date.getTime();
      return d !== 0 ? d : (a.numeroPiece ?? 0) - (b.numeroPiece ?? 0);
    });

    let cumul = 0;
    const lignes: LigneGrandLivreAnalytique[] = brutes.map((b) => {
      cumul += b.debit - b.credit;
      return { ...b, date: b.date.toISOString().slice(0, 10), soldeProgressif: cumul };
    });

    return {
      section: {
        id: section.id,
        code: section.code,
        intitule: section.intitule,
        plan: section.plan,
        dateDebut: section.dateDebut?.toISOString().slice(0, 10) ?? null,
        dateFin: section.dateFin?.toISOString().slice(0, 10) ?? null,
      },
      lignes,
      totaux: {
        debit: lignes.reduce((t, l) => t + l.debit, 0),
        credit: lignes.reduce((t, l) => t + l.credit, 0),
        solde: cumul,
      },
    };
  }

  /**
   * Contrôle des cumuls. Compare, pour chaque plan, les mouvements généraux
   * des comptes que le plan est censé ventiler aux mouvements effectivement
   * ventilés, et liste les écritures manquantes. Un écart non nul n'est pas
   * une anomalie technique : c'est du travail de ventilation qui reste à
   * faire, et l'état dit exactement lequel. Au-delà du plafond, la liste en
   * montre les premières et dit combien il y en a (audit final F186).
   */
  async controleCumuls(
    tenantId: string,
    params: { exerciceId: string; dateDebut?: string; dateFin?: string; planId?: string },
  ): Promise<LigneControleCumuls[]> {
    const { du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);
    const plans = await this.prisma.planAnalytique.findMany({
      where: { tenantId, estActif: true, ...(params.planId ? { id: params.planId } : {}) },
      orderBy: [{ ordre: 'asc' }, { code: 'asc' }],
    });

    const resultats: LigneControleCumuls[] = [];
    for (const plan of plans) {
      // LES CUMULS SE DEMANDENT À LA BASE, LA LISTE SE BORNE (audit final
      // F186). Un seul périmètre sert les deux agrégats, la tranche et son
      // décompte, et le grand livre des lignes non ventilées (fonction n° 52) ·
      // deux filtres écrits séparément rendraient des cumuls et une liste qui
      // ne parlent pas des mêmes lignes. Il écarte l'écriture qui solde les
      // comptes de gestion (régression de l'audit final F4) et les écritures
      // de situation (`journal-analytique.ts`).
      const fenetre = { tenantId, exerciceId: params.exerciceId, du, au, classes: classesDuPlan(plan.classesVentilees) };
      const perimetre = perimetreDuPlan(fenetre);
      const sansRepartition = sansRepartitionSur(fenetre, plan.id);

      const [general, analytique, tranche, nombreSansRepartition] = await Promise.all([
        this.prisma.ligneEcriture.aggregate({ where: perimetre, _sum: { debit: true, credit: true } }),
        // Les ventilations DE CE PLAN portées par les lignes du périmètre, et
        // elles seules · une ventilation d'un autre plan ou d'une ligne hors
        // des classes ventilées n'entrait pas dans la somme d'avant.
        this.prisma.ventilationAnalytique.aggregate({
          where: { planId: plan.id, ligne: perimetre },
          _sum: { debit: true, credit: true },
        }),
        this.prisma.ligneEcriture.findMany({
          where: sansRepartition,
          include: {
            compte: { select: { numero: true, intitule: true } },
            ecriture: { select: { id: true, date: true, libelle: true, journal: { select: { code: true } } } },
          },
          orderBy: TRI_SANS_REPARTITION,
          take: PLAFOND_LIGNES_SANS_REPARTITION,
        }),
        this.prisma.ligneEcriture.count({ where: sansRepartition }),
      ]);

      const generalDebit = Number(general._sum.debit ?? 0);
      const generalCredit = Number(general._sum.credit ?? 0);
      const analytiqueDebit = Number(analytique._sum.debit ?? 0);
      const analytiqueCredit = Number(analytique._sum.credit ?? 0);

      resultats.push({
        planId: plan.id,
        planCode: plan.code,
        planIntitule: plan.intitule,
        mouvementsGenerauxDebit: generalDebit,
        mouvementsGenerauxCredit: generalCredit,
        mouvementsAnalytiquesDebit: analytiqueDebit,
        mouvementsAnalytiquesCredit: analytiqueCredit,
        ecartDebit: generalDebit - analytiqueDebit,
        ecartCredit: generalCredit - analytiqueCredit,
        nombreSansRepartition,
        tronque: nombreSansRepartition > tranche.length,
        lignesSansRepartition: tranche.map((l) => ({
          ligneId: l.id,
          ecritureId: l.ecriture.id,
          date: l.ecriture.date.toISOString().slice(0, 10),
          journal: l.ecriture.journal.code,
          compteNumero: l.compte.numero,
          compteIntitule: l.compte.intitule,
          libelle: l.libelle ?? l.ecriture.libelle,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
      });
    }
    return resultats;
  }

  /**
   * État budgétaire : prévu, réalisé, écart, par section.
   *
   * Le RÉALISÉ d'une section est le solde de ses ventilations, mais lu du bon
   * côté : une section de dépenses se consomme au débit, une section de
   * ressources s'exécute au crédit. Plutôt que d'imposer un sens à la section,
   * on retient la valeur absolue du solde · une section ne mélange pas les
   * deux en pratique, et le signe brut ferait apparaître un budget « négatif »
   * sur les ressources.
   *
   * Une section mouvementée sans budget est marquée `horsBudget` : c'est
   * l'option « impression des comptes non budgétisés » de Sage, et pour un
   * bailleur c'est la ligne la plus importante de l'état.
   */
  async etatBudgetaire(
    tenantId: string,
    params: { planId: string; exerciceId: string; dateDebut?: string; dateFin?: string; mois?: number },
  ): Promise<{ lignes: LigneEtatBudgetaire[]; totaux: LigneEtatBudgetaire }> {
    const plan = await this.plan(tenantId, params.planId);
    if (!plan.gererBudgets) {
      throw new BadRequestException(`Le plan ${plan.code} ne gère pas les budgets.`);
    }
    const { exercice, du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);

    // Un mois demandé restreint la fenêtre de réalisé ET la dotation lue.
    let debut = du;
    let fin = au;
    if (params.mois) {
      // Sur un exercice de plus de douze mois, le même mois revient deux
      // fois et la dotation n'est qu'annuelle (audit final F39) · un mois
      // choisi ne dirait pas lequel des deux il vise.
      if (moisEntre(exercice.dateDebut, exercice.dateFin) > 12) {
        throw new BadRequestException(
          "Sur un exercice de plus de douze mois, un même mois revient deux fois : choisissez une période par " +
            'ses dates. La dotation y est annuelle.',
        );
      }
      ({ debut, fin } = bornesDuMois(exercice.dateDebut, params.mois));
    }

    // LES RUBRIQUES SONT RENDUES, ELLES NE SONT PLUS ÉCARTÉES. Cette requête
    // portait `type: DETAIL` : un cabinet dont la convention se lit
    // « 1 Personnel, dont 11 Salaires et 12 Charges sociales » n'obtenait
    // qu'une liste plate de feuilles, et le bailleur qui lit son budget par
    // rubrique devait additionner à la main. Le schéma promet pourtant que
    // TOTAL « regroupe ses sections de même racine dans les états ».
    const sections = await this.prisma.sectionAnalytique.findMany({
      where: { planId: params.planId, tenantId },
      orderBy: { code: 'asc' },
    });
    const budgets = await this.prisma.budgetSection.findMany({
      where: {
        exerciceId: params.exerciceId,
        sectionId: { in: sections.map((s) => s.id) },
        mois: params.mois ?? null,
      },
    });
    const budgetDe = (id: string) => Number(budgets.find((b) => b.sectionId === id)?.montant ?? 0);
    const cumuls = await this.cumulsPlan(tenantId, params.planId, params.exerciceId, debut, fin);

    // Le réalisé est pris en VALEUR ABSOLUE par section, jamais sur la somme
    // algébrique d'une rubrique : une rubrique qui mêle une charge et son
    // annulation doit montrer ce qui a été consommé de chaque côté, et prendre
    // la valeur absolue du net les compenserait.
    const realiseDe = (id: string) => {
      const somme = cumuls.get(id);
      return Math.abs(Number(somme?.debit ?? 0) - Number(somme?.credit ?? 0));
    };

    const lignes: LigneEtatBudgetaire[] = sections.map((s) => {
      const estRubrique = s.type === TypeCompteDetailTotal.TOTAL;
      const budget = valeurDeLaLigne(s, sections, budgetDe);
      const realise = valeurDeLaLigne(s, sections, realiseDe);
      return {
        sectionId: s.id,
        code: s.code,
        intitule: s.intitule,
        estRubrique,
        budget,
        realise,
        ecart: budget - realise,
        tauxConsommation: budget !== 0 ? (realise / budget) * 100 : null,
        // Une RUBRIQUE n'est jamais « hors budget » · le signalement vise une
        // section mouvementée que personne n'a dotée, et il appartient à la
        // feuille. Le porter sur la rubrique ferait crier le sous-total dès
        // qu'une seule de ses feuilles est concernée, et masquerait laquelle.
        horsBudget: !estRubrique && budget === 0 && realise !== 0,
      };
    });

    // LE TOTAL GÉNÉRAL NE SOMME QUE LES FEUILLES · sommer les lignes affichées
    // compterait chaque dépense autant de fois qu'elle a de rubriques au-dessus
    // d'elle, et vaudrait le double du vrai sur une nomenclature à deux niveaux.
    const budgetTotal = totalDesFeuilles(sections, budgetDe);
    const realiseTotal = totalDesFeuilles(sections, realiseDe);
    return {
      lignes,
      totaux: {
        sectionId: null,
        code: '',
        intitule: 'Total',
        estRubrique: false,
        budget: budgetTotal,
        realise: realiseTotal,
        ecart: budgetTotal - realiseTotal,
        tauxConsommation: budgetTotal !== 0 ? (realiseTotal / budgetTotal) * 100 : null,
        horsBudget: false,
      },
    };
  }

  /**
   * LE JOURNAL ANALYTIQUE D'UN PLAN (fonction n° 52) · les ventilations des
   * lignes du grand livre et les lignes d'OD analytiques, dans l'ordre du
   * journal, sur une fenêtre de l'exercice. `OD` ne rend que les OD
   * analytiques (Sage, « reports et OD analytiques » · l'analytique d'OmegaX
   * n'a pas de report à lui). Écran de travail · une tranche, dite, et des
   * totaux et un décompte pris par la base sur toute la fenêtre.
   */
  async journal(
    tenantId: string,
    params: { planId: string; exerciceId: string; dateDebut?: string; dateFin?: string; origine: OrigineJournalAnalytique },
  ) {
    const plan = await this.plan(tenantId, params.planId);
    const { du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);
    const avecVentilations = params.origine === 'TOUTES';
    // Même périmètre que la balance et le grand livre · jamais une écriture de
    // situation ; la ventilation n'a pas de tenantId, la borne passe par
    // l'écriture de sa ligne.
    const whereVentilations: Prisma.VentilationAnalytiqueWhereInput = {
      planId: plan.id,
      ligne: { ecriture: { tenantId, exerciceId: params.exerciceId, date: { gte: du, lte: au }, ...HORS_SITUATION } },
    };
    // La borne du dossier est écrite DANS chaque appel (`cloisonnement.spec.ts`
    // la lit par sa structure) · seul le filtre de l'en-tête est partagé.
    const odDuPlan: Prisma.OdAnalytiqueWhereInput = {
      tenantId,
      planId: plan.id,
      exerciceId: params.exerciceId,
      date: { gte: du, lte: au },
    };
    const plafond = PLAFOND_LIGNES_JOURNAL_ANALYTIQUE;
    const [ventilations, lignesOd, sommeV, sommeOd, nombreV, nombreOd] = await Promise.all([
      avecVentilations
        ? this.prisma.ventilationAnalytique.findMany({
            where: whereVentilations,
            include: {
              section: { select: { code: true, intitule: true } },
              ligne: {
                include: {
                  compte: { select: { numero: true, intitule: true } },
                  ecriture: { select: { date: true, libelle: true, numeroPiece: true, journal: { select: { code: true } } } },
                },
              },
            },
            orderBy: [
              { ligne: { ecriture: { date: 'asc' } } },
              { ligne: { ecriture: { journal: { code: 'asc' } } } },
              { ligne: { ecriture: { numeroPiece: 'asc' } } },
              { id: 'asc' },
            ],
            take: plafond,
          })
        : Promise.resolve([]),
      this.prisma.ligneOdAnalytique.findMany({
        where: { tenantId, od: odDuPlan },
        include: {
          section: { select: { code: true, intitule: true } },
          od: { include: { compte: { select: { numero: true, intitule: true } } } },
        },
        orderBy: [{ od: { date: 'asc' } }, { id: 'asc' }],
        take: plafond,
      }),
      avecVentilations
        ? this.prisma.ventilationAnalytique.aggregate({ where: whereVentilations, _sum: { debit: true, credit: true } })
        : Promise.resolve({ _sum: { debit: null, credit: null } }),
      this.prisma.ligneOdAnalytique.aggregate({ where: { tenantId, od: odDuPlan }, _sum: { debit: true, credit: true } }),
      avecVentilations ? this.prisma.ventilationAnalytique.count({ where: whereVentilations }) : Promise.resolve(0),
      this.prisma.ligneOdAnalytique.count({ where: { tenantId, od: odDuPlan } }),
    ]);

    const lues: LigneJournalAnalytique[] = ventilations.map((v) => ({
      id: v.id,
      origine: 'VENTILATION' as const,
      date: v.ligne.ecriture.date,
      journal: v.ligne.ecriture.journal.code,
      numeroPiece: v.ligne.ecriture.numeroPiece,
      sectionCode: v.section.code,
      sectionIntitule: v.section.intitule,
      compteNumero: v.ligne.compte.numero,
      compteIntitule: v.ligne.compte.intitule,
      libelle: v.ligne.libelle ?? v.ligne.ecriture.libelle,
      debit: Number(v.debit),
      credit: Number(v.credit),
    }));
    // « OD ANA » · une correction extra-comptable ne se lit jamais comme une
    // pièce du livre-journal (même libellé que le grand livre analytique).
    const od: LigneJournalAnalytique[] = lignesOd.map((l) => ({
      id: l.id,
      origine: 'OD' as const,
      date: l.od.date,
      journal: 'OD ANA',
      numeroPiece: null,
      sectionCode: l.section.code,
      sectionIntitule: l.section.intitule,
      compteNumero: l.od.compte.numero,
      compteIntitule: l.od.compte.intitule,
      libelle: l.od.libelle,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));
    const tranche = premieresDeLUnion(lues, od, plafond);
    const total = nombreV + nombreOd;
    const debit = Number(sommeV._sum.debit ?? 0) + Number(sommeOd._sum.debit ?? 0);
    const credit = Number(sommeV._sum.credit ?? 0) + Number(sommeOd._sum.credit ?? 0);
    return {
      plan: { id: plan.id, code: plan.code, intitule: plan.intitule },
      origine: params.origine,
      lignes: tranche.map((l) => ({ ...l, date: l.date.toISOString().slice(0, 10) })),
      total,
      tronque: total > tranche.length,
      totaux: { debit, credit },
    };
  }

  /**
   * LE GRAND LIVRE DES LIGNES NON VENTILÉES D'UN PLAN (fonction n° 52) · les
   * lignes des classes que le plan ventile, restées sans répartition sur lui,
   * avec leur solde progressif · ce que Sage imprime à la suite du grand
   * livre analytique. Mêmes lignes que le contrôle des cumuls, par le même
   * périmètre. Une tranche, dite ; totaux et décompte pris par la base.
   */
  async nonVentilees(tenantId: string, params: { planId: string; exerciceId: string; dateDebut?: string; dateFin?: string }) {
    const plan = await this.plan(tenantId, params.planId);
    const { du, au } = await this.bornes(tenantId, params.exerciceId, params.dateDebut, params.dateFin);
    const where = sansRepartitionSur(
      { tenantId, exerciceId: params.exerciceId, du, au, classes: classesDuPlan(plan.classesVentilees) },
      plan.id,
    );
    const [lignes, somme, total] = await Promise.all([
      this.prisma.ligneEcriture.findMany({
        where,
        include: {
          compte: { select: { numero: true, intitule: true } },
          ecriture: { select: { date: true, libelle: true, numeroPiece: true, statut: true, journal: { select: { code: true } } } },
        },
        orderBy: TRI_SANS_REPARTITION,
        take: PLAFOND_LIGNES_JOURNAL_ANALYTIQUE,
      }),
      this.prisma.ligneEcriture.aggregate({ where, _sum: { debit: true, credit: true } }),
      this.prisma.ligneEcriture.count({ where }),
    ]);
    // Le solde progressif part de la première ligne · la tranche est faite des
    // PREMIÈRES lignes dans l'ordre, il est donc juste sur tout ce qui est montré.
    let cumul = 0;
    return {
      plan: { id: plan.id, code: plan.code, intitule: plan.intitule, classesVentilees: plan.classesVentilees },
      lignes: lignes.map((l) => {
        const debit = Number(l.debit);
        const credit = Number(l.credit);
        cumul += debit - credit;
        return {
          ligneEcritureId: l.id,
          date: l.ecriture.date.toISOString().slice(0, 10),
          journal: l.ecriture.journal.code,
          numeroPiece: l.ecriture.numeroPiece,
          statut: l.ecriture.statut,
          compteNumero: l.compte.numero,
          compteIntitule: l.compte.intitule,
          libelle: l.libelle ?? l.ecriture.libelle,
          debit,
          credit,
          soldeProgressif: cumul,
        };
      }),
      total,
      tronque: total > lignes.length,
      totaux: {
        debit: Number(somme._sum.debit ?? 0),
        credit: Number(somme._sum.credit ?? 0),
        solde: Number(somme._sum.debit ?? 0) - Number(somme._sum.credit ?? 0),
      },
    };
  }

}
