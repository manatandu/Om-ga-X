import { montant } from './montants';
import type { LigneNoteCalculee } from './types';

/**
 * LA PART NON VENTILÉE PAR ÉCHÉANCE, DITE À L'ÉCRAN DES NOTES (paquet 1,
 * A10, reproduit sur vraie base le 2026-10-09).
 *
 * Le serveur range chaque ligne de tiers OUVERTE à la clôture par sa date
 * d'échéance, et sert à part le RESTE du solde qu'aucune échéance ne range
 * (`echeanceNonVentilee`, audit final F10) · ce n'est pas une quatrième
 * échéance, c'est ce que la tenue n'a pas daté. L'export le disait en
 * commentaire de cellule ; l'écran ne le disait pas, si bien que les colonnes
 * d'échéance s'y lisaient complètes alors qu'elles laissaient une part du
 * solde de côté (400 000 sur 1 400 000 au banc).
 *
 * Hors du composant, parce que les specs client ne chargent jamais React
 * (`specs-sans-react.spec.ts`) · c'est ici que la phrase affichée se teste.
 * Le serveur ne sert le champ que non nul (au demi-centime) ; la garde est
 * reprise pour qu'un zéro servi par erreur ne fasse pas une ligne « 0,00 ».
 */
export const TITRE_PART_NON_VENTILEE = 'Part non ventilée par échéance';

/** La phrase sous la ligne, ou `null` quand rien n'est laissé de côté. */
export function phrasePartNonVentilee(ligne: Pick<LigneNoteCalculee, 'echeanceNonVentilee'>): string | null {
  const m = ligne.echeanceNonVentilee;
  if (typeof m !== 'number' || !Number.isFinite(m) || Math.abs(m) < 0.005) return null;
  return `${TITRE_PART_NON_VENTILEE} : ${montant(m)} · rangée dans aucune colonne d'échéance.`;
}

/**
 * Le pourquoi, pour la bulle. Une part NÉGATIVE se lit spontanément comme une
 * créance (ou une dette) négative ; elle n'en est pas une · ce sont des
 * mouvements non datés et non lettrés qui dépassent les lignes datées. Même
 * lecture que le commentaire de la NOTE 3 des deux SMT
 * (`exports/etat-etafi.ts`, `NOTE_PART_NON_VENTILEE_NEGATIVE`).
 */
export function aidePartNonVentilee(ligne: Pick<LigneNoteCalculee, 'echeanceNonVentilee'>): string {
  const m = ligne.echeanceNonVentilee ?? 0;
  if (m < 0) {
    return (
      'Part négative · des mouvements sans date d’échéance (un règlement non lettré, le plus souvent) dépassent les ' +
      'lignes datées. Ce n’est pas un montant dû ni recouvrable : les colonnes d’échéance rangent les lignes datées, ' +
      'et ce reste les ramène au solde. Lettrer les mouvements du compte pour la résorber.'
    );
  }
  return (
    'Les colonnes d’échéance ne rangent que les lignes ouvertes à la clôture qui portent une date d’échéance. Le ' +
    'reste du solde (ligne saisie sans échéance, report à-nouveau en solde) n’est rangé dans aucune colonne : le ' +
    'mettre d’office à un an au plus donnerait une ventilation complète et fausse. Saisir la date d’échéance des ' +
    'lignes de tiers, et tenir ces comptes en report à-nouveau au détail.'
  );
}
