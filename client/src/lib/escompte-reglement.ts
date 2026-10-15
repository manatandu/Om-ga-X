import { lireMontant } from './imputation-reglement';

/**
 * ESCOMPTE ET ÉCART DE RÈGLEMENT À L'ÉCRAN (ligne sage-l2, fonction 36) ·
 * les règles sont celles du serveur (`src/modules/reglements/ecart-escompte.ts`),
 * qui juge et refuse · l'écran ne fait que lire les champs du tiers, dire ce
 * qui est illisible avant l'envoi, et servir les comptes que le serveur offre
 * (`GET /reglements/comptes-escompte-ecart`), jamais une table recopiée.
 */

export type RoleEcartEscompte = 'ESCOMPTE_OBTENU' | 'ESCOMPTE_ACCORDE' | 'ECART_REGLEMENT';

export interface CompteDuRole {
  id: string;
  numero: string;
  intitule: string;
}

/** Un rôle servi · les comptes admis, le seul proposé, ou le motif (aucun, ou plusieurs à choisir). */
export interface RoleServi {
  role: RoleEcartEscompte;
  racine: string;
  comptes: CompteDuRole[];
  proposeId: string | null;
  motif: string | null;
}

export interface ComptesEscompteEcart {
  /** Le seuil du dossier · `null` quand aucun n'est fixé (aucun écart ne se passe alors). */
  seuil: number | null;
  roles: RoleServi[];
}

export function roleServi(servis: ComptesEscompteEcart | null, role: RoleEcartEscompte): RoleServi | null {
  return servis?.roles.find((r) => r.role === role) ?? null;
}

/** Le rôle de l'escompte selon le sens · obtenu du fournisseur, accordé au client. */
export function roleEscompte(sens: 'FOURNISSEUR' | 'CLIENT'): RoleEcartEscompte {
  return sens === 'FOURNISSEUR' ? 'ESCOMPTE_OBTENU' : 'ESCOMPTE_ACCORDE';
}

/**
 * LES CHAMPS DU CORPS POUR UN TIERS · l'escompte lu (vide = aucun), la case
 * « Solder l'écart », et le compte choisi de chacun quand le serveur en offre
 * plusieurs. Un escompte illisible ou non positif est dit avant l'envoi ; le
 * reste (dépassement, seuil, compte manquant) est jugé par le serveur.
 */
export function champsEscompteEcart(p: {
  escompteSaisi: string | undefined;
  solderEcart: boolean;
  compteEscompteId: string | undefined;
  compteEcartId: string | undefined;
}): { champs: Record<string, unknown> } | { motif: string } {
  const lu = lireMontant(p.escompteSaisi);
  if ('illisible' in lu) return { motif: `L'escompte est illisible (« ${lu.illisible} »).` };
  const escompte = 'valeur' in lu ? lu.valeur : null;
  if (escompte !== null && !(escompte > 0)) return { motif: "L'escompte doit être un montant strictement positif · videz-le pour n'en passer aucun." };
  return {
    champs: {
      ...(escompte !== null ? { escompte } : {}),
      ...(escompte !== null && p.compteEscompteId ? { compteEscompteId: p.compteEscompteId } : {}),
      ...(p.solderEcart ? { solderEcart: true } : {}),
      ...(p.solderEcart && p.compteEcartId ? { compteEcartId: p.compteEcartId } : {}),
    },
  };
}

/** Le payé par défaut · le dû moins l'escompte lisible, au centime (le serveur fait de même sans montant). */
export function payeParDefaut(du: number, escompteSaisi: string | undefined): number {
  const lu = lireMontant(escompteSaisi);
  const escompte = 'valeur' in lu && lu.valeur > 0 ? lu.valeur : 0;
  return Math.round((du - escompte) * 100) / 100;
}
