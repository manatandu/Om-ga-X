import type { GroupesLusLigneALigne } from './types';

/**
 * LES GROUPES LUS LIGNE À LIGNE SE DISENT EN UNE LIGNE (paquet 1, B5).
 *
 * Un groupe de lettrage dont le reste ne se répartit pas sûrement entre ses
 * factures garde la lecture ligne à ligne · le total de l'état est exact, la
 * répartition par échéance de ce groupe ne l'est pas. Le serveur le sert
 * (`groupesLusLigneALigne`, borné, le total dit) ; l'écran le dit. Rien
 * n'est affiché quand la lecture n'en a trouvé aucun (`total: 0`), ni quand
 * le serveur ne le sert pas · une absence n'est jamais lue comme « aucun ».
 */
export function texteGroupesLusLigneALigne(g: GroupesLusLigneALigne | null | undefined): string | null {
  if (!g || g.total <= 0) return null;
  const nommes = g.groupes.map((x) => `${x.code} (${x.compte})`).join(', ');
  const autres = g.total - g.groupes.length;
  const suite = autres > 0 ? `${nommes ? `${nommes} et ` : ''}${autres} autre${autres > 1 ? 's' : ''}` : nommes;
  return (
    `${g.total} groupe${g.total > 1 ? 's' : ''} de lettrage lu${g.total > 1 ? 's' : ''} ligne à ligne · ` +
    `leur reste ne se répartit pas sûrement entre leurs factures` +
    (suite ? ` · ${suite}` : '')
  );
}

/** La raison, dans l'infobulle · le texte à l'écran reste d'une ligne. */
export const RAISON_GROUPES_LUS_LIGNE_A_LIGNE =
  "Inscription en négatif sans son origine, reste en devise qui ne rend pas le solde en francs (écart de change non passé), part déclarée au-delà de la facture · le total est exact, la répartition par échéance de ces groupes ne l'est pas.";
