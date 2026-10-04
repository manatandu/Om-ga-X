import * as ExcelJS from 'exceljs';
import { LIGNE_ENTETE_FPM } from './presentation-fpm';
import { NOM_BALANCE, NOM_BALANCE_N1 } from './theme-etafi';

/**
 * RELECTURE DES FORMULES QUI VISENT LES BALANCES DE LA LIASSE · outil des
 * tests (`liasse-etafi.spec.ts`, `liasse-syscohada.spec.ts`), sans usage en
 * production, et nommé comme tel par `fichiers-sans-appelant.spec.ts`.
 *
 * Les feuilles BALANCE N et BALANCE N-1 ont pris la présentation FPM
 * (décision de Manasse du 2026-10-04) · cartouche, deux lignes d'en-tête,
 * totaux en bas. Toute formule d'une autre feuille qui les lisait par position
 * (« C2:C… », comptes dès la ligne 2) serait tombée sur le cartouche ou sur
 * une ligne de total SANS AUCUNE ERREUR · Excel additionne ce qu'on lui
 * donne, et un contrôle d'équilibre sur des cellules vides répond
 * « Equilibre ». Le classeur produit est donc RELU · chaque plage citée doit
 * viser des lignes de COMPTE, dans la colonne dont l'en-tête dit ce que la
 * formule prétend lire, et son résultat se recalcule ici.
 */

const FEUILLES_BALANCE = [NOM_BALANCE, NOM_BALANCE_N1];

/** Ce que l'en-tête d'une colonne de balance FPM annonce. */
export interface EnteteColonne {
  groupe: string;
  sens: string;
}

/** L'en-tête qu'une formule PRÉTEND lire · un motif pour le groupe (la veille varie). */
export interface EnteteAttendu {
  groupe: RegExp;
  sens: 'Débit' | 'Crédit';
}

/** Une plage d'une feuille de balance, citée par une formule. */
export interface PlageCitee {
  feuilleSource: string;
  celluleSource: string;
  feuille: string;
  colonne: string;
  de: number;
  a: number;
}

/** La valeur numérique d'une cellule, résultat de formule compris (vide = 0). */
function valeurDe(cellule: ExcelJS.Cell): number {
  const v = cellule.value as unknown;
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'result' in v) return Number((v as { result: unknown }).result ?? 0);
  if (typeof v === 'object' && v !== null && 'formula' in v) {
    throw new Error(`Formule sans résultat joint · ${(v as { formula: string }).formula}`);
  }
  return Number(v);
}

function formuleDe(cellule: ExcelJS.Cell): string | null {
  const v = cellule.value as unknown;
  if (v && typeof v === 'object' && 'formula' in v) return String((v as { formula: string }).formula);
  return null;
}

/** L'en-tête FPM d'une colonne · le titre de groupe (ligne 8, fusionné) et le sens (ligne 9). */
export function enteteDeColonne(feuille: ExcelJS.Worksheet, colonne: string): EnteteColonne {
  const c = feuille.getColumn(colonne).number;
  // Le titre d'un groupe fusionné est porté par sa première colonne · C, E, G.
  const premiere = c >= 3 && c % 2 === 0 ? c - 1 : c;
  return {
    groupe: String(feuille.getCell(LIGNE_ENTETE_FPM, premiere).value ?? ''),
    sens: String(feuille.getCell(LIGNE_ENTETE_FPM + 1, c).value ?? ''),
  };
}

/** Une ligne de COMPTE · un numéro en colonne A (les totaux n'en ont pas). */
export function estLigneDeCompte(feuille: ExcelJS.Worksheet, rang: number): boolean {
  if (rang <= LIGNE_ENTETE_FPM + 1) return false;
  const a = feuille.getCell(rang, 1).value;
  return typeof a === 'string' && /^\d+$/.test(a.trim());
}

/** Toutes les plages de BALANCE N ou BALANCE N-1 citées par une formule du classeur. */
export function plagesCitees(wb: ExcelJS.Workbook): PlageCitee[] {
  const plages: PlageCitee[] = [];
  const motif = /'(BALANCE N(?:-1)?)'!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?/g;
  wb.eachSheet((ws) => {
    if (FEUILLES_BALANCE.includes(ws.name)) return;
    ws.eachRow((row) =>
      row.eachCell((cellule) => {
        const f = formuleDe(cellule);
        if (!f) return;
        for (const m of f.matchAll(motif)) {
          if (m[4] && m[4] !== m[2]) throw new Error(`Plage sur deux colonnes · ${ws.name}!${cellule.address} · ${f}`);
          plages.push({
            feuilleSource: ws.name,
            celluleSource: cellule.address,
            feuille: m[1],
            colonne: m[2],
            de: Number(m[3]),
            a: Number(m[5] ?? m[3]),
          });
        }
      }),
    );
  });
  return plages;
}

/**
 * Ce qui ne va pas dans une plage · elle doit couvrir EXACTEMENT les lignes de
 * compte de sa feuille (ni l'en-tête, ni un total, ni un compte oublié), et
 * l'en-tête de sa colonne doit être celui qu'on attend.
 */
export function defautsDePlage(wb: ExcelJS.Workbook, p: PlageCitee, attendu: EnteteAttendu): string[] {
  const ws = wb.getWorksheet(p.feuille);
  if (!ws) return [`${p.feuilleSource}!${p.celluleSource} · feuille ${p.feuille} absente`];
  const defauts: string[] = [];
  const ou = `${p.feuilleSource}!${p.celluleSource} → ${p.feuille}!${p.colonne}${p.de}:${p.colonne}${p.a}`;
  const comptes: number[] = [];
  ws.eachRow((_row, r) => {
    if (estLigneDeCompte(ws, r)) comptes.push(r);
  });
  for (let r = p.de; r <= p.a; r++) {
    if (!estLigneDeCompte(ws, r)) defauts.push(`${ou} · la ligne ${r} n'est pas une ligne de compte`);
  }
  const manquants = comptes.filter((r) => r < p.de || r > p.a);
  if (manquants.length) defauts.push(`${ou} · comptes hors de la plage, lignes ${manquants.join(', ')}`);
  const vues = enteteDeColonne(ws, p.colonne);
  if (!attendu.groupe.test(vues.groupe) || vues.sens !== attendu.sens) {
    defauts.push(`${ou} · en-tête « ${vues.groupe} / ${vues.sens} », attendu « ${attendu.groupe} / ${attendu.sens} »`);
  }
  // Une colonne SANS MONTANT (aucun mouvement en N-1) est permise · le zéro y
  // est une cellule vide par convention. La plage n'en vise pas moins les
  // lignes de compte, et le test confronte sa somme à celle refaite à la main.
  return defauts;
}

/** Recalcule une formule `SUM('feuille'!X10:X20)` (ou `0`) sur le classeur. */
export function evaluerSomme(wb: ExcelJS.Workbook, formule: string): number {
  if (formule.trim() === '0') return 0;
  const m = /^SUM\('([^']+)'!([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/.exec(formule.trim());
  if (!m) throw new Error(`Formule non relue · ${formule}`);
  const ws = wb.getWorksheet(m[1]);
  if (!ws) throw new Error(`Feuille absente · ${m[1]}`);
  let total = 0;
  for (let r = Number(m[3]); r <= Number(m[5]); r++) total += valeurDe(ws.getCell(`${m[2]}${r}`));
  return Math.round(total * 100) / 100;
}

/** Un verdict de CONTROLE BALANCE, recalculé comme Excel le rendrait. */
export interface VerdictControle {
  bloc: string;
  colonnes: [string, string];
  sommes: [number, number];
  verdict: string;
}

/**
 * Recalcule chaque verdict de CONTROLE BALANCE · la somme de chaque colonne
 * depuis la feuille de balance, puis la formule `IF(ROUND(a-b,0)=0,
 * "Equilibre","Déséquilibre : écart de "&TEXT(a-b,"#,##0"))` relue sur ses
 * cellules (jamais supposée).
 */
export function verdictsControleBalance(wb: ExcelJS.Workbook): VerdictControle[] {
  const ws = wb.getWorksheet('CONTROLE BALANCE');
  if (!ws) throw new Error('Feuille CONTROLE BALANCE absente');
  const verdicts: VerdictControle[] = [];
  for (const r0 of [2, 5]) {
    const bloc = ws.getCell(r0, 1).value;
    if (typeof bloc !== 'string' || !bloc) continue;
    for (const [c1, c2] of [
      [2, 3],
      [4, 5],
      [6, 7],
    ]) {
      const f = formuleDe(ws.getCell(r0 + 2, c1)) ?? '';
      const m = /^IF\(ROUND\(([A-Z])(\d+)-([A-Z])(\d+),0\)=0,"Equilibre","Déséquilibre : écart de "&TEXT\(\1\2-\3\4,"#,##0"\)\)$/.exec(f);
      if (!m) throw new Error(`Verdict non relu · ${bloc} colonne ${c1} · ${f}`);
      const somme = (lettre: string, rang: string) => evaluerSomme(wb, formuleDe(ws.getCell(`${lettre}${rang}`)) ?? '');
      const a = somme(m[1], m[2]);
      const b = somme(m[3], m[4]);
      const ecart = Math.round((a - b) * 100) / 100;
      verdicts.push({
        bloc,
        colonnes: [String(ws.getCell(r0, c1).value), String(ws.getCell(r0, c2).value)],
        sommes: [a, b],
        verdict:
          Math.round(ecart) === 0
            ? 'Equilibre'
            : `Déséquilibre : écart de ${Math.round(ecart).toLocaleString('en-US')}`,
      });
    }
  }
  return verdicts;
}

/**
 * L'en-tête que la cellule source PRÉTEND lire, d'après son propre libellé ·
 * l'intitulé de colonne de CONTROLE BALANCE, ou le libellé de ligne de
 * CONTROLES. Un libellé inconnu est une erreur · une formule nouvelle sur les
 * balances doit dire ce qu'elle lit pour être relue.
 */
export function enteteAttenduDe(wb: ExcelJS.Workbook, p: PlageCitee): EnteteAttendu {
  const ws = wb.getWorksheet(p.feuilleSource)!;
  const source = ws.getCell(p.celluleSource);
  const sens = (t: string): 'Débit' | 'Crédit' => (/cr[ée]dit/i.test(t) ? 'Crédit' : 'Débit');
  if (p.feuilleSource === 'CONTROLE BALANCE') {
    const titre = String(ws.getCell(Number(source.row) - 1, Number(source.col)).value ?? '');
    if (/^Mouvements bruts avant la période /.test(titre)) return { groupe: /^Mouvements au \d\d\/\d\d\/\d\d$/, sens: sens(titre) };
    if (/^Mouvements (Débit|Crédit)$/.test(titre)) return { groupe: /^Mouvements$/, sens: sens(titre) };
    if (/^Soldes cumulés /.test(titre)) return { groupe: /^Soldes cumulés$/, sens: sens(titre) };
    throw new Error(`Intitulé de CONTROLE BALANCE non relu · ${titre}`);
  }
  const libelle = String(ws.getCell(Number(source.row), 1).value ?? '');
  if (/solde de clôture/i.test(libelle)) return { groupe: /^Soldes cumulés$/, sens: sens(libelle) };
  throw new Error(`Libellé non relu · ${p.feuilleSource}!${p.celluleSource} · ${libelle}`);
}

/** Tous les défauts des formules qui visent les balances de la liasse. */
export function defautsDesFormulesDeBalance(wb: ExcelJS.Workbook): { plages: PlageCitee[]; defauts: string[] } {
  const plages = plagesCitees(wb);
  return { plages, defauts: plages.flatMap((p) => defautsDePlage(wb, p, enteteAttenduDe(wb, p))) };
}

/** Une ligne de balance du serveur, telle que les doublures des tests la rendent. */
export interface LigneServeur {
  reportDebit: number;
  reportCredit: number;
  mouvementDebit: number;
  mouvementCredit: number;
  solde: number;
}

/** La somme qu'une colonne de balance FPM doit rendre, recalculée à la main sur les lignes du serveur. */
export function sommeAttendue(lignes: readonly LigneServeur[], colonne: string): number {
  const f: Record<string, (l: LigneServeur) => number> = {
    C: (l) => l.reportDebit,
    D: (l) => l.reportCredit,
    E: (l) => l.mouvementDebit,
    F: (l) => l.mouvementCredit,
    G: (l) => Math.max(l.solde, 0),
    H: (l) => Math.max(-l.solde, 0),
  };
  if (!f[colonne]) throw new Error(`Colonne ${colonne} sans montant`);
  return Math.round(lignes.reduce((t, l) => t + f[colonne](l), 0) * 100) / 100;
}

/**
 * UNE FEUILLE DE BALANCE DE LA LIASSE DANS LA PRÉSENTATION FPM · en-têtes sur
 * fond 4F81BD en Arial, la colonne « Mouvements au <veille> » de SA période,
 * un compte par ligne dans l'ordre des numéros, l'identité « avant +
 * mouvements = solde cumulé » ligne à ligne, un solde NET dans une seule
 * colonne, et les trois totaux. Rend la liste des écarts, vide si tout tient.
 */
export function defautsDeFeuilleBalance(
  wb: ExcelJS.Workbook,
  nom: string,
  numerosAttendus: readonly string[],
  avant: string,
  fondEntete: string,
): string[] {
  const bal = wb.getWorksheet(nom);
  if (!bal) return [`feuille ${nom} absente`];
  const defauts: string[] = [];
  const attendu = (cellule: string, valeur: string) => {
    const v = String(bal.getCell(cellule).value ?? '');
    if (v !== valeur) defauts.push(`${nom}!${cellule} · « ${v} », attendu « ${valeur} »`);
  };
  attendu(`C${LIGNE_ENTETE_FPM}`, avant);
  attendu(`E${LIGNE_ENTETE_FPM}`, 'Mouvements');
  attendu(`G${LIGNE_ENTETE_FPM}`, 'Soldes cumulés');
  const fond = (bal.getCell(LIGNE_ENTETE_FPM, 1).fill as { fgColor?: { argb?: string } } | undefined)?.fgColor?.argb;
  if (fond !== fondEntete) defauts.push(`${nom} · fond d'en-tête ${fond}`);
  if (bal.getCell(LIGNE_ENTETE_FPM, 1).font?.name !== 'Arial') defauts.push(`${nom} · police d'en-tête`);
  const rangs: number[] = [];
  bal.eachRow((_row, r) => {
    if (estLigneDeCompte(bal, r)) rangs.push(r);
  });
  const numeros = rangs.map((r) => String(bal.getCell(r, 1).value));
  const tries = [...numerosAttendus].sort();
  if (numeros.join() !== tries.join()) defauts.push(`${nom} · comptes ${numeros.join(', ')}, attendus ${tries.join(', ')}`);
  for (const r of rangs) {
    const v = (c: number) => valeurDe(bal.getCell(r, c));
    if (Math.abs(v(3) - v(4) + v(5) - v(6) - (v(7) - v(8))) > 0.005) defauts.push(`${nom} · ligne ${r} ne boucle pas`);
    if (v(7) !== 0 && v(8) !== 0) defauts.push(`${nom} · ligne ${r} porte un solde dans les deux colonnes`);
  }
  const libelles = new Set<string>();
  bal.eachRow((row) => libelles.add(String(row.getCell(2).value ?? '')));
  for (const t of ['Totaux comptes de bilan', 'Totaux comptes de gestion', 'Totaux de la balance']) {
    if (!libelles.has(t)) defauts.push(`${nom} · ligne « ${t} » absente`);
  }
  return defauts;
}
