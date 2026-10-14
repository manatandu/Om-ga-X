import { Prisma, StatutEcriture, TypeJournal } from '@prisma/client';

/**
 * LES ÉCRITURES DE SITUATION (ligne sage-l1, fonction 12 de la reproduction de
 * Sage 100 i7 · « un journal de type Situation ne peut pas être clôturé ni
 * compacté », guide de l'utilisateur, codes journaux).
 *
 * DÉCISION PAR LA LOI (2026-10-14). Le livre-journal reçoit « les mouvements
 * de l'exercice » (AUDCIF art. 19), enregistrés « opération par opération »
 * à la date de leur pièce justificative (art. 16, al. 2 ; art. 17, 3°). Une
 * écriture de situation (simulation, estimation, prévision) n'enregistre
 * aucune opération · elle n'est pas un mouvement de l'exercice et n'entre
 * jamais au livre-journal. Donc :
 *  · elle ne se VALIDE pas · la validation fait entrer la donnée au
 *    livre-journal, dans un traitement irréversible (art. 22, 2°) ;
 *  · elle n'est pas un BROUILLARD · le brouillard attend sa validation, elle
 *    n'en attend aucune, et la clôture annuelle, qui refuse tout brouillard,
 *    ne l'attend pas ;
 *  · aucun livre ni état ne la lit · le grand-livre et la balance sont tirés
 *    des mouvements (art. 19), les états financiers et les déclarations du
 *    livre-journal, la clôture et le report à-nouveau aussi ;
 *  · son journal ne se clôture pas · la clôture informatique de l'art. 22, 3°
 *    porte sur « la chronologie des opérations », qu'il ne tient pas. Les
 *    clôtures partielle et totale y sont refusées, la clôture de période ne
 *    le fige pas. OmegaX ne compacte rien.
 *
 * Elle se lit et s'imprime dans SON journal seulement. Le choix de Sage
 * d'inclure les journaux de situation dans une édition (manuel 2, ligne 29)
 * n'a pas été coché · il ne l'est pas ici non plus.
 *
 * L'INVARIANT · une écriture porte le statut SITUATION si et seulement si son
 * journal est de type Situation. Il est tenu à l'écriture par
 * `common/journal-de-situation/extension-journal-de-situation.ts`, posé sur le
 * client Prisma comme le cloisonnement · un module qui passerait une opération
 * dans un journal de situation est refusé, au lieu d'en faire une simulation.
 */

/** Les statuts que lisent les livres et les états de travail · jamais une situation. */
export const STATUTS_COMPTABLES: readonly StatutEcriture[] = [StatutEcriture.BROUILLARD, StatutEcriture.VALIDEE];

/** Le filtre d'une lecture qui prend le brouillard · tout sauf les écritures de situation. */
export const HORS_SITUATION = { statut: { not: StatutEcriture.SITUATION } } satisfies Prisma.EcritureWhereInput;

/**
 * Le statut que lit un livre ou un état · le livre-journal seul, ou le
 * livre-journal et le brouillard, jamais une situation. Une seule écriture du
 * filtre, que les lecteurs du brouillard partagent.
 */
export function filtreDuStatut(inclureBrouillard: boolean): Prisma.EcritureWhereInput {
  return inclureBrouillard ? HORS_SITUATION : { statut: StatutEcriture.VALIDEE };
}

/** Le statut tel qu'un livre ou un classeur l'imprime · une situation n'est pas un brouillard. */
export function libelleDuStatut(statut: StatutEcriture | string): string {
  if (statut === StatutEcriture.VALIDEE) return 'Validée';
  if (statut === StatutEcriture.SITUATION) return 'Situation';
  return 'Brouillard';
}

/** Le journal reçoit-il des écritures de situation ? */
export function estJournalDeSituation(journal: { type: TypeJournal }): boolean {
  return journal.type === TypeJournal.SITUATION;
}

/** Le statut d'une écriture qui naît dans ce journal, saisie comprise. */
export function statutDeNaissance(journal: { type: TypeJournal }): StatutEcriture {
  return estJournalDeSituation(journal) ? StatutEcriture.SITUATION : StatutEcriture.BROUILLARD;
}

const FONDEMENT =
  "(AUDCIF art. 19 · le livre-journal reçoit les mouvements de l'exercice ; art. 22, 2° · la validation les y fait entrer)";

/** Une écriture de situation présentée à la validation. */
export function motifSituationNeSeValidePas(pieces: string[]): string {
  return (
    `${pieces.length > 1 ? 'Les écritures' : "L'écriture"} ${pieces.join(', ')} ${pieces.length > 1 ? 'sont' : 'est'} ` +
    `${pieces.length > 1 ? 'des écritures' : 'une écriture'} de situation · ${pieces.length > 1 ? 'elles' : 'elle'} ` +
    `n'enregistre${pieces.length > 1 ? 'nt' : ''} aucune opération et n'entre${pieces.length > 1 ? 'nt' : ''} jamais au ` +
    `livre-journal ${FONDEMENT}. Pour passer l'opération, saisissez-la dans un journal ordinaire.`
  );
}

/** Un module, ou un import qui n'est pas la saisie, vise un journal de situation. */
export function motifJournalDeSituationReserveALaSaisie(code: string): string {
  return (
    `Le journal ${code} est un journal de situation · il ne reçoit que des écritures saisies, qui n'entrent jamais ` +
    `au livre-journal ${FONDEMENT}. Une opération passée par un traitement doit l'être dans un journal ordinaire · ` +
    'choisissez-en un autre.'
  );
}

/** Une clôture partielle ou totale demandée sur un journal de situation. */
export function motifJournalDeSituationNonCloturable(code: string): string {
  return (
    `Le journal ${code} est un journal de situation · il ne se clôture pas. La clôture informatique porte sur la ` +
    "chronologie des opérations enregistrées (AUDCIF art. 22, 3°), et ses écritures n'en enregistrent aucune. Une " +
    'clôture de période fige tous les autres journaux et le laisse ouvert.'
  );
}

/** Un journal de situation ne porte pas la séquence de numérotation du fichier. */
export function motifSituationHorsSequenceDuFichier(code: string): string {
  return (
    `Le journal ${code} est un journal de situation · il ne prend pas la numérotation continue pour le fichier, qui ` +
    "numérote les pièces du livre-journal (AUDCIF art. 17, 3°). Choisissez la numérotation continue par journal, " +
    'mensuelle ou manuelle.'
  );
}
