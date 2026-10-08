/**
 * LA RÉDUCTION DU TAUX INPP SAISIE À L'ÉCRAN (ordonnance n° 84/186 du
 * 15 octobre 1984, art. 1er, al. 2).
 *
 * Un champ vide vaut « aucune réduction ». Un champ rempli et illisible n'est
 * PAS « aucune réduction » (relecture adverse, mineur b) · le corps de la
 * simulation l'écartait sans un mot, et l'INPP sortait au taux plein sous un
 * champ que le cabinet croyait pris en compte. Le motif est dit sous le champ
 * et l'envoi refusé tant qu'il reste.
 *
 * Seule la FORME est jugée ici (un nombre de points positif, au millième au
 * plus, comme le DTO du serveur l'exige). Le plafond du quart du taux se juge
 * au serveur, sur le taux du mois · il n'est jamais recalculé à l'écran.
 */
export function motifReductionInppIllisible(saisie: string): string | null {
  if (saisie.trim() === '') return null;
  const texte = saisie.replace(/\s/g, '').replace(',', '.');
  const valeur = Number(texte);
  if (!/^\d*\.?\d+$/.test(texte) || Number.isNaN(valeur)) {
    return 'Réduction INPP illisible · saisissez un nombre de points du taux (par exemple 0,5), ou videz le champ.';
  }
  if (valeur <= 0) {
    return 'Réduction INPP nulle · videz le champ s’il n’y a pas de réduction accordée.';
  }
  if (/\.\d{4,}$/.test(texte)) {
    return 'Réduction INPP au-delà du millième de point · arrondissez à trois décimales au plus.';
  }
  return null;
}
