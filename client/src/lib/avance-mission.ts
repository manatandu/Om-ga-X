/**
 * LIGNE PAIE-DECLARATIONS, POINT 3 · ce que l'écran de l'avance de mission
 * lit et propose. La règle est au serveur (`personnel/avance-mission.ts`),
 * qui refuse de toute façon · l'écran ne propose que les journaux que le
 * serveur admettrait, pour ne pas offrir un choix voué au refus.
 */
export type IssueRegularisation = 'SOLDEE' | 'COMPLEMENT_PAYE' | 'TROP_VERSE_RENDU' | 'TROP_VERSE_RETENU';

/** Même libellés que le serveur (`LIBELLE_ISSUE`). */
export const LIBELLE_ISSUE: Readonly<Record<IssueRegularisation, string>> = {
  SOLDEE: 'Avance soldée par les frais',
  COMPLEMENT_PAYE: 'Complément payé au salarié',
  TROP_VERSE_RENDU: 'Trop-versé rendu par le salarié',
  TROP_VERSE_RETENU: 'Trop-versé retenu sur la paie',
};

export type JournalMin = { id: string; code: string; intitule: string; type: string; estActif: boolean };

/**
 * Les journaux de la régularisation · de trésorerie quand de l'argent passe
 * (complément payé, trop-versé rendu), sinon ni de trésorerie ni de situation.
 * Aucune issue encore connue, aucun journal · le choix du trop-versé d'abord.
 */
export function journauxDeLaRegularisation(journaux: readonly JournalMin[] | null, issue: IssueRegularisation | null): JournalMin[] {
  if (!journaux || issue === null) return [];
  const argent = issue === 'COMPLEMENT_PAYE' || issue === 'TROP_VERSE_RENDU';
  return journaux.filter((j) => j.estActif && (argent ? j.type === 'TRESORERIE' : j.type !== 'TRESORERIE' && j.type !== 'SITUATION'));
}
