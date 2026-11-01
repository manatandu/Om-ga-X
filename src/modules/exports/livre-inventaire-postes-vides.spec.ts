import * as ExcelJS from 'exceljs';
import { JeuEtatsFinanciersSycebnl, Referentiel } from '@prisma/client';
import { ExportService } from './export.service';
import { fondementInventaire } from '../documents-obligatoires/livre-inventaire.service';

/**
 * SECOND TOUR DU PAQUET 1, LIGNE A, MAJEUR · le livre d'inventaire figeait
 * 0,00 sur les postes du tableau des flux que le serveur laisse vides (paquet
 * 1, A7) · l'écran et la liasse les écrivent vides, avec leur motif. Le livre
 * les rend vides aussi, et dit le motif sous le tableau ; un état transcrit
 * avant la règle (sans `postesVides`) se rend tel quel.
 */
function exporter(tft: Record<string, unknown>) {
  const livre = {
    courante: jest.fn().mockResolvedValue({ version: 1, transcritLe: '2027-03-01', etats: { fluxTresorerie: tft } }),
    conformite: jest.fn().mockResolvedValue({
      exigence: 'exigence du texte',
      etatsExiges: [{ cle: 'fluxTresorerie', libelle: 'Tableau des flux', transcrit: true, motifIndisponibilite: null }],
      resume: { renseigne: false, exigence: '', remarque: '' },
      fondement: fondementInventaire({
        referentiel: Referentiel.SYCEBNL,
        jeuEtatsFinanciersSycebnl: JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
        systemeComptableSyscohada: null,
      }),
    }),
  };
  const prisma = {
    exercice: { findFirst: jest.fn().mockResolvedValue(null) },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nom: 'Dossier', numeroImpot: 'A1', devise: 'CDF' }) },
  };
  const vide = {} as never;
  return new ExportService(prisma as never, vide, vide, vide, vide, vide, vide, vide, livre as never, vide).livreInventaireExcel('t1', 'ex');
}

async function feuilleFlux(tft: Record<string, unknown>) {
  const { buffer } = await exporter(tft);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  return wb.getWorksheet('Tableau des flux')!;
}

function ligneDe(ws: ExcelJS.Worksheet, ref: string): ExcelJS.Row | undefined {
  let trouve: ExcelJS.Row | undefined;
  ws.eachRow((r) => {
    if (r.getCell(2).value === ref) trouve = r;
  });
  return trouve;
}

const lignes = [
  { ref: 'FA', libelle: 'Capacité d’autofinancement', montant: 0 },
  { ref: 'FB', libelle: 'Variation des stocks', montant: 120_000 },
];

describe('livre d’inventaire · les postes vides du tableau des flux restent vides (ligne A, MAJEUR)', () => {
  it('un poste laissé vide n’est pas figé à 0,00, et son motif est dit', async () => {
    const ws = await feuilleFlux({
      lignes,
      postesVides: ['FA'],
      postesNonCalculables: [{ ref: 'FA', raison: 'ouverture passée en OD au premier jour' }],
    });
    expect(ligneDe(ws, 'FA')!.getCell(4).value).toBeNull();
    expect(ligneDe(ws, 'FB')!.getCell(4).value).toBe(120_000);
    const textes: string[] = [];
    ws.eachRow((r) => textes.push(String(r.getCell(3).value ?? '')));
    expect(textes.join('\n')).toContain('Laissés vides (FA) · ouverture passée en OD au premier jour');
  });

  it('un état transcrit avant la règle se rend tel qu’il a été figé', async () => {
    const ws = await feuilleFlux({ lignes });
    expect(ligneDe(ws, 'FA')!.getCell(4).value).toBe(0);
  });
});
