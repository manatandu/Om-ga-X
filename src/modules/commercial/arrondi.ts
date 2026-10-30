/**
 * LIGNE commercial-l8, fonction 94 · LES MODES D'ARRONDI (Sage, P_ARRONDI).
 *
 * AUCUN TEXTE LU NE FIXE L'ARRONDI D'UN PRIX DE VENTE · le prix est celui que
 * les parties conviennent (AUDCG art. 263, « l'acheteur est tenu de payer le
 * prix convenu »). Le mode d'arrondi est donc une CONVENTION DU DOSSIER, qui
 * ne sert qu'à PROPOSER le prix net unitaire d'une ligne (prix moins la
 * remise du client), jamais à le corriger après coup. Il ne touche JAMAIS la
 * taxe ni un total · la base de la TVA est le montant hors taxes qui figure
 * sur la facture (O.-L. n° 10/001, art. 29 ; décret n° 011/42, art. 79), et
 * la taxe se calcule sur lui, au centime, par le moteur de la facture.
 *
 * Tout se compte en CENTIMES ENTIERS (BigInt) · un prix de 1 999,99 remisé de
 * 12,5 % ne doit pas dépendre d'un flottant pour tomber du bon côté du pas.
 */

export type MethodeArrondi = 'PROCHE' | 'SUPERIEUR' | 'INFERIEUR';

export const METHODES_ARRONDI: readonly MethodeArrondi[] = ['PROCHE', 'SUPERIEUR', 'INFERIEUR'];

/** Le pas le plus grand admis · convention d'OmegaX, un million de francs. */
export const PAS_MAXIMUM = 1_000_000;

/** Un montant en francs au centime, en centimes entiers · `null` s'il n'est pas au centime. */
export function enCentimesExacts(v: number): bigint | null {
  if (!Number.isFinite(v)) return null;
  const c = Math.round(v * 100);
  if (Math.abs(c - v * 100) > 1e-6) return null;
  return BigInt(c);
}

/** Le pas d'un mode · au moins un centime, au plus un million de francs, au centime. */
export function motifRefusPas(pas: number): string | null {
  const c = enCentimesExacts(pas);
  if (c === null) return 'Le pas d’arrondi se saisit en francs, au centime (0,01 au moins).';
  if (c < 1n) return 'Le pas d’arrondi est d’au moins un centime (0,01).';
  if (c > BigInt(PAS_MAXIMUM * 100)) return `Le pas d’arrondi est d’au plus ${PAS_MAXIMUM.toLocaleString('fr-FR')} francs.`;
  return null;
}

/** Un intitulé · un à trente-cinq caractères, comme chez Sage. */
export function motifRefusIntitule(intitule: string): string | null {
  const t = intitule.trim();
  if (!t) return 'L’intitulé du mode d’arrondi est exigé.';
  if ([...t].length > 35) return 'L’intitulé du mode d’arrondi compte au plus 35 caractères.';
  return null;
}

/**
 * LE PRIX NET UNITAIRE PROPOSÉ · prix hors taxes × (1 − remise), arrondi au
 * pas du mode, sinon au centime le plus proche (le demi-centime au-dessus).
 * La remise est en pour cent à deux décimales au plus (`motifRefusRemise`).
 * Rend des francs au centime, jamais un flottant hors du centime.
 */
export function prixNetArrondi(
  prixHT: number,
  remisePourcent: number,
  mode: { methode: MethodeArrondi; pas: number } | null,
): number {
  const prix = enCentimesExacts(prixHT);
  if (prix === null) throw new Error('Prix hors du centime.');
  const r = BigInt(Math.round(remisePourcent * 100)); // centièmes de pour cent
  const num = prix * (10000n - r);
  const den = 10000n;
  const pasC = mode ? (enCentimesExacts(mode.pas) ?? 1n) : 1n;
  const methode = mode?.methode ?? 'PROCHE';
  const unite = den * pasC;
  let q: bigint;
  if (methode === 'INFERIEUR') q = num / unite;
  else if (methode === 'SUPERIEUR') q = (num + unite - 1n) / unite;
  else q = (2n * num + unite) / (2n * unite);
  return Number(q * pasC) / 100;
}
