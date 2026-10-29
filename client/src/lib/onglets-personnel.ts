/**
 * Les onglets de la fenêtre Personnel, lus dans son adresse (`?onglet=…`).
 *
 * Une commande de menu ne pouvait pas ouvrir la fenêtre sur un onglet · la
 * passation de la paie du mois, un geste de TRAITEMENT, n'était atteignable
 * qu'en passant par « Structure > Registre du personnel » puis l'onglet
 * Bulletins (audit de l'interface du 2026-09-27, I10). Même mécanique que
 * `ongletDe` du journal.
 */
export const ONGLETS_PERSONNEL = [
  'registre',
  'confrontation',
  'effectif',
  'simulation',
  'bulletins',
  'conges',
  'absences',
  // Ligne sage-l5, fonction 78, reste · les feuilles de temps et les compteurs libres.
  'temps',
  // Ligne microfina-m3, idée 3 · ordres et frais de mission.
  'missions',
  // Ligne microfina-m3, lot 2 · demandes de congé, échéancier, formation, main-d'œuvre.
  'demandes',
  'echeances',
  'formation',
  'declaration',
  // Ligne paie-suite · départements et directions.
  'organisation',
  // Ligne paie-suite, fonction 89 · fiche individuelle et cumuls annuels.
  'fiche',
  // Ligne paie-suite, fonction 82 · import du personnel depuis Excel.
  'import',
  'rubriques',
  'baremes',
  'decompte',
  'livre',
] as const;

export type OngletPersonnel = (typeof ONGLETS_PERSONNEL)[number];

export function ongletPersonnelDe(adresse: string | undefined): OngletPersonnel {
  const brut = new URLSearchParams(adresse?.split('?')[1] ?? '').get('onglet');
  return (ONGLETS_PERSONNEL as readonly string[]).includes(brut ?? '') ? (brut as OngletPersonnel) : 'registre';
}
