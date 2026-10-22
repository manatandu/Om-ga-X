import { lireNombre } from './conditions-bancaires-saisie';
import type { Corps } from './operations-tresorerie-saisie';

/**
 * LA SAISIE D'UN TITRE DE PLACEMENT (ligne sage-l3, fonction 47). Même règle
 * que les financements · vide = absent, illisible = refus NOMMÉ à l'écran et
 * rien ne part ; un montant au point des milliers (« 500.000 ») est AMBIGU et
 * refusé. Les règles de fond (P.E.P.S., parts détenues, comptes, revue dans
 * l'ordre) restent au serveur (`src/modules/tresorerie/titres-placement.ts`).
 */
export interface ChampsMouvement {
  journalBanqueId: string;
  date: string;
  quantite: string;
  prix: string;
  frais: string;
  reference: string;
}

export interface CorpsMouvement {
  journalBanqueId: string;
  date: string;
  quantite: number;
  prix: number;
  frais: number | null;
  reference: string;
}

export function corpsMouvement(c: ChampsMouvement): Corps<CorpsMouvement> {
  if (!c.journalBanqueId) return { refus: 'Choisissez le journal de banque qui a passé l’opération.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date)) return { refus: 'La date de l’avis d’opéré est exigée.' };
  const q = lireNombre(c.quantite, 'taux');
  if (!('valeur' in q) || q.valeur <= 0) return { refus: 'Le nombre de parts · un nombre positif, par exemple 10 ou 12,5.' };
  const prix = lireNombre(c.prix, 'montant');
  if (!('valeur' in prix) || prix.valeur <= 0) return { refus: 'Le prix de l’avis d’opéré · un montant positif, par exemple 1 050 000 ou 1050000,50.' };
  const frais = lireNombre(c.frais, 'montant');
  if ('illisible' in frais) return { refus: 'Les frais · un montant, par exemple 10 000, ou rien.' };
  if (!c.reference.trim()) return { refus: 'La référence de l’avis d’opéré est exigée.' };
  return { corps: { journalBanqueId: c.journalBanqueId, date: c.date, quantite: q.valeur, prix: prix.valeur, frais: 'valeur' in frais ? frais.valeur : null, reference: c.reference.trim() } };
}

export function valeurUnitaireLue(texte: string): Corps<number> {
  const v = lireNombre(texte, 'montant');
  if (!('valeur' in v) || v.valeur < 0) return { refus: 'La valeur unitaire · un montant positif ou nul, par exemple 98 000 ou 98000,25.' };
  return { corps: v.valeur };
}
