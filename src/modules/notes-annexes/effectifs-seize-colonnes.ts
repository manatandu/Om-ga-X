import { JeuNotesAnnexes } from '@prisma/client';
import type { ColonneNote } from './note-annexe.types';

/**
 * NOTES 20B (projets) ET 29B (associations), 1. PERSONNEL PROPRE · SEIZE
 * COLONNES (décision par la loi du 2026-10-04, point 3).
 *
 * SYCEBNL, Partie 4 ch. 3 (NOTE 20B) et ch. 2 (NOTE 29B), VERBATIM · « Colonnes
 * EFFECTIFS (Nationaux / Autres Etats de la Région / Hors Région / Total) et
 * MASSE SALARIALE (Nationaux / Autres Etats de la Région / Hors Région /
 * Total), ventilées M / F » (29B · « chacune ventilée M (Masculin) / F
 * (Féminin) »). Deux tableaux × quatre zones × M/F · les huit colonnes
 * d'avant, qui portaient « (M / F) » dans UNE cellule, ne reproduisaient pas
 * la contexture. Même forme que la NOTE 27B du SYSCOHADA
 * (`colonnesEffectifs`), avec les zones du texte SYCEBNL (« Région », pas
 * « OHADA ») · on ne transpose pas les intitulés d'un référentiel à l'autre.
 *
 * LE PERSONNEL EXTÉRIEUR ET BÉNÉVOLE GARDE SA COLONNE UNIQUE · la transcription
 * SYCEBNL ne nomme que « Colonne Facturation à l'entité », et le 27B SYSCOHADA
 * ne se transpose pas · à lire sur le PDF du J.O. OHADA, comme E5.
 *
 * UNE SAISIE ANCIENNE N'EST JAMAIS SCINDÉE · la découper reviendrait à deviner
 * la répartition par sexe. La migration `20270144000000_effectifs_seize_colonnes`
 * porte l'ancien rang k au rang `RANG_FORMAT_ANTERIEUR + k`, hors de la
 * contexture · aucune cellule nouvelle ne la lit, la note la montre à part
 * comme saisie au format à huit colonnes, et les seize cellules restent vides
 * jusqu'à ce que le cabinet les remplisse (choix technique qu'aucun texte ne
 * régit).
 */

/** Rang à partir duquel une saisie est conservée hors de la contexture. */
export const RANG_FORMAT_ANTERIEUR = 100;

/** Les huit intitulés d'avant, par rang · pour dire d'où vient la valeur gardée. */
export const LIBELLES_FORMAT_HUIT_COLONNES: readonly string[] = [
  'EFFECTIFS · Nationaux (M / F)',
  'EFFECTIFS · Autres Etats de la Région (M / F)',
  'EFFECTIFS · Hors Région (M / F)',
  'EFFECTIFS · Total (M / F)',
  'MASSE SALARIALE · Nationaux (M / F)',
  'MASSE SALARIALE · Autres Etats de la Région (M / F)',
  'MASSE SALARIALE · Hors Région (M / F)',
  'MASSE SALARIALE · Total (M / F)',
];

/** Les seize colonnes, dans l'ordre du texte. */
export function colonnesEffectifsSycebnl(): ColonneNote[] {
  const zones = ['Nationaux', 'Autres Etats de la Région', 'Hors Région', 'Total'];
  const bloc = (tableau: string) =>
    zones.flatMap((zone) => ['M', 'F'].map((sexe) => ({ type: 'LIBRE' as const, libelle: `${tableau} · ${zone} · ${sexe}` })));
  return [...bloc('EFFECTIFS'), ...bloc('MASSE SALARIALE')];
}

/** Les notes passées à seize colonnes, par jeu · le sous-tableau 1 seul. */
export const NOTES_EFFECTIFS_SEIZE_COLONNES: ReadonlyArray<{ jeu: JeuNotesAnnexes; code: string }> = [
  { jeu: JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS, code: '29B' },
  { jeu: JeuNotesAnnexes.PROJETS_DEVELOPPEMENT, code: '20B' },
];

/** Une valeur saisie au format à huit colonnes, montrée à part. */
export interface SaisieFormatAnterieur {
  cleRubrique: string;
  /** L'intitulé de l'ancienne colonne (« EFFECTIFS · Nationaux (M / F) »). */
  colonneAnterieure: string;
  valeur: string | number;
}
