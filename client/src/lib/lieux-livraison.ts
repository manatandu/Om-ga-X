/**
 * LIEUX DE LIVRAISON À L'ÉCRAN (ligne sage-l2, fonction 31) · le serveur juge
 * (`src/modules/tiers/lieux-livraison.ts`) ; l'écran ne fait que composer le
 * corps · un champ vide part `null` (il efface, et un courriel vide n'est pas
 * un courriel invalide).
 */
export interface LieuLivraison {
  id: string;
  intitule: string;
  adresse: string | null;
  complement: string | null;
  boitePostale: string | null;
  ville: string | null;
  pays: string | null;
  contact: string | null;
  telephone: string | null;
  email: string | null;
  estPrincipal: boolean;
  estActif: boolean;
}

export interface ListeLieux {
  lieux: LieuLivraison[];
  total: number;
  tronque: boolean;
}

export type SaisieLieu = Record<'intitule' | 'adresse' | 'complement' | 'boitePostale' | 'ville' | 'pays' | 'contact' | 'telephone' | 'email', string>;

export const LIEU_VIDE: SaisieLieu = {
  intitule: '',
  adresse: '',
  complement: '',
  boitePostale: '',
  ville: '',
  pays: '',
  contact: '',
  telephone: '',
  email: '',
};

/** Le formulaire rempli d'un lieu existant · `null` devient un champ vide. */
export function saisieDuLieu(l: LieuLivraison): SaisieLieu {
  return Object.fromEntries(Object.keys(LIEU_VIDE).map((k) => [k, (l[k as keyof SaisieLieu] as string | null) ?? ''])) as SaisieLieu;
}

/** Le corps envoyé · l'intitulé tel quel (le serveur le range), les autres champs vides à `null`. */
export function corpsDuLieu(s: SaisieLieu): Record<string, string | null> {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === 'intitule' ? v : v.trim() === '' ? null : v.trim()]));
}
