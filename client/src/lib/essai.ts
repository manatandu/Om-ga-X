/**
 * L'inscription avec essai · ce que l'écran envoie à `POST /auth/inscription-essai`
 * et ce qu'il lit de `GET /auth/inscription-essai/etat`. Module pur, sans
 * `import.meta`, pour être testé sans écran.
 *
 * Le TYPE d'entité tapé par le visiteur choisit le référentiel et le jeu
 * d'états, jamais deux choix séparés · il ne connaît pas ces mots. Les trois
 * jeux SYCEBNL et les deux systèmes SYSCOHADA existent côté serveur ; l'essai
 * en propose les trois portes d'entrée usuelles, le reste se règle ensuite
 * dans le dossier.
 */
export type TypeEntiteEssai = 'ASSOCIATION' | 'PROJET' | 'ENTREPRISE';

export const TYPES_ENTITE_ESSAI: { valeur: TypeEntiteEssai; libelle: string }[] = [
  { valeur: 'ASSOCIATION', libelle: 'Association, ONG ou ordre professionnel' },
  { valeur: 'PROJET', libelle: 'Projet de développement financé par un bailleur' },
  { valeur: 'ENTREPRISE', libelle: 'Entreprise ou société' },
];

export interface CorpsEssai {
  nomEntite: string;
  referentiel: 'SYCEBNL' | 'SYSCOHADA';
  email: string;
  jeuEtatsFinanciersSycebnl?: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' | 'PROJETS_DEVELOPPEMENT';
}

export function corpsEssai(type: TypeEntiteEssai, nomEntite: string, email: string): CorpsEssai {
  const commun = { nomEntite: nomEntite.trim(), email: email.trim() };
  if (type === 'ENTREPRISE') return { ...commun, referentiel: 'SYSCOHADA' };
  return {
    ...commun,
    referentiel: 'SYCEBNL',
    jeuEtatsFinanciersSycebnl: type === 'PROJET' ? 'PROJETS_DEVELOPPEMENT' : 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
  };
}

export interface EtatEssai {
  ouverte: boolean;
  joursEssai: number;
}

/** Une réponse illisible ou absente vaut « fermée » · le lien ne s'offre que sur une porte lue ouverte. */
export function essaiOuvert(e: unknown): e is EtatEssai {
  const o = e as { ouverte?: unknown; joursEssai?: unknown } | null | undefined;
  return o?.ouverte === true && typeof o.joursEssai === 'number';
}
