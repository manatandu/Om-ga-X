/**
 * CONTRÔLE 36 · LES COMPTES 4334 ET 4335 D'UN DOSSIER SEMÉ AVANT LA DÉCISION T1.
 *
 * DÉCISION T1 DU 2026-10-07 (`docs/decisions-par-la-loi-paie-2026-10-07.md`).
 * L'INPP et l'ONEM sont des impôts et taxes, pas des cotisations sociales · la
 * fiche du compte 64 des deux textes (AUDCIF Titre VII ; SYCEBNL Partie 2
 * ch. 3) range « les versements institués par les autorités pour le
 * financement d'actions d'intérêt général », débités « par le crédit du compte
 * 44 », et la fiche du compte 66 exclut « les impôts dont l'assiette repose sur
 * la rémunération ». Charge au 64150000 (INPP) et au 64130000 (ONEM), dette au
 * 44280000 « Autres impôts et taxes ».
 *
 * OmegaX avait semé 43340000 et 43350000 sous le 433 « Autres organismes
 * sociaux ». Les dossiers nouveaux ne les reçoivent plus ; les dossiers déjà
 * semés les gardent, et RIEN N'EST TOUCHÉ D'OFFICE · un compte mouvementé ne se
 * supprime pas, une écriture validée ne se retouche que par inscription en
 * négatif (AUDCIF art. 20), et la réimputation du point 9 en est le chemin. Ce
 * contrôle NOMME ce qui reste, compte par compte, avec l'issue qui convient à
 * l'exercice examiné.
 *
 * INFORMATION, JAMAIS AVERTISSEMENT · le solde de la dette est juste, la
 * balance boucle, seule la NATURE du compte est contestée. Et le registre des
 * retenues lit toujours ces comptes (nature `inppOnem`), si bien que rien de
 * dû n'est perdu en route.
 */
import type { AnomalieControle } from './controles.service';

/** Les deux racines semées par OmegaX avant la décision T1. */
export const RACINES_ANCIENNES_INPP_ONEM = ['4334', '4335'] as const;

export const estCompteAncienInppOnem = (numero: string): boolean =>
  RACINES_ANCIENNES_INPP_ONEM.some((r) => numero.startsWith(r));

export type CompteAncienInppOnem = {
  readonly numero: string;
  readonly intitule: string;
  readonly estActif: boolean;
  /** Lignes du compte, tous exercices confondus. */
  readonly lignesTotal: number;
  /** Lignes de l'exercice examiné qu'une saisie a portées (hors report). */
  readonly lignesSaisiesExercice: number;
  /** Lignes de l'exercice examiné nées d'une clôture (à-nouveau). */
  readonly lignesReportExercice: number;
  /** Crédits moins débits de l'exercice examiné, report compris. */
  readonly soldeCrediteurExercice: number;
};

export function anomalieInppOnemSousLe433(
  comptes: readonly CompteAncienInppOnem[],
  exerciceClos: boolean,
): AnomalieControle | null {
  const occurrences: AnomalieControle['occurrences'] = [];
  for (const c of [...comptes].sort((a, b) => a.numero.localeCompare(b.numero))) {
    const reference = `${c.numero} ${c.intitule}`;
    const mouvementeIci = c.lignesSaisiesExercice + c.lignesReportExercice > 0;
    const montant = Math.round(c.soldeCrediteurExercice * 100) / 100;
    if (mouvementeIci && exerciceClos) {
      occurrences.push({
        reference,
        detail:
          "Exercice clôturé · rien n'y est réimputé ni corrigé. Le solde reporté s'apure dans l'exercice ouvert qui suit, à son paiement, sur ce même compte.",
        montant,
      });
      continue;
    }
    if (c.lignesSaisiesExercice > 0) {
      occurrences.push({
        reference,
        detail:
          `${c.lignesSaisiesExercice} ligne(s) saisie(s) dans cet exercice · à réimputer vers le 44280000 « Autres impôts et taxes » ` +
          '(Recherche d’écritures filtrée sur ce compte, puis Réimputer). Validées, elles sont inscrites en négatif sur ce compte et reprises au 4428.',
        montant,
      });
      continue;
    }
    if (c.lignesReportExercice > 0) {
      occurrences.push({
        reference,
        detail:
          "Seul le report à-nouveau mouvemente ce compte dans cet exercice · une écriture de report ne se réimpute pas. Le solde s'apure à son paiement, sur ce même compte ; les dettes suivantes vont au 44280000.",
        montant,
      });
      continue;
    }
    if (c.lignesTotal === 0 && c.estActif) {
      occurrences.push({
        reference,
        detail: 'Jamais mouvementé · mettez-le en sommeil (Plan comptable) pour qu’aucune saisie ne le choisisse plus.',
      });
    }
  }
  if (occurrences.length === 0) return null;
  return {
    code: 'INPP_ONEM_SOUS_LE_433',
    gravite: 'INFORMATION',
    libelle: 'INPP ou ONEM sur un compte 433 semé avant la décision du 7 octobre 2026',
    consequence:
      "L'INPP et l'ONEM sont des impôts et taxes · la fiche du compte 64 des deux textes les débite par le crédit du compte 44, et la fiche du compte 66 " +
      "exclut les impôts assis sur la rémunération. Leur dette va au 44280000 « Autres impôts et taxes », leur charge au 64150000 (INPP) et au 64130000 " +
      "(ONEM). Le solde porté au 4334 ou au 4335 est juste, seule la nature du compte l'est moins · le registre des retenues continue de le lire.",
    action:
      "Dans un exercice ouvert, réimputez les lignes saisies vers le 44280000, et reclassez par une écriture d'opérations diverses la charge passée au " +
      '66410000 vers le 64150000 et le 64130000. Dans un exercice clôturé, rien ne se touche. Un compte que rien ne mouvemente plus se met en sommeil, ' +
      "jamais ne se supprime s'il a été mouvementé.",
    occurrences,
  };
}
