import type { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { attendreLeTuyau, type IdentiteEtat, segmentIdentification } from './classeur-en-flux';

/**
 * LA PRÉSENTATION FPM · les balances et grands livres tels que le cabinet les
 * remet (ligne FPM, 2026-10-04). Relevée cellule par cellule sur trois
 * classeurs de travail du cabinet (balance générale, grand-livre des tiers
 * brut de Sage, grand-livre des tiers retravaillé) · Arial 9, cartouche des
 * lignes 2 à 6, en-têtes pleins `FF4F81BD` en blanc, montants au format
 * `#\ ##0.00`, zéro rendu par une cellule VIDE, filets verticaux entre les
 * groupes de colonnes, ni quadrillage horizontal ni zébrure.
 *
 * TROIS ÉCARTS AVEC LES MODÈLES, VOULUS :
 *  · l'unité est TOUJOURS la monnaie de tenue (`monnaieDuJeuLegal`, loi
 *    n° 23/053 art. 141, 1° ; AUDCIF art. 17, 1°), jamais le « $ » de leurs
 *    éditions, dont la tenue en dollars n'a pas de base légale ;
 *  · les dates s'écrivent `dd\/mm\/yy`. La balance relevée portait
 *    `mm\/dd\/yy`, reste du gabarit américain de Sage · le 01/02/24 s'y lit
 *    deux fois ;
 *  · le pied de page imprimé de tous les états d'OmegaX reste posé (AUDCIF
 *    art. 22, 7°, « numérotés et datés ») · le « Page : 1 » du cartouche ne
 *    numérote que la première page, comme chez eux.
 *
 * TOUT S'ÉCRIT EN FLUX (`classeur-en-flux.ts`) · le cartouche et les en-têtes
 * AVANT la première donnée, les formats et les filets portés par la COLONNE
 * (une ligne commise ne se reformate plus).
 */

/**
 * LE FORMAT DES MONTANTS, À L'OCTET · `#`, barre oblique inverse, ESPACE
 * INSÉCABLE (U+00A0), `##0.00`. La barre échappe l'espace, qu'Excel imprime
 * tel quel comme séparateur des milliers ; une espace ordinaire à sa place
 * changerait le séparateur selon le poste.
 */
export const FORMAT_MONTANT_FPM = '#\\ ##0.00';
/** Les dates · jour, mois, année sur deux chiffres, à la française. */
export const FORMAT_DATE_FPM = 'dd\\/mm\\/yy';

/** Le fond des en-têtes, relevé sur la balance du cabinet. */
export const FOND_ENTETE_FPM = 'FF4F81BD';
const BLANC = 'FFFFFFFF';
const BLEU_LIEN = 'FF0000FF';

const POLICE = { name: 'Arial', size: 9 } as const;
const FILET = { style: 'thin' } as const;

/** Les quatre premières lignes du cartouche, puis le filet, puis la ligne 6. */
export const LIGNE_ENTETE_FPM = 8;

/**
 * Un montant à l'arrondi du centime, ou RIEN quand il est nul · « Un zéro se
 * rend par une cellule vide » (présentation relevée). L'arrondi passe avant
 * le test, sans quoi un reste flottant de 1e-11 sortirait « 0.00 ».
 */
export function montantFpm(n: number): number | null {
  const a = Math.round(n * 100) / 100;
  return a === 0 ? null : a;
}

/** Le solde net, dans la seule colonne de son sens. */
export function soldeEnDeuxColonnes(solde: number): { debit: number | null; credit: number | null } {
  const a = Math.round(solde * 100) / 100;
  return { debit: a > 0 ? a : null, credit: a < 0 ? -a : null };
}

/**
 * L'HEURE DU TIRAGE, À KINSHASA (UTC+1, sans heure d'été) · lue sur l'horloge
 * du serveur, qui tourne en UTC · un tirage de 23 h 30 à Kinshasa sortirait
 * daté de la veille.
 */
export function tirageAKinshasa(instant: Date = new Date()): string {
  const k = new Date(instant.getTime() + 60 * 60 * 1000);
  const d2 = (x: number) => String(x).padStart(2, '0');
  return (
    `${d2(k.getUTCDate())}/${d2(k.getUTCMonth() + 1)}/${d2(k.getUTCFullYear() % 100)} à ` +
    `${d2(k.getUTCHours())}:${d2(k.getUTCMinutes())}:${d2(k.getUTCSeconds())}`
  );
}

/**
 * LES NOMS DE FEUILLE, un par compte · le numéro seul, débarrassé des
 * caractères qu'Excel refuse dans un nom de feuille (`[ ] : * ? / \`) et de
 * l'apostrophe, qui ferait sortir le nom de ses guillemets dans une formule
 * de lien. Trente et un caractères au plus. UNICITÉ SANS ÉGARD À LA CASSE,
 * comme Excel la juge · un doublon, et les réservés (la feuille de la
 * balance, « Historique » qu'Excel garde pour lui), prennent un suffixe
 * numéroté plutôt qu'un classeur qu'Excel répare à l'ouverture en renommant.
 */
export function nomsDeFeuilles(numeros: readonly string[], reserves: readonly string[]): string[] {
  const pris = new Set([...reserves, 'Historique', 'History'].map((n) => n.toLowerCase()));
  return numeros.map((numero) => {
    const base = (numero.replace(/[[\]:*?/\\']/g, '').trim() || 'Compte').slice(0, 31);
    let nom = base;
    for (let i = 2; pris.has(nom.toLowerCase()); i++) {
      const suffixe = `-${i}`;
      nom = `${base.slice(0, 31 - suffixe.length)}${suffixe}`;
    }
    pris.add(nom.toLowerCase());
    return nom;
  });
}

/**
 * UN LIEN INTERNE EST UNE FORMULE `HYPERLINK`, JAMAIS UNE PROPRIÉTÉ DE
 * CELLULE · l'écrivain en flux d'ExcelJS (4.4.0) range tout lien en relation
 * EXTERNE (`SheetRelsWriter.addHyperlink`, `TargetMode: 'External'`) et
 * perd l'attribut `location` · le lien vers `#'401'!A1` s'ouvrirait comme une
 * adresse web. La formule n'a besoin d'aucune relation.
 *
 * Le nom de feuille est entre apostrophes (il commence par un chiffre),
 * l'ensemble entre guillemets doublés quand le texte en porte.
 */
export function formuleLien(feuille: string, cellule: string, texte: string): ExcelJS.CellFormulaValue {
  const cible = `#'${feuille.replace(/'/g, "''")}'!${cellule}`;
  const echapper = (s: string) => s.replace(/"/g, '""');
  return { formula: `HYPERLINK("${echapper(cible)}","${echapper(texte)}")`, result: texte };
}

/** La police d'un lien · bleu souligné, comme Excel les pose. */
export const POLICE_LIEN: Partial<ExcelJS.Font> = { ...POLICE, color: { argb: BLEU_LIEN }, underline: true };

/** Une colonne FPM · sa clé, sa largeur, son genre, et le filet à sa droite. */
export interface ColonneFpm {
  cle: string;
  largeur: number;
  genre: 'texte' | 'montant' | 'date';
  /** Filet vertical à droite · il sépare deux groupes de colonnes. */
  filetDroit?: boolean;
  /** Filet à gauche · la première colonne seulement. */
  filetGauche?: boolean;
}

/** Les filets d'une colonne, réutilisés quand une cellule pose sa bordure. */
function filetsDe(c: ColonneFpm): Partial<ExcelJS.Borders> {
  return { ...(c.filetGauche ? { left: FILET } : {}), ...(c.filetDroit ? { right: FILET } : {}) };
}

function styleDeColonne(c: ColonneFpm): Partial<ExcelJS.Style> {
  return {
    font: { ...POLICE },
    border: filetsDe(c),
    ...(c.genre === 'montant' ? { numFmt: FORMAT_MONTANT_FPM, alignment: { horizontal: 'right' } } : {}),
    ...(c.genre === 'date' ? { numFmt: FORMAT_DATE_FPM } : {}),
  };
}

/** Une cellule d'en-tête · titre, et fusion éventuelle sur la ligne d'en dessous ou les colonnes voisines. */
export interface EnteteFpm {
  /** Rang de la colonne (1 pour A). */
  colonne: number;
  ligne: 0 | 1;
  texte: string;
  /** Fusion jusqu'à cette colonne incluse, sur la même ligne. */
  jusquA?: number;
  /** Fusion sur les deux lignes d'en-tête. */
  surDeuxLignes?: boolean;
}

/** Ce que décrit une feuille FPM. */
export interface ParametresFeuilleFpm {
  nomFeuille: string;
  titre: string;
  sousTitre: string;
  identite: IdentiteEtat;
  debut: Date;
  fin: Date;
  colonnes: ColonneFpm[];
  /** Une ou deux lignes d'en-tête. */
  entetes: EnteteFpm[];
  lignesEntete: 1 | 2;
  /** Ligne 1 · le lien « Retour à la balance », s'il y en a un. */
  retour?: ExcelJS.CellFormulaValue;
  /** Ligne 7 · une mention sous le cartouche (le brouillard), s'il y en a une. */
  mention?: string;
}

/**
 * Pose une feuille FPM dans un classeur en flux · cartouche des lignes 2 à 6,
 * en-têtes en ligne 8 (et 9), pied de page imprimé. Une feuille ne s'ouvre
 * qu'une fois la précédente commise · en flux, ses lignes sont déjà parties.
 */
export function poserFeuilleFpm(
  classeur: ExcelJS.stream.xlsx.WorkbookWriter,
  sortie: Writable,
  p: ParametresFeuilleFpm,
) {
  const n = p.colonnes.length;
  const derniereEntete = LIGNE_ENTETE_FPM + p.lignesEntete - 1;
  const ident = segmentIdentification(p.identite);
  const feuille = classeur.addWorksheet(p.nomFeuille, {
    views: [{ state: 'frozen', ySplit: derniereEntete }],
    properties: { defaultRowHeight: 12 },
    headerFooter: {
      // `&` introduit un code d'en-tête Excel · doublé, il s'imprime.
      oddFooter:
        `&L${p.identite.entite.replace(/&/g, '&&')}${ident ? ` · ${ident.replace(/&/g, '&&')}` : ''} · ` +
        `${p.identite.periode} · montants en ${p.identite.devise}` +
        `&RPage &P / &N · édité le ${new Date().toLocaleDateString('fr-FR')}`,
    },
  });
  feuille.columns = p.colonnes.map((c) => ({ key: c.cle, width: c.largeur, style: styleDeColonne(c) }));

  // Les colonnes du cartouche · le titre au milieu, la période à droite.
  const milieu = Math.max(2, Math.ceil(n / 2));
  const avantDerniere = n - 1;
  // Une cellule du cartouche ne prend NI le filet ni le format de sa colonne ·
  // elle naît avec le style de la colonne (ExcelJS le recopie), et « Période
  // du » sortirait aligné à droite entre deux filets de montant.
  const cart = (ligne: ExcelJS.Row, col: number): ExcelJS.Cell => {
    const cellule = ligne.getCell(col);
    cellule.border = {};
    cellule.alignment = {};
    cellule.font = { ...POLICE };
    cellule.numFmt = '@';
    return cellule;
  };

  /** Pose une cellule du cartouche d'un seul geste · valeur et style. */
  const poser = (ligne: ExcelJS.Row, col: number, valeur: ExcelJS.CellValue, style: Partial<ExcelJS.Style> = {}) => {
    const cellule = cart(ligne, col);
    cellule.value = valeur;
    if (style.font) cellule.font = style.font;
    if (style.alignment) cellule.alignment = style.alignment;
    if (style.numFmt) cellule.numFmt = style.numFmt;
  };
  const gras = { font: { ...POLICE, bold: true } };
  const aGauche = { horizontal: 'left' } as const;

  const l1 = feuille.getRow(1);
  if (p.retour) poser(l1, 1, p.retour, { font: POLICE_LIEN });
  l1.commit();

  const l2 = feuille.getRow(2);
  l2.height = 23;
  poser(l2, 1, p.identite.entite, gras);
  poser(l2, milieu, p.titre, { font: { name: 'Arial', size: 18, bold: true }, alignment: { horizontal: 'center' } });
  poser(l2, avantDerniere, 'Période du', gras);
  poser(l2, n, p.debut, { numFmt: FORMAT_DATE_FPM, alignment: aGauche });
  l2.commit();

  const l3 = feuille.getRow(3);
  poser(l3, avantDerniere, 'au', gras);
  poser(l3, n, p.fin, { numFmt: FORMAT_DATE_FPM, alignment: aGauche });
  l3.commit();

  const l4 = feuille.getRow(4);
  poser(l4, milieu, p.sousTitre, { ...gras, alignment: { horizontal: 'center' } });
  // L'UNITÉ EST CELLE DE LA TENUE, toujours · voir l'en-tête du fichier.
  poser(l4, avantDerniere, `Tenue de compte : ${p.identite.devise}`);
  l4.commit();

  // Une ligne SANS VALEUR n'est écrite par le flux que si elle a une hauteur
  // (`WorksheetWriter._writeRow`) · sans elle, le filet disparaîtrait.
  const l5 = feuille.getRow(5);
  l5.height = 13.2;
  for (let c = 1; c <= n; c++) {
    const cellule = cart(l5, c);
    cellule.value = null;
    cellule.border = { bottom: FILET };
  }
  l5.commit();

  const l6 = feuille.getRow(6);
  poser(l6, 1, 'OmegaX');
  // En TEXTE, date et heure dans la même cellule · la colonne qui suit le
  // titre est, selon l'état, un montant ou le lettrage, trop étroite pour une
  // date et une heure (« ##### »).
  poser(l6, milieu, `Date de tirage ${tirageAKinshasa()}`);
  poser(l6, avantDerniere, 'Page :', { alignment: { horizontal: 'right' } });
  poser(l6, n, 1, { numFmt: '0', alignment: aGauche });
  l6.commit();
  const l7 = feuille.getRow(7);
  if (p.mention) poser(l7, 1, p.mention, { font: { ...POLICE, italic: true, bold: true } });
  l7.commit();

  // EN-TÊTES · fond plein, blanc gras, centrés et renvoyés à la ligne. Toutes
  // les cellules des lignes d'en-tête reçoivent le fond, fusionnées ou non,
  // sans quoi une colonne vide trouerait la bande.
  for (let r = 0; r < p.lignesEntete; r++) {
    const ligne = feuille.getRow(LIGNE_ENTETE_FPM + r);
    if (r === 0 && p.lignesEntete === 2) ligne.height = 24;
    for (let c = 1; c <= n; c++) {
      const cellule = ligne.getCell(c);
      const col = p.colonnes[c - 1];
      cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOND_ENTETE_FPM } };
      cellule.font = { ...POLICE, bold: true, color: { argb: BLANC } };
      cellule.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cellule.border = { ...filetsDe(col), ...(r === p.lignesEntete - 1 ? { bottom: FILET } : {}) };
      cellule.numFmt = '@';
    }
    for (const e of p.entetes.filter((x) => x.ligne === r)) ligne.getCell(e.colonne).value = e.texte;
  }
  // Les fusions AVANT la mise en flux des lignes d'en-tête · une ligne commise
  // ne se touche plus, et `mergeCells` relit ses cellules.
  for (const e of p.entetes) {
    const haut = LIGNE_ENTETE_FPM + e.ligne;
    const bas = e.surDeuxLignes ? haut + 1 : haut;
    const droite = e.jusquA ?? e.colonne;
    if (bas > haut || droite > e.colonne) feuille.mergeCells(haut, e.colonne, bas, droite);
  }
  for (let r = 0; r < p.lignesEntete; r++) feuille.getRow(LIGNE_ENTETE_FPM + r).commit();

  let derniere = derniereEntete;
  const ajouter = async (valeurs: Record<string, unknown>, options: LigneFpm = {}): Promise<number> => {
    const ligne = feuille.addRow(valeurs);
    // Chaque cellule existe, valeur nulle comprise · c'est elle qui porte le
    // filet vertical de sa colonne, sans quoi un montant nul trouerait la
    // ligne de séparation des groupes.
    p.colonnes.forEach((c, i) => {
      const cellule = ligne.getCell(i + 1);
      if (cellule.value === undefined) cellule.value = null;
      if (options.gras) cellule.font = { ...POLICE, bold: true };
      if (options.filetHaut) cellule.border = { ...filetsDe(c), top: FILET };
    });
    if (options.lien) {
      const cellule = ligne.getCell(options.lien.colonne);
      cellule.value = options.lien.valeur;
      cellule.font = { ...POLICE_LIEN, ...(options.gras ? { bold: true } : {}) };
    }
    ligne.commit();
    derniere = ligne.number;
    await attendreLeTuyau(sortie);
    return ligne.number;
  };

  return {
    feuille,
    ajouter,
    derniereLigne: () => derniere,
    premiereLigneDonnees: derniereEntete + 1,
    fermer: () => feuille.commit(),
  };
}

/** Les options d'une ligne de données. */
export interface LigneFpm {
  gras?: boolean;
  filetHaut?: boolean;
  lien?: { colonne: number; valeur: ExcelJS.CellFormulaValue };
}

export type FeuilleFpm = ReturnType<typeof poserFeuilleFpm>;

/**
 * LES COLONNES DU GRAND LIVRE FPM · Date, C.j, N° pièce, Libellé écriture,
 * Lettr., Mouvement débit, Mouvement crédit, Solde progressif (grand-livre
 * des tiers du cabinet, ligne 7 ou 8 selon l'édition). Filets entre Date, C.j,
 * les pièces et libellés, le lettrage, les deux mouvements et le solde.
 */
export const COLONNES_GRAND_LIVRE_FPM: ColonneFpm[] = [
  { cle: 'date', largeur: 9, genre: 'date', filetGauche: true, filetDroit: true },
  { cle: 'journal', largeur: 7, genre: 'texte', filetDroit: true },
  { cle: 'piece', largeur: 11, genre: 'texte' },
  { cle: 'libelle', largeur: 46, genre: 'texte', filetDroit: true },
  { cle: 'lettre', largeur: 7, genre: 'texte', filetDroit: true },
  { cle: 'debit', largeur: 15, genre: 'montant' },
  { cle: 'credit', largeur: 15, genre: 'montant', filetDroit: true },
  { cle: 'solde', largeur: 15, genre: 'montant', filetDroit: true },
];

export const ENTETES_GRAND_LIVRE_FPM: EnteteFpm[] = [
  { colonne: 1, ligne: 0, texte: 'Date' },
  { colonne: 2, ligne: 0, texte: 'C.j' },
  { colonne: 3, ligne: 0, texte: 'N° pièce' },
  { colonne: 4, ligne: 0, texte: 'Libellé écriture' },
  { colonne: 5, ligne: 0, texte: 'Lettr.' },
  { colonne: 6, ligne: 0, texte: 'Mouvement débit' },
  { colonne: 7, ligne: 0, texte: 'Mouvement crédit' },
  { colonne: 8, ligne: 0, texte: 'Solde progressif' },
];

/**
 * LES COLONNES D'UNE BALANCE FPM · numéro, intitulé, puis trois paires
 * débit / crédit (« Mouvements au <veille> », « Mouvements », « Soldes
 * cumulés »), un filet entre chaque groupe.
 */
export const COLONNES_BALANCE_FPM: ColonneFpm[] = [
  { cle: 'numero', largeur: 13, genre: 'texte', filetGauche: true, filetDroit: true },
  { cle: 'intitule', largeur: 40, genre: 'texte', filetDroit: true },
  { cle: 'avantDebit', largeur: 16, genre: 'montant' },
  { cle: 'avantCredit', largeur: 16, genre: 'montant', filetDroit: true },
  { cle: 'mouvementDebit', largeur: 16, genre: 'montant' },
  { cle: 'mouvementCredit', largeur: 16, genre: 'montant', filetDroit: true },
  { cle: 'soldeDebit', largeur: 16, genre: 'montant' },
  { cle: 'soldeCredit', largeur: 16, genre: 'montant', filetDroit: true },
];

/** La veille du début de période, en toutes lettres de date · « Mouvements au 31/12/25 ». */
export function libelleAvantPeriode(debut: Date): string {
  const veille = new Date(debut.getTime() - 24 * 60 * 60 * 1000);
  const jj = String(veille.getUTCDate()).padStart(2, '0');
  const mm = String(veille.getUTCMonth() + 1).padStart(2, '0');
  const aa = String(veille.getUTCFullYear() % 100).padStart(2, '0');
  return `Mouvements au ${jj}/${mm}/${aa}`;
}

export function entetesBalanceFpm(debut: Date, libelleNumero: string, libelleIntitule: string): EnteteFpm[] {
  return [
    { colonne: 1, ligne: 0, texte: libelleNumero, surDeuxLignes: true },
    { colonne: 2, ligne: 0, texte: libelleIntitule, surDeuxLignes: true },
    { colonne: 3, ligne: 0, texte: libelleAvantPeriode(debut), jusquA: 4 },
    { colonne: 5, ligne: 0, texte: 'Mouvements', jusquA: 6 },
    { colonne: 7, ligne: 0, texte: 'Soldes cumulés', jusquA: 8 },
    { colonne: 3, ligne: 1, texte: 'Débit' },
    { colonne: 4, ligne: 1, texte: 'Crédit' },
    { colonne: 5, ligne: 1, texte: 'Débit' },
    { colonne: 6, ligne: 1, texte: 'Crédit' },
    { colonne: 7, ligne: 1, texte: 'Débit' },
    { colonne: 8, ligne: 1, texte: 'Crédit' },
  ];
}
