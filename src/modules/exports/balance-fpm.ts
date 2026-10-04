import { ClasseCompte } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { type FeuilleFpm, formuleLien, montantFpm, soldeEnDeuxColonnes } from './presentation-fpm';

/**
 * LE CORPS D'UNE BALANCE DANS LA PRÉSENTATION DU CABINET (ligne FPM) · une
 * seule écriture, servie à la balance exportée (`export-fpm.service.ts`) et
 * aux deux feuilles BALANCE N et BALANCE N-1 des liasses (décision de Manasse
 * du 2026-10-04, « adapte juste les 2 balances selon le modèle de FPM »).
 * Deux écritures de la même balance finiraient par différer d'un total.
 *
 * Colonnes · A numéro, B intitulé, C-D mouvements BRUTS avant la période,
 * E-F mouvements de la période, G-H solde cumulé NET dans la seule colonne de
 * son sens. Pas de sous-totaux par classe ; en fin de tableau « Totaux
 * comptes de bilan » (classes 1 à 5), « Totaux comptes de gestion » (6 à 8),
 * « Totaux de la balance », puis une ligne par division de la classe 9, hors
 * des totaux · au SYCEBNL elle porte les contributions volontaires en nature
 * « (mémoire, sans impact bilan/résultat) » (Partie 2 ch. 1, cadre
 * comptable) ; au SYSCOHADA ses 90 et 91 sont hors bilan et ses 92 à 99
 * analytiques (AUDCIF Titre VII ch. 1). Chaque division est nommée par son
 * intitulé lu dans le plan du dossier · un numéro, deux sens.
 */

/** Une ligne de balance, dans les colonnes de la présentation. */
export interface LigneBalanceFpm {
  compteId: string;
  numero: string;
  intitule: string;
  classe: ClasseCompte;
  avantDebit: number;
  avantCredit: number;
  mouvementDebit: number;
  mouvementCredit: number;
  totalDebit: number;
  totalCredit: number;
}

/** Les six colonnes de montants d'une ligne de total. */
export interface TotauxBalance {
  avantDebit: number;
  avantCredit: number;
  mouvementDebit: number;
  mouvementCredit: number;
  solde: number;
}

export const CLASSES_BILAN = new Set<ClasseCompte>([
  ClasseCompte.CLASSE_1,
  ClasseCompte.CLASSE_2,
  ClasseCompte.CLASSE_3,
  ClasseCompte.CLASSE_4,
  ClasseCompte.CLASSE_5,
]);
export const CLASSES_GESTION = new Set<ClasseCompte>([ClasseCompte.CLASSE_6, ClasseCompte.CLASSE_7, ClasseCompte.CLASSE_8]);

export const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Les divisions à deux chiffres de la classe 9 que la balance porte. */
export function divisionsDeLaClasse9(lignes: readonly LigneBalanceFpm[]): string[] {
  return [...new Set(lignes.filter((l) => l.classe === ClasseCompte.CLASSE_9).map((l) => l.numero.slice(0, 2)))];
}

/** Une ligne de compte · le numéro est le lien vers sa feuille, s'il en a une. */
export async function ecrireLigneDeCompte(
  feuille: FeuilleFpm,
  l: LigneBalanceFpm,
  libelle: string,
  feuilleDuCompte: string | undefined,
): Promise<number> {
  const solde = soldeEnDeuxColonnes(l.totalDebit - l.totalCredit);
  return feuille.ajouter(
    {
      numero: l.numero,
      intitule: libelle,
      avantDebit: montantFpm(l.avantDebit),
      avantCredit: montantFpm(l.avantCredit),
      mouvementDebit: montantFpm(l.mouvementDebit),
      mouvementCredit: montantFpm(l.mouvementCredit),
      soldeDebit: solde.debit,
      soldeCredit: solde.credit,
    },
    feuilleDuCompte ? { lien: { colonne: 1, valeur: formuleLien(feuilleDuCompte, 'A1', l.numero) } } : {},
  );
}

/**
 * UNE LIGNE DE TOTAL · les quatre colonnes de mouvements en SOMME, les deux
 * de solde en solde NET dans la seule colonne de son sens (présentation
 * relevée · « Totaux comptes de bilan » ne porte que le solde net). Chaque
 * montant est une FORMULE (un total écrit en dur ne se vérifie pas), son
 * résultat joint pour qui lit sans moteur de calcul. Un total nul reste une
 * cellule vide, comme tout zéro de la présentation.
 */
export async function ecrireTotal(
  feuille: FeuilleFpm,
  libelle: string,
  t: TotauxBalance,
  references: (col: string) => string,
): Promise<number> {
  const f = (col: string, valeur: number): ExcelJS.CellFormulaValue | null => {
    const v = montantFpm(valeur);
    return v === null ? null : { formula: references(col), result: v };
  };
  const solde = soldeEnDeuxColonnes(t.solde);
  const net = (sens: 'D' | 'C'): ExcelJS.CellFormulaValue | null => {
    const v = sens === 'D' ? solde.debit : solde.credit;
    if (v === null) return null;
    const [a, b] = sens === 'D' ? ['G', 'H'] : ['H', 'G'];
    return { formula: `MAX(0,${references(a)}-(${references(b)}))`, result: v };
  };
  return feuille.ajouter(
    {
      intitule: libelle,
      avantDebit: f('C', t.avantDebit),
      avantCredit: f('D', t.avantCredit),
      mouvementDebit: f('E', t.mouvementDebit),
      mouvementCredit: f('F', t.mouvementCredit),
      soldeDebit: net('D'),
      soldeCredit: net('C'),
    },
    { gras: true, filetHaut: true },
  );
}

export function totauxBalance(lignes: readonly LigneBalanceFpm[]): TotauxBalance {
  const s = (f: (l: LigneBalanceFpm) => number) => arrondi(lignes.reduce((t, l) => t + f(l), 0));
  return {
    avantDebit: s((l) => l.avantDebit),
    avantCredit: s((l) => l.avantCredit),
    mouvementDebit: s((l) => l.mouvementDebit),
    mouvementCredit: s((l) => l.mouvementCredit),
    solde: s((l) => l.totalDebit - l.totalCredit),
  };
}

export function sommeBalance(a: TotauxBalance, b: TotauxBalance): TotauxBalance {
  return {
    avantDebit: arrondi(a.avantDebit + b.avantDebit),
    avantCredit: arrondi(a.avantCredit + b.avantCredit),
    mouvementDebit: arrondi(a.mouvementDebit + b.mouvementDebit),
    mouvementCredit: arrondi(a.mouvementCredit + b.mouvementCredit),
    solde: arrondi(a.solde + b.solde),
  };
}

export function ecartBalance(a: TotauxBalance, b: TotauxBalance): TotauxBalance {
  return {
    avantDebit: arrondi(a.avantDebit - b.avantDebit),
    avantCredit: arrondi(a.avantCredit - b.avantCredit),
    mouvementDebit: arrondi(a.mouvementDebit - b.mouvementDebit),
    mouvementCredit: arrondi(a.mouvementCredit - b.mouvementCredit),
    solde: arrondi(a.solde - b.solde),
  };
}

export function estNulBalance(t: TotauxBalance): boolean {
  return [t.avantDebit, t.avantCredit, t.mouvementDebit, t.mouvementCredit, t.solde].every((v) => arrondi(v) === 0);
}

/** Une plage de lignes d'une colonne · `SUM(C10:C42)`. */
export function plageBalance(premiere: number, derniere: number) {
  return (col: string) => `SUM(${col}${premiere}:${col}${derniere})`;
}

/** Ce que le corps d'une balance a écrit · rangs des comptes et des lignes de données. */
export interface CorpsBalance {
  ligneDuCompte: Map<string, number>;
  /** Première et dernière ligne de COMPTE (totaux exclus), ou null sans compte. */
  premiere: number | null;
  derniere: number | null;
}

/**
 * LES LIGNES DE COMPTES PUIS LES TOTAUX. `feuilleDe` donne, compte par compte,
 * la feuille de son grand livre (le numéro devient un lien) · absent dans la
 * liasse, qui ne porte aucune feuille de compte.
 */
export async function ecrireCorpsBalance(
  feuille: FeuilleFpm,
  lignes: readonly LigneBalanceFpm[],
  intitulesDivisions: Map<string, string>,
  feuilleDe?: Map<string, string | undefined>,
): Promise<CorpsBalance> {
  const ligneDuCompte = new Map<string, number>();
  const rangs = { bilan: [] as number[], gestion: [] as number[] };
  const rangsDivision = new Map<string, number[]>();
  for (const l of lignes) {
    const r = await ecrireLigneDeCompte(feuille, l, l.intitule, feuilleDe?.get(l.compteId));
    ligneDuCompte.set(l.compteId, r);
    if (CLASSES_BILAN.has(l.classe)) rangs.bilan.push(r);
    else if (CLASSES_GESTION.has(l.classe)) rangs.gestion.push(r);
    else {
      const d = l.numero.slice(0, 2);
      rangsDivision.set(d, [...(rangsDivision.get(d) ?? []), r]);
    }
  }
  const tous = [...ligneDuCompte.values()];

  // LES PLAGES SE LISENT SUR LES RANGS ÉCRITS, jamais supposées contiguës ·
  // la base trie les numéros comme du texte, et une plage `SUM(C9:C40)` qui
  // franchirait une ligne d'une autre classe l'additionnerait en silence.
  const formuleDesRangs = (r: number[]) => (col: string) =>
    r.length === 0 ? '0' : `SUM(${r.map((x) => `${col}${x}`).join(',')})`;
  const plagesOuRangs = (r: number[]) =>
    r.length > 0 && r[r.length - 1] - r[0] === r.length - 1 ? plageBalance(r[0], r[r.length - 1]) : formuleDesRangs(r);

  const tBilan = totauxBalance(lignes.filter((l) => CLASSES_BILAN.has(l.classe)));
  const tGestion = totauxBalance(lignes.filter((l) => CLASSES_GESTION.has(l.classe)));
  const rBilan = await ecrireTotal(feuille, 'Totaux comptes de bilan', tBilan, plagesOuRangs(rangs.bilan));
  const rGestion = await ecrireTotal(feuille, 'Totaux comptes de gestion', tGestion, plagesOuRangs(rangs.gestion));
  await ecrireTotal(feuille, 'Totaux de la balance', sommeBalance(tBilan, tGestion), (col) => `${col}${rBilan}+${col}${rGestion}`);
  for (const d of divisionsDeLaClasse9(lignes)) {
    await ecrireTotal(
      feuille,
      `Totaux ${intitulesDivisions.get(d) ?? d}`,
      totauxBalance(lignes.filter((l) => l.classe === ClasseCompte.CLASSE_9 && l.numero.startsWith(d))),
      plagesOuRangs(rangsDivision.get(d) ?? []),
    );
  }
  return {
    ligneDuCompte,
    premiere: tous.length ? Math.min(...tous) : null,
    derniere: tous.length ? Math.max(...tous) : null,
  };
}
