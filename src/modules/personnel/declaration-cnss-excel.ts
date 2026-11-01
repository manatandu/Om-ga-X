import * as ExcelJS from 'exceljs';
import { FORMAT_MONTANT_FPM, FOND_ENTETE_FPM, montantFpm, tirageAKinshasa } from '../exports/presentation-fpm';
import { MONNAIE_DE_TENUE } from '../../common/monnaie-de-tenue';
import type { DeclarationCnss } from './declaration-cnss';

/**
 * LA DÉCLARATION CNSS PRÉPARÉE, EN EXCEL · trois feuilles · les énonciations
 * de l'art. 23 (et les branches du point 7), les bulletins du mois (ce que la
 * feuille de paie jointe doit recenser, art. 24 et 25), les manques et
 * réserves. Les montants sont ceux du moteur (`declaration-cnss.ts`), lus sur
 * les bulletins figés · rien ne se recalcule ici, et un total est une VALEUR,
 * jamais une formule qu'une ligne insérée fausserait. Un montant non chiffré
 * reste une cellule VIDE avec son motif à côté, jamais un zéro.
 */
const POLICE = { name: 'Arial', size: 9 } as const;
const ENTETE: Partial<ExcelJS.Style> = {
  font: { ...POLICE, bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: FOND_ENTETE_FPM } },
  alignment: { vertical: 'middle', wrapText: true },
};

function cartouche(f: ExcelJS.Worksheet, lignes: string[]) {
  lignes.forEach((t, i) => {
    const c = f.getCell(i + 1, 1);
    c.value = t;
    c.font = { ...POLICE, bold: i === 0 };
  });
}

function entetes(f: ExcelJS.Worksheet, ligne: number, titres: string[]) {
  titres.forEach((t, i) => Object.assign(f.getCell(ligne, i + 1), { value: t, style: ENTETE }));
}

function montant(c: ExcelJS.Cell, v: number | null) {
  c.value = v === null ? null : montantFpm(v);
  c.numFmt = FORMAT_MONTANT_FPM;
  c.font = POLICE;
}

export async function classeurDeclarationCnss(d: DeclarationCnss, maintenant: Date = new Date()): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  const nom = String(d.enonciations[0]?.valeur ?? '');
  const entete = [
    nom,
    `Déclaration des cotisations sociales · ${d.mois} · état de préparation`,
    `Montants en ${MONNAIE_DE_TENUE} · tiré le ${tirageAKinshasa(maintenant)}`,
    d.reserve,
  ];

  // ---- Feuille 1 · les énonciations de l'art. 23 --------------------------
  const f1 = classeur.addWorksheet('Déclaration');
  cartouche(f1, entete);
  let l = entete.length + 2;
  entetes(f1, l, ['Point', 'Énonciation (arrêté n° 146/2018, art. 23)', 'Valeur', 'Manque']);
  f1.getColumn(1).width = 7;
  f1.getColumn(2).width = 60;
  f1.getColumn(3).width = 24;
  f1.getColumn(4).width = 60;
  for (const e of d.enonciations) {
    l++;
    f1.getCell(l, 1).value = e.rang;
    f1.getCell(l, 2).value = e.libelle;
    if (typeof e.valeur === 'number' && e.rang >= 5 && e.rang <= 7) montant(f1.getCell(l, 3), e.valeur);
    else f1.getCell(l, 3).value = e.valeur;
    f1.getCell(l, 4).value = e.manque;
    for (let k = 1; k <= 4; k++) f1.getCell(l, k).font = POLICE;
  }
  l += 2;
  entetes(f1, l, ['', 'Point 7 · par branche', 'Montant', 'Charge et source']);
  for (const b of d.branches) {
    l++;
    f1.getCell(l, 2).value = b.libelle;
    montant(f1.getCell(l, 3), b.montantFc);
    f1.getCell(l, 4).value = `${b.charge === 'TRAVAILLEUR' ? 'Travailleur' : 'Employeur'} · ${b.article}`;
    f1.getCell(l, 2).font = POLICE;
    f1.getCell(l, 4).font = POLICE;
  }
  l++;
  f1.getCell(l, 2).value = 'Total des cotisations dues';
  f1.getCell(l, 2).font = { ...POLICE, bold: true };
  montant(f1.getCell(l, 3), d.totalCotisationsFc);
  l += 2;
  f1.getCell(l, 2).value = `Date limite de dépôt et de versement · ${d.echeance.dateLimite} (régularisation au plus tard le ${d.echeance.regularisationAvant})`;
  f1.getCell(l + 1, 2).value = d.echeance.fondement;
  f1.getCell(l, 2).font = POLICE;
  f1.getCell(l + 1, 2).font = POLICE;

  // ---- Feuille 2 · les bulletins du mois ----------------------------------
  const f2 = classeur.addWorksheet('Bulletins');
  cartouche(f2, entete);
  const l0 = entete.length + 2;
  const titres = [
    'Bulletin',
    'Nature',
    'Travailleur',
    'Matricule',
    "N° d'immatriculation",
    'Emploi',
    'Catégorie',
    'Total versé',
    'Base de la CNSS',
    'Prestations aux familles',
    'Pensions, employeur',
    'Pensions, travailleur',
    'Risques professionnels',
    'Enfants bénéficiaires',
  ];
  entetes(f2, l0, titres);
  [10, 14, 28, 12, 18, 18, 12, 14, 14, 14, 14, 14, 14, 12].forEach((w, i) => (f2.getColumn(i + 1).width = w));
  let r = l0;
  for (const b of d.bulletins) {
    r++;
    const v = [b.numero, b.nature === 'DECOMPTE_FINAL' ? 'Décompte final' : 'Bulletin du mois', b.nomComplet, b.matricule, b.numeroImmatriculation, b.emploi, b.categorieProfessionnelle];
    v.forEach((x, i) => Object.assign(f2.getCell(r, i + 1), { value: x ?? null, font: POLICE }));
    montant(f2.getCell(r, 8), b.totalVerseFc);
    montant(f2.getCell(r, 9), b.baseCnssFc);
    montant(f2.getCell(r, 10), b.parBranche['cnss-pf']);
    montant(f2.getCell(r, 11), b.parBranche['cnss-pension-employeur']);
    montant(f2.getCell(r, 12), b.parBranche['cnss-pension-travailleur']);
    montant(f2.getCell(r, 13), b.parBranche['cnss-rp']);
    Object.assign(f2.getCell(r, 14), { value: b.enfantsBeneficiaires, font: POLICE });
  }

  // ---- Feuille 3 · manques et réserves ------------------------------------
  const f3 = classeur.addWorksheet('Manques et réserves');
  cartouche(f3, entete);
  f3.getColumn(1).width = 140;
  let m = entete.length + 2;
  entetes(f3, m, ['Ce que le registre ne tient pas, ou qui ne se lit pas']);
  for (const t of d.manques.length ? d.manques : ['Aucun manque relevé.']) {
    m++;
    Object.assign(f3.getCell(m, 1), { value: t, font: POLICE });
  }
  m += 2;
  entetes(f3, m, ['Réserves']);
  for (const t of d.reserves) {
    m++;
    Object.assign(f3.getCell(m, 1), { value: t, font: POLICE });
  }

  return Buffer.from(await classeur.xlsx.writeBuffer());
}
