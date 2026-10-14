import { Referentiel } from '@prisma/client';
import { estCompteDeBien } from './compte-du-bien';
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
}

export function motifRefusLigneACreer(l: LigneACreer): string | null {
  if (l.dejaRattacheeA) return `Cette ligne a déjà fait naître la fiche « ${l.dejaRattacheeA} » · une ligne, un bien.`;
  if (l.estANouveau) {
    return "Ligne d'à-nouveau · le bien est au bilan d'ouverture · créez sa fiche en bien repris (Nouvelle immobilisation, « Bien repris »), sans écriture.";
  }
  if (l.exerciceClos) {
    return "L'écriture est dans un exercice clôturé · le bien est au bilan d'ouverture de l'exercice ouvert · créez sa fiche en bien repris, sans écriture.";
  }
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
  if (l.lignesDeBien > 1 && l.fondsAuCredit.length > 0) {
    return (
      `L'écriture porte ${l.lignesDeBien} biens et crédite un fonds (${l.fondsAuCredit.join(', ')}) · sa reprise ne se ` +
      'répartirait pas entre eux. Corrigez la pièce au journal en une pièce par bien (inscription en négatif puis ' +
      'écriture exacte, AUDCIF art. 20, al. 2), puis créez chaque fiche depuis sa pièce.'
    );
  }
  return null;
}
