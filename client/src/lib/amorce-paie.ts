import type { ModuleOptionnel } from './profil-dossier';

/**
 * L'AMORCE « ACTIVER LA PAIE » (ligne paie-declarations, gel levé par Manasse
 * le 2026-11-01). La paie est un module ACTIVABLE (`tenant/modules-optionnels.ts`,
 * décision du 2026-09-28) · un dossier neuf part sans elle, et masquer n'est
 * pas refuser · la fenêtre Personnel reste ouverte par son adresse ou par une
 * tuile. Celui qui l'ouvre sans le module ne voyait aucune trace de la
 * commande qui la met au menu. L'amorce le dit, et l'administrateur l'active
 * d'un clic par la MÊME route que les Paramètres (`PATCH /dossier/modules`).
 *
 * Un dossier pas encore chargé (liste absente) ne montre rien · on ne propose
 * pas d'activer ce qui l'est peut-être déjà.
 */
export function paieAActiver(modulesActives: readonly ModuleOptionnel[] | null | undefined): boolean {
  return Array.isArray(modulesActives) && !modulesActives.includes('PAIE');
}

/** La liste après activation · l'ordre et les autres modules gardés, sans doublon. */
export function modulesAvecLaPaie(modulesActives: readonly ModuleOptionnel[]): ModuleOptionnel[] {
  return modulesActives.includes('PAIE') ? [...modulesActives] : [...modulesActives, 'PAIE'];
}
