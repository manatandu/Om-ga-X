/**
 * LES SÉLECTIONS ENREGISTRÉES (ligne sage-l7, fonction 59) · ce que l'écran
 * en fait, tenu par son spec. Les règles vivent au serveur
 * (`src/modules/exports/selections/`).
 */

export type EditionSelection = 'JOURNAL' | 'IMPRESSION_DIFFEREE';

export interface SelectionServie {
  id: string;
  edition: EditionSelection;
  nom: string;
  criteres: Record<string, string | boolean>;
  creePar: string;
  creeLe: string;
  modifieLe: string;
  /** Le journal que la sélection nomme a été retiré depuis son enregistrement. */
  journalIntrouvable: boolean;
}

export interface ListeSelections {
  selections: SelectionServie[];
  total: number;
  tronque: boolean;
}

/**
 * Les critères à rappeler · un journal retiré depuis l'enregistrement n'est
 * pas rappelé (il ne filtrerait plus rien), et c'est DIT, jamais remplacé en
 * silence par « tous les journaux ».
 */
export function criteresRappeles(s: Pick<SelectionServie, 'nom' | 'criteres' | 'journalIntrouvable'>): {
  criteres: Record<string, string | boolean>;
  avertissement: string | null;
} {
  if (!s.journalIntrouvable) return { criteres: { ...s.criteres }, avertissement: null };
  const { journalId: _retire, ...reste } = s.criteres;
  return {
    criteres: reste,
    avertissement: `Le journal de la sélection « ${s.nom} » n'existe plus · la sélection est rappelée sur tous les journaux.`,
  };
}
