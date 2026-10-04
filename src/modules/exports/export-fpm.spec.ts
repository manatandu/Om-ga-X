import 'reflect-metadata';
import { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import * as JSZip from 'jszip';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ClasseCompte } from '@prisma/client';
import { ExportFpmService, familleOuRefus } from './export-fpm.service';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { FORMAT_MONTANT_FPM, FORMAT_DATE_FPM, formuleLien, libelleAvantPeriode, nomsDeFeuilles } from './presentation-fpm';

/**
 * LA PRÉSENTATION FPM, RELUE DANS LE CLASSEUR PRODUIT (CLAUDE.md § 10 · un
 * test d'export relit le fichier plutôt que d'affirmer qu'il est juste).
 *
 * Le jeu d'essai est un dossier SYCEBNL de l'exercice 2026, à-nouveau compris ·
 * dotation, un fournisseur rattaché dont le règlement est au brouillard, la
 * banque, un achat, une contribution volontaire en nature (classe 9) et deux
 * comptes 47 du même collectif, l'un rattaché à un tiers, l'autre non.
 */

const EXERCICE = { id: 'ex', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') };
const TENANT = { id: 't1', nom: 'Association Essai', numeroImpot: 'A1', devise: null, referentiel: 'SYCEBNL' };

type C = { id: string; numero: string; intitule: string; classe: ClasseCompte };
const COMPTES: Record<string, C> = {
  c101: { id: 'c101', numero: '10100000', intitule: 'Dotation', classe: ClasseCompte.CLASSE_1 },
  c401: { id: 'c401', numero: '40110001', intitule: 'Fournisseur', classe: ClasseCompte.CLASSE_4 },
  c4711: { id: 'c4711', numero: '47110001', intitule: 'Débiteur divers', classe: ClasseCompte.CLASSE_4 },
  c4712: { id: 'c4712', numero: '47120000', intitule: 'Créditeurs divers', classe: ClasseCompte.CLASSE_4 },
  c521: { id: 'c521', numero: '52110000', intitule: 'Banque', classe: ClasseCompte.CLASSE_5 },
  c601: { id: 'c601', numero: '60110000', intitule: 'Achats', classe: ClasseCompte.CLASSE_6 },
  c900: { id: 'c900', numero: '90010000', intitule: 'Emploi en travail', classe: ClasseCompte.CLASSE_9 },
  c910: { id: 'c910', numero: '91010000', intitule: 'Bénévolat', classe: ClasseCompte.CLASSE_9 },
};
/** Les en-têtes du plan · intitulés que les lignes de total doivent LIRE. */
const PLAN = [
  { numero: '401', intitule: 'Fournisseurs, dettes en compte' },
  { numero: '471', intitule: 'Débiteurs et créditeurs divers' },
  { numero: '90', intitule: 'Emplois des contributions volontaires en nature' },
  { numero: '91', intitule: 'Contributions volontaires en nature' },
];

const AN = { date: new Date('2026-01-01T00:00:00Z'), numeroPiece: 1, libelle: 'À-nouveau', statut: 'VALIDEE', journal: { code: 'AN' } };
const ACHAT = { date: new Date('2026-02-03T00:00:00Z'), numeroPiece: 7, libelle: 'Facture REGIDESO', statut: 'VALIDEE', journal: { code: 'AC' } };
const REGLEMENT = { date: new Date('2026-03-04T00:00:00Z'), numeroPiece: 2, libelle: 'Règlement', statut: 'BROUILLARD', journal: { code: 'BQ' } };
const CVN = { date: new Date('2026-04-05T00:00:00Z'), numeroPiece: 3, libelle: 'Bénévolat', statut: 'VALIDEE', journal: { code: 'OD' } };
const DIVERS = { date: new Date('2026-05-06T00:00:00Z'), numeroPiece: 4, libelle: 'Divers', statut: 'VALIDEE', journal: { code: 'OD' } };

const ligne = (id: string, compte: keyof typeof COMPTES, debit: number, credit: number, ecriture: object, lettre: string | null = null) => ({
  id,
  compteId: compte,
  debit,
  credit,
  lettre,
  libelle: null,
  compte: COMPTES[compte],
  ecriture,
});

/** Dans l'ordre que la requête demande · numéro, date, à-nouveau en tête. */
const LIGNES = [
  ligne('l1', 'c101', 0, 1000, AN),
  ligne('l3', 'c401', 0, 500, ACHAT, 'A'),
  ligne('l5', 'c401', 300, 0, REGLEMENT),
  ligne('l9', 'c4711', 100, 0, DIVERS),
  ligne('l10', 'c4712', 0, 100, DIVERS),
  ligne('l2', 'c521', 1000, 0, AN),
  ligne('l6', 'c521', 0, 300, REGLEMENT),
  ligne('l4', 'c601', 500, 0, ACHAT),
  ligne('l7', 'c900', 50, 0, CVN),
  ligne('l8', 'c910', 0, 50, CVN),
];

/** La balance du dépôt, telle que `EcritureService.balance` la rendrait sur ces lignes. */
function balance() {
  const parCompte = new Map<string, { rD: number; rC: number; mD: number; mC: number }>();
  for (const l of LIGNES) {
    const a = parCompte.get(l.compteId) ?? { rD: 0, rC: 0, mD: 0, mC: 0 };
    if (l.ecriture === AN) {
      a.rD += l.debit;
      a.rC += l.credit;
    } else {
      a.mD += l.debit;
      a.mC += l.credit;
    }
    parCompte.set(l.compteId, a);
  }
  return Object.values(COMPTES)
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .map((c) => {
      const a = parCompte.get(c.id)!;
      return {
        compteId: c.id,
        numero: c.numero,
        intitule: c.intitule,
        classe: c.classe,
        typeCompte: 'DETAIL',
        reportDebit: a.rD,
        reportCredit: a.rC,
        mouvementDebit: a.mD,
        mouvementCredit: a.mC,
        clotureDebit: 0,
        clotureCredit: 0,
        totalDebit: a.rD + a.mD,
        totalCredit: a.rC + a.mC,
        solde: a.rD + a.mD - a.rC - a.mC,
      };
    });
}

function service(options: { compte?: number } = {}) {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
    exercice: { findFirst: jest.fn(async ({ where }: any) => (where.id === 'ex' && where.tenantId === 't1' ? EXERCICE : null)) },
    ligneEcriture: {
      // La doublure HONORE la requête · borne du dossier, filtre de comptes,
      // curseur, `skip` et taille de lot (CLAUDE.md, passe F4b).
      count: jest.fn(async ({ where }: any) =>
        options.compte ?? LIGNES.filter((l) => !where.compteId || where.compteId.in.includes(l.compteId)).length,
      ),
      findMany: jest.fn(async ({ where, take, cursor, skip }: any) => {
        expect(where.ecriture).toEqual({ tenantId: 't1', exerciceId: 'ex' });
        const filtrees = LIGNES.filter((l) => !where.compteId || where.compteId.in.includes(l.compteId));
        const depart = cursor ? filtrees.findIndex((l) => l.id === cursor.id) + (skip ?? 0) : 0;
        return filtrees.slice(depart, depart + take);
      }),
    },
    compte: {
      findMany: jest.fn(async ({ where }: any) =>
        where.tenantId === 't1' ? PLAN.filter((p) => where.numero.in.includes(p.numero)) : [],
      ),
    },
    tiersCompte: {
      findMany: jest.fn().mockResolvedValue([
        { compteId: 'c401', tiers: { code: 'F1', nom: 'REGIDESO' } },
        { compteId: 'c4711', tiers: { code: 'D1', nom: 'Jean Débiteur' } },
      ]),
    },
  };
  const ecriture = { balance: jest.fn(async () => ({ lignes: balance() })) } as unknown as EcritureService;
  const p = prisma as unknown as PrismaService;
  const vide = {} as never;
  const exports = new ExportService(p, ecriture, vide, vide, vide, vide, vide, vide, vide, vide);
  return { fpm: new ExportFpmService(p, ecriture, exports), prisma };
}

/**
 * LES FORMATS TELS QU'ILS SONT ÉCRITS DANS LE FICHIER · le lecteur d'ExcelJS
 * retire les barres obliques inverses d'un `formatCode` (« dd\\/mm\\/yy » se
 * relit « dd/mm/yy »), si bien qu'une cellule relue ne prouve pas l'octet
 * écrit. On lit donc aussi `xl/styles.xml`.
 */
let dernierFichier: Buffer = Buffer.alloc(0);
async function formatsEcrits(): Promise<string[]> {
  const xml = await (await JSZip.loadAsync(dernierFichier)).file('xl/styles.xml')!.async('string');
  return [...xml.matchAll(/formatCode="([^"]*)"/g)].map((m) => m[1]);
}

async function lire(ecrire: (ouvrir: () => Writable) => Promise<unknown>): Promise<ExcelJS.Workbook> {
  const morceaux: Buffer[] = [];
  const sortie = new Writable({
    write(m, _e, cb) {
      morceaux.push(Buffer.from(m));
      cb();
    },
  });
  await ecrire(() => sortie);
  dernierFichier = Buffer.concat(morceaux);
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(dernierFichier as never);
  return classeur;
}

/** La ligne dont une cellule porte ce texte. */
function ligneDe(f: ExcelJS.Worksheet, texte: string): ExcelJS.Row {
  let trouvee: ExcelJS.Row | undefined;
  f.eachRow((r) => {
    r.eachCell((c) => {
      if (!trouvee && c.value === texte) trouvee = r;
    });
  });
  if (!trouvee) throw new Error(`Ligne « ${texte} » absente de la feuille ${f.name}`);
  return trouvee;
}

const formule = (v: ExcelJS.CellValue) => v as ExcelJS.CellFormulaValue;

describe('présentation FPM · les briques', () => {
  it('le format des montants est celui des modèles, espace insécable comprise', () => {
    expect(FORMAT_MONTANT_FPM).toBe('#\\\u00a0##0.00');
    expect(FORMAT_DATE_FPM).toBe('dd\\/mm\\/yy');
  });

  it('nomme une feuille par numéro, sans caractère interdit, sans doublon, hors des noms réservés', () => {
    expect(nomsDeFeuilles(['401/1', '401:1', 'balance', '52110000'], ['Balance'])).toEqual([
      '4011',
      '4011-2',
      'balance-2',
      '52110000',
    ]);
    expect(nomsDeFeuilles(['1'.repeat(40)], [])[0]).toHaveLength(31);
  });

  it('un lien interne est une formule HYPERLINK, le texte en résultat', () => {
    expect(formuleLien('401', 'A1', '401')).toEqual({ formula: `HYPERLINK("#'401'!A1","401")`, result: '401' });
  });

  it('la veille du début de période titre la première paire de colonnes', () => {
    expect(libelleAvantPeriode(EXERCICE.dateDebut)).toBe('Mouvements au 31/12/25');
  });
});

describe('balance des comptes · une feuille par compte, liée', () => {
  const produire = () => lire((ouvrir) => service().fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir));

  it('rend la feuille Balance puis une feuille par compte mouvementé, nommée par son numéro', async () => {
    const c = await produire();
    expect(c.worksheets.map((f) => f.name)).toEqual([
      'Balance',
      '10100000',
      '40110001',
      '47110001',
      '47120000',
      '52110000',
      '60110000',
      '90010000',
      '91010000',
    ]);
  });

  it('pose le cartouche du cabinet · entité, titre, période en dd/mm/yy, monnaie de TENUE', async () => {
    const f = (await produire()).getWorksheet('Balance')!;
    expect(f.getCell('A2').value).toBe('Association Essai');
    expect(f.getCell('A2').font).toMatchObject({ name: 'Arial', size: 9, bold: true });
    expect(f.getCell('D2').value).toBe('Balance des comptes');
    expect(f.getCell('D2').font).toMatchObject({ name: 'Arial', size: 18, bold: true });
    expect(f.getCell('G2').value).toBe('Période du');
    expect(f.getCell('H2').value).toEqual(EXERCICE.dateDebut);
    expect(f.getCell('H2').numFmt).toBe('dd/mm/yy');
    // Écrit avec ses barres d'échappement · relu ci-dessous dans le fichier.
    expect(await formatsEcrits()).toEqual(expect.arrayContaining(['dd\\/mm\\/yy', '#\\\u00a0##0.00']));
    expect((await formatsEcrits()).some((x) => x.includes('mm\\/dd'))).toBe(false);
    expect(f.getCell('H3').value).toEqual(EXERCICE.dateFin);
    expect(f.getCell('D4').value).toBe('Complète');
    // L'unité est celle de la tenue (`monnaieDuJeuLegal`), jamais le « $ » des modèles.
    expect(f.getCell('G4').value).toBe('Tenue de compte : CDF');
    expect(f.getCell('A5').border.bottom).toMatchObject({ style: 'thin' });
    expect(f.getCell('A6').value).toBe('OmegaX');
    expect(String(f.getCell('D6').value)).toMatch(/^Date de tirage \d\d\/\d\d\/\d\d à \d\d:\d\d:\d\d$/);
    expect(f.getCell('G6').value).toBe('Page :');
    expect(f.headerFooter.oddFooter).toContain('Page &P / &N');
  });

  it('pose les en-têtes sur fond plein, en blanc gras, et nomme la veille du début de période', async () => {
    const f = (await produire()).getWorksheet('Balance')!;
    expect(f.getCell('C8').value).toBe('Mouvements au 31/12/25');
    expect(f.getCell('E8').value).toBe('Mouvements');
    expect(f.getCell('G8').value).toBe('Soldes cumulés');
    expect(['C9', 'D9', 'E9', 'F9', 'G9', 'H9'].map((a) => f.getCell(a).value)).toEqual([
      'Débit', 'Crédit', 'Débit', 'Crédit', 'Débit', 'Crédit',
    ]);
    for (const a of ['A8', 'H9']) {
      expect(f.getCell(a).fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } });
      expect(f.getCell(a).font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    }
  });

  it('rend chaque montant au format exact, un zéro par une cellule VIDE, le solde net dans une seule colonne', async () => {
    const f = (await produire()).getWorksheet('Balance')!;
    const banque = ligneDe(f, 'Banque');
    expect(['C', 'D', 'E', 'F', 'G', 'H'].map((c) => banque.getCell(c).value)).toEqual([1000, null, null, 300, 700, null]);
    expect(banque.getCell('C').numFmt).toBe('#\u00a0##0.00');
    expect(banque.getCell('C').font).toMatchObject({ name: 'Arial', size: 9 });
    expect(banque.getCell('C').alignment).toMatchObject({ horizontal: 'right' });
    // Les filets verticaux entre les groupes, portés aussi par les cellules vides.
    expect(banque.getCell('D').border.right).toMatchObject({ style: 'thin' });
    expect(banque.getCell('A').border.left).toMatchObject({ style: 'thin' });
    expect(banque.getCell('C').border.top).toBeUndefined();
  });

  it('fait du numéro un lien vers la feuille du compte, et de la feuille un lien de retour vers SA ligne', async () => {
    const c = await produire();
    const f = c.getWorksheet('Balance')!;
    const fournisseur = ligneDe(f, 'Fournisseur');
    expect(formule(fournisseur.getCell('A').value).formula).toBe(`HYPERLINK("#'40110001'!A1","40110001")`);
    expect(fournisseur.getCell('A').font).toMatchObject({ underline: true, color: { argb: 'FF0000FF' } });
    const gl = c.getWorksheet('40110001')!;
    expect(formule(gl.getCell('A1').value).formula).toBe(`HYPERLINK("#'Balance'!A${fournisseur.number}","Retour à la balance")`);
    // Chaque lien mène à une feuille qui existe.
    f.eachRow((r, n) => {
      const v = r.getCell('A').value;
      if (n > 9 && v && typeof v === 'object' && 'formula' in v) {
        const cible = /#'([^']+)'!/.exec((v as ExcelJS.CellFormulaValue).formula)![1];
        expect(c.getWorksheet(cible)).toBeDefined();
      }
    });
  });

  it('totalise bilan, gestion et balance par formule, et sort la classe 9 sur sa propre ligne, nommée par le plan', async () => {
    const f = (await produire()).getWorksheet('Balance')!;
    const bilan = ligneDe(f, 'Totaux comptes de bilan');
    // Les classes 1 à 5 occupent les lignes 10 à 14.
    expect(formule(bilan.getCell('C').value)).toEqual({ formula: 'SUM(C10:C14)', result: 1000 });
    expect(formule(bilan.getCell('F').value)).toEqual({ formula: 'SUM(F10:F14)', result: 900 });
    // Solde net du bilan · 1 000 de dotation, 200 au fournisseur, 700 en banque
    // · créditeur de 500, que porte l'achat de la classe 6.
    expect(bilan.getCell('G').value).toBeNull();
    expect(formule(bilan.getCell('H').value)).toEqual({ formula: 'MAX(0,SUM(H10:H14)-(SUM(G10:G14)))', result: 500 });
    expect(bilan.getCell('C').border.top).toMatchObject({ style: 'thin' });
    expect(bilan.getCell('C').font).toMatchObject({ bold: true });
    const gestion = ligneDe(f, 'Totaux comptes de gestion');
    expect(formule(gestion.getCell('G').value).result).toBe(500);
    const total = ligneDe(f, 'Totaux de la balance');
    expect(formule(total.getCell('E').value)).toEqual({
      formula: `E${bilan.number}+E${gestion.number}`,
      result: 900,
    });
    expect(total.getCell('G').value).toBeNull();
    expect(total.getCell('H').value).toBeNull();
    // La classe 9 n'entre pas aux totaux de la balance · une ligne par division.
    expect(formule(ligneDe(f, 'Totaux Emplois des contributions volontaires en nature').getCell('E').value).result).toBe(50);
    expect(formule(ligneDe(f, 'Totaux Contributions volontaires en nature').getCell('F').value).result).toBe(50);
  });

  it('écrit dans chaque feuille le grand livre du compte, au solde progressif signé, dont le total rend la balance', async () => {
    const c = await produire();
    const gl = c.getWorksheet('40110001')!;
    expect(gl.getCell('D2').value).toBe('Grand-livre des comptes');
    expect(['A8', 'B8', 'C8', 'D8', 'E8', 'F8', 'G8', 'H8'].map((a) => gl.getCell(a).value)).toEqual([
      'Date', 'C.j', 'N° pièce', 'Libellé écriture', 'Lettr.', 'Mouvement débit', 'Mouvement crédit', 'Solde progressif',
    ]);
    expect(gl.getCell('A9').value).toBe('40110001');
    expect(gl.getCell('D9').value).toBe('Fournisseur');
    expect(gl.getCell('A9').font).toMatchObject({ bold: true });
    expect(gl.getCell('A10').value).toEqual(ACHAT.date);
    expect(gl.getCell('A10').numFmt).toBe('dd/mm/yy');
    expect(['B10', 'C10', 'D10', 'E10', 'F10', 'G10', 'H10'].map((a) => gl.getCell(a).value)).toEqual([
      'AC', '7', 'Facture REGIDESO', 'A', null, 500, -500,
    ]);
    // Le brouillard se dit sur sa ligne.
    expect(gl.getCell('D11').value).toBe('Règlement · brouillard');
    expect(gl.getCell('H11').value).toBe(-200);
    const total = ligneDe(gl, 'Total du compte');
    expect(['F', 'G', 'H'].map((x) => total.getCell(x).value)).toEqual([300, 500, -200]);
  });

  it('la feuille de la banque commence par l’à-nouveau tel que le report l’a posé', async () => {
    const gl = (await produire()).getWorksheet('52110000')!;
    expect(['B10', 'D10', 'F10', 'H10'].map((a) => gl.getCell(a).value)).toEqual(['AN', 'À-nouveau', 1000, 1000]);
  });

  it('balance seule · aucune feuille de compte, aucun lien', async () => {
    const c = await lire((ouvrir) => service().fpm.balanceGeneraleEnFlux('t1', 'ex', false, ouvrir));
    expect(c.worksheets.map((f) => f.name)).toEqual(['Balance']);
    expect(ligneDe(c.getWorksheet('Balance')!, 'Banque').getCell('A').value).toBe('52110000');
  });

  it('refuse AVANT le premier octet au-delà du plafond, lignes de balance comprises, en nommant le chemin de rechange', async () => {
    const { fpm } = service({ compte: 199_995 });
    const ouvrir = jest.fn();
    await expect(fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir)).rejects.toThrow(PayloadTooLargeException);
    await expect(fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir)).rejects.toThrow(/balance seule/);
    expect(ouvrir).not.toHaveBeenCalled();
    // Sans les grands livres, la balance seule passe.
    await lire((o) => fpm.balanceGeneraleEnFlux('t1', 'ex', false, o));
  });

  it('refuse un exercice d’un autre dossier, avant le flux', async () => {
    const ouvrir = jest.fn();
    await expect(service().fpm.balanceGeneraleEnFlux('t2', 'ex', true, ouvrir)).rejects.toThrow(/Exercice introuvable/);
    expect(ouvrir).not.toHaveBeenCalled();
  });
});

describe('balance des tiers · une famille, un sous-total par collectif, le contrôle', () => {
  it('fournisseurs · nom du tiers, « Total » et l’intitulé du plan, total général, aucun écart', async () => {
    const c = await lire((ouvrir) => service().fpm.balanceTiersEnFlux('t1', 'ex', 'FOURNISSEURS', true, ouvrir));
    expect(c.worksheets.map((f) => f.name)).toEqual(['Balance', '40110001']);
    const f = c.getWorksheet('Balance')!;
    expect(f.getCell('D2').value).toBe('Balance des tiers');
    expect(f.getCell('D4').value).toBe('Fournisseur');
    const tiers = ligneDe(f, 'REGIDESO');
    expect(formule(tiers.getCell('A').value).formula).toBe(`HYPERLINK("#'40110001'!A1","40110001")`);
    const sousTotal = ligneDe(f, 'Total Fournisseurs, dettes en compte');
    expect(formule(sousTotal.getCell('H').value).result).toBe(200);
    const general = ligneDe(f, 'Total général');
    expect(formule(general.getCell('H').value)).toEqual({
      formula: `MAX(0,H${sousTotal.number}-(G${sousTotal.number}))`,
      result: 200,
    });
    expect(ligneDe(f, 'Solde à la balance générale').getCell('H').value).toBe(200);
    expect(ligneDe(f, 'Écart : aucun').getCell('H').value).toBeNull();
    const gl = c.getWorksheet('40110001')!;
    expect(gl.getCell('D2').value).toBe('Grand-livre des tiers');
    expect(gl.getCell('D9').value).toBe('REGIDESO');
    expect(ligneDe(gl, 'Total du tiers').getCell('H').value).toBe(-200);
  });

  it('autres tiers · le compte du collectif sans tiers reste à la balance générale, et l’écart le DIT', async () => {
    const c = await lire((ouvrir) => service().fpm.balanceTiersEnFlux('t1', 'ex', 'AUTRES', true, ouvrir));
    const f = c.getWorksheet('Balance')!;
    expect(c.worksheets.map((x) => x.name)).toEqual(['Balance', '47110001']);
    expect(ligneDe(f, 'Total Débiteurs et créditeurs divers').getCell('A').value).toBeNull();
    const ecart = ligneDe(f, 'Écart avec la balance générale');
    expect(ecart.getCell('E').value).toBeNull();
    expect(ecart.getCell('F').value).toBe(-100);
    expect(ecart.getCell('G').value).toBe(100);
    expect(ecart.getCell('B').font).toMatchObject({ bold: true });
  });

  it('nomme les clients du SYCEBNL par leur sens dans ce plan', async () => {
    const c = await lire((ouvrir) => service().fpm.balanceTiersEnFlux('t1', 'ex', 'CLIENTS', false, ouvrir));
    expect(c.getWorksheet('Balance')!.getCell('D4').value).toBe('Adhérent et client-usager');
  });
});

describe('grands livres sur une feuille · blocs, totaux, contrôle', () => {
  it('grand livre des comptes · un bloc par compte, « Totaux », contrôle sans écart', async () => {
    const c = await lire((ouvrir) => service().fpm.grandLivreEnFlux('t1', 'ex', ouvrir));
    const f = c.worksheets[0];
    expect(f.getCell('D2').value).toBe('Grand-livre des comptes');
    expect(ligneDe(f, '10100000').getCell('D').value).toBe('Dotation');
    const totaux = ligneDe(f, 'Totaux');
    expect(['F', 'G', 'H'].map((x) => totaux.getCell(x).value)).toEqual([1950, 1950, null]);
    expect(['F', 'G'].map((x) => ligneDe(f, 'Solde à la balance générale').getCell(x).value)).toEqual([1950, 1950]);
    ligneDe(f, 'Écart : aucun');
  });

  it('grand-livre des tiers · « Total du tiers », et l’écart des collectifs DIT pour les autres tiers', async () => {
    const c = await lire((ouvrir) => service().fpm.grandLivreTiersEnFlux('t1', 'ex', 'AUTRES', ouvrir));
    const f = c.worksheets[0];
    expect(f.getCell('D2').value).toBe('Grand-livre des tiers');
    expect(f.getCell('D4').value).toBe('Autre');
    ligneDe(f, 'Total du tiers');
    const ecart = ligneDe(f, 'Écart (comptes des collectifs sans tiers rattaché)');
    expect(['F', 'G', 'H'].map((x) => ecart.getCell(x).value)).toEqual([null, -100, 100]);
  });
});

describe('les routes', () => {
  const res = () => {
    const r = { set: jest.fn(), destroy: jest.fn(), send: jest.fn() } as never;
    return r;
  };
  const user = { tenantId: 't1' } as never;

  it('le grand livre sort dans la présentation du cabinet PAR DÉFAUT, à plat sur demande, un format inconnu refusé', async () => {
    const exports = { grandLivreCompletExcelEnFlux: jest.fn().mockResolvedValue({ lignes: 0 }) };
    const fpm = { grandLivreEnFlux: jest.fn().mockResolvedValue({ lignes: 0 }) };
    const ctl = new ExportController(exports as never, fpm as never);
    await ctl.grandLivreComplet(user, res(), 'ex');
    expect(fpm.grandLivreEnFlux).toHaveBeenCalledTimes(1);
    await ctl.grandLivreComplet(user, res(), 'ex', 'plat');
    expect(exports.grandLivreCompletExcelEnFlux).toHaveBeenCalledTimes(1);
    await expect(ctl.grandLivreComplet(user, res(), 'ex', 'pdf')).rejects.toThrow(BadRequestException);
  });

  it('une balance des tiers porte UNE famille · « TOUS » ou rien est refusé, nommé', () => {
    expect(() => familleOuRefus('TOUS')).toThrow(/Type de tiers à préciser/);
    expect(() => familleOuRefus(undefined)).toThrow(BadRequestException);
    expect(familleOuRefus('SALARIES')).toBe('SALARIES');
  });

  it('la balance passe la demande « balance seule » au service', async () => {
    const fpm = { balanceGeneraleEnFlux: jest.fn().mockResolvedValue({ lignes: 0 }) };
    const ctl = new ExportController({} as never, fpm as never);
    await ctl.balance(user, res(), 'ex', 'non');
    await ctl.balance(user, res(), 'ex');
    expect(fpm.balanceGeneraleEnFlux.mock.calls.map((c) => c[2])).toEqual([false, true]);
    await expect(ctl.balance(user, res(), 'ex', 'peut-être')).rejects.toThrow(BadRequestException);
  });
});
