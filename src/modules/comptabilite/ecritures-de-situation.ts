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
 *  · elle ne se VALIDE pas · l'art. 22 fixe son champ à son 1° · « les
 *    données relatives à toute opération donnant lieu à enregistrement ».
 *    Lu seul, son 2° (« toute donnée entrée fait l'objet d'une validation »)
 *    se lirait contre la règle · une simulation est une donnée entrée, jamais
 *    validée. Mais il porte sur les données de son 1°, et une simulation ne
 *    se rapporte à aucune opération · elle est hors du champ de l'article, et
 *    la validation, qui fait entrer l'opération au livre-journal dans un
 *    traitement irréversible, n'a rien à y faire entrer (relecture du premier
 *    tour, m1). La migration `20270171000001_ecritures_de_situation_reprises`
 *    cite le seul 2° · appliquée, elle ne se retouche pas (Prisma en vérifie
 *    l'empreinte), et c'est ici que se lit la décision ;
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
 * LE FILTRE REÇU D'UN APPELANT, ARRÊTÉ SUR SON STATUT · le statut qu'il pose
 * est gardé (le livre-journal seul, `VALIDEE`), et à défaut la simulation est
 * écartée · une lecture qui reçoit son filtre de l'appelant ne la laisse
 * jamais passer parce que l'appelant l'a oubliée. Nommé par le filet
 * `lectures-hors-situation.spec.ts`.
 */
// LA VALEUR, PAS LA CLÉ (relecture du second tour, e) · un appelant qui pose
// `statut: undefined` (un champ facultatif relayé tel quel) avait la clé sans
// valeur · Prisma ignore un `undefined`, et la simulation passait.
export function avecStatut<F extends Prisma.EcritureWhereInput>(filtre: F): F | (F & typeof HORS_SITUATION) {
  return filtre.statut !== undefined ? filtre : { ...filtre, ...HORS_SITUATION };
}

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
  "(AUDCIF art. 19 · le livre-journal reçoit les mouvements de l'exercice ; art. 22, 1° · la validation ne porte que sur " +
  'les données relatives à une opération)';

/** Une écriture de situation présentée à la validation. */
export function motifSituationNeSeValidePas(pieces: string[]): string {
  return (
    `${pieces.length > 1 ? 'Les écritures' : "L'écriture"} ${pieces.join(', ')} ${pieces.length > 1 ? 'sont' : 'est'} ` +
    `${pieces.length > 1 ? 'des écritures' : 'une écriture'} de situation · ${pieces.length > 1 ? 'elles' : 'elle'} ` +
    `n'enregistre${pieces.length > 1 ? 'nt' : ''} aucune opération et n'entre${pieces.length > 1 ? 'nt' : ''} jamais au ` +
    `livre-journal ${FONDEMENT}. Pour passer l'opération, saisissez-la dans un journal ordinaire.`
  );
}

/**
 * Une simulation désignée pour justifier un acte d'un module (redressement
 * d'inventaire, consignation, don, facture, mouvement de stock, contre-passation
 * déclarée) · elle n'enregistre aucune opération, elle ne justifie rien.
 * Rattachée, elle se disait la pièce de l'acte, devenait retenue et ne se
 * retirait plus (relecture du premier tour, B3).
 */
export function motifSimulationNonRattachable(piece: string, acte: string): string {
  return (
    `L'écriture ${piece} est une écriture de situation · elle n'enregistre aucune opération ${FONDEMENT} et ne ` +
    `justifie pas ${acte}. Désignez la pièce passée dans un journal ordinaire.`
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

/**
 * LE BROUILLARD HÉRITÉ D'UN JOURNAL DE SITUATION SE TRANSFÈRE DANS UN JOURNAL
 * ORDINAIRE (relecture du second tour, BLOQUANT · décision par la loi).
 *
 * La reprise des écritures tenues (`20270171040000_ecritures_de_situation_tenues`)
 * laisse au brouillard, dans leur journal de situation, celles qu'une lettre,
 * un pointage ou un module tient · saisies avant la règle, elles peuvent
 * enregistrer une opération. Elles ne s'y valident pas (l'invariant le
 * refuse), et défaire ce qui les tient n'est pas toujours possible (lettrage
 * figé par une clôture de période, rapprochement clos qui n'est pas le
 * dernier, mouvement de stock qui a servi une sortie, journal clôturé
 * totalement avant la règle) · la clôture annuelle refusait alors sans issue.
 * Sur `main`, elles se validaient sur place.
 *
 * Le geste · TRANSFÉRER la pièce dans un journal ordinaire du dossier, où elle
 * se valide comme toute pièce. Ce qu'en dit l'AUDCIF :
 *  · art. 22, 1° · « l'indication de l'origine, du contenu et de
 *    l'imputation » · lignes, comptes, montants, lettrage, pointage et liens
 *    des modules sont GARDÉS tels quels, l'auteur et la date de saisie aussi ;
 *    le journal et le numéro d'origine restent au journal d'audit, qui
 *    enregistre la tête de l'écriture avant et après (`Ecriture` y est suivie) ;
 *  · art. 22, 2° · l'irréversibilité frappe la donnée VALIDÉE · un brouillard
 *    n'est pas au livre-journal, il se modifie, et le transfert n'en valide
 *    rien · la validation reste un geste à part, réservé au comptable ;
 *  · art. 22, 3° et 4° · la chronologie du journal d'ARRIVÉE est tenue ·
 *    la pièce y prend le numéro suivant (art. 17, 3°), et datée d'une période
 *    qu'une clôture fige dans ce journal, elle est enregistrée au premier jour
 *    de la période non encore clôturée, sa date de valeur mentionnée
 *    distinctement · sur DEMANDE, comme à la saisie, jamais au-delà de
 *    l'exercice. Les clôtures du journal de SITUATION ne la retiennent pas ·
 *    elles portent sur la chronologie d'opérations enregistrées, et une pièce
 *    qui n'est pas entrée au livre-journal n'en fait pas partie (même lecture
 *    que `cloturesApplicables`, qui ne fige pas ce journal par une clôture de
 *    période).
 */
export const ISSUE_TRANSFERT =
  'transférez-la dans un journal ordinaire (Brouillard, « Transférer »), où elle se valide comme toute pièce · ' +
  'ses lignes, son lettrage, son pointage et ses liens aux modules restent tels quels';

/** La pièce présentée au transfert n'est pas un brouillard hérité d'un journal de situation. */
export function motifTransfertSansObjet(piece: string, statut: StatutEcriture | string, situation: boolean): string | null {
  if (!situation) {
    return `L'écriture ${piece} n'est pas dans un journal de situation · le transfert ne sert qu'au brouillard qu'un tel journal a gardé.`;
  }
  if (statut === StatutEcriture.SITUATION) {
    return (
      `L'écriture ${piece} est une écriture de situation · elle n'enregistre aucune opération ${FONDEMENT} et ne se ` +
      "transfère pas. Pour passer l'opération, saisissez-la dans un journal ordinaire."
    );
  }
  if (statut === StatutEcriture.VALIDEE) {
    return (
      `L'écriture ${piece} est validée · elle est entrée au livre-journal et ne change plus de journal (AUDCIF ` +
      'art. 22, 2°). Le contrôle des écritures validées dans un journal de situation dit la voie de correction.'
    );
  }
  return null;
}

/** Le journal d'arrivée choisi est lui-même un journal de situation. */
export function motifArriveeDeSituation(code: string): string {
  return (
    `Le journal ${code} est un journal de situation · ses écritures ne se valident pas. Choisissez un journal ` +
    "ordinaire, celui où l'opération aurait dû être saisie."
  );
}

/** Le brouillard hérité présenté à la validation, nommé avec son issue. */
export function motifBrouillardHeriteNeSeValidePas(pieces: string[]): string {
  const plusieurs = pieces.length > 1;
  return (
    `${plusieurs ? 'Les écritures' : "L'écriture"} ${pieces.join(', ')} ${plusieurs ? 'sont restées' : 'est restée'} au ` +
    `brouillard dans un journal de situation · ${plusieurs ? 'elles ne se valident' : 'elle ne se valide'} pas dans ce ` +
    `journal ${FONDEMENT}. ${ISSUE_TRANSFERT.charAt(0).toUpperCase()}${ISSUE_TRANSFERT.slice(1)}.`
  );
}

/**
 * L'impression ou l'export d'un journal de situation (relecture du second
 * tour, d) · la suite numérotée des impressions atteste le journal des
 * opérations (AUDCIF art. 22, 1° et 7°, « les états périodiques fournis soient
 * numérotés et datés »). Une simulation n'en fait pas partie · imprimée, elle
 * ne prend aucun numéro de la suite, et la page le dit.
 */
export function motifImpressionDeSituationNonNumerotee(code: string): string {
  return (
    `Le journal ${code} est un journal de situation · son impression n'atteste aucune opération du livre-journal et ` +
    'ne prend pas de numéro dans la suite des impressions.'
  );
}
