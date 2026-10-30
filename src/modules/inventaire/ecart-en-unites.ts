/**
 * LIGNE RESTES-IMMOS-BUDGETS, POINT 2 · LA QUANTITÉ DU BIEN SUR LA FICHE DE
 * COMPTAGE.
 *
 * Une fiche du registre peut porter un LOT d'unités identiques
 * (`Immobilisation.quantite`, ligne immos n° 65). L'inventaire physique
 * procède « au recensement et à l'évaluation de ses biens » (AUDCIF art. 42,
 * non écarté par l'art. 3 du SYCEBNL) · recenser un lot de dix chaises, c'est
 * en compter dix. La quantité du registre est donc recopiée sur la fiche
 * (`quantiteAttendue`), et la quantité comptée s'y confronte EN UNITÉS.
 *
 * TROIS RÈGLES.
 *  1. « PAS ENCORE COMPTÉ » N'EST PAS ZÉRO · sans quantité comptée, aucun
 *     écart n'est dit (sinon un manquant de tout le lot).
 *  2. UN MANQUANT SE DIT, IL NE SE PASSE PAS · la sous-commission qualifie
 *     (sortie, vol, disparition, rebut) et le geste de sortie du registre le
 *     traduit ; l'inventaire n'écrit rien (CPCC, étapes 4 et 5).
 *  3. JAMAIS UN EXCÉDENT CRÉÉ · « si la valeur d'inventaire est supérieure à
 *     la valeur d'entrée, cette dernière est MAINTENUE dans les comptes »
 *     (AUDCIF art. 43). Une unité trouvée en plus n'entre ni au registre ni
 *     au bilan par l'inventaire · une acquisition omise s'enregistre avec sa
 *     pièce, jamais par le comptage.
 *  Un bien se compte en unités ENTIÈRES · une fraction d'unité n'est pas un
 *  comptage d'un bien du registre (refusée à la saisie).
 */

export type SensEcartUnites = 'CONFORME' | 'MANQUANT' | 'EXCEDENT';

export type EcartEnUnites = {
  attendue: number;
  /** `null` · la fiche n'est pas encore comptée. */
  comptee: number | null;
  /** Comptée moins attendue · `null` tant que rien n'est compté. */
  ecart: number | null;
  sens: SensEcartUnites | null;
  mention: string;
  /**
   * La quantité que le registre porte AUJOURD'HUI, quand elle diffère de celle
   * recopiée (une partie du lot sortie depuis) · la fiche comptée la garde, le
   * compteur ayant confronté ce qu'il voyait à la quantité montrée, et c'est dit.
   */
  quantiteRegistre: number | null;
  /**
   * Relecture indépendante, M3 · ce qui reste d'un manquant à traduire au
   * registre · le manquant moins les unités sorties du registre depuis le
   * comptage. Zéro · déjà traduit, rien à sortir de nouveau ; `null` hors
   * manquant. Sans quoi l'écran et le PV réédité invitaient à sortir deux
   * fois les mêmes unités.
   */
  manquantATraduire: number | null;
};

const unites = (k: number) => `${k.toLocaleString('fr-FR')} unité${Math.abs(k) > 1 ? 's' : ''}`;

export const MENTION_EXCEDENT_UNITES =
  "aucune unité n'est ajoutée au registre ni au bilan par l'inventaire · la valeur d'entrée est maintenue (AUDCIF art. 43) ; " +
  "une acquisition omise s'enregistre avec sa pièce justificative.";

/** L'écart d'une fiche en unités, ou `null` quand la fiche ne porte aucune quantité du registre. */
export function ecartEnUnites(fiche: {
  quantiteAttendue: number | null;
  quantiteComptee: unknown;
  /** La quantité du bien au registre aujourd'hui, si la fiche porte un bien. */
  quantiteRegistre?: number | null;
}): EcartEnUnites | null {
  if (fiche.quantiteAttendue === null || fiche.quantiteAttendue === undefined) return null;
  const attendue = fiche.quantiteAttendue;
  const change = fiche.quantiteRegistre !== null && fiche.quantiteRegistre !== undefined && fiche.quantiteRegistre !== attendue;
  const quantiteRegistre = change ? (fiche.quantiteRegistre as number) : null;
  const suite = change
    ? ` Le registre porte depuis ${unites(quantiteRegistre as number)} (une partie du lot sortie ou rendue après l'engendrement) · la fiche garde la quantité qui a été montrée au comptage.`
    : '';
  if (fiche.quantiteComptee === null || fiche.quantiteComptee === undefined) {
    return { attendue, comptee: null, ecart: null, sens: null, mention: `Registre · ${unites(attendue)} · non compté.${suite}`, quantiteRegistre, manquantATraduire: null };
  }
  const comptee = Number(fiche.quantiteComptee);
  const ecart = comptee - attendue;
  if (ecart === 0) return { attendue, comptee, ecart, sens: 'CONFORME', mention: `${unites(comptee)} comptée(s), conforme au registre.${suite}`, quantiteRegistre, manquantATraduire: null };
  if (ecart < 0) {
    const dejaSorties = quantiteRegistre !== null ? Math.max(0, attendue - quantiteRegistre) : 0;
    const manquantATraduire = Math.max(0, -ecart - dejaSorties);
    const mention =
      dejaSorties === 0
        ? `Manquant de ${unites(-ecart)} sur ${unites(attendue)} au registre · la sous-commission qualifie (sortie, vol, ` +
          `disparition, rebut) ; rien n'est passé d'office, la sortie des unités se fait depuis la fiche du bien.${suite}`
        : manquantATraduire === 0
          ? `Manquant de ${unites(-ecart)} sur ${unites(attendue)} montrées au comptage · déjà traduit au registre, qui porte ` +
            `depuis ${unites(quantiteRegistre as number)} · rien à sortir de nouveau.`
          : `Manquant de ${unites(-ecart)} sur ${unites(attendue)} montrées au comptage · ${unites(dejaSorties)} déjà sortie(s) du ` +
            `registre depuis, ${unites(manquantATraduire)} encore à qualifier ; rien n'est passé d'office, la sortie se fait depuis la fiche du bien.`;
    return { attendue, comptee, ecart, sens: 'MANQUANT', mention, quantiteRegistre, manquantATraduire };
  }
  return {
    attendue,
    comptee,
    ecart,
    sens: 'EXCEDENT',
    mention: `Excédent de ${unites(ecart)} sur ${unites(attendue)} au registre · ${MENTION_EXCEDENT_UNITES}${suite}`,
    quantiteRegistre,
    manquantATraduire: null,
  };
}

/** Le refus d'une quantité comptée sur la fiche d'un bien du registre, ou `null`. */
export function motifRefusQuantiteDuBien(quantite: number | undefined, estUnBienDuRegistre: boolean): string | null {
  if (quantite === undefined || !estUnBienDuRegistre) return null;
  if (!Number.isInteger(quantite)) return "Un bien du registre se compte en unités entières · une fraction d'unité n'est pas un comptage.";
  return null;
}
