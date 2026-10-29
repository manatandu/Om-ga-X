/**
 * LA SORTIE GLOBALE DE PLUSIEURS BIENS (ligne immos, fonction n° 69 · Sage
 * Immobilisations, sortie globale et cession multiple, M4 B-65) · les règles
 * pures du LOT. Chaque bien, lui, est jugé par les règles de la sortie
 * ordinaire (`ImmobilisationService.simulerSortie`).
 *
 * UNE PIÈCE JUSTIFICATIVE, UNE ÉCRITURE PAR BIEN. La mise au rebut d'un lot,
 * un vol, une destruction s'appuient sur UN document (procès-verbal de mise
 * au rebut ou de destruction, factures de vente · fiche du compte 81 des deux
 * plans, éléments de contrôle), dont la référence et la date sont exigées
 * (AUDCIF art. 17, 3° et 5°) et recopiées sur chaque écriture. La sortie reste
 * une écriture par bien · la fiche retient son écriture de sortie, unique, et
 * le tableau des immobilisations relit chaque bien sorti avec sa valeur nette.
 *
 * LE PRIX D'UNE CESSION SE DIT PAR BIEN · une vente en bloc à un prix global
 * se répartit par le cabinet, sur la facture ou à défaut sur ses propres
 * critères · aucun texte lu ne fixe la clé, OmegaX n'en devine aucune.
 */

/** Le plafond d'un lot · convention d'OmegaX, tenue aussi par la route. */
export const BIENS_PAR_LOT_MAX = 200;

/** Pourquoi le lot se refuse avant tout bien, ou null. */
export function motifRefusLot(ids: readonly string[], type: 'CESSION' | 'MISE_HORS_SERVICE', prix: readonly (number | undefined)[]): string | null {
  if (ids.length < 2) return 'Une sortie globale porte au moins deux biens · un bien seul sort par « Sortir ».';
  if (ids.length > BIENS_PAR_LOT_MAX) return `Une sortie globale porte au plus ${BIENS_PAR_LOT_MAX} biens · scindez le lot.`;
  if (new Set(ids).size !== ids.length) return 'Un bien figure deux fois dans le lot · il ne sort qu’une fois.';
  if (type === 'CESSION') {
    const sansPrix = prix.filter((p) => p === undefined || p === null).length;
    if (sansPrix > 0) {
      return `${sansPrix} bien(s) du lot sans prix de cession · une cession porte le prix de chaque bien (compte 82), réparti par le cabinet quand la vente est globale.`;
    }
  } else if (prix.some((p) => p !== undefined && p !== null && p > 0)) {
    return 'Une mise hors service ne porte pas de prix · un bien vendu sort en cession.';
  }
  return null;
}

/** Les refus des biens, ensemble · vingt nommés au plus, le total toujours dit. */
export function messageRefusDuLot(refus: readonly { designation: string; motif: string }[], total: number): string {
  const nommes = refus.slice(0, 20).map((r) => `« ${r.designation} » · ${r.motif}`);
  const reste = refus.length > 20 ? ` (et ${refus.length - 20} autre(s))` : '';
  return `Aucun bien n’est sorti · ${refus.length} des ${total} biens du lot sont refusés${reste} · ${nommes.join(' ; ')}`;
}
