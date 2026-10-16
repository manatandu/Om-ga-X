/**
 * LA BALANCE ET LE GRAND LIVRE SUR UNE PÉRIODE (ligne export-periode, gel levé
 * par Manasse le 2026-10-16). Le serveur juge la période (`periodeDeLExtrait` ·
 * bornée à l'exercice, refus nommé sinon) ; l'écran ne fait que la porter et
 * dire ce qu'il montre.
 *
 * MÊME RÈGLE QUE LE SERVEUR, et elle seule · une date vide prend la borne de
 * l'exercice, et une période qui couvre l'exercice entier n'est PAS un
 * extrait · ni titre d'extrait, ni numéro, la balance et le livre de
 * l'exercice tels quels.
 */
export interface PeriodeSaisie {
  /** Jour AAAA-MM-JJ, ou vide pour le premier jour de l'exercice. */
  du: string;
  /** Jour AAAA-MM-JJ, ou vide pour le dernier jour de l'exercice. */
  au: string;
}

export const PERIODE_EXERCICE: PeriodeSaisie = { du: '', au: '' };

const jourIso = (d: string) => d.slice(0, 10);

/** Les bornes effectives · la saisie, complétée par l'exercice. */
export function bornesDeLaPeriode(exercice: { dateDebut: string; dateFin: string }, p: PeriodeSaisie): { du: string; au: string } {
  return { du: p.du || jourIso(exercice.dateDebut), au: p.au || jourIso(exercice.dateFin) };
}

/** Un extrait · une borne posée, et la période n'est pas l'exercice entier. */
export function estUnExtrait(exercice: { dateDebut: string; dateFin: string }, p: PeriodeSaisie): boolean {
  if (!p.du && !p.au) return false;
  const b = bornesDeLaPeriode(exercice, p);
  return b.du !== jourIso(exercice.dateDebut) || b.au !== jourIso(exercice.dateFin);
}

/** Le complément d'adresse · seulement les bornes posées, jamais une borne vide. */
export function requetePeriode(p: PeriodeSaisie): string {
  return `${p.du ? `&du=${encodeURIComponent(p.du)}` : ''}${p.au ? `&au=${encodeURIComponent(p.au)}` : ''}`;
}

/** Un jour AAAA-MM-JJ lu à la française. */
export function jourFr(iso: string): string {
  return jourIso(iso).split('-').reverse().join('/');
}

/** La veille d'un jour AAAA-MM-JJ, en AAAA-MM-JJ · le jour où s'arrête le report. */
export function veille(iso: string): string {
  const d = new Date(`${jourIso(iso)}T00:00:00.000Z`);
  return new Date(d.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** « Extrait du 01/04/2026 au 30/06/2026 » · le titre que l'écran et l'impression portent (condition 2). */
export function titreExtrait(exercice: { dateDebut: string; dateFin: string }, p: PeriodeSaisie): string {
  const b = bornesDeLaPeriode(exercice, p);
  return `Extrait du ${jourFr(b.du)} au ${jourFr(b.au)}`;
}

/** Une date de saisie hors de l'exercice · dite à l'écran avant l'envoi, le serveur la refuse aussi. */
export function motifPeriodeSaisie(exercice: { dateDebut: string; dateFin: string }, p: PeriodeSaisie): string | null {
  const b = bornesDeLaPeriode(exercice, p);
  if (b.du < jourIso(exercice.dateDebut) || b.au > jourIso(exercice.dateFin)) {
    return `La période doit tenir dans l'exercice, du ${jourFr(exercice.dateDebut)} au ${jourFr(exercice.dateFin)}.`;
  }
  if (b.du > b.au) return 'La date de début de la période dépasse sa date de fin.';
  return null;
}

/**
 * LA PÉRIODE APPLIQUÉE EST RANGÉE AVEC SON EXERCICE (relecture « écran »,
 * mineur 1) · remise à vide par un effet au changement d'exercice, elle
 * survivait un rendu, et la balance du nouvel exercice partait avec les dates
 * de l'ancien. Lue pour un autre exercice, c'est l'exercice entier.
 */
export interface PeriodeDeLExercice extends PeriodeSaisie {
  exerciceId: string | null;
}

export function periodePourLExercice(p: PeriodeDeLExercice, exerciceId: string | undefined): PeriodeSaisie {
  return p.exerciceId !== null && p.exerciceId === exerciceId ? { du: p.du, au: p.au } : PERIODE_EXERCICE;
}

/**
 * CE QU'UNE LECTURE A DEMANDÉ · l'exercice, la période appliquée et ses
 * réglages. Une balance ou un grand livre ne se montre, et un extrait ne
 * s'imprime, que lu pour la clé COURANTE (relectures du 2026-10-16, BLOQUANT
 * 1 et MAJEUR 2) · gardé d'une période à l'autre, pendant le chargement ou
 * après un échec, il montrait les chiffres de l'exercice sous le titre « Solde
 * au 31/03 », et l'impression numérotait la nouvelle période sur l'ancienne.
 */
export function cleDeLecture(exerciceId: string, p: PeriodeSaisie, ...reglages: (string | boolean)[]): string {
  return [exerciceId, p.du, p.au, ...reglages.map(String)].join('|');
}

export interface Lu<T> {
  cle: string;
  donnees: T;
}

/** La donnée lue pour la clé courante, sinon rien · jamais celle d'une autre période. */
export function lueePour<T>(lu: Lu<T> | null, cle: string): T | null {
  return lu !== null && lu.cle === cle ? lu.donnees : null;
}

/**
 * UNE SECTION DU GRAND LIVRE SE MONTRE si elle porte une ligne OU un report
 * (relectures du 2026-10-16, BLOQUANT 2) · un compte qui n'a que son solde à
 * la veille est un solde de départ (condition 1) ; masqué, l'écran disait
 * « aucun report », et l'extrait imprimé l'attestait sous un numéro.
 */
export function sectionVisible(s: { lignes: readonly unknown[]; report?: unknown }): boolean {
  return s.lignes.length > 0 || (s.report !== undefined && s.report !== null);
}

/**
 * L'EXTRAIT NE S'IMPRIME QUE SUR CE QUI EST MONTRÉ, LU POUR SA PÉRIODE ·
 * jamais pendant un chargement, après un échec, ni sur des chiffres restés
 * d'une autre période. Le grand livre refusé par son volume s'imprime par le
 * compte qu'il montre.
 */
export function extraitImprimable(e: {
  extrait: boolean;
  onglet: string;
  balanceLue: boolean;
  grandLivreLu: boolean;
  refusGrandLivre: boolean;
  sectionSeuleLue: boolean;
}): boolean {
  if (!e.extrait) return false;
  if (e.onglet === 'balance') return e.balanceLue;
  if (e.onglet === 'grand-livre') return e.refusGrandLivre ? e.sectionSeuleLue : e.grandLivreLu;
  return false;
}
