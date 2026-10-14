/**
 * LE MODE ASSISTANT DE CRÉATION (ligne sage-l1, fonction 18 · Sage 100 i7,
 * « Fenêtre > Mode assistant » · la création guidée d'un compte et d'un code
 * journal, étape par étape, et la création enchaînée, « valider ce compte
 * pour en créer un nouveau »).
 *
 * Une PRÉFÉRENCE DU POSTE, jamais une donnée du dossier (comme les favoris
 * et les totaux de la saisie) · lue et retenue sous `try/catch`, le stockage
 * du navigateur pouvant manquer (fenêtre privée). L'assistant ne décide
 * rien · il présente les MÊMES champs que le formulaire, envoie le MÊME
 * corps à la MÊME route, et le serveur juge tout comme avant.
 */
export const CLE_MODE_ASSISTANT = 'omegax.creation.modeAssistant';

/** Le mode assistant retenu par ce poste · faux par défaut, et faux si le stockage manque. */
export function lireModeAssistant(): boolean {
  try {
    return localStorage.getItem(CLE_MODE_ASSISTANT) === 'oui';
  } catch {
    return false;
  }
}

/** Retient le choix · un stockage refusé ne fait rien, la fenêtre garde le choix pour elle. */
export function memoriserModeAssistant(actif: boolean): void {
  try {
    if (actif) localStorage.setItem(CLE_MODE_ASSISTANT, 'oui');
    else localStorage.removeItem(CLE_MODE_ASSISTANT);
  } catch {
    /* préférence du poste · sans stockage, elle ne survit pas à la fenêtre */
  }
}

export type EtapeCompte = 'NUMERO' | 'TYPE' | 'RECAPITULATIF';
export const ETAPES_COMPTE: readonly EtapeCompte[] = ['NUMERO', 'TYPE', 'RECAPITULATIF'];
export const LIBELLE_ETAPE_COMPTE: Record<EtapeCompte, string> = {
  NUMERO: 'Numéro et intitulé',
  TYPE: 'Type du compte',
  RECAPITULATIF: 'Récapitulatif',
};

export type EtapeJournal = 'TYPE' | 'CODE' | 'NUMEROTATION' | 'COMPTE' | 'RECAPITULATIF';
export const LIBELLE_ETAPE_JOURNAL: Record<EtapeJournal, string> = {
  TYPE: 'Type du journal',
  CODE: 'Code et intitulé',
  NUMEROTATION: 'Numérotation des pièces',
  COMPTE: 'Compte du journal',
  RECAPITULATIF: 'Récapitulatif',
};

/** Les étapes d'un code journal · le compte du journal n'est une étape que pour un journal de trésorerie. */
export function etapesJournal(type: string): EtapeJournal[] {
  return ['TYPE', 'CODE', 'NUMEROTATION', ...(type === 'TRESORERIE' ? (['COMPTE'] as const) : []), 'RECAPITULATIF'];
}

/**
 * L'étape suivante ou précédente, bornée · une étape qui n'existe plus (le
 * type a changé et le compte n'est plus une étape) ramène à la plus proche
 * qui existe, jamais hors de la liste.
 */
export function etapeVoisine<E extends string>(etapes: readonly E[], courante: E, sens: 1 | -1): E {
  const i = etapes.indexOf(courante);
  if (i === -1) return etapes[0];
  return etapes[Math.min(etapes.length - 1, Math.max(0, i + sens))];
}

/** Le rang de l'étape, à partir de 1, et le nombre d'étapes · « Étape 2 sur 4 ». */
export function rangEtape<E extends string>(etapes: readonly E[], courante: E): { rang: number; total: number } {
  return { rang: Math.max(1, etapes.indexOf(courante) + 1), total: etapes.length };
}
