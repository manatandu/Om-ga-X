import { Referentiel, StatutEcriture, StatutExercice } from '@prisma/client';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { libelleExercice } from '../../common/libelle-exercice';
import { motifRefusLigneEnDevise } from '../comptabilite/ligne-en-devise';
import { motifLignesTenues } from '../comptabilite/lignes-tenues';
import { motifHorsReevaluation, seReevalueALaCloture } from './perimetre-reevaluation';

/**
 * DÉCLARER LA DEVISE D'UNE LIGNE D'À-NOUVEAU DÉJÀ PASSÉE (ligne AU3,
 * 2026-10-08).
 *
 * LE DÉFAUT · une balance d'ouverture importée avant que l'import ne lise la
 * devise a fait d'une créance de 1 500 USD (3 200 000 FC au cours d'origine)
 * une ligne en francs. La réévaluation de clôture ne lit que les lignes qui
 * portent une devise · la créance restait au bilan pour 3 200 000 quand le
 * dernier cours de clôture (2 400) en faisait 3 600 000. Or « lorsque les
 * créances et dettes libellées en monnaies étrangères subsistent au bilan à
 * la date de clôture, leur enregistrement initial est corrigé sur la base du
 * dernier cours de change à cette date » (AUDCIF art. 54 ; Titre VIII ch. 22
 * § 2.2).
 *
 * RIEN N'EST DEVINÉ. Un 411 en francs peut réunir des factures en francs et
 * d'autres en dollars ; un libellé « USD » ne prouve rien. Seul le cabinet
 * DÉCLARE, pièce à l'appui (la SOURCE est exigée), quelle part de la ligne
 * est en quelle devise et pour quel montant en devise · le reste est en
 * francs. Une ligne déclarée « en francs » sort de la liste, rien n'est
 * changé.
 *
 * LA DÉCLARATION SUIT L'ÉTAT DE LA LIGNE (AUDCIF art. 22, 2° et art. 20) ·
 *  · AU BROUILLARD, la ligne n'est pas entrée au livre-journal · elle se
 *    complète en place (sa part en devise reçoit devise, montant et cours ;
 *    les autres parts et le reste deviennent des lignes du même compte dans
 *    la même pièce, qui reste équilibrée) ;
 *  · VALIDÉE, « l'irréversibilité des traitements interdise toute
 *    suppression, addition ou modification ultérieure » (art. 22, 2°) · la
 *    correction « s'effectue exclusivement par inscription en négatif des
 *    éléments erronés ; l'enregistrement exact est ensuite opéré » (art. 20,
 *    al. 2) · une pièce de correction, à la date de l'à-nouveau, inscrit la
 *    ligne en négatif puis ses parts exactes, et se range comme l'à-nouveau
 *    dans la colonne d'ouverture de la balance. Le montant en francs du
 *    compte ne bouge pas · seule la devise s'ajoute.
 *
 * QUATRE REFUS, chacun avec son issue.
 *  1. La ligne est LETTRÉE ou POINTÉE · le lettrage affirme qu'elle est
 *     soldée, le pointage qu'elle concorde avec un relevé (même refus que la
 *     correction, `motifLignesTenues`).
 *  2. Une RÉÉVALUATION non annulée de l'exercice l'a déjà lue (en francs) ·
 *     la déclarer après coup ferait passer une seconde fois une position que
 *     la réévaluation a jugée sans devise · issue, annuler la réévaluation
 *     (D6), déclarer, réévaluer.
 *  3. L'EXERCICE PRÉCÉDENT EST ENCORE OUVERT · sa clôture confronte cette
 *     ouverture à son bilan de clôture, compte par compte et DEVISE PAR
 *     DEVISE (AUDCIF art. 34 · SYCEBNL art. 16, 4), ligne AU2) · la devise
 *     déclarée ici serait une divergence que la rectification effacerait ·
 *     issue, déclarer sur l'à-nouveau de l'exercice précédent, ou le
 *     clôturer d'abord.
 *  4. Le compte n'est ni une créance, ni une dette, ni une disponibilité ·
 *     sa devise ne servirait à rien (immobilisation, titre, stock maintenus
 *     au cours historique, ch. 22 section 1), `motifHorsReevaluation`.
 */

/** La devise d'une part, telle que le cabinet la déclare. */
export interface PartDeclaree {
  deviseId: string;
  montantDevise: number;
  /** Le cours appliqué · déduit des deux montants s'il manque (art. 52). */
  coursApplique?: number | null;
  /** La part de la ligne, en monnaie de tenue, positive. */
  montant: number;
}

/** La ligne telle que la déclaration la lit. */
export interface LigneADeclarer {
  numero: string;
  debit: number;
  credit: number;
  deviseId: string | null;
  lettre: string | null;
  lettrageId: string | null;
  rapprochementId: string | null;
  aDesVentilations: boolean;
  ecriture: {
    estGenereeParCloture: boolean;
    estANouveauProvisoire: boolean;
    estSoldeDesComptesDeGestion: boolean;
    statut: StatutEcriture;
    exercice: { statut: StatutExercice; dateDebut: Date; dateFin: Date };
  };
}

/** Une à-nouveau qui fait foi · ni le provisoire d'OmegaX, ni le solde des comptes de gestion. */
export function estLigneDANouveauDeclarable(e: LigneADeclarer['ecriture']): boolean {
  return e.estGenereeParCloture && !e.estANouveauProvisoire && !e.estSoldeDesComptesDeGestion;
}

/** Au plus · une ligne d'à-nouveau ne se découpe pas en cent devises. */
export const PARTS_MAXIMUM = 20;

const EPSILON = 0.005;

/** Un mouvement en francs de sens contraire, postérieur et non lettré (B1). */
export interface ReglementEnFrancs {
  piece: number | null;
  date: Date;
  montant: number;
}

/** Ce que la ligne ne dit pas, lu par le service. */
export interface ContexteDeclaration {
  dejaDeclaree: boolean;
  /**
   * La réévaluation non annulée la plus tardive d'un exercice qui commence au
   * plus tôt avec celui de la ligne (relecture adverse, M1) · celle de
   * l'exercice même, ou d'un exercice POSTÉRIEUR qui a lu le report de cette
   * ligne en francs.
   */
  reevaluationLue: { date: Date; exercice: string; memeExercice: boolean } | null;
  exercicePrecedentOuvert: { libelle: string } | null;
  /**
   * La ligne est le REPORT d'une ligne déjà déclarée (ou d'une part en francs
   * née d'une déclaration) · la redéclarer jugerait deux fois la même
   * position (relecture adverse, M2).
   */
  prolongeUneLigneDeclaree: boolean;
  /** Mouvements en francs de sens contraire, postérieurs, non lettrés (B1), bornés. */
  reglementsEnFrancs: { lignes: ReglementEnFrancs[]; total: number };
}

/**
 * Le motif qui refuse de déclarer cette ligne, avant même de lire les parts ·
 * `null` si elle se déclare. `contexte` porte ce que la ligne ne dit pas ·
 * une réévaluation non annulée de l'exercice, l'exercice précédent ouvert,
 * une déclaration déjà faite.
 */
export function motifRefusLigne(
  l: LigneADeclarer,
  referentiel: Referentiel,
  contexte: ContexteDeclaration,
): string | null {
  if (!estLigneDANouveauDeclarable(l.ecriture)) {
    return l.ecriture.estANouveauProvisoire
      ? "Cette ligne est l'à-nouveau PROVISOIRE d'OmegaX, recalculé à chaque relance · déclarez la devise sur la ligne de " +
          "l'exercice précédent qu'il reporte (bilan d'ouverture importé), elle suivra au report."
      : "Seule une ligne d'à-nouveau (bilan d'ouverture importé, ou report de clôture) se déclare ici · une ligne ordinaire " +
          'porte sa devise à la saisie, et se corrige par inscription en négatif (AUDCIF art. 20, al. 2).';
  }
  if (l.ecriture.exercice.statut === StatutExercice.CLOTURE) {
    return (
      `L'exercice ${libelleExercice(l.ecriture.exercice)} est clôturé · ses écritures ne se corrigent plus (AUDCIF art. 20, al. 3). ` +
      "Déclarez la devise sur l'à-nouveau de l'exercice suivant, qui reporte ce compte."
    );
  }
  if (contexte.dejaDeclaree) return 'La devise de cette ligne a déjà été déclarée · la déclaration ne se refait pas.';
  if (contexte.prolongeUneLigneDeclaree) {
    return (
      "Cette ligne reporte une ligne de l'exercice précédent dont la devise a déjà été déclarée (ou la part en francs d'une " +
      'déclaration) · la déclarer de nouveau jugerait deux fois la même position.'
    );
  }
  if (l.deviseId) return 'Cette ligne porte déjà sa devise.';
  if (!seReevalueALaCloture(l.numero, referentiel)) {
    return (
      `Le compte ${l.numero} n'est ni une créance, ni une dette, ni une disponibilité · ` +
      `${motifHorsReevaluation(l.numero, referentiel)}. Sa devise ne changerait rien.`
    );
  }
  const tenue = motifLignesTenues([l], 'cette ligne', 'déclarer sa devise');
  if (tenue) return tenue;
  if (l.aDesVentilations) {
    return "Cette ligne est ventilée en analytique · retirez sa ventilation d'abord, la déclaration découperait la ligne sans elle.";
  }
  if (contexte.reevaluationLue) {
    const r = contexte.reevaluationLue;
    return (
      `La réévaluation du ${r.date.toISOString().slice(0, 10)} (exercice ${r.exercice}) a déjà lu ce compte, ` +
      (r.memeExercice ? 'cette ligne en francs' : 'le report de cette ligne en francs') +
      ' (AUDCIF art. 54) · déclarer sa devise maintenant ferait juger deux fois la même position. Annulez les réévaluations ' +
      "à partir de la plus récente (« Annuler », AUDCIF art. 20, al. 2), déclarez la devise, puis réévaluez dans l'ordre des exercices."
    );
  }
  if (contexte.reglementsEnFrancs.total > 0) {
    const { lignes, total } = contexte.reglementsEnFrancs;
    const liste = lignes
      .map((m) => `pièce ${m.piece ?? '·'} du ${m.date.toISOString().slice(0, 10)}, ${arrondi(m.montant)}`)
      .join(' ; ');
    return (
      `${total} mouvement(s) en francs de sens contraire, postérieurs à cette ligne et non lettrés, réduisent déjà ce compte ` +
      `(${liste}${total > lignes.length ? ' ; …' : ''}). Sans devise, la réévaluation ne les déduirait pas de la position · ` +
      'elle jugerait la ligne entière et doterait ou reprendrait sur un montant en devise déjà réglé (AUDCIF art. 54). ' +
      'Deux issues · si ce sont des règlements de cette position, porter d’abord leur devise (les annuler, par une ' +
      'contre-passation lettrée avec eux, puis les repasser en devise, AUDCIF art. 20, al. 2) ; si ce sont des règlements ' +
      'd’autres pièces en francs, les lettrer avec ces pièces, et la déclaration ne portera que sur ce qui reste ouvert.'
    );
  }
  if (contexte.exercicePrecedentOuvert) {
    return (
      `L'exercice ${contexte.exercicePrecedentOuvert.libelle} est encore ouvert · sa clôture confrontera cette ouverture à son ` +
      'bilan de clôture, compte par compte et devise par devise (AUDCIF art. 34 · SYCEBNL art. 16, 4)), et la devise déclarée ' +
      "ici y serait un écart. Déclarez-la sur l'à-nouveau de cet exercice (bilan d'ouverture importé) · elle suivra au report · " +
      "ou clôturez-le d'abord."
    );
  }
  return null;
}

/**
 * Le motif qui refuse les PARTS déclarées, ou `null`. Chaque part est une
 * ligne en devise et suit la règle de la saisie (`motifRefusLigneEnDevise` ·
 * devise du dossier, jamais la monnaie de tenue, montant positif,
 * contrevaleur au centime du montant en devise au cours) ; leur somme ne
 * dépasse pas la ligne · le reste est en francs.
 */
export function motifRefusParts(
  parts: PartDeclaree[],
  montantLigne: number,
  devisesDuDossier: Map<string, { code: string }>,
): string | null {
  if (parts.length > PARTS_MAXIMUM) return `Au plus ${PARTS_MAXIMUM} parts par ligne.`;
  let somme = 0;
  for (const [i, p] of parts.entries()) {
    if (!Number.isFinite(p.montant) || p.montant <= 0) return `Part ${i + 1} · son montant en ${MONNAIE_DE_TENUE} est positif.`;
    const motif = motifRefusLigneEnDevise(
      { debit: p.montant, credit: 0, deviseId: p.deviseId, montantDevise: p.montantDevise, coursApplique: p.coursApplique ?? null },
      devisesDuDossier.get(p.deviseId),
    );
    if (motif) return `Part ${i + 1} · ${motif}`;
    somme += p.montant;
  }
  if (somme > montantLigne + EPSILON) {
    return (
      `Les parts déclarées font ${arrondi(somme)} ${MONNAIE_DE_TENUE}, la ligne en porte ${arrondi(montantLigne)} · ` +
      'une déclaration découpe la ligne, elle ne change pas son montant.'
    );
  }
  return null;
}

function arrondi(x: number): number {
  return Math.round(x * 100) / 100;
}

export interface LigneExacte {
  montant: number;
  deviseId: string | null;
  montantDevise: number | null;
  coursApplique: number | null;
  sensDebit: boolean;
}

/**
 * Les lignes EXACTES qui remplacent la ligne déclarée, dans son sens · une par
 * part (avec sa devise), puis le reste en francs s'il y en a un. La somme est
 * celle de la ligne, au centime.
 */
export function lignesExactes(
  l: { debit: number; credit: number },
  parts: PartDeclaree[],
): LigneExacte[] {
  const sensDebit = l.debit - l.credit >= 0;
  const total = arrondi(Math.abs(l.debit - l.credit));
  const sortie: LigneExacte[] = parts.map((p) => ({
    montant: arrondi(p.montant),
    deviseId: p.deviseId,
    montantDevise: p.montantDevise,
    coursApplique:
      p.coursApplique !== null && p.coursApplique !== undefined
        ? p.coursApplique
        : Math.round((p.montant / p.montantDevise) * 1e6) / 1e6,
    sensDebit,
  }));
  const reste = arrondi(total - sortie.reduce((s, p) => s + p.montant, 0));
  if (reste > EPSILON) sortie.push({ montant: reste, deviseId: null, montantDevise: null, coursApplique: null, sensDebit });
  return sortie;
}

/** Une ligne lue pour l'appariement d'un report (relecture adverse, M2). */
export interface LigneDeReport {
  id: string;
  compteId: string;
  debit: number;
  credit: number;
  libelle: string | null;
  dateEcheance: Date | null;
}

function centimes(x: number): number {
  return Math.round(x * 100);
}

/**
 * LA CLÉ D'UNE LIGNE REPORTÉE · compte, montants au centime, échéance et
 * libellé, que le report au DÉTAIL recopie (`report-a-nouveau.ts`, « RAN
 * détail <compte> · <libellé> »), comme `paires-a-cheval.ts` les apparie.
 * Aucun lien en base ne relie une ligne à son report · la clé est tout ce qui
 * les reconnaît.
 */
export function cleDeLigne(l: LigneDeReport): string {
  return [l.compteId, centimes(l.debit), centimes(l.credit), l.dateEcheance?.getTime() ?? '', l.libelle ?? ''].join('|');
}

/** La clé que portera, à l'exercice suivant, le report au DÉTAIL de cette ligne. */
export function cleDuReport(l: LigneDeReport, numeroCompte: string): string {
  return cleDeLigne({ ...l, libelle: `RAN détail ${numeroCompte} · ${l.libelle ?? ''}` });
}

/**
 * L'APPARIEMENT DES REPORTS (relecture adverse, M2) · une ligne d'à-nouveau
 * importée et non déclarée ne transmet son attente qu'à SA ligne reportée,
 * jamais au compte entier (une facture saisie en francs, reportée sur le même
 * compte, sortirait sinon de l'appariement à-nouveau / facture qui sert la
 * TVA à l'encaissement et le lettrage). Par clé · autant de reports que
 * d'origines, ils s'apparient dans l'ordre (des lignes identiques sont
 * interchangeables) ; aucun report (report au SOLDE, ligne soldée), l'origine
 * est NOMMÉE ; un nombre différent, toutes les origines de la clé le sont.
 */
export function apparierReports<O extends { id: string }, R extends { id: string }>(
  origines: Array<{ ligne: O; cle: string }>,
  reports: Array<{ ligne: R; cle: string }>,
): { herites: R[]; nonRetrouvees: O[]; ambigues: O[] } {
  const parCle = new Map<string, R[]>();
  for (const r of reports) parCle.set(r.cle, [...(parCle.get(r.cle) ?? []), r.ligne]);
  const originesParCle = new Map<string, O[]>();
  for (const o of origines) originesParCle.set(o.cle, [...(originesParCle.get(o.cle) ?? []), o.ligne]);
  const herites: R[] = [];
  const nonRetrouvees: O[] = [];
  const ambigues: O[] = [];
  for (const [cle, os] of originesParCle) {
    const rs = parCle.get(cle) ?? [];
    if (rs.length === 0) nonRetrouvees.push(...os);
    else if (rs.length === os.length) herites.push(...rs);
    else ambigues.push(...os);
  }
  return { herites, nonRetrouvees, ambigues };
}
