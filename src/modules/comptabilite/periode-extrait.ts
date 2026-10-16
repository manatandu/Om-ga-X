import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { jourUtc } from '../../common/echeance';
import { lirePeriodeDeListe } from '../../common/periode-de-liste';

/**
 * LA BALANCE ET LE GRAND LIVRE SUR UNE PÉRIODE (ligne export-periode, gel levé
 * par Manasse le 2026-10-16, « l'autorisation « Lève le gel pour l'export par
 * période » » · CLAUDE.md § 5, `docs/plan-version-1.md` § 10).
 *
 * QUATRE CONDITIONS, posées avant le code et acceptées avec lui :
 *  1. LE SOLDE DE DÉPART NE SE PERD JAMAIS · une balance « du 1er avril au
 *     30 juin » garde, dans la colonne « Mouvements au 31 mars », tout ce qui
 *     précède ; le grand livre ouvre chaque compte sur son report à la veille.
 *     AUDCIF art. 19 · la balance fait apparaître « le solde à l'ouverture, le
 *     cumul des mouvements débiteurs et créditeurs depuis l'ouverture, le
 *     solde à la date considérée ».
 *  2. LE TITRE DIT L'EXTRAIT · le grand-livre obligatoire est celui « où sont
 *     reportés compte par compte les différents mouvements de l'exercice »
 *     (même article) ; un extrait remis comme « le grand livre » serait un
 *     livre amputé (CLAUDE.md § 8 bis).
 *  3. NUMÉROTÉ ET DATÉ · « les états périodiques fournis soient numérotés et
 *     datés » (AUDCIF art. 22, 7°) · `ExtraitPeriode`, `extraits-periode.ts`.
 *  4. LA PÉRIODE TIENT DANS UN EXERCICE · à cheval sur deux, l'à-nouveau du
 *     second porterait une seconde fois ce que le premier a déjà mouvementé.
 *
 * Les deux articles valent aux deux référentiels · l'art. 3 du SYCEBNL
 * n'écarte de l'art. 19 que son quatrième tiret (livre d'inventaire), et
 * n'écarte pas l'art. 22.
 *
 * UNE PÉRIODE QUI COUVRE L'EXERCICE ENTIER N'EST PAS UN EXTRAIT · elle rend
 * `null`, et la balance et le livre de l'exercice, inchangés et sans numéro.
 */
export interface PeriodeExtrait {
  /** Premier jour compris, à minuit UTC. */
  du: Date;
  /** Dernier jour compris, à minuit UTC. */
  au: Date;
  /** Le lendemain de `au` · borne EXCLUE des lectures (un jour se compte entier). */
  finExclue: Date;
  /** Le dernier jour de l'exercice · celui du virement du résultat non affecté (`ecrituresAvantLaPeriode`). */
  finExercice: Date;
}

/**
 * LE REPORT D'UN COMPTE À LA VEILLE DE LA PÉRIODE · ses sommes BRUTES, débit
 * et crédit, comme la colonne « Mouvements au <veille> » de la présentation du
 * cabinet · un solde net tairait les montants que le report porte.
 */
export interface ReportALaVeille {
  au: Date;
  debit: number;
  credit: number;
}

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/** Un jour lu à la française, pour les messages et les titres. */
export function jourFr(d: Date): string {
  return d.toISOString().slice(0, 10).split('-').reverse().join('/');
}

/** La veille du premier jour · le jour où s'arrête le report de la période. */
export function veilleDe(d: Date): Date {
  return new Date(jourUtc(d).getTime() - UN_JOUR_MS);
}

/** « du 01/04/2026 au 30/06/2026 » · la période en clair. */
export function libellePeriode(p: Pick<PeriodeExtrait, 'du' | 'au'>): string {
  return `du ${jourFr(p.du)} au ${jourFr(p.au)}`;
}

export function motifPeriodeHorsExercice(exercice: { dateDebut: Date; dateFin: Date }): string {
  return (
    `La période doit tenir dans l'exercice, ${libellePeriode({ du: exercice.dateDebut, au: exercice.dateFin })} · ` +
    "à cheval sur deux exercices, l'à-nouveau du second porterait une seconde fois ce que le premier a déjà " +
    "mouvementé. Choisissez l'exercice de la période, puis ses dates."
  );
}

/**
 * LA PÉRIODE DEMANDÉE, OU L'EXERCICE ENTIER · `du` et `au` facultatifs, au
 * format AAAA-MM-JJ, chacun complété par la borne de l'exercice quand il
 * manque. Une date illisible est REFUSÉE (`lirePeriodeDeListe`) · ignorée,
 * elle rendrait le livre de l'exercice sous le nom d'un extrait. Hors de
 * l'exercice, refus nommé (condition 4).
 */
export function periodeDeLExtrait(
  exercice: { dateDebut: Date; dateFin: Date },
  demande: { du?: string | null; au?: string | null },
): PeriodeExtrait | null {
  const lue = lirePeriodeDeListe({ du: demande.du, au: demande.au });
  if (lue.du === null && lue.au === null) return null;
  const debut = jourUtc(exercice.dateDebut);
  const fin = jourUtc(exercice.dateFin);
  const du = lue.du !== null ? new Date(`${lue.du}T00:00:00.000Z`) : debut;
  const au = lue.au !== null ? new Date(`${lue.au}T00:00:00.000Z`) : fin;
  // `du` seul après la fin de l'exercice, ou `au` seul avant son début, sont
  // HORS de l'exercice (relecture du 2026-10-16) · complétés par sa borne, ils
  // finiraient avant de commencer, et le refus parlerait de dates à l'envers.
  if (du.getTime() < debut.getTime() || au.getTime() > fin.getTime() || du.getTime() > fin.getTime() || au.getTime() < debut.getTime()) {
    throw new BadRequestException(motifPeriodeHorsExercice(exercice));
  }
  if (du.getTime() > au.getTime()) {
    throw new BadRequestException('La date de début de la période dépasse sa date de fin.');
  }
  if (du.getTime() === debut.getTime() && au.getTime() === fin.getTime()) return null;
  return { du, au, finExclue: new Date(au.getTime() + UN_JOUR_MS), finExercice: fin };
}

/**
 * AVANT LA PÉRIODE, OU DEDANS · UNE règle pour la balance, le grand livre de
 * l'écran et les classeurs (relecture du 2026-10-16). La colonne « Mouvements
 * au <veille> » et la ligne « Report au <veille> » sont DATÉES · elles portent
 * ce qui est daté avant le premier jour, et l'à-nouveau DU premier jour même
 * (report de clôture au premier jour de l'exercice, bilan d'ouverture importé
 * au jour où la tenue reprend), qui EST la position de la veille au soir.
 * Une écriture de clôture datée PLUS LOIN (bilan d'ouverture importé en cours
 * de période, virement du résultat non affecté au dernier jour) est un
 * mouvement de la période · la balance la rangeait au report, quand le grand
 * livre du même classeur la montrait en ligne, et le solde de départ affiché
 * était faux à sa date sans qu'aucun total ne le dise. Le virement du
 * résultat, daté du dernier jour de l'exercice, n'est jamais une ouverture,
 * même sur une période d'un seul jour.
 */
export function ecrituresAvantLaPeriode(p: Pick<PeriodeExtrait, 'du' | 'finExercice'>): Prisma.EcritureWhereInput {
  const ouverture = ouvertureDuPremierJour(p);
  return ouverture ? { OR: [{ date: { lt: p.du } }, ouverture] } : { date: { lt: p.du } };
}

/** Le complément exact de `ecrituresAvantLaPeriode`, jusqu'au dernier jour compris. */
export function ecrituresDansLaPeriode(p: PeriodeExtrait): Prisma.EcritureWhereInput {
  const dates: Prisma.EcritureWhereInput = { date: { gte: p.du, lt: p.finExclue } };
  if (!ouvertureDuPremierJour(p)) return dates;
  const lendemain = new Date(p.du.getTime() + UN_JOUR_MS);
  return { AND: [dates, { OR: [{ date: { gte: lendemain } }, { estGenereeParCloture: false }, { estSoldeDesComptesDeGestion: true }] }] };
}

function ouvertureDuPremierJour(p: Pick<PeriodeExtrait, 'du' | 'finExercice'>): Prisma.EcritureWhereInput | null {
  if (p.du.getTime() >= jourUtc(p.finExercice).getTime()) return null;
  const lendemain = new Date(p.du.getTime() + UN_JOUR_MS);
  return { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false, date: { gte: p.du, lt: lendemain } };
}

/** La période telle qu'un écran la reçoit · ses jours, ou `null` pour l'exercice entier. */
export function periodeServie(p: PeriodeExtrait | null): { du: string; au: string } | null {
  return p ? { du: p.du.toISOString().slice(0, 10), au: p.au.toISOString().slice(0, 10) } : null;
}
