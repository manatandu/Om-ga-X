import { BadRequestException } from '@nestjs/common';
import { FormeImpressionJournal, Prisma, StatutEcriture, TypeJournal } from '@prisma/client';
import { transactionJournalisee, type ClientTransactionnel } from '../../common/audit/transaction-journalisee';
import type { CriteresRecherche } from '../comptabilite/recherche-ecritures';

/**
 * LE JOURNAL MARQUÉ « IMPRIMÉ » (ligne sage-l1, fonction 60 · Sage 100 i7,
 * manuel 2 ligne 67, manuel 3 ligne 29 · l'impression du journal le marque
 * imprimé, et la clôture d'un journal non imprimé peut être refusée).
 *
 * DÉCISION PAR LA LOI (D3 de la reproduction, relue le 2026-10-14). AUDCIF
 * art. 22, 3° · la clôture informatique est imposée « au moins
 * trimestrielle », et le texte ne la subordonne à aucune impression ;
 * art. 22, 1° · les données « puissent être restituées sur papier ou sous une
 * forme directement intelligible » ; art. 22, 7° · « les états périodiques
 * fournis soient numérotés et datés ». D'où :
 *  · l'impression du journal est ENREGISTRÉE par le serveur, numérotée
 *    (suite continue par dossier) et datée, avec son auteur, l'exercice, le
 *    journal (ou tous) et la période couverts, et le nombre de pièces qu'il
 *    a compté lui-même ;
 *  · le refus de clôturer un journal non imprimé est une OPTION du dossier,
 *    désactivée par défaut (comme le double regard) · l'imposer ferait d'une
 *    préférence d'organisation une condition que la loi ne pose pas, et
 *    l'issue est immédiate, imprimer le journal ;
 *  · UNE ÉCRITURE VALIDÉE APRÈS L'IMPRESSION rend sa période non imprimée ·
 *    le papier ne la porte pas. La comparaison est faite jour par jour, sur la
 *    dernière validation du jour contre l'heure de l'impression qui le couvre.
 *
 * CE QUI COMPTE COMME UNE IMPRESSION DU JOURNAL · le journal ENTIER de la
 * période, un journal ou tous · jamais une recherche (compte, montant,
 * libellé, pièce, référence), qui n'est pas le journal. À l'écran, la fenêtre
 * ne montre qu'une tranche au-delà de son plafond · une impression de la
 * fenêtre n'atteste alors rien, elle est refusée (l'export, lui, rend tout).
 *
 * Les écritures de situation (fonction 12) ne sont pas au livre-journal · un
 * journal de situation n'a rien à imprimer pour la clôture, il ne se clôture
 * pas.
 */

export interface PerimetreImpression {
  exerciceId?: string;
  journalId?: string | null;
  dateDebut?: string;
  dateFin?: string;
}

/** Une impression déjà enregistrée, telle que le contrôle la lit. */
export interface ImpressionLue {
  journalId: string | null;
  dateDebut: Date;
  dateFin: Date;
  imprimeAt: Date;
}

/** La dernière validation d'un jour d'un journal · ce que l'impression doit couvrir. */
export interface JourValide {
  journalId: string;
  date: Date;
  derniereValidation: Date | null;
}

const jour = (d: Date) => d.toISOString().slice(0, 10);
const debutDuJour = (d: Date) => new Date(`${jour(d)}T00:00:00.000Z`).getTime();

/** Une recherche n'est pas le journal · elle ne se marque jamais imprimée. */
export function estUneRecherche(criteres: CriteresRecherche): boolean {
  return (
    !!criteres.recherche?.trim() ||
    !!criteres.compte?.trim() ||
    criteres.montantMin !== undefined ||
    criteres.montantMax !== undefined ||
    criteres.numeroPiece !== undefined ||
    !!criteres.reference?.trim()
  );
}

export const MOTIF_RECHERCHE_NON_IMPRIMABLE =
  "Une recherche (compte, montant, libellé, pièce ou référence) n'est pas le journal · retirez les critères pour imprimer le journal de la période.";

/**
 * Le jour est-il couvert · une impression du même journal (ou de tous les
 * journaux), dont la période contient le jour, faite APRÈS sa dernière
 * validation. Un jour sans écriture validée n'a rien à couvrir.
 */
export function jourCouvert(j: JourValide, impressions: readonly ImpressionLue[]): boolean {
  if (!j.derniereValidation) return true;
  const t = debutDuJour(j.date);
  return impressions.some(
    (i) =>
      (i.journalId === null || i.journalId === j.journalId) &&
      debutDuJour(i.dateDebut) <= t &&
      t <= debutDuJour(i.dateFin) &&
      i.imprimeAt.getTime() >= j.derniereValidation!.getTime(),
  );
}

/** Les jours d'écritures validées qu'aucune impression ne couvre. */
export function joursNonImprimes(jours: readonly JourValide[], impressions: readonly ImpressionLue[]): JourValide[] {
  return jours.filter((j) => !jourCouvert(j, impressions));
}

type Lecteur = {
  ecriture: {
    groupBy: (a: unknown) => Promise<Array<{ journalId: string; date: Date; _max: { valideeAt: Date | null } }>>;
  };
  impressionJournal: { findMany: (a: unknown) => Promise<ImpressionLue[]> };
  journal: { findMany: (a: unknown) => Promise<Array<{ id: string; code: string }>> };
};

/** Au-delà, la liste nommée s'arrête et dit son total (§ 8 bis). */
export const PLAFOND_MOIS_NOMMES = 24;

export interface MoisNonImprime {
  journal: string;
  mois: string;
}

/**
 * LES MOIS NON IMPRIMÉS d'un exercice, jusqu'à une date, d'un journal ou de
 * tous · lus par regroupement en base (une ligne par journal et par jour),
 * jamais en rapatriant les écritures. Le livre-journal seul · une écriture
 * validée, hors à-nouveau provisoire (jamais validé) et hors journal de
 * situation.
 */
export async function moisNonImprimes(
  prisma: Lecteur,
  p: { tenantId: string; exerciceId: string; journalId: string | null; jusquau: Date },
): Promise<{ mois: MoisNonImprime[]; total: number }> {
  const [jours, impressions] = await Promise.all([
    prisma.ecriture.groupBy({
      by: ['journalId', 'date'],
      where: {
        tenantId: p.tenantId,
        exerciceId: p.exerciceId,
        statut: StatutEcriture.VALIDEE,
        date: { lte: p.jusquau },
        journal: { type: { not: TypeJournal.SITUATION } },
        ...(p.journalId ? { journalId: p.journalId } : {}),
      } satisfies Prisma.EcritureWhereInput,
      _max: { valideeAt: true },
    }),
    prisma.impressionJournal.findMany({
      where: { tenantId: p.tenantId, exerciceId: p.exerciceId },
      select: { journalId: true, dateDebut: true, dateFin: true, imprimeAt: true },
    }),
  ]);
  // Une écriture validée sans date de validation (donnée ancienne) se lit
  // validée au plus tard aujourd'hui · seule une impression postérieure à sa
  // date la couvre, jamais une antérieure.
  const manquants = joursNonImprimes(
    jours.map((g) => ({ journalId: g.journalId, date: g.date, derniereValidation: g._max.valideeAt ?? g.date })),
    impressions,
  );
  if (manquants.length === 0) return { mois: [], total: 0 };
  const journaux = await prisma.journal.findMany({
    where: { tenantId: p.tenantId, id: { in: [...new Set(manquants.map((m) => m.journalId))] } },
    select: { id: true, code: true },
  });
  const code = new Map(journaux.map((j) => [j.id, j.code]));
  const cles = new Map<string, MoisNonImprime>();
  for (const m of manquants) {
    const mois = jour(m.date).slice(0, 7);
    const journal = code.get(m.journalId) ?? '·';
    cles.set(`${journal}|${mois}`, { journal, mois });
  }
  const tous = [...cles.values()].sort((a, b) => a.mois.localeCompare(b.mois) || a.journal.localeCompare(b.journal));
  return { mois: tous.slice(0, PLAFOND_MOIS_NOMMES), total: tous.length };
}

/** Le refus de la clôture, quand l'option du dossier le demande. */
export function motifClotureNonImprimee(r: { mois: MoisNonImprime[]; total: number }): string {
  const nommes = r.mois.map((m) => `${m.journal} ${m.mois.split('-').reverse().join('/')}`).join(', ');
  const reste = r.total > r.mois.length ? ` et ${r.total - r.mois.length} autre(s)` : '';
  return (
    `Le dossier refuse de clôturer un journal non imprimé (Paramètres du dossier) · des écritures validées ne figurent ` +
    `sur aucune impression faite après leur validation : ${nommes}${reste}. Imprimez ou exportez le journal de la ` +
    "période (État > Livres comptables > Journal), puis relancez la clôture. Les données doivent pouvoir être " +
    'restituées sur papier (AUDCIF art. 22, 1°).'
  );
}

/** La période qu'une impression couvre · celle demandée, bornée à l'exercice. */
export function periodeCouverte(
  exercice: { dateDebut: Date; dateFin: Date },
  p: PerimetreImpression,
): { dateDebut: Date; dateFin: Date } {
  const debut = p.dateDebut ? new Date(p.dateDebut) : exercice.dateDebut;
  const fin = p.dateFin ? new Date(p.dateFin) : exercice.dateFin;
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
    throw new BadRequestException('La période imprimée est illisible.');
  }
  if (debut.getTime() > fin.getTime()) throw new BadRequestException('La période imprimée finit avant de commencer.');
  // Hors de l'exercice, le journal imprimé ne couvre que sa part dans l'exercice.
  return {
    dateDebut: debut.getTime() < exercice.dateDebut.getTime() ? exercice.dateDebut : debut,
    dateFin: fin.getTime() > exercice.dateFin.getTime() ? exercice.dateFin : fin,
  };
}

/**
 * ENREGISTRE UNE IMPRESSION · le numéro suit le dernier du dossier, sous un
 * verrou par dossier dans la transaction (deux impressions simultanées ne
 * prennent jamais le même numéro, art. 22, 7°).
 */
export async function enregistrerImpression(
  prisma: ClientTransactionnel,
  p: {
    tenantId: string;
    exerciceId: string;
    journalId: string | null;
    dateDebut: Date;
    dateFin: Date;
    forme: FormeImpressionJournal;
    nombreEcritures: number;
    imprimePar: string;
  },
) {
  return transactionJournalisee(prisma, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`impressions-journal:${p.tenantId}`}))`;
    const max = await tx.impressionJournal.aggregate({ where: { tenantId: p.tenantId }, _max: { numero: true } });
    return tx.impressionJournal.create({
      data: {
        tenantId: p.tenantId,
        numero: (max._max.numero ?? 0) + 1,
        exerciceId: p.exerciceId,
        journalId: p.journalId,
        dateDebut: p.dateDebut,
        dateFin: p.dateFin,
        forme: p.forme,
        nombreEcritures: p.nombreEcritures,
        imprimePar: p.imprimePar,
      },
    });
  });
}

/** Les impressions relues d'un exercice qu'on retire, par tranche · une par mise à jour unitaire. */
const LOT_IMPRESSIONS_RATTACHEES = 500;

/**
 * UNE IMPRESSION SUIT L'EXERCICE QUI REPREND SA PÉRIODE (relecture de la
 * ligne sage-l1, M6). Un exercice ne disparaît que par l'arrêt à la
 * dissolution (l'exercice postérieur vide d'une société sans liquidation) et
 * par l'annulation de l'arrêt (l'exercice de liquidation rendu) · la clé de
 * l'impression vers son exercice (RESTRICT) refusait la suppression, et
 * l'impression, comptée parmi les usages, ENFERMAIT l'arrêt et son annulation
 * sans issue, aucune route ne retirant une impression.
 *
 * L'impression ne se SUPPRIME JAMAIS · elle atteste un état numéroté et daté
 * (AUDCIF art. 22, 7°), et la retirer rendrait son numéro au suivant (la
 * suite est lue sur le plus grand numéro du dossier), deux documents remis
 * portant alors le même. Elle se RATTACHE à l'exercice qui reprend sa période,
 * période, journal, numéro et date intacts, par une mise à jour UNITAIRE
 * (journal d'audit · un `updateMany` n'y laisserait que filtre et compte).
 */
export async function rattacherLesImpressions(
  tx: Prisma.TransactionClient,
  tenantId: string,
  depuis: string,
  vers: string,
): Promise<number> {
  let rattachees = 0;
  let curseur: string | undefined;
  for (;;) {
    const lot = await tx.impressionJournal.findMany({
      where: { tenantId, exerciceId: depuis },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: LOT_IMPRESSIONS_RATTACHEES,
      ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
    });
    for (const i of lot) {
      await tx.impressionJournal.update({ where: { id: i.id }, data: { exerciceId: vers } });
      rattachees++;
    }
    if (lot.length < LOT_IMPRESSIONS_RATTACHEES) return rattachees;
    curseur = lot[lot.length - 1].id;
  }
}
