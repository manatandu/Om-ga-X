import type { GroupesLusLigneALigne, MotifGroupeNomme } from './types';

/**
 * LES GROUPES À LA RÉPARTITION INCERTAINE SE DISENT EN UNE LIGNE (paquet 1, B5).
 *
 * Un groupe de lettrage dont le reste ne se répartit pas sûrement entre ses
 * factures garde la lecture ligne à ligne · le total de l'état est exact, la
 * répartition par échéance de ce groupe ne l'est pas. Le serveur le sert
 * (`groupesLusLigneALigne`, borné, le total dit) ; l'écran le dit. Rien
 * n'est affiché quand la lecture n'en a trouvé aucun (`total: 0`), ni quand
 * le serveur ne le sert pas · une absence n'est jamais lue comme « aucun ».
 *
 * CHAQUE GROUPE PORTE SON MOTIF (relecture « échecs silencieux », mineur 7) ·
 * l'infobulle disait pour tous « écart de change non passé », faux pour une
 * facture en devise réglée en PARTIE · l'écart réalisé ne se passe qu'au
 * groupe soldé (AUDCIF art. 55 ; ligne A6). Le motif court suit le groupe, la
 * raison de chaque motif présent va dans l'infobulle.
 */
export const LIBELLE_MOTIF: Record<MotifGroupeNomme, string> = {
  NEGATIF_SANS_ORIGINE: 'négatif sans son origine',
  IMPUTATION_DECLAREE_NON_LUE: 'imputation déclarée illisible',
  DEVISE_SOLDEE_ECART_NON_PASSE: 'soldé en devise, écart de change non passé',
  DEVISE_REGLEE_EN_PARTIE: 'facture en devise réglée en partie',
  RESTE_NON_REPARTI: 'reste non réparti',
};

const RAISON_MOTIF: Record<MotifGroupeNomme, string> = {
  NEGATIF_SANS_ORIGINE: "Une inscription en négatif n'a pas sa ligne d'origine parmi les lignes lues · le groupe est lu ligne à ligne.",
  IMPUTATION_DECLAREE_NON_LUE:
    "Une imputation déclarée dépasse ce que la facture doit, ou porte sur un groupe en devise · le groupe est lu ligne à ligne.",
  DEVISE_SOLDEE_ECART_NON_PASSE:
    "Des factures soldées dans leur devise et non en francs · l'écart de change réalisé n'est pas passé (AUDCIF art. 55), le groupe est lu ligne à ligne.",
  DEVISE_REGLEE_EN_PARTIE:
    "Une facture en devise réglée en partie à un autre cours · son reste au coût historique ne rend pas le solde en francs, et l'écart réalisé ne se passe qu'au groupe soldé · le groupe est lu ligne à ligne.",
  RESTE_NON_REPARTI: 'Des restes qui ne rendent pas le solde du groupe · le groupe est lu ligne à ligne.',
};

export function texteGroupesLusLigneALigne(g: GroupesLusLigneALigne | null | undefined): string | null {
  if (!g || g.total <= 0) return null;
  const nommes = g.groupes
    .map((x) => {
      const motif = x.motif ? LIBELLE_MOTIF[x.motif] : undefined;
      return motif ? `${x.code} (${x.compte}, ${motif})` : `${x.code} (${x.compte})`;
    })
    .join(', ');
  const autres = g.total - g.groupes.length;
  const suite = autres > 0 ? `${nommes ? `${nommes} et ` : ''}${autres} autre${autres > 1 ? 's' : ''}` : nommes;
  return (
    `${g.total} groupe${g.total > 1 ? 's' : ''} de lettrage à la répartition incertaine` +
    (suite ? ` · ${suite}` : '')
  );
}

/**
 * La raison, dans l'infobulle · une phrase par motif présent parmi les
 * groupes nommés, puis ce que la lecture change. Le texte à l'écran reste
 * d'une ligne.
 */
export function raisonGroupesLusLigneALigne(g: GroupesLusLigneALigne | null | undefined): string | null {
  if (!g || g.total <= 0) return null;
  const motifs = [...new Set(g.groupes.map((x) => x.motif).filter((m): m is MotifGroupeNomme => Boolean(m && RAISON_MOTIF[m])))];
  const phrases = motifs.map((m) => RAISON_MOTIF[m]);
  if (g.total > g.groupes.length) phrases.push("Les groupes que la liste ne nomme pas peuvent porter un autre motif.");
  phrases.push("Le total est exact ; la répartition par échéance de ces groupes n'est pas sûre.");
  return phrases.join(' ');
}
