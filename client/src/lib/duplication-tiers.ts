import type { TypeTiers } from './types';

/**
 * LA COPIE D'UN TIERS À L'ÉCRAN (ligne sage-l2, fonction 32) · le serveur la
 * compose (`src/modules/tiers/duplication-tiers.ts`) et nomme ce qu'il ne
 * reprend pas ; l'écran en remplit le formulaire de création. Type, code,
 * nom, modèle et mode passent par les champs du formulaire ; le reste part
 * tel que servi.
 */
export interface CopieDuTiers {
  origine: string;
  corps: {
    type: TypeTiers;
    code: '';
    nom: string;
    qualite?: string;
    adresse?: string;
    boitePostale?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    email?: string;
    contact?: string;
    modeleReglementId?: string;
    modeReglementId?: string;
    validationAutomatiqueEcheances?: true;
    /** Les modèles d'impression (fonction 27) · repris, envoyés tels quels. */
    modeleImpressionExtraitId?: string;
    modeleImpressionReglementId?: string;
    modeleImpressionRappelId?: string;
    /** Le représentant et la devise habituelle (ligne restes-l8-immos) · repris ; l'encours maximum jamais. */
    representantId?: string;
    deviseId?: string;
  };
  nonRepris: Array<{ champ: string; motif: string }>;
}

/**
 * Le représentant suit le TYPE de la copie · un vendeur représente un client,
 * un acheteur un fournisseur (`commercial/collaborateurs.ts`). Le type changé
 * dans le formulaire, le représentant n'est plus envoyé · la création le
 * refuserait sur un champ que le formulaire ne montre pas (relecture
 * indépendante, m1), et la ligne « Non repris » le dit.
 */
const representantTombe = (c: CopieDuTiers, typeChoisi: TypeTiers | undefined) =>
  !!c.corps.representantId && typeChoisi !== undefined && typeChoisi !== c.corps.type;

/** Les champs repris qui n'ont pas de place dans le formulaire · envoyés tels quels à la création. */
export function champsReprisHorsFormulaire(c: CopieDuTiers, typeChoisi?: TypeTiers): Record<string, string | boolean> {
  const { type: _type, code: _code, nom: _nom, modeleReglementId: _modele, modeReglementId: _mode, representantId, ...reste } = c.corps;
  return representantId && !representantTombe(c, typeChoisi) ? { ...reste, representantId } : reste;
}

/** La ligne qui dit ce que la copie ne reprend pas. */
export function nonReprisEnClair(c: CopieDuTiers, typeChoisi?: TypeTiers): string {
  const non = representantTombe(c, typeChoisi)
    ? [...c.nonRepris, { champ: 'Représentant', motif: 'le type du tiers a changé · à choisir sur la fiche créée' }]
    : c.nonRepris;
  return non.map((n) => `${n.champ} (${n.motif})`).join(' ; ');
}

/**
 * CE QUE LA COPIE REPREND, dit en entier (second tour de relecture, mineur
 * 10) · les modèles d'impression et l'échéancier appliqué d'office partaient
 * avec la création sans être nommés.
 */
export function reprisEnClair(c: CopieDuTiers, typeChoisi?: TypeTiers): string {
  const repris = ['nom', 'qualité', 'coordonnées', 'règlement'];
  if (c.corps.validationAutomatiqueEcheances) repris.push('échéancier appliqué d’office');
  if (c.corps.modeleImpressionExtraitId || c.corps.modeleImpressionReglementId || c.corps.modeleImpressionRappelId) {
    repris.push('modèles d’impression');
  }
  if (c.corps.representantId && !representantTombe(c, typeChoisi)) repris.push('représentant');
  if (c.corps.deviseId) repris.push('devise habituelle');
  return `${repris.slice(0, -1).join(', ')} et ${repris[repris.length - 1]}`;
}
