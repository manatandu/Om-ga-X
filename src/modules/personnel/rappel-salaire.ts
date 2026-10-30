/**
 * LIGNE PAIE-SUITE, FONCTION 87 · LE RAPPEL DE SALAIRES · règles pures, sans
 * Prisma.
 *
 * LE CAS · une hausse de la rémunération de base qui prend effet à une date
 * passée (avenant, décision de l'employeur, convention) · les bulletins des
 * mois écoulés sont émis, INDÉLÉBILES (arrêté du 8 août 2008, art. 4), et les
 * arriérés restent dus.
 *
 * DÉCISION PAR LA LOI (2026-10-29) · LES ARRIÉRÉS SE PAIENT SUR LE BULLETIN
 * DU MOIS OÙ ILS SONT VERSÉS, jamais sur un second bulletin des mois passés.
 *  - Le Code du travail, art. 213 · le livre de paie consigne « À CHAQUE PAIE,
 *    toute somme quelconque attribuée à titre de rémunération ».
 *  - Le modèle du livre (arrêté du 8 août 2008, mention 13) et le bulletin de
 *    l'arrêté n° 142/2018 (art. 12) portent « les ARRIÉRÉS DE RÉMUNÉRATION,
 *    portés sous la rubrique « divers » et accompagnés, le cas échéant, d'une
 *    note sous la rubrique « observation » » · une rubrique DU bulletin de la
 *    paie, pas un bulletin à part.
 *  - Un second bulletin d'un mois déjà payé serait calculé seul, sur un mois
 *    que l'impôt annualise (loi n° 23/053, art. 119, `LIMITE_UN_BULLETIN_PAR_MOIS`)
 *    · ses tranches s'appliqueraient deux fois, et l'impôt serait minoré.
 * Le « bulletin complémentaire » de Sage devient donc UN RAPPEL CALCULÉ, mois
 * par mois, que le bulletin du mois de paiement PORTE (comme une mission ou
 * une allocation de congé) · le serveur rejoue les montants, le client ne
 * nomme que le rappel.
 *
 * LE CALCUL, PROPORTIONNEL, convention d'OmegaX dite · l'arriéré d'un mois est
 * le salaire figé sur son bulletin (éléments « Salaire ou traitement », en
 * francs) multiplié par l'écart relatif de la base · (nouvelle base − base
 * figée) ÷ base figée. Un mois payé en entier rend la différence des bases ;
 * un mois incomplet (absence, entrée en cours de mois) rend la même part de
 * la différence que le salaire payé l'était de l'ancienne base. La base figée
 * est celle que le bulletin a recopiée du contrat à son émission
 * (`calcul.contrat`), jamais le contrat du jour.
 *
 * CE QUI EST REFUSÉ, ET POURQUOI.
 *  - UNE BAISSE · rendre un salaire déjà payé serait une retenue que
 *    l'art. 112 du Code du travail ne nomme pas (liste fermée).
 *  - UN MOIS SANS BULLETIN ÉMIS · rien n'a été payé, il n'y a rien à rappeler
 *    (le mois se paie par son bulletin) · nommé, exclu.
 *  - UN MOIS STIPULÉ EN DOLLARS · son salaire figé est la conversion d'un jour
 *    passé ; un rappel se convertit au cours du jour du paiement (décision T8,
 *    `conversion-usd.ts`) · non servi ici, nommé.
 *  - UN MOIS DÉJÀ RAPPELÉ · la base figée ne porte pas le premier rappel, et
 *    un second le compterait deux fois · annuler le premier, déclarer la base
 *    finale.
 *  - UNE BASE D'UNE AUTRE MONNAIE OU D'UNE AUTRE PÉRIODICITÉ que celle du
 *    contrat figé · l'écart relatif ne se lit qu'entre deux bases de même
 *    unité.
 *
 * CE QUE LE RAPPEL NE FAIT PAS · il ne change pas le contrat (la base des
 * mois à venir se déclare au registre) ; il ne recalcule ni les heures
 * majorées ni les allocations de congé des mois passés, assises sur l'ancien
 * taux · nommé dans la réserve.
 */

export const MOIS_RAPPEL_AU_PLUS = 24;

export const RESERVE_RAPPEL =
  "Le rappel porte les arriérés du salaire de base au bulletin du mois où ils sont payés (Code du travail, art. 213 ; arrêté du 8 août 2008, mention 13, « arriérés de rémunération ») · cotisations et retenue d'impôt se calculent sur ce bulletin. Il ne change pas le contrat, et ne recalcule ni les heures majorées ni les allocations de congé des mois passés.";

const MOIS_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const rang = (m: string) => {
  const [a, b] = m.split('-').map(Number);
  return a * 12 + (b - 1);
};
const moisDuRang = (r: number) => `${Math.floor(r / 12)}-${String((r % 12) + 1).padStart(2, '0')}`;

export function moisDuRappel(debut: string, fin: string): string[] | { refus: string } {
  if (!MOIS_RE.test(debut) || !MOIS_RE.test(fin)) return { refus: 'Les mois du rappel se lisent AAAA-MM.' };
  if (rang(fin) < rang(debut)) return { refus: 'Le dernier mois du rappel précède le premier.' };
  if (rang(fin) - rang(debut) + 1 > MOIS_RAPPEL_AU_PLUS) return { refus: `Un rappel couvre ${MOIS_RAPPEL_AU_PLUS} mois au plus (convention d'OmegaX) · scindez-le.` };
  return Array.from({ length: rang(fin) - rang(debut) + 1 }, (_, i) => moisDuRang(rang(debut) + i));
}

/**
 * L'ARRIÉRÉ D'UN MOIS, en centimes, en entiers longs · salaire × (nouvelle −
 * ancienne) ÷ ancienne, arrondi au centime le plus proche. Le produit d'un
 * salaire en centimes par un écart de base en centimes dépasse l'entier sûr
 * des flottants.
 */
export function arriereDuMois(salaireFc: number, ancienneBase: number, nouvelleBase: number): number {
  const s = BigInt(Math.round(salaireFc * 100));
  const a = BigInt(Math.round(ancienneBase * 100));
  const n = BigInt(Math.round(nouvelleBase * 100));
  const num = s * (n - a) * 2n + a;
  return Number(num / (2n * a)) / 100;
}

export type BulletinSource = {
  id: string;
  numero: number;
  moisDePaie: string;
  /** Le salaire figé en francs · somme des éléments « Salaire ou traitement » du bulletin, rappels exclus. */
  salaireFc: number | null;
  /** `calcul.contrat` · la base, sa périodicité et sa monnaie recopiées à l'émission. */
  base: number | null;
  periodicite: string | null;
  devise: string | null;
  stipuleEnDollars: boolean;
};

export type LigneRappel = {
  mois: string;
  bulletinId: string;
  numero: number;
  salaireFigeFc: number;
  ancienneBase: number;
  arriereFc: number;
};

export type CalculRappel = {
  lignes: LigneRappel[];
  exclus: { mois: string; motif: string }[];
  totalFc: number;
};

/** Le rappel mois par mois · chaque mois exclu dit pourquoi. */
export function calculerRappel(
  mois: readonly string[],
  sources: readonly BulletinSource[],
  /** Mois → description du rappel non annulé qui le couvre déjà (« déclaré le 2026-11-03 »). */
  dejaRappeles: ReadonlyMap<string, string>,
  declare: { nouvelleBase: number; periodicite: string; devise: string },
): CalculRappel {
  const lignes: LigneRappel[] = [];
  const exclus: { mois: string; motif: string }[] = [];
  for (const m of mois) {
    const deja = dejaRappeles.get(m);
    if (deja !== undefined) {
      exclus.push({ mois: m, motif: `déjà couvert par un rappel ${deja} · annulez-le et déclarez la base finale` });
      continue;
    }
    const b = sources.filter((x) => x.moisDePaie === m);
    if (b.length === 0) {
      exclus.push({ mois: m, motif: 'aucun bulletin émis · rien n’a été payé, rien n’est à rappeler' });
      continue;
    }
    if (b.length > 1) {
      exclus.push({ mois: m, motif: `plusieurs bulletins émis (n° ${b.map((x) => x.numero).join(', ')}) · le rappel ne choisit pas` });
      continue;
    }
    const s = b[0];
    if (s.stipuleEnDollars) {
      exclus.push({ mois: m, motif: `bulletin n° ${s.numero} stipulé en dollars · son rappel se convertit au cours du jour du paiement, non servi ici` });
      continue;
    }
    if (s.base === null || !(s.base > 0)) {
      exclus.push({ mois: m, motif: `bulletin n° ${s.numero} sans base de rémunération figée · l'écart ne se lit pas` });
      continue;
    }
    if (s.periodicite !== declare.periodicite || (s.devise ?? 'CDF') !== declare.devise) {
      exclus.push({ mois: m, motif: `bulletin n° ${s.numero} sur une base ${s.periodicite ?? 'de périodicité inconnue'} en ${s.devise ?? 'monnaie inconnue'} · la nouvelle base se déclare dans la même unité` });
      continue;
    }
    if (s.salaireFc === null || !(s.salaireFc > 0)) {
      exclus.push({ mois: m, motif: `bulletin n° ${s.numero} sans élément « Salaire ou traitement » lisible` });
      continue;
    }
    if (Math.round(declare.nouvelleBase * 100) <= Math.round(s.base * 100)) {
      exclus.push({
        mois: m,
        motif: `la base figée (${s.base}) n'est pas inférieure à la nouvelle · une baisse rendrait un salaire payé, ce que l'art. 112 du Code du travail n'autorise pas`,
      });
      continue;
    }
    lignes.push({ mois: m, bulletinId: s.id, numero: s.numero, salaireFigeFc: s.salaireFc, ancienneBase: s.base, arriereFc: arriereDuMois(s.salaireFc, s.base, declare.nouvelleBase) });
  }
  return { lignes, exclus, totalFc: lignes.reduce((n, l) => n + Math.round(l.arriereFc * 100), 0) / 100 };
}

/** Le libellé de l'élément porté au bulletin · la note de l'observation que la mention 13 demande. */
export const libelleRappel = (mois: string, motif: string) => `Rappel de salaire de ${mois} · ${motif}`.slice(0, 200);

/** Un rappel ne se porte qu'au bulletin d'un mois postérieur à tous ses mois · il paie le passé. */
export function motifRefusMoisDePaiement(moisDePaie: string, moisDuRappel: readonly string[]): string | null {
  const dernier = [...moisDuRappel].sort().at(-1);
  if (dernier && moisDePaie <= dernier) {
    return `Ce rappel couvre jusqu'à ${dernier} · il se porte au bulletin d'un mois postérieur, celui où les arriérés sont payés.`;
  }
  return null;
}
