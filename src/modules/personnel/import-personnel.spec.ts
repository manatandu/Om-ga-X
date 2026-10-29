import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { apparierColonnes, lireLigne, lireMontantImport, COLONNES_IMPORT } from './import-personnel';
import { ImportPersonnelService } from './import-personnel.service';
import { MOTIF_MONNAIE_EXIGEE } from './regles-contrat-travail';

/**
 * LIGNE PAIE-SUITE, FONCTION 82 · l'import du personnel. Ce qui casserait en
 * silence · une ligne que la saisie refuserait (montant sans monnaie, sexe
 * inconnu, date réparée) qui entre quand même, un « 500.000 » lu 500, un
 * registre à moitié importé, un matricule dédoublé, une colonne devinée.
 */
const csv = (lignes: string[][]) => Buffer.from(lignes.map((l) => l.join(';')).join('\n'), 'utf8').toString('base64');

describe("l'import du personnel · la lecture", () => {
  it('les en-têtes se lisent sans accents ni casse · une colonne inconnue est nommée', () => {
    const r = apparierColonnes(['NOM', 'sexe', "date d entree en vigueur", 'Couleur préférée']);
    expect([...r.rangs.keys()]).toEqual(['nom', 'sexe', 'dateEntreeEnVigueur']);
    expect(r.ignorees).toEqual(['Couleur préférée']);
  });

  it('le point des milliers est refusé comme ambigu, la virgule décimale admise', () => {
    expect(lireMontantImport('500.000')).toBe('ambigu');
    expect(lireMontantImport('500 000')).toBe(500_000);
    expect(lireMontantImport('500000,50')).toBe(500_000.5);
    expect(lireMontantImport('500.5')).toBe(500.5);
    expect(lireMontantImport('cinq cents')).toBeNull();
  });

  it('chaque valeur illisible est un refus nommé · jamais devinée', () => {
    const { rangs } = apparierColonnes(COLONNES_IMPORT.map((c) => c.entete));
    const valeurs = COLONNES_IMPORT.map(() => '');
    const poser = (cle: string, v: string) => (valeurs[COLONNES_IMPORT.findIndex((c) => c.cle === cle)] = v);
    poser('nom', 'KABILA');
    poser('sexe', 'X');
    poser('dateNaissance', '31/02/1990');
    poser('type', 'CDD');
    const l = lireLigne(2, valeurs, rangs);
    expect(l.refus.join(' ')).toMatch(/Sexe.*M ou F/);
    expect(l.refus.join(' ')).toMatch(/Date de naissance.*illisible/);
    // Un contrat sans sa date d'entrée en vigueur ne s'importe pas à moitié.
    expect(l.refus.join(' ')).toMatch(/type et sa date d'entrée en vigueur/);
  });
});

describe("l'import du personnel · le service", () => {
  const monter = (existants: { matricule: string; nom: string }[] = []) => {
    const crees: { salarie: Record<string, unknown>[]; contrat: Record<string, unknown>[] } = { salarie: [], contrat: [] };
    const prisma = {
      $transaction: async (f: (tx: unknown) => unknown) => f(prisma),
      // Fonction 76 · l'option des comptes individuels, retirée ici.
      tenant: { findUnique: jest.fn(async () => ({ comptesIndividuelsSalaries: false })) },
      salarie: {
        findMany: jest.fn(async ({ where }: { where: { tenantId: string; matricule: { in: string[] } } }) =>
          existants.filter((e) => where.matricule.in.includes(e.matricule)),
        ),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => (crees.salarie.push(data), { id: `s${crees.salarie.length}` })),
      },
      contratTravail: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => (crees.contrat.push(data), data)) },
    };
    return { svc: new ImportPersonnelService(prisma as never), crees };
  };
  const entete = ['Matricule', 'Nom', 'Sexe', 'Type de contrat', "Date d'entrée en vigueur", 'Rémunération de base', 'Monnaie'];

  it('la simulation juge par les règles de la saisie · un montant sans monnaie est refusé, rien n’est écrit', async () => {
    const { svc, crees } = monter([{ matricule: '007', nom: 'MBEKI' }]);
    const r = await svc.simuler('t', 'p.csv', csv([entete, ['001', 'KABILA', 'M', 'CDI', '2026-01-05', '500000', ''], ['007', 'LUMUMBA', 'F', '', '', '', ''], ['002', 'TSHALA', 'F', '', '', '', '']]));
    expect(r.total).toBe(3);
    expect(r.lignes[0].refus.filter((x) => x.includes(MOTIF_MONNAIE_EXIGEE))).toHaveLength(1);
    expect(r.lignes[1].refus.join(' ')).toMatch(/007 est déjà porté par MBEKI/);
    expect(r.lignes[2].refus).toEqual([]);
    expect(r.aImporter).toBe(1);
    expect(crees.salarie).toHaveLength(0);
  });

  it("une ligne refusée et rien n'est importé · tout ou rien", async () => {
    const { svc, crees } = monter();
    await expect(svc.importer('t', 'u', 'p.csv', csv([entete, ['001', 'KABILA', 'M', '', '', '', ''], ['002', '', 'F', '', '', '', '']]))).rejects.toBeInstanceOf(BadRequestException);
    expect(crees.salarie).toHaveLength(0);
  });

  it('deux lignes du même matricule sont refusées', async () => {
    const { svc } = monter();
    const r = await svc.simuler('t', 'p.csv', csv([entete, ['001', 'A', 'M', '', '', '', ''], ['001', 'B', 'F', '', '', '', '']]));
    expect(r.lignes[1].refus.join(' ')).toMatch(/ligne 2 du fichier/);
  });

  it('un fichier sain crée fiches et contrats, avec les colonnes de la saisie', async () => {
    const { svc, crees } = monter();
    const r = await svc.importer('t', 'u', 'p.csv', csv([entete, ['001', 'KABILA', 'M', 'CDI', '05/01/2026', '500 000', 'CDF'], ['002', 'TSHALA', 'F', '', '', '', '']]));
    expect(r).toMatchObject({ salaries: 2, contrats: 1 });
    expect(crees.salarie[0]).toMatchObject({ tenantId: 't', createdBy: 'u', matricule: '001', nom: 'KABILA', sexe: 'MASCULIN', actif: true });
    expect(crees.contrat[0]).toMatchObject({ type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: new Date('2026-01-05'), deviseRemuneration: 'CDF', constateParEcrit: true });
    expect(Number(crees.contrat[0].remunerationBase)).toBe(500_000);
  });

  it('le modèle porte les en-têtes que la lecture reconnaît', async () => {
    const { svc } = monter();
    const relu = new ExcelJS.Workbook();
    await relu.xlsx.load((await svc.modele()) as unknown as ArrayBuffer);
    const ligne = (relu.getWorksheet('Personnel')!.getRow(1).values as unknown[]).slice(1).map(String);
    expect(apparierColonnes(ligne).rangs.size).toBe(COLONNES_IMPORT.length);
  });

  it('une colonne obligatoire absente refuse le fichier entier', async () => {
    const { svc } = monter();
    await expect(svc.simuler('t', 'p.csv', csv([['Nom'], ['KABILA']]))).rejects.toThrow(/Sexe/);
  });
});
