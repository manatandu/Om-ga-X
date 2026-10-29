import { EditionSelection } from '@prisma/client';

/**
 * LES SÉLECTIONS ENREGISTRÉES (ligne sage-l7, fonction 59) · règles pures.
 *
 * Les critères d'une édition gardés sous un nom et rappelés. Aucun texte ne
 * les régit · c'est une commodité de travail. Décision de la ligne · AU
 * DOSSIER, jamais au poste. Une sélection nomme des objets du dossier (un
 * journal, des dates) qui n'ont de sens que là ; un dossier se travaille à
 * plusieurs et sur plusieurs postes, et le réviseur reprend la sélection du
 * comptable pour refaire la même édition ; un critère gardé dans le
 * navigateur se perd avec ses données, en fenêtre privée ou sur un autre
 * poste (CLAUDE.md · le stockage du navigateur ne porte que des commodités
 * propres au poste, jamais un état qui doit durer).
 *
 * CE QU'UNE SÉLECTION GARDE · les critères de SON édition, et eux seuls,
 * relus clé par clé · une clé inconnue ou d'un mauvais type est REFUSÉE,
 * jamais rangée. Jamais l'exercice · une sélection se rappelle sur
 * l'exercice choisi (« le journal des achats du premier trimestre » vaut
 * chaque année).
 */

type Regle = 'chaine' | 'date' | 'booleen' | 'identifiant' | readonly string[];

export const CRITERES_PAR_EDITION: Record<EditionSelection, Record<string, Regle>> = {
  // Les filtres de la fenêtre du journal (JournalPage, `Filtres`).
  JOURNAL: {
    journalId: 'identifiant',
    dateDebut: 'date',
    dateFin: 'date',
    recherche: 'chaine',
    compte: 'chaine',
    montant: 'chaine',
    montantMax: 'chaine',
    numeroPiece: 'chaine',
    reference: 'chaine',
    inclureBrouillard: 'booleen',
    // Ligne gl-saisie, fonction 64 · les écritures revues, ou à revoir.
    revue: ['oui', 'non'],
  },
  // Le formulaire des impressions différées.
  IMPRESSION_DIFFEREE: {
    nature: ['JOURNAL', 'GRAND_LIVRE', 'BALANCE'],
    journalId: 'identifiant',
    dateDebut: 'date',
    dateFin: 'date',
    inclureBrouillard: 'booleen',
    format: ['fpm', 'plat'],
    grandsLivres: 'booleen',
  },
};

/** Convention d'OmegaX · une saisie de critère n'a pas besoin de plus. */
export const LONGUEUR_MAX_CRITERE = 100;
export const LONGUEUR_MAX_NOM = 60;
/** Au-delà, la liste d'une édition se tronque et le dit (CLAUDE.md § 8 bis). */
export const PLAFOND_SELECTIONS = 200;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function nomOuMotif(brut: unknown): { nom: string } | { motif: string } {
  const nom = typeof brut === 'string' ? brut.trim() : '';
  if (!nom) return { motif: 'Le nom de la sélection est exigé.' };
  if (nom.length > LONGUEUR_MAX_NOM) return { motif: `Le nom de la sélection tient en ${LONGUEUR_MAX_NOM} caractères au plus.` };
  return { nom };
}

/**
 * Les critères d'une sélection, relus · une valeur vide n'est pas gardée
 * (elle vaut « aucun critère » au rappel), tout le reste est jugé sur la
 * règle de sa clé.
 */
export function criteresSelectionOuMotif(
  edition: EditionSelection,
  brut: unknown,
): { criteres: Record<string, string | boolean> } | { motif: string } {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { motif: 'Les critères de la sélection sont illisibles.' };
  const regles = CRITERES_PAR_EDITION[edition];
  const criteres: Record<string, string | boolean> = {};
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (cle === 'exerciceId') {
      return { motif: "Une sélection ne garde pas l'exercice · elle se rappelle sur l'exercice choisi." };
    }
    const regle = regles[cle];
    if (!regle) return { motif: `Critère inconnu pour cette édition · « ${cle} ».` };
    if (valeur === null || valeur === undefined || valeur === '') continue;
    if (regle === 'booleen') {
      if (typeof valeur !== 'boolean') return { motif: `Critère « ${cle} » · oui ou non.` };
      criteres[cle] = valeur;
      continue;
    }
    if (typeof valeur !== 'string') return { motif: `Critère « ${cle} » illisible.` };
    if (valeur.length > LONGUEUR_MAX_CRITERE) return { motif: `Critère « ${cle} » trop long (${LONGUEUR_MAX_CRITERE} caractères au plus).` };
    if (regle === 'date' && (!JOUR.test(valeur) || Number.isNaN(Date.parse(`${valeur}T00:00:00Z`)))) {
      return { motif: `Critère « ${cle} » · une date AAAA-MM-JJ est attendue.` };
    }
    if (Array.isArray(regle) && !regle.includes(valeur)) {
      return { motif: `Critère « ${cle} » · ${regle.map((v) => `« ${v} »`).join(', ')}.` };
    }
    criteres[cle] = valeur;
  }
  return { criteres };
}
