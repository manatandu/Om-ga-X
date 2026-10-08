import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutEcriture, StatutExercice } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { transactionJournalisee } from '../../common/audit/transaction-journalisee';
import { libelleExercice } from '../../common/libelle-exercice';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { EcritureService } from '../comptabilite/ecriture.service';
import { prochainNumeroPiece } from '../journaux/numerotation-piece';
import { lignesFigees } from '../exercice/gel-cloture';
import { poserGroupeSoldeDuModule, prochaineLettreDuCompte } from '../lettrage/lettrage.service';
import { DevisesService } from './devises.service';
import { seReevalueALaCloture } from './perimetre-reevaluation';
import {
  apparierReports,
  cleDeLigne,
  cleDuReport,
  lignesExactes,
  motifRefusLigne,
  motifRefusParts,
  type ContexteDeclaration,
  type LigneADeclarer,
  type LigneDeReport,
  type PartDeclaree,
  type ReglementEnFrancs,
} from './declaration-devise-a-nouveau';

/** La référence que portent les pièces de correction · elles sortent de la liste. */
export const REFERENCE_DECLARATION_DEVISE = 'DECLARATION-DEVISE';

/** Bornée, et la borne se dit (§ 8 bis). */
const PLAFOND_LISTE = 500;
/**
 * Les lignes d'à-nouveau lues par exercice · un report au DÉTAIL porte une
 * ligne par pièce ouverte. Au-delà, la liste se dit tronquée, jamais
 * complète (§ 8 bis).
 */
const PLAFOND_LECTURE_PAR_EXERCICE = 20_000;
/** Les réévaluations lues pour reconnaître leurs écritures (comme le contrôle 32). */
const PLAFOND_REEVALUATIONS_LUES = 200;
/** Les mouvements nommés par le refus B1 · au-delà, le total le dit. */
const MOUVEMENTS_NOMMES = 10;

export interface DeclarerDeviseANouveauEntree {
  ligneId: string;
  parts: PartDeclaree[];
  source: string;
}

/** Une ligne d'à-nouveau que la déclaration attend, et pourquoi elle se déclare ou non. */
export interface LigneRestantADeclarer {
  ligneId: string;
  exerciceId: string;
  exercice: string;
  date: string;
  piece: number | null;
  origine: 'IMPORT' | 'REPORT';
  statut: StatutEcriture;
  compteNumero: string;
  compteIntitule: string;
  /** Débit moins crédit, en monnaie de tenue. */
  montant: number;
  /** Le refus de la déclaration aujourd'hui, ou null si elle se déclare. */
  motifRefus: string | null;
}

/**
 * Une ligne importée non déclarée dont le report au détail ne se retrouve pas
 * à l'exercice suivant (relecture adverse, M2) · NOMMÉE, jamais devinée.
 * `NON_RETROUVE` · aucun report à sa clé (report au SOLDE, ligne retouchée) ;
 * `AMBIGU` · des lignes identiques en nombre différent de leurs reports.
 */
export interface ReportNonRetrouve {
  exercice: string;
  exerciceSuivant: string;
  compteNumero: string;
  montant: number;
  motif: 'NON_RETROUVE' | 'AMBIGU';
}

const SELECT_LIGNE = {
  id: true,
  compteId: true,
  libelle: true,
  debit: true,
  credit: true,
  deviseId: true,
  lettre: true,
  lettrageId: true,
  rapprochementId: true,
  dateEcheance: true,
  ecritureId: true,
  _count: { select: { ventilations: true } },
  compte: { select: { numero: true, intitule: true } },
  ecriture: {
    select: {
      id: true,
      tenantId: true,
      exerciceId: true,
      journalId: true,
      date: true,
      numeroPiece: true,
      reference: true,
      libelle: true,
      statut: true,
      estGenereeParCloture: true,
      estANouveauProvisoire: true,
      estSoldeDesComptesDeGestion: true,
      exercice: { select: { id: true, statut: true, dateDebut: true, dateFin: true } },
    },
  },
} satisfies Prisma.LigneEcritureSelect;

type LigneLue = Prisma.LigneEcritureGetPayload<{ select: typeof SELECT_LIGNE }>;

/**
 * Le libellé que le report recopie est celui de la LIGNE, à défaut celui de
 * l'écriture (`lireComptesDuReport`, « libelle ?? ecriture.libelle ») · une
 * ligne de bilan importé n'a souvent pas de libellé propre (rejeu sur vraie
 * base, l'appariement échouait sans ce repli).
 */
function versLigneDeReport(l: {
  id: string;
  compteId: string;
  debit: unknown;
  credit: unknown;
  libelle: string | null;
  dateEcheance: Date | null;
  ecriture?: { libelle: string };
}): LigneDeReport {
  return {
    id: l.id,
    compteId: l.compteId,
    debit: Number(l.debit),
    credit: Number(l.credit),
    libelle: l.libelle ?? l.ecriture?.libelle ?? null,
    dateEcheance: l.dateEcheance,
  };
}

function versLigneADeclarer(l: LigneLue): LigneADeclarer {
  return {
    numero: l.compte.numero,
    debit: Number(l.debit),
    credit: Number(l.credit),
    deviseId: l.deviseId,
    lettre: l.lettre,
    lettrageId: l.lettrageId,
    rapprochementId: l.rapprochementId,
    aDesVentilations: l._count.ventilations > 0,
    ecriture: {
      estGenereeParCloture: l.ecriture.estGenereeParCloture,
      estANouveauProvisoire: l.ecriture.estANouveauProvisoire,
      estSoldeDesComptesDeGestion: l.ecriture.estSoldeDesComptesDeGestion,
      statut: l.ecriture.statut,
      exercice: l.ecriture.exercice,
    },
  };
}

/**
 * LIGNE AU3 · la devise d'une ligne d'à-nouveau importée sans elle, DÉCLARÉE
 * par le cabinet · voir `declaration-devise-a-nouveau.ts` pour les règles.
 * Le service lit le contexte (réévaluation de l'exercice, exercice précédent,
 * déclaration déjà faite), passe sous le verrou des devises du dossier (une
 * réévaluation ne s'intercale pas entre la lecture et l'écriture), et écrit
 * la déclaration, auditée, avec ses lignes.
 */
@Injectable()
export class DeclarationDeviseANouveauService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritureService: EcritureService,
    private readonly devises: DevisesService,
  ) {}

  /**
   * Les écritures qui ne sont pas des mouvements du compte · celles des
   * réévaluations (écarts, provision, contre-passation, contre-passation
   * déclarée, leurs inscriptions en négatif à l'annulation, annulées ou non)
   * et les pièces de correction des déclarations. Reconnues par LIAISON,
   * jamais par le libellé ni par un drapeau. Bornée comme le contrôle 32 ·
   * au-delà, `tronque`.
   */
  private async ecrituresHorsMouvements(tenantId: string): Promise<{ ids: string[]; tronque: boolean }> {
    const [reevaluations, declarations] = await Promise.all([
      this.prisma.reevaluation.findMany({
        where: { tenantId },
        orderBy: [{ dateReevaluation: 'desc' }, { id: 'asc' }],
        take: PLAFOND_REEVALUATIONS_LUES + 1,
        select: {
          ecritureEcartsId: true,
          ecritureProvisionId: true,
          ecritureExtourneId: true,
          contrePassationDeclareeId: true,
          annulation: true,
          annulationsContrePassation: true,
        },
      }),
      this.prisma.declarationDeviseANouveau.findMany({
        where: { tenantId, ecritureCorrectionId: { not: null } },
        select: { ecritureCorrectionId: true },
      }),
    ]);
    const ids = new Set<string>();
    const ajouter = (x: unknown) => {
      if (typeof x === 'string') ids.add(x);
    };
    const lireTraces = (j: unknown) => {
      for (const a of Array.isArray(j) ? j : []) {
        if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
        ajouter((a as { ecritureId?: unknown }).ecritureId);
        ajouter((a as { negatifId?: unknown }).negatifId);
      }
    };
    for (const r of reevaluations.slice(0, PLAFOND_REEVALUATIONS_LUES)) {
      ajouter(r.ecritureEcartsId);
      ajouter(r.ecritureProvisionId);
      ajouter(r.ecritureExtourneId);
      ajouter(r.contrePassationDeclareeId);
      lireTraces(r.annulation);
      lireTraces(r.annulationsContrePassation);
    }
    for (const d of declarations) ajouter(d.ecritureCorrectionId);
    return { ids: [...ids], tronque: reevaluations.length > PLAFOND_REEVALUATIONS_LUES };
  }

  /**
   * CE QUE L'EXERCICE DE LA LIGNE DIT, commun à toutes ses lignes d'à-nouveau.
   *  · M1 (relecture adverse) · la réévaluation non annulée la plus tardive
   *    d'un exercice qui COMMENCE au plus tôt avec celui de la ligne · celle
   *    de l'exercice même, ou celle d'un exercice POSTÉRIEUR qui a lu le
   *    report de cette ligne en francs (N+1 réévalué, puis la déclaration sur
   *    l'à-nouveau de N, qui passera au report de N+1).
   *  · L'exercice précédent encore ouvert.
   */
  private async contexteDeLExercice(
    tenantId: string,
    ex: { id: string; dateDebut: Date },
    dateLigne: Date,
  ): Promise<Pick<ContexteDeclaration, 'reevaluationLue' | 'exercicePrecedentOuvert'>> {
    const [reevaluation, precedent] = await Promise.all([
      this.prisma.reevaluation.findFirst({
        where: { tenantId, annuleeLe: null, dateReevaluation: { gte: dateLigne }, exercice: { dateDebut: { gte: ex.dateDebut } } },
        orderBy: { dateReevaluation: 'desc' },
        select: { dateReevaluation: true, exercice: { select: { id: true, dateDebut: true, dateFin: true } } },
      }),
      this.prisma.exercice.findFirst({
        where: { tenantId, dateFin: { lt: ex.dateDebut }, statut: { not: StatutExercice.CLOTURE } },
        orderBy: { dateFin: 'desc' },
        select: { dateDebut: true, dateFin: true },
      }),
    ]);
    return {
      reevaluationLue: reevaluation
        ? {
            date: reevaluation.dateReevaluation,
            exercice: libelleExercice(reevaluation.exercice),
            memeExercice: reevaluation.exercice.id === ex.id,
          }
        : null,
      exercicePrecedentOuvert: precedent ? { libelle: libelleExercice(precedent) } : null,
    };
  }

  /**
   * B1 (relecture adverse) · LES MOUVEMENTS EN FRANCS QUI RÉDUISENT DÉJÀ LA
   * POSITION. La réévaluation ne lit que les lignes en devise · un règlement
   * passé en francs, non lettré, n'en est pas déduit, et la ligne déclarée en
   * entier ferait juger un montant en devise déjà réglé (401 repris 1 500 USD
   * pour 3 200 000, 1 000 USD payés pour 2 150 000 FC sans lettrage · la
   * réévaluation à 2 400 dotait 400 000 au lieu de 150 000). Sont lus · les
   * lignes SANS devise et NON lettrées du compte, datées au plus tôt de la
   * ligne, hors à-nouveau (sauf, pour un REPORT, les autres lignes reportées
   * du même exercice · un règlement de N non lettré y revient en francs), hors
   * écritures de réévaluation et de correction. Seule la colonne du
   * RÈGLEMENT décide (le débit d'une dette, le crédit d'une créance) · un
   * règlement inscrit en négatif s'y compense avec ce qu'il annule, et une
   * facture en francs du même sens ne masque rien. Le refus nomme les
   * mouvements.
   */
  private async reglementsEnFrancs(
    tenantId: string,
    l: LigneLue,
    horsMouvements: string[],
  ): Promise<ContexteDeclaration['reglementsEnFrancs']> {
    const sens = Math.sign(Number(l.debit) - Number(l.credit));
    if (sens === 0) return { lignes: [], total: 0 };
    const where: Prisma.LigneEcritureWhereInput = {
      compteId: l.compteId,
      deviseId: null,
      lettrageId: null,
      id: { not: l.id },
      ecriture: {
        tenantId,
        estANouveauProvisoire: false,
        estSoldeDesComptesDeGestion: false,
        ...(horsMouvements.length > 0 ? { id: { notIn: horsMouvements } } : {}),
        OR: [
          { estGenereeParCloture: false, date: { gte: l.ecriture.date } },
          ...(l.ecriture.reference !== 'IMPORT'
            ? [{ estGenereeParCloture: true, exerciceId: l.ecriture.exerciceId, NOT: { reference: 'IMPORT' } }]
            : []),
        ],
      },
    };
    // LA COLONNE DU RÈGLEMENT, seule · le débit d'une dette, le crédit d'une
    // créance. Un règlement inscrit en négatif s'y retranche de lui-même ;
    // une facture du même sens, dans l'autre colonne, ne le masque jamais.
    const somme = await this.prisma.ligneEcriture.aggregate({ where, _sum: { debit: true, credit: true } });
    const regle = sens < 0 ? Number(somme._sum.debit ?? 0) : Number(somme._sum.credit ?? 0);
    if (regle < 0.005) return { lignes: [], total: 0 };
    const contraire: Prisma.LigneEcritureWhereInput = sens < 0 ? { debit: { gt: 0 } } : { credit: { gt: 0 } };
    const whereContraire: Prisma.LigneEcritureWhereInput = { AND: [where, contraire] };
    const [lus, total] = await Promise.all([
      this.prisma.ligneEcriture.findMany({
        where: whereContraire,
        orderBy: [{ ecriture: { date: 'asc' } }, { id: 'asc' }],
        take: MOUVEMENTS_NOMMES,
        select: { debit: true, credit: true, ecriture: { select: { numeroPiece: true, date: true } } },
      }),
      this.prisma.ligneEcriture.count({ where: whereContraire }),
    ]);
    const lignes: ReglementEnFrancs[] = lus.map((m) => ({
      piece: m.ecriture.numeroPiece,
      date: m.ecriture.date,
      montant: Math.abs(Number(m.debit) - Number(m.credit)),
    }));
    return { lignes, total };
  }

  /**
   * M2 (relecture adverse) · la ligne est-elle le REPORT d'une ligne déjà
   * déclarée · l'origine, son inscription en négatif restée ouverte (le
   * lettrage n'a pas pu être posé, période figée) ou la part laissée en
   * francs ? Lue à la clé du report (`cleDuReport`), dans les déclarations de
   * l'exercice qui précède immédiatement. Une ligne importée n'est jamais un
   * report.
   */
  private async prolongeUneLigneDeclaree(tenantId: string, l: LigneLue): Promise<boolean> {
    if (l.ecriture.reference === 'IMPORT') return false;
    const precedent = await this.prisma.exercice.findFirst({
      where: { tenantId, dateFin: { lt: l.ecriture.exercice.dateDebut } },
      orderBy: { dateFin: 'desc' },
      select: { id: true },
    });
    if (!precedent) return false;
    const declarations = await this.prisma.declarationDeviseANouveau.findMany({
      where: { tenantId, exerciceId: precedent.id, compteId: l.compteId },
      select: { ligneOrigineId: true, lignesResultantes: true },
    });
    const ids = new Set<string>();
    for (const d of declarations) {
      ids.add(d.ligneOrigineId);
      for (const id of Array.isArray(d.lignesResultantes) ? (d.lignesResultantes as string[]) : []) ids.add(id);
    }
    if (ids.size === 0) return false;
    const enFrancs = await this.prisma.ligneEcriture.findMany({
      where: { id: { in: [...ids] }, deviseId: null, ecriture: { tenantId } },
      select: {
        id: true,
        compteId: true,
        debit: true,
        credit: true,
        libelle: true,
        dateEcheance: true,
        ecriture: { select: { libelle: true } },
      },
    });
    const cle = cleDeLigne(versLigneDeReport(l));
    return enFrancs.some((d) => cleDuReport(versLigneDeReport(d), l.compte.numero) === cle);
  }

  /** Le contexte d'une ligne · ce qui refuse sans être porté par elle. */
  private async contexte(tenantId: string, l: LigneLue): Promise<ContexteDeclaration> {
    const horsMouvements = await this.ecrituresHorsMouvements(tenantId);
    const [declaree, exercice, reglements, prolonge] = await Promise.all([
      this.prisma.declarationDeviseANouveau.findFirst({ where: { tenantId, ligneOrigineId: l.id }, select: { id: true } }),
      this.contexteDeLExercice(tenantId, l.ecriture.exercice, l.ecriture.date),
      this.reglementsEnFrancs(tenantId, l, horsMouvements.ids),
      this.prolongeUneLigneDeclaree(tenantId, l),
    ]);
    return { dejaDeclaree: declaree !== null, ...exercice, reglementsEnFrancs: reglements, prolongeUneLigneDeclaree: prolonge };
  }

  /**
   * CE QUI RESTE À DÉCLARER · nommé, jamais deviné. Les lignes d'à-nouveau
   * sans devise, sur une créance, une dette ou une disponibilité, des
   * exercices ouverts, qu'aucune déclaration n'a encore tranchées · venues
   * d'un IMPORT, ou du REPORT au détail d'une ligne importée restée non
   * déclarée à la clôture, appariée LIGNE À LIGNE (relecture adverse, M2 ·
   * `apparierReports`), jamais par compte · un report ordinaire, issu de
   * lignes saisies, n'y entre pas, sa devise suit le report (F54, F55). Une
   * ligne importée non déclarée dont le report ne se retrouve pas (report au
   * SOLDE, lignes identiques en nombre différent) est NOMMÉE dans
   * `nonRetrouvees`. Un dossier sans autre devise que la monnaie de tenue n'a
   * rien à déclarer, et la réponse le dit.
   */
  async restantADeclarer(tenantId: string) {
    const devises = await this.prisma.devise.findMany({ where: { tenantId }, select: { id: true, code: true } });
    const etrangeres = devises.filter((d) => d.code.toUpperCase() !== MONNAIE_DE_TENUE);
    if (etrangeres.length === 0) {
      return {
        sansDeviseEtrangere: true,
        lignes: [] as LigneRestantADeclarer[],
        total: 0,
        tronque: false,
        nonRetrouvees: [] as ReportNonRetrouve[],
      };
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
    if (!tenant) throw new NotFoundException('Dossier introuvable');
    const [exercices, declarations, horsMouvements] = await Promise.all([
      this.prisma.exercice.findMany({
        where: { tenantId },
        orderBy: { dateDebut: 'asc' },
        select: { id: true, statut: true, dateDebut: true, dateFin: true },
      }),
      this.prisma.declarationDeviseANouveau.findMany({
        where: { tenantId },
        select: { ligneOrigineId: true, lignesResultantes: true, ecritureCorrectionId: true },
      }),
      this.ecrituresHorsMouvements(tenantId),
    ]);
    const declarees = new Set<string>();
    const corrections = new Set<string>();
    for (const d of declarations) {
      declarees.add(d.ligneOrigineId);
      for (const id of Array.isArray(d.lignesResultantes) ? (d.lignesResultantes as string[]) : []) declarees.add(id);
      if (d.ecritureCorrectionId) corrections.add(d.ecritureCorrectionId);
    }

    const sortie: LigneRestantADeclarer[] = [];
    const nonRetrouvees: ReportNonRetrouve[] = [];
    let total = 0;
    let lectureTronquee = horsMouvements.tronque;
    // Les lignes de l'exercice précédent restées en attente (importées ou
    // héritées, non déclarées, non soldées par un lettrage) · seul leur
    // report au détail en hérite.
    let enAttente: LigneLue[] = [];
    let precedent: { statut: StatutExercice; libelle: string } | null = null;
    for (const ex of exercices) {
      const lignes = await this.prisma.ligneEcriture.findMany({
        where: {
          deviseId: null,
          ecriture: {
            tenantId,
            exerciceId: ex.id,
            estGenereeParCloture: true,
            estANouveauProvisoire: false,
            estSoldeDesComptesDeGestion: false,
            ...(corrections.size > 0 ? { id: { notIn: [...corrections] } } : {}),
          },
          OR: [{ debit: { not: 0 } }, { credit: { not: 0 } }],
        },
        select: SELECT_LIGNE,
        orderBy: [{ compte: { numero: 'asc' } }, { id: 'asc' }],
        take: PLAFOND_LECTURE_PAR_EXERCICE,
      });
      if (lignes.length === PLAFOND_LECTURE_PAR_EXERCICE) lectureTronquee = true;
      const ouvertes = lignes.filter(
        (l) => !declarees.has(l.id) && Math.abs(Number(l.debit) - Number(l.credit)) >= 0.005,
      );
      const importees = ouvertes.filter(
        (l) => l.ecriture.reference === 'IMPORT' && seReevalueALaCloture(l.compte.numero, tenant.referentiel),
      );
      // Le report n'existe qu'une fois l'exercice précédent clôturé · avant,
      // seul l'à-nouveau provisoire (écarté) le porte, et rien n'est nommé.
      let herites: LigneLue[] = [];
      if (enAttente.length > 0 && precedent?.statut === StatutExercice.CLOTURE) {
        const appariement = apparierReports(
          enAttente.map((o) => ({ ligne: o, cle: cleDuReport(versLigneDeReport(o), o.compte.numero) })),
          ouvertes
            .filter((r) => r.ecriture.reference !== 'IMPORT')
            .map((r) => ({ ligne: r, cle: cleDeLigne(versLigneDeReport(r)) })),
        );
        herites = appariement.herites;
        for (const [o, motif] of [
          ...appariement.nonRetrouvees.map((o) => [o, 'NON_RETROUVE'] as const),
          ...appariement.ambigues.map((o) => [o, 'AMBIGU'] as const),
        ]) {
          if (nonRetrouvees.length >= PLAFOND_LISTE) {
            lectureTronquee = true;
            break;
          }
          nonRetrouvees.push({
            exercice: precedent.libelle,
            exerciceSuivant: libelleExercice(ex),
            compteNumero: o.compte.numero,
            montant: Math.round((Number(o.debit) - Number(o.credit)) * 100) / 100,
            motif,
          });
        }
      }
      const candidates = [...importees, ...herites];
      enAttente = candidates.filter((l) => !l.lettre);
      precedent = { statut: ex.statut, libelle: libelleExercice(ex) };
      if (ex.statut === StatutExercice.CLOTURE || candidates.length === 0) continue;
      // Ce que l'exercice dit se lit UNE fois · les lignes d'à-nouveau d'un
      // exercice partagent sa date. Les mouvements en francs (B1) se lisent
      // par compte et par sens, une fois chacun.
      const contexteExercice = await this.contexteDeLExercice(tenantId, ex, candidates[0].ecriture.date);
      const reglementsLus = new Map<string, ContexteDeclaration['reglementsEnFrancs']>();
      for (const l of candidates) {
        total++;
        if (sortie.length >= PLAFOND_LISTE) continue;
        const cle = `${l.compteId}|${Math.sign(Number(l.debit) - Number(l.credit))}|${l.ecriture.reference === 'IMPORT'}`;
        let reglements = reglementsLus.get(cle);
        if (!reglements) {
          reglements = await this.reglementsEnFrancs(tenantId, l, horsMouvements.ids);
          reglementsLus.set(cle, reglements);
        }
        sortie.push({
          ligneId: l.id,
          exerciceId: ex.id,
          exercice: libelleExercice(ex),
          date: l.ecriture.date.toISOString().slice(0, 10),
          piece: l.ecriture.numeroPiece,
          origine: l.ecriture.reference === 'IMPORT' ? 'IMPORT' : 'REPORT',
          statut: l.ecriture.statut,
          compteNumero: l.compte.numero,
          compteIntitule: l.compte.intitule,
          montant: Math.round((Number(l.debit) - Number(l.credit)) * 100) / 100,
          // Une candidate n'est ni déclarée, ni le report d'une déclarée · elle
          // vient d'un import ou d'une origine en attente.
          motifRefus: motifRefusLigne(versLigneADeclarer(l), tenant.referentiel, {
            ...contexteExercice,
            dejaDeclaree: false,
            prolongeUneLigneDeclaree: false,
            reglementsEnFrancs: reglements,
          }),
        });
      }
    }
    return {
      sansDeviseEtrangere: false,
      lignes: sortie,
      total,
      tronque: lectureTronquee || total > sortie.length,
      nonRetrouvees,
    };
  }

  /** Déclare, sous le verrou des devises du dossier. */
  async declarer(tenantId: string, userId: string, entree: DeclarerDeviseANouveauEntree) {
    return this.devises.sousVerrouDuDossier(tenantId, 'DÉCLARATION DE LA DEVISE D’UN À-NOUVEAU', () =>
      this.declarerSousVerrou(tenantId, userId, entree),
    );
  }

  private async declarerSousVerrou(tenantId: string, userId: string, entree: DeclarerDeviseANouveauEntree) {
    const source = (entree.source ?? '').trim();
    if (source.length < 3 || source.length > 500) {
      throw new BadRequestException(
        'La source est exigée (3 à 500 caractères) · la pièce qui établit la devise et le montant en devise (facture, contrat, relevé).',
      );
    }
    const ligne = await this.prisma.ligneEcriture.findFirst({
      where: { id: entree.ligneId, ecriture: { tenantId } },
      select: SELECT_LIGNE,
    });
    if (!ligne) throw new NotFoundException('Ligne introuvable');
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { referentiel: true } });
    if (!tenant) throw new NotFoundException('Dossier introuvable');

    const lue = versLigneADeclarer(ligne);
    const refus = motifRefusLigne(lue, tenant.referentiel, await this.contexte(tenantId, ligne));
    if (refus) throw new ConflictException(refus);
    const montantLigne = Math.abs(lue.debit - lue.credit);
    const devises = await this.prisma.devise.findMany({ where: { tenantId }, select: { id: true, code: true } });
    const parts = entree.parts ?? [];
    const refusParts = motifRefusParts(parts, montantLigne, new Map(devises.map((d) => [d.id, d])));
    if (refusParts) throw new BadRequestException(refusParts);

    const exactes = lignesExactes(lue, parts);
    const detailParts = parts.map((p, i) => ({
      deviseId: p.deviseId,
      devise: devises.find((d) => d.id === p.deviseId)?.code ?? '',
      montantDevise: p.montantDevise,
      coursApplique: exactes[i].coursApplique,
      montant: exactes[i].montant,
    }));
    const resteEnFrancs = Math.round((montantLigne - detailParts.reduce((s, p) => s + p.montant, 0)) * 100) / 100;
    const base = {
      tenantId,
      exerciceId: ligne.ecriture.exerciceId,
      ecritureOrigineId: ligne.ecritureId,
      ligneOrigineId: ligne.id,
      compteId: ligne.compteId,
      montantLigne: Math.round(montantLigne * 100) / 100,
      parts: detailParts as unknown as Prisma.InputJsonValue,
      resteEnFrancs,
      source,
      createdBy: userId,
    };

    // ENTIÈREMENT EN FRANCS · rien ne change à la ligne, la déclaration seule
    // la sort de la liste.
    if (parts.length === 0) {
      const d = await this.prisma.declarationDeviseANouveau.create({ data: { ...base, mode: 'EN_FRANCS' } });
      return { declaration: d, ecritureCorrectionId: null, messages: ['Ligne déclarée en francs · rien n’est changé.'] };
    }

    if (ligne.ecriture.statut === StatutEcriture.BROUILLARD) {
      return this.declarerAuBrouillard(tenantId, ligne, exactes, base);
    }
    return this.declarerParCorrection(tenantId, userId, ligne, exactes, base);
  }

  /**
   * AU BROUILLARD · la ligne n'est pas entrée au livre-journal (AUDCIF
   * art. 22, 2°) · elle reçoit la première part, les suivantes et le reste
   * naissent dans la même pièce, sur le même compte. Le statut est relu DANS
   * la transaction · validée entre-temps, la pièce se corrige par
   * inscription en négatif, et le geste se refait.
   */
  private async declarerAuBrouillard(
    tenantId: string,
    ligne: LigneLue,
    exactes: ReturnType<typeof lignesExactes>,
    base: Omit<Prisma.DeclarationDeviseANouveauUncheckedCreateInput, 'mode'>,
  ) {
    return transactionJournalisee(this.prisma, async (tx) => {
      const encore = await tx.ecriture.count({
        where: { id: ligne.ecritureId, tenantId, statut: StatutEcriture.BROUILLARD },
      });
      if (encore !== 1) {
        throw new ConflictException("L'à-nouveau a été validé entre-temps · refaites la déclaration, elle s'inscrira en négatif.");
      }
      const [premiere, ...suivantes] = exactes;
      const montants = (m: number, sensDebit: boolean) => (sensDebit ? { debit: m, credit: 0 } : { debit: 0, credit: m });
      // Une mise à jour UNITAIRE, filtrée sur ce qui a été lu · une ligne
      // lettrée ou réécrite entre-temps fait échouer le geste entier.
      const { count } = await tx.ligneEcriture.updateMany({
        where: { id: ligne.id, deviseId: null, lettrageId: null, rapprochementId: null, debit: ligne.debit, credit: ligne.credit },
        data: {
          ...montants(premiere.montant, premiere.sensDebit),
          deviseId: premiere.deviseId,
          montantDevise: premiere.montantDevise,
          coursApplique: premiere.coursApplique,
        },
      });
      if (count !== 1) throw new ConflictException('La ligne a changé entre la lecture et la déclaration · relisez-la.');
      const creees: string[] = [];
      for (const p of suivantes) {
        const c = await tx.ligneEcriture.create({
          data: {
            ecritureId: ligne.ecritureId,
            compteId: ligne.compteId,
            libelle: ligne.libelle,
            dateEcheance: ligne.dateEcheance,
            ...montants(p.montant, p.sensDebit),
            deviseId: p.deviseId,
            montantDevise: p.montantDevise,
            coursApplique: p.coursApplique,
          },
          select: { id: true },
        });
        creees.push(c.id);
      }
      const declaration = await tx.declarationDeviseANouveau.create({
        data: { ...base, mode: 'BROUILLARD', lignesResultantes: [ligne.id, ...creees] },
      });
      return {
        declaration,
        ecritureCorrectionId: null,
        messages: [`À-nouveau au brouillard complété en place · ${exactes.length} ligne(s) sur le compte ${ligne.compte.numero}.`],
      };
    });
  }

  /**
   * VALIDÉE · inscription en NÉGATIF de la ligne, puis ses parts exactes
   * (AUDCIF art. 20, al. 2), dans UNE pièce de correction validée, au journal
   * et à la date de l'à-nouveau (au premier jour non clôturé si la période
   * l'est, art. 22, 4°), rangée comme lui dans la colonne d'ouverture. Le
   * négatif est lettré avec la ligne qu'il annule quand le lettrage le permet
   * (compte lettrable, rien de figé) · sans quoi les deux resteraient ouverts
   * au détail du tiers et au report suivant.
   */
  private async declarerParCorrection(
    tenantId: string,
    userId: string,
    ligne: LigneLue,
    exactes: ReturnType<typeof lignesExactes>,
    base: Omit<Prisma.DeclarationDeviseANouveauUncheckedCreateInput, 'mode'>,
  ) {
    const debitOrigine = Number(ligne.debit);
    const creditOrigine = Number(ligne.credit);
    const lignesCorrection = [
      { compteId: ligne.compteId, debit: -debitOrigine, credit: -creditOrigine },
      ...exactes.map((p) => ({
        compteId: ligne.compteId,
        debit: p.sensDebit ? p.montant : 0,
        credit: p.sensDebit ? 0 : p.montant,
        deviseId: p.deviseId,
        montantDevise: p.montantDevise,
        coursApplique: p.coursApplique,
      })),
    ];
    const { journal, date, dateValeur } = await this.ecritureService.controlesDEntree(tenantId, {
      exerciceId: ligne.ecriture.exerciceId,
      journalId: ligne.ecriture.journalId,
      date: ligne.ecriture.date,
      lignes: lignesCorrection,
      reporterAuPremierJourOuvert: true,
      exigerVentilationObligatoire: false,
    });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { doubleRegardValidation: true } });
    const doubleRegard = tenant?.doubleRegardValidation === true;
    const messages: string[] = [];
    const resultat = await transactionJournalisee(this.prisma, async (tx) => {
      const encore = await tx.ligneEcriture.count({
        where: { id: ligne.id, deviseId: null, lettrageId: null, rapprochementId: null, ecriture: { tenantId } },
      });
      if (encore !== 1) throw new ConflictException('La ligne a été lettrée ou pointée entre la lecture et la déclaration · relisez-la.');
      const numeroPiece = await prochainNumeroPiece(tx, tenantId, journal, ligne.ecriture.exerciceId, date);
      const ecriture = await tx.ecriture.create({
        data: {
          tenantId,
          exerciceId: ligne.ecriture.exerciceId,
          journalId: ligne.ecriture.journalId,
          numeroPiece,
          date,
          dateValeur,
          libelle: `Devise déclarée · à-nouveau ${ligne.compte.numero}`.slice(0, 250),
          reference: REFERENCE_DECLARATION_DEVISE,
          motifCorrection:
            `Devise de la ligne d'à-nouveau ${ligne.compte.numero} déclarée · ${String(base.source)}`.slice(0, 500) +
            ' · AUDCIF art. 20, al. 2.',
          // UNE SAISIE DU CABINET, pas une écriture de clôture (relecture
          // adverse, M3) · sans `estGenereeParCloture`, elle reste au contrôle
          // VALIDATION_PAR_SON_AUTEUR et au test des écritures de journal
          // (ISA 240 § 33 a). Elle est reconnue par sa LIAISON à la
          // déclaration (`ecritureCorrectionId`) · liste, lecture des
          // mouvements en francs (B1), détenteurs. En francs, elle se compense
          // compte par compte · la colonne des mouvements n'en bouge pas.
          createdBy: userId,
          // VALIDÉE comme la ligne qu'elle corrige (précédent D6 d'A6) ·
          // laissée au brouillard, l'à-nouveau validé resterait seul au
          // livre-journal. SOUS LE DOUBLE REGARD (`doubleRegardValidation`,
          // § 10 ter), elle reste au BROUILLARD, validée par un autre
          // utilisateur que l'auteur · la refuser enfermait la déclaration de
          // tout à-nouveau validé de ce dossier.
          ...(doubleRegard
            ? { statut: StatutEcriture.BROUILLARD }
            : { statut: StatutEcriture.VALIDEE, valideeAt: new Date(), valideeBy: userId }),
          lignes: { create: lignesCorrection.map((l) => ({ ...l, libelle: ligne.libelle, dateEcheance: ligne.dateEcheance })) },
        },
        select: { id: true, lignes: { select: { id: true, debit: true, credit: true, deviseId: true } } },
      });
      const negatif = ecriture.lignes.find((l) => Number(l.debit) === -debitOrigine && Number(l.credit) === -creditOrigine && !l.deviseId);
      const lettrable = await tx.compte.findFirst({ where: { id: ligne.compteId, tenantId, lettrable: true }, select: { id: true } });
      if (negatif && lettrable) {
        const figees = await lignesFigees(tx, tenantId, [ligne.id, negatif.id]);
        if (figees.size === 0) {
          const code = (await prochaineLettreDuCompte(tx, tenantId, ligne.compteId))();
          if (await poserGroupeSoldeDuModule(tx, { tenantId, compteId: ligne.compteId, ligneIds: [ligne.id, negatif.id], userId, code })) {
            messages.push(`Ligne d'origine lettrée (${code}) avec son inscription en négatif.`);
          }
        } else {
          messages.push("Ligne d'origine et inscription en négatif non lettrées · une clôture fige le premier jour.");
        }
      }
      const declaration = await tx.declarationDeviseANouveau.create({
        data: {
          ...base,
          mode: 'CORRECTION',
          ecritureCorrectionId: ecriture.id,
          lignesResultantes: ecriture.lignes.map((l) => l.id),
        },
      });
      return { declaration, ecritureCorrectionId: ecriture.id };
    });
    messages.unshift(
      `Pièce de correction passée · la ligne validée inscrite en négatif puis ses ${exactes.length} part(s) exacte(s) (AUDCIF art. 20, al. 2).`,
      ...(doubleRegard
        ? ['Double regard actif · la pièce de correction reste au brouillard, à valider par un autre utilisateur que vous.']
        : []),
    );
    return { ...resultat, messages };
  }
}
