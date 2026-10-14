/**
 * MASQUER LES TOTAUX DE LA SAISIE (ligne sage-l1, fonction 11 · Sage 100 i7,
 * « Masquer les totaux » des codes journaux). Une PRÉFÉRENCE DU POSTE, pas une
 * donnée du dossier · elle ne change que ce que la fenêtre de saisie montre,
 * jamais ce que le serveur contrôle.
 *
 * Ce qu'elle cache · les deux lignes de totaux (le journal de la période, la
 * pièce en cours). Ce qu'elle NE cache JAMAIS · l'état d'équilibre de la
 * pièce (« Pièce équilibrée » ou le solde à débiter ou à créditer) et le refus
 * d'enregistrer une pièce déséquilibrée · le serveur refuse de toute façon une
 * écriture dont les débits ne valent pas les crédits.
 *
 * Mémorisée PAR POSTE, comme l'onglet des immobilisations et le choix
 * d'exercice · `localStorage` jette en fenêtre privée, d'où le `try/catch`
 * des deux côtés ; illisible, la préférence vaut « totaux montrés ».
 */
export const CLE_MASQUER_TOTAUX_SAISIE = 'omegax.saisie.masquerTotaux';

/** La préférence lue sur le poste · faux si rien n'est retenu ou si le stockage manque. */
export function lireMasquerTotaux(): boolean {
  try {
    return localStorage.getItem(CLE_MASQUER_TOTAUX_SAISIE) === 'oui';
  } catch {
    return false;
  }
}

/** Retient la préférence sur le poste · un stockage bloqué la laisse pour la seule séance. */
export function memoriserMasquerTotaux(masquer: boolean): void {
  try {
    if (masquer) localStorage.setItem(CLE_MASQUER_TOTAUX_SAISIE, 'oui');
    else localStorage.removeItem(CLE_MASQUER_TOTAUX_SAISIE);
  } catch {
    // Fenêtre privée ou stockage bloqué · la préférence n'est pas retenue.
  }
}
