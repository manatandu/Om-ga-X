import { Referentiel } from '@prisma/client';
import { motifSimulationNonRattachable } from '../comptabilite/ecritures-de-situation';
import { estCompteDeBien } from './compte-du-bien';
import { contrepartieAcquisitionAdmise, motifRefusContrepartie } from './contrepartie-acquisition';
import { estCompteEnCours } from './immobilisation-en-cours';

/**
 * CRÉER LES BIENS À PARTIR DES ÉCRITURES DÉJÀ PASSÉES (ligne sage-l4,
 * fonction n° 68 · Sage, création automatique des biens) · les règles pures.
 *
 * Le cas courant est la REPRISE D'UN DOSSIER · les acquisitions de l'exercice
 * ont été passées au journal avant que le cabinet ne tienne le registre. La
 * fiche naît alors de la LIGNE d'acquisition, sans nouvelle écriture (une
 * seconde doublerait la valeur brute au bilan, sur une écriture équilibrée),
 * et RETIENT l'écriture comme une acquisition passée par le module.
 *
 * Ce qui ne devient pas une fiche, et pourquoi.
 *  · une ligne au BROUILLARD · l'écriture peut encore changer, et la fiche
 *    garderait une valeur que le journal n'a pas ; elle se valide d'abord
 *    (AUDCIF art. 22, 2°) ;
 *  · une ligne d'un exercice CLÔTURÉ, ou d'un à-nouveau · le bien est au bilan
 *    d'ouverture de l'exercice ouvert, il se crée en bien REPRIS (audit final
 *    F32), sans écriture ;
 *  · une ligne au crédit, ou hors des comptes de bien (21 à 24, et 20 au
 *    SYCEBNL, `estCompteDeBien`), ou sur un en-cours (2x9), dont la fiche
 *    tient deux comptes qu'une ligne ne dit pas ;
 *  · une ligne d'une écriture qu'un module tient déjà (l'acquisition que le
 *    module a passée, une mise en service, un reclassement, une réévaluation…)
 *    · elle n'est pas une acquisition à reprendre ;
 *  · une écriture de PLUSIEURS biens qui crédite un FONDS (subvention en
 *    nature au 14, et au SYCEBNL 167, 171, 172) · la reprise du fonds lit les
 *    lignes de l'écriture d'acquisition du bien, et un fonds commun ne se
 *    répartirait pas entre eux ; ces biens se créent par le module.
 */

/** Ce que le service lit d'une ligne candidate, pour la juger. */
export interface LigneACreer {
  referentiel: Referentiel;
  statutEcriture: string;
  exerciceClos: boolean;
  estANouveau: boolean;
  debit: number;
  numeroCompte: string;
  /** La fiche déjà née de cette ligne. */
  dejaRattacheeA: string | null;
  /** La fiche dont le MODULE a passé cette écriture d'acquisition. */
  acquisitionDuModule: string | null;
  /** Les autres modules qui tiennent l'écriture (libellés de `detenteursDe`). */
  autresModules: string[];
  /** Lignes au débit d'un compte de bien dans l'écriture, celle-ci comprise. */
  lignesDeBien: number;
  /** Comptes de fonds crédités par l'écriture. */
  fondsAuCredit: string[];
  /**
   * Relecture M2 · la pièce de correction qui a inscrit cette écriture en
   * négatif (`Ecriture.correction`), ou null. Corrigée, elle ne porte plus de
   * bien · la ligne exacte est celle de la pièce qui la remplace.
   */
  corrigeeParLaPiece: string | null;
  /** Les comptes crédités par la pièce (ligne au crédit, au signe près). */
  credits: string[];
  /** La pièce porte une ligne EN NÉGATIF sur un compte de bien (correction, réimputation). */
  negatifSurUnCompteDeBien: boolean;
  /**
   * La pièce est du premier jour de l'exercice, passée à un journal qui n'est
   * ni d'achats ni de trésorerie · son code, ou null.
   */
  premierJourHorsAchats: string | null;
  /** Une AUTRE pièce validée inscrit le même montant en négatif à ce compte · son numéro, ou null. */
  memeMontantEnNegatifAilleurs: string | null;
}

/**
 * LES CRÉDITS QUI FONT D'UNE PIÈCE AUTRE CHOSE QU'UNE ACQUISITION (relecture
 * M2) · un compte de bien qui n'est pas une contrepartie admise du bien
 * (reclassement D 2445 / C 2441, échange, mise en service passée à la main
 * hors l'en-cours de la fiche), un amortissement (28) ou une dépréciation
 * (29) · une reprise de bilan d'ouverture ou une sortie, un écart de
 * réévaluation (106) ou une provision spéciale (154) · une réévaluation
 * passée à la main. Les quatre racines sont ouvertes sous ces numéros aux
 * deux plans (AUDCIF Titre VII, comptes 10, 15, 28 et 29 ; SYCEBNL Partie 2
 * ch. 2) · l'en-cours achevé (2x9) et l'avance soldée (251, 252), que les
 * fiches des comptes 21 à 25 admettent, ne sont pas visés.
 */
export function creditsQuiSortentUnBien(referentiel: Referentiel, numeroCompteDuBien: string, credits: readonly string[]): string[] {
  return [
    ...new Set(
      credits.filter(
        (c) =>
          c.startsWith('28') ||
          c.startsWith('29') ||
          c.startsWith('106') ||
          c.startsWith('154') ||
          (estCompteDeBien(referentiel, c) && !contrepartieAcquisitionAdmise(referentiel, numeroCompteDuBien, c)),
      ),
    ),
  ];
}

export function motifRefusLigneACreer(l: LigneACreer): string | null {
  if (l.dejaRattacheeA) return `Cette ligne a déjà fait naître la fiche « ${l.dejaRattacheeA} » · une ligne, un bien.`;
  if (l.estANouveau) {
    return "Ligne d'à-nouveau · le bien est au bilan d'ouverture · créez sa fiche en bien repris (Nouvelle immobilisation, « Bien repris »), sans écriture.";
  }
  if (l.exerciceClos) {
    return "L'écriture est dans un exercice clôturé · le bien est au bilan d'ouverture de l'exercice ouvert · créez sa fiche en bien repris, sans écriture.";
  }
  // Une écriture de SITUATION ne se valide jamais · « validez-la d'abord »
  // serait une issue fermée (ligne sage-l1, intégration).
  if (l.statutEcriture === 'SITUATION') return motifSimulationNonRattachable('de cette ligne', "la naissance d'un bien");
  if (l.statutEcriture !== 'VALIDEE') {
    return "L'écriture est au brouillard · validez-la d'abord (AUDCIF art. 22, 2°), ou créez le bien par « Nouvelle immobilisation », qui passe son écriture.";
  }
  if (!(l.debit > 0)) return 'Seule une ligne au débit fait entrer un bien.';
  if (!estCompteDeBien(l.referentiel, l.numeroCompte)) {
    return `Le ${l.numeroCompte} n'est pas un compte de bien (21 à 24${l.referentiel === Referentiel.SYCEBNL ? ', et 20' : ''}).`;
  }
  if (estCompteEnCours(l.numeroCompte)) {
    return `Le ${l.numeroCompte} est un compte en cours · la fiche d'un bien en cours tient son compte définitif et son en-cours, qu'une ligne ne dit pas.`;
  }
  if (l.acquisitionDuModule) return `L'écriture est l'acquisition que le module a passée pour « ${l.acquisitionDuModule} ».`;
  if (l.autresModules.length > 0) {
    return `L'écriture est tenue par ${l.autresModules.join(', ')} · elle n'est pas une acquisition à reprendre.`;
  }
  if (l.corrigeeParLaPiece !== null) {
    return (
      `L'écriture a été inscrite en négatif par la pièce n° ${l.corrigeeParLaPiece} (AUDCIF art. 20, al. 2) · elle ne porte ` +
      "plus de bien. La ligne exacte est celle de la pièce passée à sa place."
    );
  }
  if (l.negatifSurUnCompteDeBien) {
    return (
      "La pièce inscrit en négatif une ligne d'un compte de bien · c'est une correction ou une réimputation, pas une " +
      "acquisition. Si elle déplace un bien entre deux comptes, inscrivez-la en négatif (Corriger), créez la fiche depuis la " +
      "ligne d'origine, puis reclassez le bien depuis sa fiche · le reclassement du module passe et retient son écriture."
    );
  }
  const sortants = creditsQuiSortentUnBien(l.referentiel, l.numeroCompte, l.credits);
  if (sortants.length > 0) {
    return (
      `La pièce crédite ${sortants.join(', ')} · un amortissement, une dépréciation, un écart de réévaluation ou un autre ` +
      "compte de bien ne sont pas la contrepartie d'une acquisition (fiches des comptes 21 à 24). C'est une reprise de bilan " +
      "d'ouverture (le bien se crée en bien repris, avec son amortissement antérieur, sans écriture), un reclassement ou une " +
      "réévaluation (passés par la fiche du bien, qui retient leur écriture)."
    );
  }
  if (l.lignesDeBien > 1 && l.fondsAuCredit.length > 0) {
    return (
      `L'écriture porte ${l.lignesDeBien} biens et crédite un fonds (${l.fondsAuCredit.join(', ')}) · sa reprise ne se ` +
      'répartirait pas entre eux. Corrigez la pièce au journal en une pièce par bien (inscription en négatif puis ' +
      'écriture exacte, AUDCIF art. 20, al. 2), puis créez chaque fiche depuis sa pièce.'
    );
  }
  return null;
}

/**
 * CE QUI NE REFUSE PAS, MAIS SE DIT (relecture M2) · une contrepartie que les
 * fiches des comptes 21 à 24 n'admettent pas pour ce bien (la création par le
 * module la refuserait, `motifRefusContrepartie`), et le même montant inscrit
 * en négatif à ce compte par une autre pièce, qui peut l'avoir réimputée.
 */
export function avertissementsLigneACreer(l: LigneACreer): string[] {
  const sortants = new Set(creditsQuiSortentUnBien(l.referentiel, l.numeroCompte, l.credits));
  const avertissements = [...new Set(l.credits)]
    .filter((c) => !sortants.has(c))
    .map((c) => motifRefusContrepartie(l.referentiel, l.numeroCompte, c))
    .filter((m): m is string => !!m);
  if (l.memeMontantEnNegatifAilleurs !== null) {
    avertissements.push(
      `La pièce n° ${l.memeMontantEnNegatifAilleurs} inscrit le même montant en négatif à ce compte · si elle réimpute ou ` +
        "corrige cette ligne, le bien ne naît pas d'elle.",
    );
  }
  return avertissements;
}

/**
 * LA PIÈCE DU PREMIER JOUR, HORS ACHATS ET TRÉSORERIE (relecture M2) · le plus
 * souvent la reprise du bilan d'ouverture saisie en opérations diverses, dont
 * le bien est REPRIS (audit final F32) et porte son amortissement antérieur ;
 * née en acquisition, la fiche se doterait comme un bien neuf. Le cabinet
 * confirme que c'est bien une acquisition de ce jour, sinon il crée le bien
 * repris. Null quand rien n'est à confirmer.
 */
export function confirmationPremierJour(l: LigneACreer): string | null {
  if (!l.premierJourHorsAchats) return null;
  return (
    `La pièce est du premier jour de l'exercice, au journal ${l.premierJourHorsAchats} · s'il s'agit de la reprise du bilan ` +
    "d'ouverture, le bien est repris · créez sa fiche en bien repris (Nouvelle immobilisation, « Bien repris »), avec son " +
    "amortissement antérieur, sans écriture. Confirmez seulement une acquisition faite ce jour-là."
  );
}
