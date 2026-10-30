/**
 * FUSION DE TIERS · règles pures, sans Prisma.
 *
 * Les écritures sont passées sur des COMPTES, jamais sur des tiers : un tiers
 * est une fiche rattachée à ses comptes (`TiersCompte`). Fusionner deux fiches
 * ne touche donc pas une ligne du livre-journal · les comptes du doublon, ses
 * factures, devis, relances, consignations et demandes de confirmation passent
 * au tiers conservé, puis le doublon est supprimé. C'est la seule fusion que
 * l'AUDCIF laisse entière (art. 22, 2° interdit de modifier une écriture
 * validée, pas de réorganiser les fiches qui pointent vers ses comptes).
 */

export interface FicheTiers {
  id: string;
  code: string;
  type: string;
  adresse: string | null;
  boitePostale: string | null;
  ville: string | null;
  pays: string | null;
  telephone: string | null;
  email: string | null;
  numeroImpot: string | null;
  contact: string | null;
  /** Ligne sage-l2, fonction 24 · un libellé, qui comble le vide comme une coordonnée. */
  qualite?: string | null;
  /** Ligne sage-l2, fonction 27 · le modèle d'impression choisi, qui comble le vide de même. */
  modeleImpressionExtraitId?: string | null;
  modeleImpressionReglementId?: string | null;
  modeleImpressionRappelId?: string | null;
  /** Ligne commercial-l8 · représentant (fonction 91) et devise habituelle (25), qui comblent le vide de même. */
  representantId?: string | null;
  deviseId?: string | null;
}

export function motifRefusFusionTiers(source: FicheTiers, cible: FicheTiers): string | null {
  if (source.id === cible.id) return 'Un tiers ne se fusionne pas avec lui-même.';
  if (source.type !== cible.type) {
    return (
      `${source.code} et ${cible.code} ne sont pas du même type (${source.type} et ${cible.type}) · ` +
      "un client et un fournisseur ne sont pas un doublon l'un de l'autre, leurs comptes ne se lisent pas au même sens."
    );
  }
  return null;
}

const COORDONNEES = [
  'adresse',
  'boitePostale',
  'ville',
  'pays',
  'telephone',
  'email',
  'numeroImpot',
  'contact',
  'qualite',
  // Les modèles d'impression (ligne sage-l2, fonction 27) · la fiche conservée
  // garde les siens, le doublon ne pose le sien que là où elle n'en a pas.
  'modeleImpressionExtraitId',
  'modeleImpressionReglementId',
  'modeleImpressionRappelId',
  // Le représentant et la devise habituelle (ligne commercial-l8) · même
  // règle. L'ENCOURS MAXIMUM n'en est PAS · celui du doublon, plus large,
  // ouvrirait au client conservé un crédit que personne ne lui a consenti ;
  // la fiche conservée garde le sien, ou aucun.
  'representantId',
  'deviseId',
] as const;

/**
 * Les coordonnées que la fiche conservée n'a pas et que le doublon porte · la
 * fiche conservée garde TOUJOURS les siennes, le doublon ne comble que les
 * vides. Écraser une adresse renseignée par celle d'un doublon ferait partir
 * les relances à une adresse que personne n'a choisie.
 */
export function coordonneesAComblement(
  source: FicheTiers,
  cible: FicheTiers,
): Partial<Record<(typeof COORDONNEES)[number], string>> {
  const r: Partial<Record<(typeof COORDONNEES)[number], string>> = {};
  for (const c of COORDONNEES) {
    const v = source[c];
    if (!cible[c] && v) r[c] = v;
  }
  return r;
}
