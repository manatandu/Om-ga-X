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
  c131: { id: 'c131', numero: '13100000', intitule: 'Résultat', classe: ClasseCompte.CLASSE_1 },
  c401: { id: 'c401', numero: '40110001', intitule: 'Fournisseur', classe: ClasseCompte.CLASSE_4 },
  c4019: { id: 'c4019', numero: '40190000', intitule: 'Fournisseurs divers', classe: ClasseCompte.CLASSE_4 },
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

/** Les drapeaux d'écriture que lisent les trois colonnes de la balance. */
const ORDINAIRE = { estGenereeParCloture: false, estSoldeDesComptesDeGestion: false };
const AN = { date: new Date('2026-01-01T00:00:00Z'), numeroPiece: 1, libelle: 'À-nouveau', statut: 'VALIDEE', journal: { code: 'AN' }, estGenereeParCloture: true, estSoldeDesComptesDeGestion: false };
const ACHAT = { date: new Date('2026-02-03T00:00:00Z'), numeroPiece: 7, libelle: 'Facture REGIDESO', statut: 'VALIDEE', journal: { code: 'AC' }, ...ORDINAIRE };
const REGLEMENT = { date: new Date('2026-03-04T00:00:00Z'), numeroPiece: 2, libelle: 'Règlement', statut: 'BROUILLARD', journal: { code: 'BQ' }, ...ORDINAIRE };
const CVN = { date: new Date('2026-04-05T00:00:00Z'), numeroPiece: 3, libelle: 'Bénévolat', statut: 'VALIDEE', journal: { code: 'OD' }, ...ORDINAIRE };
const DIVERS = { date: new Date('2026-05-06T00:00:00Z'), numeroPiece: 4, libelle: 'Divers', statut: 'VALIDEE', journal: { code: 'OD' }, ...ORDINAIRE };
const DIVERS2 = { date: new Date('2026-05-07T00:00:00Z'), numeroPiece: 5, libelle: 'Fournisseur sans fiche', statut: 'VALIDEE', journal: { code: 'AC' }, ...ORDINAIRE };
/** L'écriture qui solde les comptes de gestion d'un exercice CLÔTURÉ (audit final F4, F5). */
const CLOTURE = { date: new Date('2026-12-31T00:00:00Z'), numeroPiece: 9, libelle: 'Solde des comptes de gestion', statut: 'VALIDEE', journal: { code: 'CL' }, estGenereeParCloture: true, estSoldeDesComptesDeGestion: true };

type Ecr = typeof AN;
const ligne = (id: string, compte: keyof typeof COMPTES, debit: number, credit: number, ecriture: Ecr, lettre: string | null = null) => ({
  id,
  compteId: compte,
  debit,
  credit,
  lettre,
  libelle: null,
  compte: COMPTES[compte],
  ecriture,
});
type Ligne = ReturnType<typeof ligne>;

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

/**
 * UN EXERCICE CLÔTURÉ (second tour, relevé bloquant) · un achat de 3 000, et
 * l'écriture de clôture qui solde le 601 sur le 13. Sa colonne de clôture
 * doit se lire avec les mouvements, jamais avant la période (audit final F5).
 */
const LIGNES_CLOS = [
  ligne('k4', 'c131', 3000, 0, CLOTURE),
  ligne('k2', 'c401', 0, 3000, ACHAT),
  ligne('k1', 'c601', 3000, 0, ACHAT),
  ligne('k3', 'c601', 0, 3000, CLOTURE),
];

/** Un compte de fournisseurs SANS tiers qui porte un solde (relevé A). */
const LIGNES_SANS_TIERS = [
  ...LIGNES.slice(0, 3),
  ligne('m1', 'c4019', 0, 100, DIVERS2),
  ...LIGNES.slice(3, 8),
  ligne('m2', 'c601', 100, 0, DIVERS2),
  ...LIGNES.slice(8),
];

/** La balance du dépôt, telle que `EcritureService.balance` la rendrait sur ces lignes. */
function balance(lignes: Ligne[]) {
  const parCompte = new Map<string, { rD: number; rC: number; mD: number; mC: number; cD: number; cC: number }>();
  for (const l of lignes) {
    const a = parCompte.get(l.compteId) ?? { rD: 0, rC: 0, mD: 0, mC: 0, cD: 0, cC: 0 };
    if (l.ecriture.estSoldeDesComptesDeGestion) {
      a.cD += l.debit;
      a.cC += l.credit;
    } else if (l.ecriture.estGenereeParCloture) {
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
    .filter((c) => parCompte.has(c.id))
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
        clotureDebit: a.cD,
        clotureCredit: a.cC,
        totalDebit: a.rD + a.mD + a.cD,
        totalCredit: a.rC + a.mC + a.cC,
        solde: a.rD + a.mD + a.cD - a.rC - a.mC - a.cC,
      };
    });
}

/** Une ligne répond-elle au filtre d'écriture d'un agrégat (drapeaux, dossier, exercice) ? */
function repond(l: Ligne, where: any): boolean {
  if (where.tenantId !== 't1' || where.exerciceId !== 'ex') return false;
  for (const cle of ['estGenereeParCloture', 'estSoldeDesComptesDeGestion'] as const) {
    if (cle in where && l.ecriture[cle] !== where[cle]) return false;
  }
  return true;
}

function service(options: { compte?: number; lignes?: Ligne[]; balanceSans?: string; referentiel?: string } = {}) {
  const lignes = options.lignes ?? LIGNES;
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...TENANT, referentiel: options.referentiel ?? TENANT.referentiel }) },
    exercice: { findFirst: jest.fn(async ({ where }: any) => (where.id === 'ex' && where.tenantId === 't1' ? EXERCICE : null)) },
    ecriture: {
      count: jest.fn(async ({ where }: any) => {
        expect(where).toMatchObject({ tenantId: 't1', exerciceId: 'ex', statut: { not: 'VALIDEE' } });
        return new Set(lignes.filter((l) => l.ecriture.statut !== 'VALIDEE').map((l) => l.ecriture)).size;
      }),
    },
    ligneEcriture: {
      // La doublure HONORE la requête · borne du dossier, filtre de comptes,
      // curseur, `skip` et taille de lot (CLAUDE.md, passe F4b).
      count: jest.fn(async ({ where }: any) =>
        options.compte ?? lignes.filter((l) => !where.compteId || where.compteId.in.includes(l.compteId)).length,
      ),
      findMany: jest.fn(async ({ where, take, cursor, skip }: any) => {
        expect(where.ecriture).toEqual({ tenantId: 't1', exerciceId: 'ex' });
        const filtrees = lignes.filter((l) => !where.compteId || where.compteId.in.includes(l.compteId));
        const depart = cursor ? filtrees.findIndex((l) => l.id === cursor.id) + (skip ?? 0) : 0;
        return filtrees.slice(depart, depart + take);
      }),
      // L'agrégat INDÉPENDANT du contrôle des tiers · il somme les lignes, il
      // ne relit pas la balance.
      aggregate: jest.fn(async ({ where }: any) => {
        const prefixes: string[] = where.compte.OR.map((o: any) => o.numero.startsWith);
        const retenues = lignes.filter((l) => repond(l, where.ecriture) && prefixes.some((p) => l.compte.numero.startsWith(p)));
        return { _sum: { debit: retenues.reduce((t, l) => t + l.debit, 0), credit: retenues.reduce((t, l) => t + l.credit, 0) } };
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
  const ecriture = {
    balance: jest.fn(async () => ({ lignes: balance(lignes).filter((l) => l.compteId !== options.balanceSans) })),
  } as unknown as EcritureService;
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

describe('second tour · exercice clôturé, contrôle indépendant, lots, brouillard', () => {
  it('F5 · le solde des comptes de gestion d’un exercice CLOS se lit avec les mouvements, jamais avant la période', async () => {
    const c = await lire((ouvrir) => service({ lignes: LIGNES_CLOS }).fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir));
    const f = c.getWorksheet('Balance')!;
    const achats = ligneDe(f, 'Achats');
    // Débit 3 000 de l'achat, crédit 3 000 de la clôture · rien avant la période, solde nul.
    expect(['C', 'D', 'E', 'F', 'G', 'H'].map((x) => achats.getCell(x).value)).toEqual([null, null, 3000, 3000, null, null]);
    const resultat = ligneDe(f, 'Résultat');
    // Le 13 n'a que la clôture, au DÉBIT · `+ l.clotureDebit` retiré, E tomberait à vide.
    expect(['C', 'D', 'E', 'F', 'G', 'H'].map((x) => resultat.getCell(x).value)).toEqual([null, null, 3000, null, 3000, null]);
    const gl = c.getWorksheet('60110000')!;
    expect(['D10', 'F10', 'H10'].map((a) => gl.getCell(a).value)).toEqual(['Facture REGIDESO', 3000, 3000]);
    expect(['D11', 'G11', 'H11'].map((a) => gl.getCell(a).value)).toEqual(['Solde des comptes de gestion', 3000, null]);
    expect(['F', 'G', 'H'].map((x) => ligneDe(gl, 'Total du compte').getCell(x).value)).toEqual([3000, 3000, null]);
    expect(['F', 'G'].map((x) => ligneDe(gl, 'Solde à la balance générale').getCell(x).value)).toEqual([3000, 3000]);
    ligneDe(gl, 'Écart : aucun');
    // Tout est validé · aucune mention de brouillard.
    expect(f.getCell('A7').value).toBeNull();
  });

  it('relevé A · un compte de fournisseurs SANS tiers est listé, et le contrôle lit les 40 par un agrégat à part', async () => {
    const { fpm, prisma } = service({ lignes: LIGNES_SANS_TIERS });
    const c = await lire((ouvrir) => fpm.balanceTiersEnFlux('t1', 'ex', 'FOURNISSEURS', false, ouvrir));
    const f = c.getWorksheet('Balance')!;
    expect(ligneDe(f, 'Fournisseurs divers · aucun tiers rattaché').getCell('F').value).toBe(100);
    ligneDe(f, 'Écart : aucun');
    // L'agrégat vise le divisionnaire entier, rattaché ou non.
    expect(prisma.ligneEcriture.aggregate.mock.calls.map((x: any[]) => x[0].where.compte)).toEqual(
      Array(3).fill({ OR: [{ numero: { startsWith: '40' } }] }),
    );
  });

  it('relevé A · une balance qui perdrait le compte sans tiers fait apparaître l’écart, chiffré', async () => {
    const options = { lignes: LIGNES_SANS_TIERS, balanceSans: 'c4019' };
    const c = await lire((ouvrir) => service(options).fpm.balanceTiersEnFlux('t1', 'ex', 'FOURNISSEURS', false, ouvrir));
    const ecart = ligneDe(c.getWorksheet('Balance')!, 'Écart avec la balance générale');
    expect(['E', 'F', 'G', 'H'].map((x) => ecart.getCell(x).value)).toEqual([null, -100, 100, null]);
    const g = await lire((ouvrir) => service(options).fpm.grandLivreTiersEnFlux('t1', 'ex', 'FOURNISSEURS', ouvrir));
    expect(['F', 'G'].map((x) => ligneDe(g.worksheets[0], 'Écart').getCell(x).value)).toEqual([null, -100]);
  });

  it('relevé B · la lecture par lots avance par le curseur, `skip: 1`, sans doublon ni oubli', async () => {
    const { fpm, prisma } = service();
    fpm.lotExport = 3;
    const c = await lire((ouvrir) => fpm.grandLivreEnFlux('t1', 'ex', ouvrir));
    const appels = prisma.ligneEcriture.findMany.mock.calls.map((x: any[]) => x[0]);
    expect(appels.map((a: any) => [a.take, a.cursor?.id, a.skip])).toEqual([
      [3, undefined, undefined],
      [3, 'l5', 1],
      [3, 'l2', 1],
      [3, 'l7', 1],
    ]);
    // Une ligne de livre par ligne d'écriture, chacune une fois.
    const f = c.worksheets[0];
    const datees: string[] = [];
    f.eachRow((r, n) => {
      if (n > 8 && r.getCell('A').value instanceof Date) datees.push(`${r.getCell('D').value}|${r.getCell('F').value}|${r.getCell('G').value}`);
    });
    const attendues = LIGNES.map(
      (l) => `${l.ecriture.libelle}${l.ecriture.statut === 'VALIDEE' ? '' : ' · brouillard'}|${l.debit || null}|${l.credit || null}`,
    );
    expect([...datees].sort()).toEqual([...attendues].sort());
    expect(['F', 'G'].map((x) => ligneDe(f, 'Totaux').getCell(x).value)).toEqual([1950, 1950]);
  });

  it('relevé B · chaque feuille de compte se contrôle contre SA ligne de balance', async () => {
    const c = await lire((ouvrir) => service().fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir));
    for (const nom of ['40110001', '52110000']) {
      const g = c.getWorksheet(nom)!;
      const total = ligneDe(g, 'Total du compte');
      const balanceDuCompte = ligneDe(g, 'Solde à la balance générale');
      expect(balanceDuCompte.number).toBe(total.number + 1);
      expect(['F', 'G'].map((x) => balanceDuCompte.getCell(x).value)).toEqual(['F', 'G'].map((x) => total.getCell(x).value));
      expect(ligneDe(g, 'Écart : aucun').number).toBe(total.number + 2);
    }
  });

  it('relevé D · la balance DIT qu’elle porte le brouillard, sous le cartouche', async () => {
    const f = (await lire((ouvrir) => service().fpm.balanceGeneraleEnFlux('t1', 'ex', false, ouvrir))).getWorksheet('Balance')!;
    expect(f.getCell('A7').value).toBe('Brouillard compris · 1 écriture non validée');
  });

  it('relevé G · les clients du SYSCOHADA s’intitulent « Client »', async () => {
    const c = await lire((ouvrir) => service({ referentiel: 'SYSCOHADA' }).fpm.balanceTiersEnFlux('t1', 'ex', 'CLIENTS', false, ouvrir));
    expect(c.getWorksheet('Balance')!.getCell('D4').value).toBe('Client');
  });
});
