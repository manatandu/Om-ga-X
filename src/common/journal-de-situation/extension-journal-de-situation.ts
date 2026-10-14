import { BadRequestException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { acteurCourant, transactionAuditee } from '../audit/contexte-audit';
import { perimetreCourant, raisonHorsCloisonnement } from '../cloisonnement/contexte-cloisonnement';

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
 * coûte rien de plus. Ses lectures passent par la transaction en cours quand
 * il y en a une (`lecteurDe`).
 */

export const MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL =
  "Une écriture de situation ne vit que dans un journal de type Situation · elle n'enregistre aucune opération et " +
  "n'entre jamais au livre-journal (AUDCIF art. 19 ; art. 22, 1°). Passez l'opération dans un journal ordinaire.";

/** Le motif du refus pour un journal de situation, nommé par son code. */
export function messageJournalDeSituation(code: string): string {
  return (
    `Le journal ${code} est un journal de situation · ses écritures n'entrent jamais au livre-journal et ne se ` +
    "valident pas (AUDCIF art. 19 ; art. 22, 1°). Seule la saisie y écrit · passez l'opération dans un journal ordinaire."
  );
}

const SITUATION = 'SITUATION';
const CREATIONS = ['create', 'createMany', 'createManyAndReturn'];
const MODIFICATIONS = ['update', 'updateMany', 'upsert'];

type Donnee = {
  journalId?: string;
  journal?: { connect?: { id?: string } };
  statut?: string | { set?: string };
  tenantId?: string;
  tenant?: { connect?: { id?: string } };
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

type Ciblee = { journalId: string; statut: string; tenantId: string };
type Lecteur = {
  journal: { findMany: (a: unknown) => Promise<Array<{ id: string; code: string; type: string }>> };
  ecriture: {
    groupBy: (a: unknown) => Promise<Ciblee[]>;
    findFirst: (a: unknown) => Promise<Ciblee | null>;
  };
};

/**
 * LE LECTEUR · la TRANSACTION EN COURS quand il y en a une (relecture de la
 * ligne sage-l1, M2). Lue sur le client de base, la lecture prenait une
 * SECONDE connexion pendant que la transaction tenait la première · sous
 * charge le pool s'épuise (P2024, le défaut que F159 a corrigé pour le journal
 * d'audit), et elle ne voyait pas ce que la transaction venait d'écrire (une
 * écriture créée puis validée dans le même acte échappait au jugement). Comme
 * le maillon d'audit (`extension-audit.ts`), on lit donc par la transaction.
 *
 * Le client de transaction porte la garde de cloisonnement · chaque lecture
 * est BORNÉE par le dossier de l'écriture jugée, que la garde admet s'il est
 * celui de la session ou de son périmètre de groupe. Sans dossier au contexte
 * ni sortie déclarée, la garde refuserait toute collection · seul cas où la
 * lecture reste sur le client de base, comme la création qu'elle juge, que la
 * garde laisse alors passer.
 */
function lecteurDe(base: PrismaClient): { lecteur: Lecteur; base: Lecteur } {
  const tx = transactionAuditee();
  const lisibleDansLaTransaction =
    raisonHorsCloisonnement() !== undefined ||
    !!acteurCourant()?.tenantId ||
    (perimetreCourant()?.size ?? 0) > 0;
  const brut = base as unknown as Lecteur;
  return { lecteur: tx && lisibleDansLaTransaction ? (tx as Lecteur) : brut, base: brut };
}

/** Le dossier que nomme une donnée de création · tenantId en clair ou tenant.connect.id. */
function dossierNomme(d: Donnee | undefined): string | undefined {
  if (!d) return undefined;
  if (typeof d.tenantId === 'string') return d.tenantId;
  const connecte = d.tenant?.connect?.id;
  return typeof connecte === 'string' ? connecte : undefined;
}

type Demande = { journalId: string; tenantId: string | undefined };

/**
 * Le type et le code des journaux demandés, lus dossier par dossier · une
 * lecture par dossier (un seul en pratique, plusieurs pour un lot du siège).
 * Une donnée qui ne nomme pas son dossier, que la colonne NOT NULL refusera de
 * toute façon, se lit sur le client de base · elle n'a pas de borne à donner.
 */
async function journauxDe(l: { lecteur: Lecteur; base: Lecteur }, demandes: Demande[]) {
  const parDossier = new Map<string | undefined, Set<string>>();
  for (const d of demandes) {
    const ids = parDossier.get(d.tenantId) ?? new Set<string>();
    ids.add(d.journalId);
    parDossier.set(d.tenantId, ids);
  }
  const resultat = new Map<string, { situation: boolean; code: string }>();
  for (const [tenantId, ids] of parDossier) {
    const where = tenantId ? { tenantId, id: { in: [...ids] } } : { id: { in: [...ids] } };
    const source = tenantId ? l.lecteur : l.base;
    const lus = await source.journal.findMany({ where, select: { id: true, code: true, type: true } });
    for (const j of lus) resultat.set(j.id, { situation: j.type === SITUATION, code: j.code });
  }
  return resultat;
}

/** Les créations · chaque donnée, son journal et son statut (BROUILLARD par défaut, celui du schéma). */
async function garderCreations(l: { lecteur: Lecteur; base: Lecteur }, donnees: Donnee[]) {
  const demandes: Demande[] = [];
  for (const d of donnees) {
    const journalId = journalDe(d);
    if (journalId) demandes.push({ journalId, tenantId: dossierNomme(d) });
  }
  const journaux = await journauxDe(l, demandes);
  for (const d of donnees) {
    const id = journalDe(d);
    const journal = id ? journaux.get(id) : undefined;
    // Un journal introuvable est refusé plus loin par sa clé étrangère (ou,
    // d'un autre dossier, par la garde de cloisonnement) · rien à juger ici.
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
  const l = lecteurDe(base);

  if (CREATIONS.includes(operation)) {
    await garderCreations(l, Array.isArray(a.data) ? a.data : a.data ? [a.data] : []);
    return query(args);
  }

  if (MODIFICATIONS.includes(operation)) {
    if (operation === 'upsert' && a.create) await garderCreations(l, [a.create]);
    const donnee = (operation === 'upsert' ? a.update : a.data) as Donnee | undefined;
    const nouveauStatut = statutDe(donnee);
    const nouveauJournal = journalDe(donnee);
    if (nouveauStatut === undefined && nouveauJournal === undefined) return query(args);
    const select = { journalId: true, statut: true, tenantId: true };
    // Les écritures visées. Une seule pour `update` et `upsert` (filtre
    // unique), relue par une lecture UNITAIRE que la garde de cloisonnement
    // juge après coup ; pour un lot, regroupées par journal, statut et
    // dossier · une lecture, quel que soit leur nombre (validation par lot
    // comprise), sous le filtre même du lot, que la garde exige déjà borné.
    const groupes: Ciblee[] =
      operation === 'updateMany'
        ? await l.lecteur.ecriture.groupBy({
            by: ['journalId', 'statut', 'tenantId'],
            where: a.where as Prisma.EcritureWhereInput,
          })
        : await l.lecteur.ecriture
            .findFirst({ where: a.where as Prisma.EcritureWhereInput, select })
            .then((e) => (e ? [e] : []));
    const journaux = await journauxDe(
      l,
      groupes.map((g) => ({ journalId: nouveauJournal ?? g.journalId, tenantId: g.tenantId })),
    );
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
