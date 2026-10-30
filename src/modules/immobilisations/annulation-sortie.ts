/**
 * ANNULER LA SORTIE D'UNE IMMOBILISATION, ENTIÈRE OU PARTIELLE · ligne
 * restes-immos-budgets, point 3 (gel levé par Manasse le 2026-10-30).
 *
 * LE TEXTE · AUDCIF art. 20, al. 2 · « Toute correction d'erreur commise et
 * découverte sur l'exercice en cours, s'effectue EXCLUSIVEMENT par
 * l'inscription en négatif des éléments erronés ; l'enregistrement exact est
 * ensuite opéré. » Al. 3 · l'erreur significative d'un exercice antérieur se
 * corrige « par ajustement du compte report à nouveau » · jamais dans un
 * exercice clôturé, donc. Art. 22, 2° · la validation fait entrer l'écriture
 * au livre-journal et l'irréversibilité « interdise toute suppression » · au
 * brouillard, elle n'y est pas encore et se retire. Art. 22, 4° · le négatif
 * d'une période close s'inscrit au premier jour non clôturé, sa date de
 * valeur mentionnée (`EcritureService.inscrireEnNegatifPourAnnulation`).
 * Aucun de ces articles n'est dans la liste d'exclusion de l'art. 3 du
 * SYCEBNL · la règle vaut aux deux référentiels.
 *
 * LE MODÈLE · celui de l'annulation des traitements (`annulation-traitement.ts`,
 * ligne sage-l4, n° 67) · motif exigé, journal d'audit, verrou de la fiche,
 * mises à jour unitaires, brouillard supprimé (`deleteMany` filtré sur le
 * statut, une ligne et une seule, sinon 409), validée inscrite en négatif,
 * refus d'une ligne lettrée ou pointée, refus tant qu'un acte postérieur a lu
 * la sortie. Chaque écriture annulée garde sa ligne d'historique
 * (`AnnulationTraitementImmobilisation`, nature `SORTIE`), qui retient
 * l'origine validée et son négatif.
 *
 * LA FICHE EST RENDUE TELLE QU'AVANT LA SORTIE · en service, sans date, prix,
 * nature ni pièce de sortie, son complément retiré, les lignes de
 * réévaluation rendues au centime (`passesEcartSortie`). Une sortie
 * PARTIELLE rend ses unités au lot · quantité, brut, valeur résiduelle et
 * amortissements détachés reviennent au centime (la part prise), la reprise
 * de la part de dépréciation sur le lot est retirée avec elle, et la fiche des
 * unités, née de la sortie, disparaît avec elle (son instantané reste dans
 * l'historique).
 *
 * Ce fichier ne lit rien · il porte les règles, que le service nourrit.
 */

/** Les écritures d'une sortie, dans l'ordre où elles se défont (la plus récente d'abord). */
export type RoleEcritureSortie = 'ECART' | 'PRODUIT' | 'SORTIE' | 'COMPLEMENT' | 'REPRISE_LOT';

export const ORDRE_DES_ROLES: readonly RoleEcritureSortie[] = ['ECART', 'PRODUIT', 'SORTIE', 'COMPLEMENT', 'REPRISE_LOT'];

export const LIBELLE_ROLE: Record<RoleEcritureSortie, string> = {
  ECART: 'écart de réévaluation soldé à la sortie',
  PRODUIT: 'produit de cession',
  SORTIE: 'sortie du bien',
  COMPLEMENT: 'dotation complémentaire de la sortie',
  REPRISE_LOT: 'reprise de la part de dépréciation sur le lot',
};

/** Un acte postérieur qui a lu la sortie · nommé, avec son issue. */
export interface ActePosterieur {
  libelle: string;
  /** Le geste qui le défait, s'il existe dans OmegaX. */
  issue: string | null;
}

/** Ce que le service lit de la sortie, pour la juger. */
export interface FaitsSortie {
  sortie: boolean;
  /** Sortie par un transfert dans le groupe · elle s'annule avec lui. */
  transfertGroupe: boolean;
  /** Sortie née d'un échange · le bien reçu est né du même geste. */
  echange: boolean;
  /** Le bien a été remplacé par un composant renouvelé (`renouveler`), nommé. */
  renouvelePar: string | null;
  /** L'exercice de la sortie est clôturé. */
  exerciceClos: boolean;
  /** Sortie d'avant la ligne, dont le complément ne se distingue pas d'une dotation ordinaire. */
  complementIndistinct: boolean;
  /** Sortie d'avant la ligne qui a soldé un écart de réévaluation sans en garder la part par ligne. */
  ecartSansParts: boolean;
  /** Sortie partielle d'avant la ligne dont la reprise sur le lot ne se rattache pas d'office. */
  repriseLotIndistincte: boolean;
  /** Sortie partielle · le lot est sorti depuis. */
  lotSorti: boolean;
  /** Le refus d'une écriture (lettrée, pointée, tenue par un autre module), ou null. */
  refusEcriture: string | null;
  posterieurs: readonly ActePosterieur[];
}

const CORRECTION_A_LA_MAIN =
  'la correction passe alors par une écriture en négatif saisie par le cabinet, avec son motif (AUDCIF art. 20, al. 2)';

/** LE MOTIF DU REFUS, OU `null` · dans l'ordre où le cabinet doit lire les causes. */
export function motifRefusAnnulationSortie(f: FaitsSortie): string | null {
  if (!f.sortie) return "Ce bien n'est pas sorti · il n'y a pas de sortie à annuler.";
  if (f.transfertGroupe) {
    return 'Ce bien est sorti par un transfert dans le groupe · la sortie fait partie du transfert et s’annule avec lui, depuis le siège (fenêtre Groupe, onglet « Transferts de biens »).';
  }
  if (f.echange) {
    return (
      'Ce bien est sorti par un échange · le bien reçu est né de la même opération (Guide d’application SYSCOHADA, Partie 1 ' +
      `ch. 5 § 4.5), et l’échange ne s’annule pas dans OmegaX · ${CORRECTION_A_LA_MAIN}.`
    );
  }
  if (f.renouvelePar) {
    return (
      `Ce composant a été renouvelé par « ${f.renouvelePar} » · sa sortie fait partie du renouvellement (AUDCIF Titre VIII ` +
      `ch. 4 § 4.1), qui ne s’annule pas dans OmegaX · ${CORRECTION_A_LA_MAIN}.`
    );
  }
  if (f.exerciceClos) {
    return (
      "L'exercice de la sortie est clôturé · son erreur ne se corrige plus par inscription en négatif, qui ne vaut que pour " +
      "l'erreur « commise et découverte sur l'exercice en cours » (AUDCIF art. 20, al. 2). Significative, elle se corrige par " +
      'ajustement du report à nouveau (al. 3) ; dans tous les cas, elle fait l’objet d’une information dans les Notes annexes (al. 4).'
    );
  }
  if (f.complementIndistinct) {
    return (
      'Cette sortie a été passée avant que la dotation complémentaire ne soit liée à elle, et la dotation de l’exercice, datée ' +
      `du jour de la sortie, ne se distingue pas d’une dotation ordinaire · rien n’est retiré d’office ; ${CORRECTION_A_LA_MAIN}.`
    );
  }
  if (f.ecartSansParts) {
    return (
      'Cette sortie a soldé l’écart de réévaluation du bien avant que la part de chaque réévaluation ne soit gardée (ligne A15 ' +
      `bis) · les lignes de réévaluation ne se rendent pas au centime, rien n’est rendu d’office ; ${CORRECTION_A_LA_MAIN}.`
    );
  }
  if (f.repriseLotIndistincte) {
    return (
      'Cette sortie d’unités a été passée avant que la reprise de leur part de dépréciation ne soit liée à leur fiche, et le lot ' +
      `en porte plusieurs dans l’exercice · rien n’est retiré d’office ; ${CORRECTION_A_LA_MAIN}.`
    );
  }
  if (f.lotSorti) {
    return 'Le lot dont ces unités sont sorties est sorti depuis · annulez d’abord la sortie du lot (« Annuler la sortie » sur sa fiche), puis celle-ci.';
  }
  if (f.refusEcriture) return f.refusEcriture;
  if (f.posterieurs.length > 0) {
    const liste = f.posterieurs.slice(0, 5).map((a) => a.libelle).join(' ; ');
    const reste = f.posterieurs.length > 5 ? ` et ${f.posterieurs.length - 5} autre(s)` : '';
    const avecIssue = f.posterieurs.filter((a) => a.issue);
    const sansIssue = f.posterieurs.filter((a) => !a.issue);
    const issue =
      sansIssue.length > 0
        ? ` ${sansIssue.map((a) => a.libelle).join(' ; ')} ne s’annule pas dans OmegaX · ${CORRECTION_A_LA_MAIN}.`
        : ` ${avecIssue[0].issue}, puis annulez la sortie.`;
    return (
      `Un acte postérieur a lu cette sortie · ${liste}${reste}. Annulée seule, la sortie laisserait ces actes calculés sur un ` +
      `état que la fiche ne porterait plus, sans qu’aucun total ne le signale.${issue}`
    );
  }
  return null;
}

/**
 * LE COMPLÉMENT D'UNE SORTIE D'AVANT LA LIGNE · la sortie ne liait pas sa
 * dotation complémentaire. Une dotation de l'exercice datée du jour de la
 * sortie, ce jour n'étant pas la clôture, est le complément ; datée d'un autre
 * jour, c'est une dotation ordinaire passée avant la sortie (la sortie ne
 * complète pas un exercice déjà doté) ; datée du jour de la sortie quand ce
 * jour EST la clôture, les deux se confondent · indistinct, rien n'est
 * deviné.
 */
export function complementDUneSortieAncienne(entree: {
  /** La fiche des unités d'un lot n'a d'autre dotation que son complément. */
  ficheDesUnites: boolean;
  dateSortie: Date;
  finExercice: Date;
  dotationsDeLExercice: ReadonlyArray<{ id: string; dateEcriture: Date | null }>;
}): { dotationId: string | null; indistinct: boolean } {
  const jour = (d: Date) => d.toISOString().slice(0, 10);
  if (entree.dotationsDeLExercice.length === 0) return { dotationId: null, indistinct: false };
  if (entree.ficheDesUnites && entree.dotationsDeLExercice.length === 1) return { dotationId: entree.dotationsDeLExercice[0].id, indistinct: false };
  if (entree.dotationsDeLExercice.length > 1) return { dotationId: null, indistinct: true };
  const d = entree.dotationsDeLExercice[0];
  if (!d.dateEcriture || jour(d.dateEcriture) !== jour(entree.dateSortie)) return { dotationId: null, indistinct: false };
  if (jour(entree.dateSortie) === jour(entree.finExercice)) return { dotationId: null, indistinct: true };
  return { dotationId: d.id, indistinct: false };
}

/** Une part de réévaluation gardée par la sortie · `{ ligneId, traitement, montant }`. */
export interface PassEcart {
  ligneId: string;
  /** `RESERVE` · rendu à `ecartTransfere` ; autrement (`REPRISE_861`) à `provisionReprise`, comme la sortie l'a pris. */
  traitement: string;
  montant: number;
}

/** Les parts gardées, lues · `null` pour une sortie d'avant la ligne (aucune liste). */
export function lirePassesEcart(json: unknown): PassEcart[] | null {
  if (!Array.isArray(json)) return null;
  return json
    .filter((x): x is { ligneId: string; traitement: string; montant: number } => !!x && typeof (x as { ligneId?: unknown }).ligneId === 'string')
    .map((x) => ({ ligneId: x.ligneId, traitement: String(x.traitement), montant: Number(x.montant) }));
}

/** Le motif saisi · trois à cinq cents caractères, comme les autres annulations. */
export { motifRefusMotifAnnulation as motifRefusMotifAnnulationSortie } from './annulation-traitement';
