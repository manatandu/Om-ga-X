import * as ExcelJS from 'exceljs';
import { ExportService } from './export.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * LA BALANCE ÂGÉE EXPORTÉE · trois populations, trois plages, trois totaux
 * (simulation complète du 2026-10-08, lot M, D1).
 *
 * Une dette fournisseur partait « en sens inverse, non ventilée », à l'écran
 * comme au classeur. Le serveur ventile désormais chaque solde dans le sens
 * NORMAL de son périmètre ; ce spec ouvre le classeur produit (CLAUDE.md § 10)
 * et vérifie que chaque section porte ses lignes, que chaque total ADDITIONNE
 * sa propre plage (la coiffe insère trois lignes en tête après coup, et une
 * formule décalée s'ouvre sans erreur) et que le net additionne les totaux.
 */

const TENANT = { id: 'tn', nom: 'Société Test', referentiel: 'SYSCOHADA' };

const tranches = [
  { cle: 'ouverture', libellePeriode: 'Avant le 01/01/2025', libelleAge: "Antérieur à l'exercice" },
  { cle: '2025-10', libellePeriode: 'Du 01/10/2025 au 31/10/2025', libelleAge: 'Moins de 90 jours' },
  { cle: '2025-11', libellePeriode: 'Du 01/11/2025 au 30/11/2025', libelleAge: 'Moins de 60 jours' },
];
const ligne = (libelle: string, montants: number[], solde: number) => ({
  cle: libelle,
  libelle,
  codeTiers: '',
  numero: '40100000',
  montants,
  solde,
});

function monter(etat: Record<string, unknown>) {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
    exercice: {
      findFirst: jest.fn().mockResolvedValue({ dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }),
    },
  } as unknown as PrismaService;
  const ecritures = { balanceAgee: jest.fn().mockResolvedValue(etat) };
  const vide = {} as never;
  return new ExportService(prisma, ecritures as never, vide, vide, vide, vide, vide, vide, vide, vide);
}

async function feuilleDe(service: ExportService, type: string) {
  const { buffer } = await service.balanceAgeeExcel('tn', 'ex', { type: type as never });
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(buffer as unknown as ArrayBuffer);
  return w.getWorksheet('Balance âgée')!;
}

/** La ligne dont la colonne A porte ce libellé. */
function rangDe(f: ExcelJS.Worksheet, libelle: string): number {
  let rang = -1;
  f.eachRow((r, n) => {
    if (r.getCell(1).value === libelle) rang = n;
  });
  return rang;
}

const formule = (f: ExcelJS.Worksheet, adresse: string) => f.getCell(adresse).value as ExcelJS.CellFormulaValue;

describe('balance âgée exportée · trois populations', () => {
  it('fournisseurs · la dette VENTILÉE sous « SOLDES CRÉDITEURS », l’avance à part, sans total des débiteurs', async () => {
    const f = await feuilleDe(
      monter({
        type: 'FOURNISSEURS',
        tranches,
        debiteurs: [],
        crediteurs: [ligne('401001 - Fournisseur A', [0, -2_320_000, 0], -2_320_000)],
        sensInverse: [ligne('401002 - Fournisseur B', [], 150_000)],
        totaux: {
          parTranche: [0, 0, 0],
          parTrancheCrediteurs: [0, -2_320_000, 0],
          debiteurs: 0,
          crediteurs: -2_320_000,
          sensInverse: 150_000,
          net: -2_170_000,
        },
      }),
      'FOURNISSEURS',
    );
    expect(rangDe(f, 'TOTAL DÉBITEURS')).toBe(-1);

    const dette = rangDe(f, '401001 - Fournisseur A');
    expect(rangDe(f, 'SOLDES CRÉDITEURS')).toBe(dette - 1);
    // La dette dans la colonne de son échéance (C, octobre).
    expect(f.getCell(`C${dette}`).value).toBe(-2_320_000);
    const total = rangDe(f, 'TOTAL CRÉDITEURS');
    expect(formule(f, `C${total}`)).toMatchObject({ formula: `SUM(C${dette}:C${dette})`, result: -2_320_000 });
    expect(formule(f, `E${total}`)).toMatchObject({ formula: `SUM(E${dette}:E${dette})`, result: -2_320_000 });

    const avance = rangDe(f, '401002 - Fournisseur B');
    expect(rangDe(f, 'SOLDES EN SENS INVERSE · non ventilés par antériorité')).toBe(avance - 1);
    expect(f.getCell(`C${avance}`).value).toBeNull();
    const totalInverse = rangDe(f, 'TOTAL SOLDES EN SENS INVERSE');
    expect(formule(f, `E${totalInverse}`)).toMatchObject({ formula: `SUM(E${avance}:E${avance})`, result: 150_000 });

    const net = rangDe(f, 'SOLDE NET · recoupe la balance auxiliaire');
    expect(formule(f, `E${net}`)).toMatchObject({ formula: `E${total}+E${totalInverse}`, result: -2_170_000 });
  });

  it('clients · débiteurs en tête, total par tranche sur leur seule plage', async () => {
    const f = await feuilleDe(
      monter({
        type: 'CLIENTS_41',
        tranches,
        debiteurs: [ligne('411001 - A', [100, 200, 0], 300), ligne('411002 - B', [0, 0, 50], 50)],
        crediteurs: [],
        sensInverse: [],
        totaux: {
          parTranche: [100, 200, 50],
          parTrancheCrediteurs: [0, 0, 0],
          debiteurs: 350,
          crediteurs: 0,
          sensInverse: 0,
          net: 350,
        },
      }),
      'CLIENTS_41',
    );
    const a = rangDe(f, '411001 - A');
    const b = rangDe(f, '411002 - B');
    const total = rangDe(f, 'TOTAL DÉBITEURS');
    expect(formule(f, `D${total}`)).toMatchObject({ formula: `SUM(D${a}:D${b})`, result: 50 });
    expect(rangDe(f, 'SOLDES CRÉDITEURS')).toBe(-1);
    expect(rangDe(f, 'TOTAL SOLDES EN SENS INVERSE')).toBe(-1);
    const net = rangDe(f, 'SOLDE NET · recoupe la balance auxiliaire');
    expect(formule(f, `E${net}`)).toMatchObject({ formula: `E${total}`, result: 350 });
  });

  it('aucune ligne · le total des débiteurs reste, à zéro, source du net', async () => {
    const f = await feuilleDe(
      monter({
        type: 'TOUS',
        tranches,
        debiteurs: [],
        crediteurs: [],
        sensInverse: [],
        totaux: { parTranche: [0, 0, 0], parTrancheCrediteurs: [0, 0, 0], debiteurs: 0, crediteurs: 0, sensInverse: 0, net: 0 },
      }),
      'TOUS',
    );
    const total = rangDe(f, 'TOTAL DÉBITEURS');
    expect(total).toBeGreaterThan(0);
    const net = rangDe(f, 'SOLDE NET · recoupe la balance auxiliaire');
    // ExcelJS ne relit pas un résultat nul · la formule seule se vérifie ici.
    expect(formule(f, `E${net}`).formula).toBe(`E${total}`);
  });
});
