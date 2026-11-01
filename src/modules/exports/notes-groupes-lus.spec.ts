import * as ExcelJS from 'exceljs';
import { ExportService } from './export.service';
import type { PrismaService } from '../../common/prisma.service';

/**
 * SECOND TOUR DU PAQUET 1, LIGNE B, VOISIN · le classeur des notes dit les
 * groupes de lettrage que la ventilation par échéance lit ligne à ligne,
 * comme l'écran des notes · il les taisait. Une feuille « Mentions » en
 * dernier, et seulement quand il y en a.
 */
function monter(groupesLusLigneALigne: unknown) {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', nom: 'ASBL ESSAI', ville: 'Kinshasa', pays: 'RD Congo' }) },
    exercice: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'e1',
        tenantId: 't',
        dateDebut: new Date('2026-01-01T00:00:00Z'),
        dateFin: new Date('2026-12-31T00:00:00Z'),
        dateArreteComptes: null,
      }),
    },
  } as unknown as PrismaService;
  const notes = {
    notesAssociations: jest.fn().mockResolvedValue({
      notes: [],
      ficheRecapitulative: [],
      couverture: { transcrites: 0, attendues: 0 },
      groupesLusLigneALigne,
    }),
  };
  const vide = {} as never;
  return new ExportService(prisma, vide, vide, vide, vide, vide, notes as never, vide, vide, vide);
}

async function classeur(service: ExportService) {
  const { buffer } = await service.notesAssociationsExcel('t', 'e1');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

describe('notes exportées · les groupes lus ligne à ligne se disent', () => {
  it('une feuille « Mentions » nomme les groupes et leur motif', async () => {
    const wb = await classeur(
      monter({ total: 1, groupes: [{ code: 'C', compte: '41100001', motif: 'RESTE_NON_REPARTI' }], tronque: false }),
    );
    const ws = wb.getWorksheet('Mentions');
    expect(ws).toBeDefined();
    expect(String(ws!.getCell('A3').value)).toContain('1 groupe de lettrage à la répartition incertaine · C (41100001, reste non réparti)');
  });

  it('aucun groupe · le classeur est celui d’avant, sans feuille de mentions', async () => {
    const wb = await classeur(monter({ total: 0, groupes: [], tronque: false }));
    expect(wb.getWorksheet('Mentions')).toBeUndefined();
  });
});
