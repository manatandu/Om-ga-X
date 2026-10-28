import { montantSaisi } from './montant-saisi';

/**
 * BON DE COMMANDE FOURNISSEUR · la saisie à l'écran (ligne microfina-m2,
 * idée 2). Le serveur calcule et juge seul (montant HT au centime, ligne
 * budgétaire active, engagement TTC prévu) ; l'écran ne fait que lire les
 * champs, refuser l'envoi d'un champ vide ou illisible (vide n'est pas zéro)
 * et afficher un total INDICATIF, jamais envoyé.
 */

export interface LigneSaisie {
  designation: string;
  quantite: string;
  prixUnitaire: string;
  montantTva: string;
  sectionId: string;
}

export const ligneVierge = (): LigneSaisie => ({ designation: '', quantite: '1', prixUnitaire: '', montantTva: '', sectionId: '' });

/** Le corps envoyé, ou le motif qui l'arrête · une taxe vide vaut zéro (elle est facultative), un prix vide ne vaut rien. */
export function corpsDesLignes(lignes: LigneSaisie[]):
  | { lignes: { designation: string; quantite: number; prixUnitaire: number; montantTva?: number; sectionId: string }[] }
  | { motif: string } {
  if (lignes.length === 0) return { motif: 'Ajoutez au moins une ligne.' };
  const sortie = [];
  for (const [i, l] of lignes.entries()) {
    const n = i + 1;
    if (!l.designation.trim()) return { motif: `Ligne ${n} · la désignation manque.` };
    if (!l.sectionId) return { motif: `Ligne ${n} · choisissez la ligne budgétaire.` };
    const q = montantSaisi(l.quantite);
    if (q === null || q <= 0) return { motif: `Ligne ${n} · la quantité est illisible ou nulle.` };
    const pu = montantSaisi(l.prixUnitaire);
    if (pu === null || pu < 0) return { motif: `Ligne ${n} · le prix unitaire est illisible.` };
    const tvaTexte = l.montantTva.trim();
    const tva = tvaTexte === '' ? 0 : montantSaisi(tvaTexte);
    if (tva === null || tva < 0) return { motif: `Ligne ${n} · la taxe prévue est illisible.` };
    sortie.push({ designation: l.designation.trim(), quantite: q, prixUnitaire: pu, ...(tva ? { montantTva: tva } : {}), sectionId: l.sectionId });
  }
  return { lignes: sortie };
}

/** Le total indicatif d'une ligne, en centimes · null tant qu'un champ est illisible. */
export function totalLigneCentimes(l: LigneSaisie): number | null {
  const q = montantSaisi(l.quantite);
  const pu = montantSaisi(l.prixUnitaire);
  const tvaTexte = l.montantTva.trim();
  const tva = tvaTexte === '' ? 0 : montantSaisi(tvaTexte);
  if (q === null || pu === null || tva === null) return null;
  return Math.round(q * pu * 100) + Math.round(tva * 100);
}

/**
 * La part proposée d'une facture sur un bon à UNE seule ligne budgétaire · le
 * plus petit du reste à facturer et de ce que la facture n'a pas encore servi.
 * Sur plusieurs lignes, rien n'est proposé · la part de chacune se DÉCLARE.
 */
export function partProposee(parSection: { resteAFacturer: number }[], disponible: number): number | null {
  if (parSection.length !== 1) return null;
  const p = Math.min(parSection[0].resteAFacturer, disponible);
  return p > 0 ? p : null;
}
