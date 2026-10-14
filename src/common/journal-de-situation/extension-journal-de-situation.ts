import { BadRequestException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * L'INVARIANT DES ÉCRITURES DE SITUATION, TENU À L'ÉCRITURE (ligne sage-l1,
 * fonction 12 · voir `modules/comptabilite/ecritures-de-situation.ts` pour la
 * décision par la loi).
 *
 * Une écriture porte le statut SITUATION si et seulement si son journal est
 * de type Situation. Les deux sens comptent, et chacun ferme un défaut muet :
 *  · une écriture VALIDÉE ou au BROUILLARD dans un journal de situation · un
 *    module qui y passerait une dotation ou une liquidation ferait entrer une
 *    simulation au livre-journal, ou laisserait une opération réelle hors de
 *    tout livre sans que rien ne le dise ;
 *  · une écriture de SITUATION dans un journal ordinaire · elle sortirait des
 *    livres et des états sans que son journal le laisse deviner.
 *
 * POSÉE SUR LE CLIENT PRISMA, comme le cloisonnement et le périmètre des
 * journaux · une trentaine de fichiers créent ou modifient des écritures, et un
 * contrôle qu'on peut oublier d'appeler n'est pas un contrôle. Elle REFUSE, elle
 * ne réécrit jamais une requête · réécrire masquerait le défaut.
 *
 * Elle ne lit le type du journal que lorsqu'une écriture naît ou change de
 * statut ou de journal · une modification de libellé, de date ou de lignes ne
 * coûte rien de plus.
 */

export const MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL =
  "Une écriture de situation ne vit que dans un journal de type Situation · elle n'enregistre aucune opération et " +
  "n'entre jamais au livre-journal (AUDCIF art. 19 ; art. 22, 2°). Passez l'opération dans un journal ordinaire.";

/** Le motif du refus pour un journal de situation, nommé par son code. */
export function messageJournalDeSituation(code: string): string {
  return (
    `Le journal ${code} est un journal de situation · ses écritures n'entrent jamais au livre-journal et ne se ` +
    "valident pas (AUDCIF art. 19 ; art. 22, 2°). Seule la saisie y écrit · passez l'opération dans un journal ordinaire."
  );
}

const SITUATION = 'SITUATION';
const CREATIONS = ['create', 'createMany', 'createManyAndReturn'];
const MODIFICATIONS = ['update', 'updateMany', 'upsert'];

type Donnee = {
  journalId?: string;
  journal?: { connect?: { id?: string } };
  statut?: string | { set?: string };
};

/** Le journal que porte une donnée, s'il y en a un. */
function journalDe(d: Donnee | undefined): string | undefined {
  if (!d) return undefined;
  if (d.journalId !== undefined) return d.journalId;
  return d.journal?.connect?.id;
}

/** Le statut que pose une donnée, s'il y en a un · forme directe ou `{ set }`. */
function statutDe(d: Donnee | undefined): string | undefined {
  if (!d || d.statut === undefined) return undefined;
  return typeof d.statut === 'string' ? d.statut : d.statut?.set;
}

/**
 * LA RÈGLE, PURE · rend le motif du refus, ou null. `situation` dit si le
 * journal est de type Situation, `statut` le statut final de l'écriture.
 */
export function motifEcartJournalDeSituation(
  journal: { situation: boolean; code: string },
  statut: string,
): string | null {
  if (journal.situation && statut !== SITUATION) return messageJournalDeSituation(journal.code);
  if (!journal.situation && statut === SITUATION) return MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL;
  return null;
}

type LecteurJournaux = { journal: { findMany: (a: unknown) => Promise<Array<{ id: string; code: string; type: string }>> } };
type LecteurEcritures = {
  ecriture: { groupBy: (a: unknown) => Promise<Array<{ journalId: string; statut: string }>> };
};

async function journauxDe(base: LecteurJournaux, ids: string[]) {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return new Map<string, { situation: boolean; code: string }>();
  const lus = await base.journal.findMany({ where: { id: { in: uniques } }, select: { id: true, code: true, type: true } });
  return new Map(lus.map((j) => [j.id, { situation: j.type === SITUATION, code: j.code }]));
}

/** Les créations · chaque donnée, son journal et son statut (BROUILLARD par défaut, celui du schéma). */
async function garderCreations(base: LecteurJournaux, donnees: Donnee[]) {
  const ids = donnees.map(journalDe).filter((x): x is string => !!x);
  const journaux = await journauxDe(base, ids);
  for (const d of donnees) {
    const id = journalDe(d);
    const journal = id ? journaux.get(id) : undefined;
    // Un journal introuvable est refusé plus loin par sa clé étrangère · rien
    // à juger ici.
    if (!journal) continue;
    const motif = motifEcartJournalDeSituation(journal, statutDe(d) ?? 'BROUILLARD');
    if (motif) throw new BadRequestException(motif);
  }
}

export async function garderJournalDeSituation(
  base: PrismaClient,
  contexte: { model: string; operation: string; args: unknown; query: (args: unknown) => Promise<unknown> },
): Promise<unknown> {
  const { model, operation, args, query } = contexte;
  if (model !== 'Ecriture') return query(args);
  const a = args as { data?: Donnee | Donnee[]; where?: unknown; create?: Donnee; update?: Donnee };
  const lecteur = base as unknown as LecteurJournaux & LecteurEcritures;

  if (CREATIONS.includes(operation)) {
    await garderCreations(lecteur, Array.isArray(a.data) ? a.data : a.data ? [a.data] : []);
    return query(args);
  }

  if (MODIFICATIONS.includes(operation)) {
    if (operation === 'upsert' && a.create) await garderCreations(lecteur, [a.create]);
    const donnee = (operation === 'upsert' ? a.update : a.data) as Donnee | undefined;
    const nouveauStatut = statutDe(donnee);
    const nouveauJournal = journalDe(donnee);
    if (nouveauStatut === undefined && nouveauJournal === undefined) return query(args);
    // Les écritures visées, regroupées par journal et par statut · une
    // lecture, quel que soit leur nombre (validation par lot comprise).
    const groupes = await lecteur.ecriture.groupBy({
      by: ['journalId', 'statut'],
      where: a.where as Prisma.EcritureWhereInput,
    });
    const journaux = await journauxDe(lecteur, [
      ...groupes.map((g) => g.journalId),
      ...(nouveauJournal ? [nouveauJournal] : []),
    ]);
    for (const g of groupes) {
      const journal = journaux.get(nouveauJournal ?? g.journalId);
      if (!journal) continue;
      const motif = motifEcartJournalDeSituation(journal, nouveauStatut ?? g.statut);
      if (motif) throw new BadRequestException(motif);
    }
    return query(args);
  }

  return query(args);
}

export function extensionJournalDeSituation(base: PrismaClient) {
  return Prisma.defineExtension({
    name: 'journal-de-situation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return garderJournalDeSituation(base, { model, operation, args, query });
        },
      },
    },
  });
}
