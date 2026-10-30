import * as ExcelJS from 'exceljs';
import { FORMAT_MONTANT_FPM, FOND_ENTETE_FPM, montantFpm, tirageAKinshasa } from '../exports/presentation-fpm';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import { RESERVE_FICHE_INDIVIDUELLE, type FicheIndividuelle, type TotauxFiche } from './fiche-individuelle';

/**
 * LIGNE PAIE-SUITE, FONCTION 89 · LA FICHE INDIVIDUELLE EN EXCEL · deux
 * feuilles, la fiche (mois par mois) et les cumuls par rubrique, dans la
 * présentation des éditions du cabinet (Arial 9, en-têtes pleins, montants au
 * format FPM, un zéro en cellule vide). Les montants sont ceux du moteur
 * (`fiche-individuelle.ts`) · rien ne se recalcule ici, et le TOTAL de chaque
 * feuille est une valeur, jamais une formule qu'une ligne insérée fausserait.
 */
const POLICE = { name: 'Arial', size: 9 } as const;
const ENTETE: Partial<ExcelJS.Style> = {
  font: { ...POLICE, bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: FOND_ENTETE_FPM } },
  alignment: { vertical: 'middle', wrapText: true },
};

const COLONNES_TOTAUX: { cle: keyof TotauxFiche; titre: string }[] = [
  { cle: 'brut', titre: 'Total versé' },
  { cle: 'assietteSociale', titre: 'Assiette sociale' },
  { cle: 'cotisationsTravailleur', titre: 'Cotisations du travailleur' },
  { cle: 'cotisationsEmployeur', titre: "Cotisations de l'employeur" },
  { cle: 'irpp', titre: 'Retenue IRPP' },
  { cle: 'retenuesAvances', titre: "Retenues d'avance" },
  { cle: 'net', titre: 'Net à payer' },
];

function cartouche(f: ExcelJS.Worksheet, lignes: string[]) {
  lignes.forEach((t, i) => {
    const c = f.getCell(i + 1, 1);
    c.value = t;
    c.font = { ...POLICE, bold: i === 0 };
  });
}

export async function classeurFicheIndividuelle(
  fiche: FicheIndividuelle,
  identite: { entite: string; nif: string | null; salarie: string; matricule: string | null },
  maintenant: Date = new Date(),
): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  const entete = [
    identite.entite + (identite.nif ? ` · NIF ${identite.nif}` : ''),
    `Fiche individuelle de paie · ${identite.salarie}${identite.matricule ? ` (matricule ${identite.matricule})` : ''}`,
    `Année ${fiche.annee} · montants en ${MONNAIE_DE_TENUE} · tiré le ${tirageAKinshasa(maintenant)}`,
    RESERVE_FICHE_INDIVIDUELLE,
  ];

  // ---- Feuille 1 · mois par mois --------------------------------------
  const f1 = classeur.addWorksheet('Fiche', { properties: { defaultRowHeight: 12 } });
  cartouche(f1, entete);
  const l0 = entete.length + 2;
  const titres = ['Mois de paie', 'Bulletins', ...COLONNES_TOTAUX.map((c) => c.titre)];
  titres.forEach((t, i) => Object.assign(f1.getCell(l0, i + 1), { value: t, style: ENTETE }));
  f1.getColumn(1).width = 13;
  f1.getColumn(2).width = 22;
  for (let i = 0; i < COLONNES_TOTAUX.length; i++) {
    f1.getColumn(i + 3).width = 16;
    f1.getColumn(i + 3).numFmt = FORMAT_MONTANT_FPM;
  }
  let l = l0 + 1;
  for (const m of fiche.mois) {
    const r = f1.getRow(l++);
    r.values = [m.mois, m.bulletins.map((b) => `n° ${b.numero}${b.nature === 'DECOMPTE_FINAL' ? ' (décompte final)' : ''}`).join(', '), ...COLONNES_TOTAUX.map((c) => montantFpm(m.totaux[c.cle]))];
    r.font = { ...POLICE };
  }
  const total = f1.getRow(l++);
  total.values = ['Total de l’année', '', ...COLONNES_TOTAUX.map((c) => montantFpm(fiche.cumul[c.cle]))];
  total.font = { ...POLICE, bold: true };
  if (fiche.annules.length) {
    f1.getCell(++l, 1).value = `Bulletins annulés, hors cumul · ${fiche.annules.map((a) => `n° ${a.numero} (${a.moisDePaie})`).join(', ')}`;
    f1.getCell(l, 1).font = { ...POLICE };
  }

  // ---- Feuille 2 · cumuls par rubrique ---------------------------------
  const f2 = classeur.addWorksheet('Cumuls par rubrique', { properties: { defaultRowHeight: 12 } });
  cartouche(f2, entete);
  const mois = Array.from({ length: 12 }, (_, i) => `${fiche.annee}-${String(i + 1).padStart(2, '0')}`);
  const t2 = ['Rubrique', 'Nature', ...mois, 'Total'];
  t2.forEach((t, i) => Object.assign(f2.getCell(l0, i + 1), { value: t, style: ENTETE }));
  f2.getColumn(1).width = 34;
  f2.getColumn(2).width = 26;
  for (let i = 0; i < 13; i++) {
    f2.getColumn(i + 3).width = 13;
    f2.getColumn(i + 3).numFmt = FORMAT_MONTANT_FPM;
  }
  let k = l0 + 1;
  for (const r of fiche.rubriques) {
    const ligne = f2.getRow(k++);
    ligne.values = [r.code ? `${r.code} · ${r.libelle}` : r.libelle, r.nature, ...mois.map((m) => montantFpm(r.parMois[m] ?? 0)), montantFpm(r.total)];
    ligne.font = { ...POLICE };
  }
  if (fiche.illisibles.length) {
    f2.getCell(++k, 1).value = `Bulletins dont les éléments ne se relisent pas, hors des rubriques (leurs totaux restent à la fiche) · n° ${fiche.illisibles.join(', ')}`;
    f2.getCell(k, 1).font = { ...POLICE };
  }
  return Buffer.from(await classeur.xlsx.writeBuffer());
}
