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
  };
  nonRepris: Array<{ champ: string; motif: string }>;
}

/** Les champs repris qui n'ont pas de place dans le formulaire · envoyés tels quels à la création. */
export function champsReprisHorsFormulaire(c: CopieDuTiers): Record<string, string | boolean> {
  const { type: _type, code: _code, nom: _nom, modeleReglementId: _modele, modeReglementId: _mode, ...reste } = c.corps;
  return reste;
}

/** La ligne qui dit ce que la copie ne reprend pas. */
export function nonReprisEnClair(c: CopieDuTiers): string {
  return c.nonRepris.map((n) => `${n.champ} (${n.motif})`).join(' ; ');
}
