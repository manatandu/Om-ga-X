/**
 * LIGNE ANALYTIQUE, FONCTION N° 52 · LE JOURNAL ANALYTIQUE ET LES LIGNES NON
 * VENTILÉES DU GRAND LIVRE ANALYTIQUE.
 *
 * Sage (manuel 1, ligne 141 ; manuel 2, lignes 46 et 51) imprime un journal
 * analytique (toutes les écritures, ou les seules OD analytiques) et un grand
 * livre analytique « avec les écritures générales non ventilées ». Aucun texte
 * ne les régit · la comptabilité analytique est « laissée à l'initiative des
 * entités » (SYCEBNL, Partie 2 ch. 3, classe 9, sous-section 2 ; AUDCIF,
 * Titre VII ch. 3, classe 9, sous-section 2). Ce ne sont pas des livres
 * obligatoires (AUDCIF art. 19) · ce sont des écrans de TRAVAIL (§ 8 bis du
 * règlement du dépôt), qui peuvent ne montrer qu'une tranche, à condition de
 * le DIRE (`tronque`, `total`) et de garder des totaux pris par la base sur
 * le périmètre entier. Les quantités et le prix moyen de Sage ne sont pas
 * repris (plan du 2026-10-29).
 *
 * LES NON VENTILÉES SONT CELLES DU CONTRÔLE DES CUMULS, ET D'AUCUN AUTRE
 * FILTRE · une seule écriture du périmètre (`perimetreDuPlan`,
 * `sansRepartitionSur`) sert le contrôle et le grand livre · deux filtres
 * écrits séparément rendraient un écart au contrôle et une liste qui ne
 * parleraient pas des mêmes lignes.
 */
import { ClasseCompte, Prisma } from '@prisma/client';
import { HORS_SITUATION } from '../comptabilite/ecritures-de-situation';

/** Lignes que le journal et le grand livre des non ventilées montrent au plus, par appel. */
export const PLAFOND_LIGNES_JOURNAL_ANALYTIQUE = 2_000;

export const ORIGINES_JOURNAL_ANALYTIQUE = ['TOUTES', 'OD'] as const;
export type OrigineJournalAnalytique = (typeof ORIGINES_JOURNAL_ANALYTIQUE)[number];

/** L'origine lue dans la requête · absente, toutes ; inconnue, `null` (refus nommé par l'appelant). */
export function lireOrigineJournal(texte: string | undefined | null): OrigineJournalAnalytique | null {
  const t = (texte ?? '').trim().toUpperCase();
  if (t === '') return 'TOUTES';
  return (ORIGINES_JOURNAL_ANALYTIQUE as readonly string[]).includes(t) ? (t as OrigineJournalAnalytique) : null;
}

/** Les classes que le plan ventile, en valeurs de l'énumération (« 2,6,7,9 » → CLASSE_2…). */
export function classesDuPlan(classesVentilees: string): ClasseCompte[] {
  return classesVentilees
    .split(',')
    .map((c) => `CLASSE_${c.trim()}` as ClasseCompte)
    .filter((c) => Object.values(ClasseCompte).includes(c));
}

/**
 * Les lignes du grand livre que le plan devrait ventiler sur une fenêtre ·
 * classes ventilées, ni écriture de situation (ligne sage-l1, fonction 12) ni
 * écriture qui solde les comptes de gestion (audit final F4, elle n'est
 * l'objet d'aucune ventilation). La borne du dossier passe par l'écriture,
 * la ligne n'ayant pas de `tenantId`.
 */
export type FenetreDuPlan = { tenantId: string; exerciceId: string; du: Date; au: Date; classes: ClasseCompte[] };

export function perimetreDuPlan(params: FenetreDuPlan): Prisma.LigneEcritureWhereInput {
  return {
    ecriture: {
      tenantId: params.tenantId,
      exerciceId: params.exerciceId,
      date: { gte: params.du, lte: params.au },
      estSoldeDesComptesDeGestion: false,
      ...HORS_SITUATION,
    },
    compte: { classe: { in: params.classes } },
  };
}

/**
 * Sans répartition sur CE plan, et non nulle · `not: 0` et non `gt: 0`, une
 * réimputation inscrit en négatif et la ligne négative reste à ventiler.
 */
export function sansRepartitionSur(fenetre: FenetreDuPlan, planId: string): Prisma.LigneEcritureWhereInput {
  return {
    ...perimetreDuPlan(fenetre),
    ventilations: { none: { planId } },
    OR: [{ debit: { not: 0 } }, { credit: { not: 0 } }],
  };
}

/** Une ligne du journal analytique, une fois lue. */
export type LigneJournalAnalytique = {
  /** Identifiant de la ventilation ou de la ligne d'OD · tri final, et clé d'affichage. */
  id: string;
  origine: 'VENTILATION' | 'OD';
  date: Date;
  journal: string;
  numeroPiece: number | null;
  sectionCode: string;
  sectionIntitule: string;
  compteNumero: string;
  compteIntitule: string;
  libelle: string;
  debit: number;
  credit: number;
};

/**
 * Les `plafond` premières lignes de l'union de deux lectures déjà bornées au
 * même plafond et TRIÉES PAR LA BASE · les ventilations par date, journal,
 * pièce et identifiant, les lignes d'OD par date et identifiant. La fusion ne
 * compare que la DATE et garde l'ordre de chaque lecture · re-trier en
 * JavaScript comparerait des codes de journal autrement que la collation de
 * la base, et la tranche ne serait plus faite des premières lignes. À date
 * égale, les ventilations passent avant les OD, qui les corrigent.
 */
export function premieresDeLUnion(
  ventilations: readonly LigneJournalAnalytique[],
  od: readonly LigneJournalAnalytique[],
  plafond: number,
): LigneJournalAnalytique[] {
  const rendues: LigneJournalAnalytique[] = [];
  let i = 0;
  let j = 0;
  while (rendues.length < plafond && (i < ventilations.length || j < od.length)) {
    const prendreOd = i >= ventilations.length || (j < od.length && od[j].date.getTime() < ventilations[i].date.getTime());
    rendues.push(prendreOd ? od[j++] : ventilations[i++]);
  }
  return rendues;
}
