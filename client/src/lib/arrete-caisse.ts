import { montantSaisi } from './montant-saisi';

/**
 * ARRÊTÉ DE CAISSE · la grille des coupures à l'écran (ligne microfina-m2,
 * idée 5). Les coupures font les espèces · le serveur recalcule leur somme et
 * lit le solde lui-même ; l'écran n'envoie que valeur et nombre, et refuse un
 * champ illisible (vide n'est pas zéro).
 */

export interface CoupureSaisie {
  valeur: string;
  nombre: string;
}

/** La grille proposée · les valeurs du dernier arrêté de la caisse, nombres vides (aucune table de billets écrite de mémoire). */
export function grilleProposee(valeurs: number[]): CoupureSaisie[] {
  const g = valeurs.map((v) => ({ valeur: String(v), nombre: '' }));
  return g.length > 0 ? g : [{ valeur: '', nombre: '' }];
}

/** Les coupures envoyées, ou le motif qui arrête l'envoi · une ligne entièrement vide est ignorée. */
export function coupuresAEnvoyer(grille: CoupureSaisie[]): { coupures: { valeurUnitaire: number; nombre: number }[] } | { motif: string } {
  const sortie: { valeurUnitaire: number; nombre: number }[] = [];
  for (const [i, c] of grille.entries()) {
    if (c.valeur.trim() === '' && c.nombre.trim() === '') continue;
    const v = montantSaisi(c.valeur);
    if (v === null || v <= 0) return { motif: `Coupure ${i + 1} · la valeur faciale est illisible.` };
    const n = montantSaisi(c.nombre);
    if (n === null || !Number.isInteger(n) || n < 0) return { motif: `Coupure ${i + 1} · le nombre doit être un entier.` };
    sortie.push({ valeurUnitaire: v, nombre: n });
  }
  return { coupures: sortie };
}

/** Le total indicatif, en centimes · null tant qu'une ligne est illisible. */
export function totalCoupuresCentimes(grille: CoupureSaisie[]): number | null {
  const r = coupuresAEnvoyer(grille);
  if ('motif' in r) return null;
  return r.coupures.reduce((s, c) => s + Math.round(c.valeurUnitaire * 100) * c.nombre, 0);
}
