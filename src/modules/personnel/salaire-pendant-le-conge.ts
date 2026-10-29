import { StatutBulletinPaie, type Prisma } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import {
  absencesPourLeCompteur,
  avertissementGardeMuette,
  congesDuMois,
  joursOuvrablesDuMois,
  motifRefusAnnulationDuCongeRetranche,
  motifRefusSalairePleinPendantLeConge,
  raisonDeLaGardeMuette,
  type AbsenceLue,
  type CongeConfronte,
  type JourIso,
} from './absences';
import { absencesDuSalarie, congesPayesDuMois } from './absences-lecture';

/**
 * B1 DE LA RELECTURE, SECOND TOUR · LE SALAIRE ET L'ALLOCATION DE CONGÉ POUR
 * LES MÊMES JOURS, DANS LES DEUX ORDRES DE SAISIE.
 *
 * Le premier tour refusait le salaire plein à l'ÉMISSION d'un bulletin dont le
 * mois porte un congé. Un congé posé APRÈS l'émission échappait à tout
 * contrôle · bulletin de septembre émis à 1 040 000, puis congé du 10 au 25
 * septembre posé en octobre avec son allocation au bulletin d'octobre · douze
 * jours payés deux fois, en silence. Et dans l'autre sens, un congé annulé
 * après qu'un bulletin a retranché ses jours laissait ce mois amputé, en
 * silence aussi. « Pendant toute la durée du congé, le travailleur a droit à
 * une allocation égale à la rémunération » (Code du travail, art. 142) · un
 * même jour ne se paie qu'une fois (arrêté du 8 août 2008, mentions 6, 14 et
 * 28, colonnes disjointes du livre de paie).
 *
 * Une règle, trois portes · l'émission du bulletin (`confronterSalaireAuxConges`),
 * la pose du congé et le report de son allocation sur un bulletin
 * (`confronterLesBulletinsEmis`), et l'annulation du congé
 * (`bulletinsQuiRetranchentLeConge`). Le calcul est celui de `absences.ts`,
 * écrit une fois.
 */

type Db = PrismaService | Prisma.TransactionClient;

export type ContratDuSalaire = {
  readonly remunerationBase: Prisma.Decimal | number | null;
  readonly periodiciteRemuneration: string | null;
  readonly deviseRemuneration: string | null;
};

/** Un congé confronté · déjà enregistré (`id`) ou sur le point de l'être. */
export type CongeAConfronter = {
  readonly id?: string;
  readonly du: JourIso;
  readonly au: JourIso;
  readonly joursVoyage: number;
  readonly remunerationJournaliere: number | null;
  readonly deviseAllocation: string | null;
};

export type Confrontation = { readonly refus: string | null; readonly avertissement: string | null };

/**
 * LE SALAIRE D'UNE SAISIE OU D'UNE ENTRÉE FIGÉE · les éléments « Salaire ou
 * traitement », dans la monnaie de la saisie (franc à défaut, comme la
 * simulation). `null` quand l'entrée ne se lit pas · jamais un zéro.
 */
export function salaireDeLaSaisie(entree: unknown): { salaire: number; devise: 'CDF' | 'USD' } | null {
  if (!entree || typeof entree !== 'object') return null;
  const e = entree as { deviseStipulation?: unknown; elements?: unknown };
  const devise = e.deviseStipulation === 'USD' ? 'USD' : e.deviseStipulation === undefined || e.deviseStipulation === null || e.deviseStipulation === 'CDF' ? 'CDF' : null;
  if (!devise || !Array.isArray(e.elements)) return null;
  let salaire = 0;
  for (const x of e.elements as unknown[]) {
    if (!x || typeof x !== 'object') return null;
    const el = x as { nature?: unknown; montantFc?: unknown; montantUsd?: unknown; rappelId?: unknown };
    // Un rappel de salaire paie des mois passés · il n'est pas le salaire du mois (ligne paie-suite, fonction 87).
    if (el.nature !== 'SALAIRE_OU_TRAITEMENT' || el.rappelId) continue;
    const brut = devise === 'USD' ? el.montantUsd : el.montantFc;
    const n = brut === undefined || brut === null ? 0 : Number(brut);
    if (!Number.isFinite(n)) return null;
    salaire += n;
  }
  return { salaire, devise };
}

/** Les mois `AAAA-MM` qu'un congé touche, du départ au dernier jour. */
export function moisTouches(du: JourIso, au: JourIso): string[] {
  const [a1, m1] = du.slice(0, 7).split('-').map(Number);
  const [a2, m2] = au.slice(0, 7).split('-').map(Number);
  const sortie: string[] = [];
  // Un congé ne dure pas des années · la borne protège d'une date illisible.
  for (let a = a1, m = m1, n = 0; (a < a2 || (a === a2 && m <= m2)) && n < 36; n += 1) {
    sortie.push(`${a}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return sortie;
}

/** Jours ouvrables du mois couverts par une absence, demi-journées pesées · ce que la proposition compte. */
const joursAbsenceDuMois = (absences: readonly AbsenceLue[], mois: string) =>
  joursOuvrablesDuMois(absences, mois).reduce((n, j) => n + j.poids, 0);

/**
 * LE SALAIRE D'UN MOIS CONFRONTÉ AUX CONGÉS PAYÉS DE CE MOIS · ceux qui sont
 * enregistrés, plus le congé sur le point de l'être (`candidat`). Refus nommé
 * quand le salaire paie des jours que l'allocation paie ; avertissement quand
 * rien ne se compare (salaire non mensuel, monnaie absente ou autre · second
 * tour, point 2), jamais un silence.
 */
export async function confronterSalaireAuxConges(
  db: Db,
  tenantId: string,
  salarieId: string,
  p: {
    readonly mois: string;
    readonly salaire: number;
    readonly devise: string;
    readonly contrat: ContratDuSalaire | null;
    readonly candidat?: CongeAConfronter;
    readonly bulletinEmis?: { readonly numero: number; readonly issue: string };
    readonly absences?: readonly AbsenceLue[];
  },
): Promise<Confrontation> {
  const candidat = p.candidat;
  // Les congés du mois d'abord · un mois sans congé n'a rien à confronter, et
  // ses absences ne se lisent pas pour rien.
  const lus: CongeConfronte[] = await congesPayesDuMois(db, tenantId, salarieId, p.mois, p.absences);
  if (lus.length === 0 && !candidat) return { refus: null, avertissement: null };
  const absences = p.absences ?? (await absencesDuSalarie(db, tenantId, salarieId));
  const conges = [...lus];
  if (candidat && !lus.some((c) => c.id === candidat.id)) {
    const { joursMaladie } = absencesPourLeCompteur(absences, null);
    const [c] = congesDuMois(
      [{ id: candidat.id ?? 'conge-a-poser', du: candidat.du, au: candidat.au, joursVoyage: candidat.joursVoyage }],
      p.mois,
      joursMaladie,
    );
    if (c) conges.push({ ...c, remunerationJournaliere: candidat.remunerationJournaliere, deviseAllocation: candidat.deviseAllocation });
  }
  const payes = conges.filter((c) => c.auMoins > 0);
  if (payes.length === 0) return { refus: null, avertissement: null };
  const raison = raisonDeLaGardeMuette(p.contrat, p.devise);
  if (raison) {
    return { refus: null, avertissement: avertissementGardeMuette({ mois: p.mois, conges: payes, raison, numero: p.bulletinEmis?.numero }) };
  }
  return {
    refus: motifRefusSalairePleinPendantLeConge({
      mois: p.mois,
      conges,
      salaireDuBulletin: p.salaire,
      salaireMensuel: Number(p.contrat!.remunerationBase),
      devise: p.devise,
      joursAbsenceDuMois: joursAbsenceDuMois(absences, p.mois),
      bulletinEmis: p.bulletinEmis,
    }),
    avertissement: null,
  };
}

/** Les bulletins ÉMIS d'un salarié pour des mois donnés · un seul actif par mois, du mois ou décompte final. */
async function bulletinsEmisDesMois(db: Db, tenantId: string, salarieId: string, mois: readonly string[]) {
  return db.bulletinPaie.findMany({
    where: { tenantId, salarieId, statut: StatutBulletinPaie.EMIS, moisDePaie: { in: [...mois] } },
    orderBy: { moisDePaie: 'asc' },
    // Un seul bulletin actif par salarié et par mois (émission sous verrou) ·
    // la borne est le nombre de mois.
    take: mois.length,
    select: {
      numero: true,
      moisDePaie: true,
      entree: true,
      contrat: { select: { remunerationBase: true, periodiciteRemuneration: true, deviseRemuneration: true } },
    },
  });
}

const illisible = (numero: number, mois: string) =>
  `Le bulletin n° ${numero} de ${mois} ne se relit pas (saisie figée illisible) · il n'est pas confronté à ce congé. Vérifiez que son salaire ne paie pas les jours du congé (Code du travail, art. 142).`;

/**
 * B1, SECOND TOUR · LES BULLETINS DÉJÀ ÉMIS DES MOIS QU'UN CONGÉ TOUCHE,
 * confrontés à lui · à la pose du congé, et quand un bulletin en porte
 * l'allocation (le mois de ce bulletin exclu, `saufMois` · l'émission le juge
 * elle-même). Chaque bulletin relu sur sa saisie FIGÉE et son contrat, jamais
 * recalculé ; le refus nomme le bulletin et l'issue du geste (`issue`).
 */
export async function confronterLesBulletinsEmis(
  db: Db,
  tenantId: string,
  salarieId: string,
  conge: CongeAConfronter,
  p: { readonly saufMois?: string; readonly issue: (numero: number, mois: string) => string },
): Promise<{ refus: string[]; avertissements: string[] }> {
  const refus: string[] = [];
  const avertissements: string[] = [];
  const mois = moisTouches(conge.du, conge.au).filter((m) => m !== p.saufMois);
  if (mois.length === 0) return { refus, avertissements };
  const bulletins = await bulletinsEmisDesMois(db, tenantId, salarieId, mois);
  if (bulletins.length === 0) return { refus, avertissements };
  const absences = await absencesDuSalarie(db, tenantId, salarieId);
  for (const b of bulletins) {
    const s = salaireDeLaSaisie(b.entree);
    if (!s) {
      avertissements.push(illisible(b.numero, b.moisDePaie));
      continue;
    }
    const r = await confronterSalaireAuxConges(db, tenantId, salarieId, {
      mois: b.moisDePaie,
      salaire: s.salaire,
      devise: s.devise,
      contrat: b.contrat,
      candidat: conge,
      bulletinEmis: { numero: b.numero, issue: p.issue(b.numero, b.moisDePaie) },
      absences,
    });
    if (r.refus) refus.push(r.refus);
    if (r.avertissement) avertissements.push(r.avertissement);
  }
  return { refus, avertissements };
}

/**
 * B1, SECOND TOUR · LES BULLETINS ÉMIS QUI ONT RETRANCHÉ LES JOURS D'UN CONGÉ,
 * à son annulation · le congé ne s'annule pas tant qu'ils tiennent (refus
 * nommé, `motifRefusAnnulationDuCongeRetranche`). Un bulletin que rien ne
 * confronte (salaire non mensuel, monnaie absente ou autre) est DIT, sans
 * refus · rien de certain ne s'y lit.
 */
export async function bulletinsQuiRetranchentLeConge(
  db: Db,
  tenantId: string,
  salarieId: string,
  conge: { readonly id: string; readonly du: JourIso; readonly au: JourIso; readonly joursVoyage: number },
): Promise<{ refus: string[]; avertissements: string[] }> {
  const refus: string[] = [];
  const avertissements: string[] = [];
  const mois = moisTouches(conge.du, conge.au);
  const bulletins = await bulletinsEmisDesMois(db, tenantId, salarieId, mois);
  if (bulletins.length === 0) return { refus, avertissements };
  const absences = await absencesDuSalarie(db, tenantId, salarieId);
  const { joursMaladie } = absencesPourLeCompteur(absences, null);
  for (const b of bulletins) {
    const [c] = congesDuMois([{ id: conge.id, du: conge.du, au: conge.au, joursVoyage: conge.joursVoyage }], b.moisDePaie, joursMaladie);
    if (!c || c.auMoins <= 0) continue;
    const s = salaireDeLaSaisie(b.entree);
    if (!s) {
      avertissements.push(illisible(b.numero, b.moisDePaie));
      continue;
    }
    const raison = raisonDeLaGardeMuette(b.contrat, s.devise);
    if (raison) {
      avertissements.push(
        `Le bulletin n° ${b.numero} de ${b.moisDePaie} n'est pas confronté à ce congé · ${raison}. S'il ne paie pas les jours du congé, annulez-le et réémettez-le avec le salaire de ces jours.`,
      );
      continue;
    }
    const motif = motifRefusAnnulationDuCongeRetranche({
      mois: b.moisDePaie,
      numero: b.numero,
      conge: c,
      salaireDuBulletin: s.salaire,
      salaireMensuel: Number(b.contrat.remunerationBase),
      devise: s.devise,
      joursAbsenceDuMois: joursAbsenceDuMois(absences, b.moisDePaie),
    });
    if (motif) refus.push(motif);
  }
  return { refus, avertissements };
}
