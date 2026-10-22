import 'reflect-metadata';
import { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExtraitsBancairesService, LIMITE_EXTRAITS } from './extraits-bancaires.service';
import { MENTION_EXTRAIT } from './extraits-bancaires';
import { LIGNE_ENTETE_FPM } from '../exports/presentation-fpm';
import type { RapprochementService } from './rapprochement.service';
import type { ExportService } from '../exports/export.service';
import type { PrismaService } from '../../common/prisma.service';

/**
 * LES EXTRAITS BANCAIRES, RELUS DANS LE CLASSEUR PRODUIT (ligne sage-l3,
 * fonction 45 · CLAUDE.md § 10, un test d'export relit le fichier). Deux
 * comptes de banque, trois relevés importés · le premier compte en porte deux
 * (janvier, février), le second un (janvier). Le solde de départ de février
 * est celui du rapprochement de janvier clos ; celui de janvier est déclaré.
 */

const T = 't1';
const C1 = { id: 'c1', numero: '52110001', intitule: 'Banque Rawbank' };
const C2 = { id: 'c2', numero: '52110002', intitule: 'Banque Equity' };

const jour = (j: string) => new Date(`${j}T00:00:00.000Z`);

const RAPPROCHEMENTS = [
  {
    id: 'r1',
    tenantId: T,
    compteId: 'c1',
    compte: C1,
    dateReleve: jour('2026-01-31'),
    soldeReleve: 1_100,
    statut: 'CLOTURE',
    clotureAt: jour('2026-02-05'),
    soldeDepartDeclare: 100,
    dateDepart: jour('2025-12-31'),
    releveImporteLe: new Date('2026-02-01T09:30:00.000Z'),
    releveNomFichier: 'releve-janvier.csv',
  },
  {
    id: 'r2',
    tenantId: T,
    compteId: 'c1',
    compte: C1,
    dateReleve: jour('2026-02-28'),
    soldeReleve: 900,
    statut: 'EN_COURS',
    clotureAt: null,
    soldeDepartDeclare: null,
    dateDepart: null,
    releveImporteLe: null,
    releveNomFichier: null,
  },
  {
    id: 'r3',
    tenantId: T,
    compteId: 'c2',
    compte: C2,
    dateReleve: jour('2026-01-31'),
    soldeReleve: 50,
    statut: 'EN_COURS',
    clotureAt: null,
    soldeDepartDeclare: null,
    dateDepart: null,
    releveImporteLe: new Date('2026-02-02T10:00:00.000Z'),
    releveNomFichier: 'equity.xlsx',
  },
];

/** Les lignes de relevé, par rapprochement · sens de la BANQUE (un crédit est une entrée du compte). */
const LIGNES: Record<string, Array<{ rang: number; date: Date; libelle: string; reference: string | null; debit: number; credit: number; rapprochee: boolean }>> = {
  r1: [
    { rang: 1, date: jour('2026-01-05'), libelle: 'Virement reçu', reference: 'VIR 1', debit: 0, credit: 1500, rapprochee: true },
    { rang: 2, date: jour('2026-01-20'), libelle: 'Frais de tenue', reference: null, debit: 500, credit: 0, rapprochee: false },
  ],
  // Février · le solde reconstitué (1 100 + 0 − 200 = 900) égale le solde imprimé.
  r2: [{ rang: 1, date: jour('2026-02-10'), libelle: 'Chèque 42', reference: 'CHQ 0042', debit: 200, credit: 0, rapprochee: true }],
  // Equity · sans rapprochement clos avant et sans solde déclaré · aucun solde de départ.
  r3: [{ rang: 1, date: jour('2026-01-15'), libelle: 'Dépôt', reference: null, debit: 0, credit: 50, rapprochee: false }],
};

type Doublure = { prisma: PrismaService; rapprochements: RapprochementService; exportService: ExportService; identites: unknown[] };

function monter(options: { total?: number; comptesTrouves?: typeof C1[] } = {}): Doublure {
  const identites: unknown[] = [];
  const prisma = {
    rapprochementBancaire: {
      count: jest.fn(async () => options.total ?? RAPPROCHEMENTS.length),
      findMany: jest.fn(async ({ where }: { where: { compteId?: string } }) => RAPPROCHEMENTS.filter((r) => !where.compteId || r.compteId === where.compteId)),
    },
    ligneReleveBancaire: {
      groupBy: jest.fn(async ({ where }: { where: { rapprochementId: { in: string[] }; OR?: unknown } }) =>
        where.rapprochementId.in.map((id) => {
          const lignes = (LIGNES[id] ?? []).filter((l) => (where.OR ? l.rapprochee : true));
          return {
            rapprochementId: id,
            _sum: { debit: lignes.reduce((s, l) => s + l.debit, 0), credit: lignes.reduce((s, l) => s + l.credit, 0) },
            _count: { _all: lignes.length },
          };
        }),
      ),
      findMany: jest.fn(async ({ where }: { where: { rapprochementId: string } }) =>
        (LIGNES[where.rapprochementId] ?? []).map((l) => ({ ...l, _count: { lignesEcriture: l.rapprochee ? 1 : 0, encoursOuverture: 0 } })),
      ),
    },
    compte: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        (options.comptesTrouves ?? [C1, C2]).filter((c) => where.id.in.includes(c.id)),
      ),
    },
  } as unknown as PrismaService;
  const rapprochements = {
    // Le solde de départ tel que le module du rapprochement le rend · janvier
    // déclaré, février ancré sur janvier clos, Equity sans rien.
    depart: jest.fn(async (_t: string, r: { id?: string; compteId: string; soldeDepartDeclare?: number | null }) => {
      if (r.compteId === 'c1' && r.soldeDepartDeclare == null) return { soldeDepart: 1_100, regle: { ancre: true, dateDepart: null }, premier: false };
      return { soldeDepart: r.soldeDepartDeclare ?? null, regle: { ancre: false, dateDepart: null }, premier: true };
    }),
  } as unknown as RapprochementService;
  const exportService = {
    identiteEtat: jest.fn(async (_t: string, periode: unknown) => {
      identites.push(periode);
      return { entite: 'Association Essai', nif: 'A1', periode: 'du 01/01/2026 au 28/02/2026', devise: 'CDF' };
    }),
  } as unknown as ExportService;
  return { prisma, rapprochements, exportService, identites };
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
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(Buffer.concat(morceaux) as never);
  return classeur;
}

const texte = (f: ExcelJS.Worksheet, ref: string) => {
  const v = f.getCell(ref).value;
  return v === null || v === undefined ? null : typeof v === 'object' && 'richText' in (v as object) ? (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('') : v;
};

describe('ExtraitsBancairesService.lister', () => {
  it('rend chaque relevé importé avec ses nombres, son solde de départ et son écart, par agrégats', async () => {
    const d = monter();
    const service = new ExtraitsBancairesService(d.prisma, d.rapprochements, d.exportService);
    const r = await service.lister(T);
    expect(r.total).toBe(3);
    expect(r.tronque).toBe(false);
    expect(r.extraits.map((e) => [e.rapprochementId, e.soldeDepart, e.mouvementsNet, e.ecartReleve, e.nombreLignes, e.nombreRapprochees, e.statut])).toEqual([
      ['r1', 100, 1000, 0, 2, 1, 'CLOTURE'],
      ['r2', 1100, -200, 0, 1, 1, 'EN_COURS'],
      ['r3', null, 50, null, 1, 0, 'EN_COURS'],
    ]);
    // La borne du dossier est écrite dans chaque appel, et la liste ne lit
    // que les rapprochements qui portent un relevé.
    const appel = (d.prisma.rapprochementBancaire.findMany as jest.Mock).mock.calls[0][0];
    expect(appel.where.tenantId).toBe(T);
    expect(appel.where.releve).toEqual({ some: { tenantId: T } });
    expect(appel.take).toBe(LIMITE_EXTRAITS);
  });

  it('se restreint au compte demandé et dit la troncature au-delà de la limite', async () => {
    const d = monter({ total: LIMITE_EXTRAITS + 1 });
    const service = new ExtraitsBancairesService(d.prisma, d.rapprochements, d.exportService);
    const r = await service.lister(T, 'c2');
    expect(r.extraits.map((e) => e.rapprochementId)).toEqual(['r3']);
    expect(r.tronque).toBe(true);
    expect((d.prisma.rapprochementBancaire.findMany as jest.Mock).mock.calls[0][0].where.compteId).toBe('c2');
  });
});

describe('ExtraitsBancairesService.editionChainee · relue dans le classeur', () => {
  it('une feuille de sommaire puis une feuille par extrait, compte par compte, du plus ancien au plus récent', async () => {
    const d = monter();
    const service = new ExtraitsBancairesService(d.prisma, d.rapprochements, d.exportService);
    let resultat: { feuilles: number; lignes: number; comptesSansExtrait: string[] } | null = null;
    let nomFichier = '';
    const classeur = await lire(async (ouvrir) => {
      resultat = await service.editionChainee(T, { compteIds: [], du: null, au: null }, (nom) => {
        nomFichier = nom;
        return ouvrir();
      });
    });
    expect(resultat).toEqual({ feuilles: 4, lignes: 4, comptesSansExtrait: [] });
    // Du premier extrait retenu au dernier (Equity, 31 janvier) · les bornes de la sélection sont nulles.
    expect(nomFichier).toBe('extraits-bancaires-2026-01-31-2026-01-31.xlsx');
    expect(classeur.worksheets.map((f) => f.name)).toEqual(['Sommaire', '52110001 2026-01-31', '52110001 2026-02-28', '52110002 2026-01-31']);

    // Le sommaire · une ligne par extrait, dans l'ordre des feuilles, le solde imprimé.
    const sommaire = classeur.getWorksheet('Sommaire')!;
    const premiere = LIGNE_ENTETE_FPM + 1;
    expect([premiere, premiere + 1, premiere + 2].map((r) => [texte(sommaire, `A${r}`), texte(sommaire, `E${r}`), texte(sommaire, `F${r}`)])).toEqual([
      ['52110001', 1100, '52110001 2026-01-31'],
      ['52110001', 900, '52110001 2026-02-28'],
      ['52110002', 50, '52110002 2026-01-31'],
    ]);
    expect(texte(sommaire, 'A7')).toBe(MENTION_EXTRAIT);
  });

  it('chaque extrait · solde de départ, lignes avec leur solde progressif au sens de la banque, totaux, solde imprimé, rapprochées', async () => {
    const d = monter();
    const service = new ExtraitsBancairesService(d.prisma, d.rapprochements, d.exportService);
    const classeur = await lire((ouvrir) => service.editionChainee(T, { compteIds: ['c1'], du: null, au: null }, () => ouvrir()));
    expect(classeur.worksheets.map((f) => f.name)).toEqual(['Sommaire', '52110001 2026-01-31', '52110001 2026-02-28']);

    const janvier = classeur.getWorksheet('52110001 2026-01-31')!;
    const l = LIGNE_ENTETE_FPM + 1;
    // Solde de départ déclaré, puis 100 + 1 500 = 1 600, puis 1 600 − 500 = 1 100 = solde imprimé · aucun écart.
    expect([texte(janvier, `C${l}`), texte(janvier, `G${l}`)]).toEqual(['Solde de départ', 100]);
    expect([texte(janvier, `A${l + 1}`), texte(janvier, `F${l + 1}`), texte(janvier, `G${l + 1}`), texte(janvier, `H${l + 1}`)]).toEqual([1, 1500, 1600, 'Oui']);
    expect([texte(janvier, `A${l + 2}`), texte(janvier, `E${l + 2}`), texte(janvier, `G${l + 2}`), texte(janvier, `H${l + 2}`)]).toEqual([2, 500, 1100, null]);
    expect([texte(janvier, `C${l + 3}`), texte(janvier, `E${l + 3}`), texte(janvier, `F${l + 3}`)]).toEqual(['Total des mouvements', 500, 1500]);
    expect([texte(janvier, `C${l + 4}`), texte(janvier, `G${l + 4}`)]).toEqual(['Solde du relevé (imprimé par la banque)', 1100]);
    expect(texte(janvier, `C${l + 5}`)).toBe('1 ligne(s) rapprochée(s) sur 2');
    // La mention dit le fichier et l'instant de l'import.
    expect(String(texte(janvier, 'A7'))).toMatch(/releve-janvier\.csv/);
    expect(String(texte(janvier, 'A7'))).toMatch(/importé le/);

    // Février · ancré sur janvier clos (1 100), un débit de 200, solde 900 = imprimé.
    const fevrier = classeur.getWorksheet('52110001 2026-02-28')!;
    expect([texte(fevrier, `G${l}`), texte(fevrier, `G${l + 1}`), texte(fevrier, `G${l + 3}`)]).toEqual([1100, 900, 900]);
    expect(String(texte(fevrier, 'A7'))).toMatch(/import non daté/);
  });

  it('sans solde de départ, la colonne de solde reste vide et la feuille le dit', async () => {
    const d = monter();
    const service = new ExtraitsBancairesService(d.prisma, d.rapprochements, d.exportService);
    const classeur = await lire((ouvrir) => service.editionChainee(T, { compteIds: ['c2'], du: null, au: null }, () => ouvrir()));
    const f = classeur.getWorksheet('52110002 2026-01-31')!;
    const l = LIGNE_ENTETE_FPM + 1;
    expect([texte(f, `C${l}`), texte(f, `G${l}`), texte(f, `H${l}`)]).toEqual(['Solde de départ', null, 'inconnu']);
    expect([texte(f, `F${l + 1}`), texte(f, `G${l + 1}`)]).toEqual([50, null]);
  });

  it('les bornes de date écartent un extrait, et un compte choisi sans extrait est dit au sommaire, jamais tu', async () => {
    const d = monter();
    const service = new ExtraitsBancairesService(d.prisma, d.rapprochements, d.exportService);
    let resultat: { comptesSansExtrait: string[] } | null = null;
    const classeur = await lire(async (ouvrir) => {
      resultat = await service.editionChainee(T, { compteIds: ['c1', 'c2'], du: jour('2026-02-01'), au: jour('2026-02-28') }, () => ouvrir());
    });
    expect(resultat!.comptesSansExtrait).toEqual(['52110002 Banque Equity']);
    expect(classeur.worksheets.map((f) => f.name)).toEqual(['Sommaire', '52110001 2026-02-28']);
    const sommaire = classeur.getWorksheet('Sommaire')!;
    const l = LIGNE_ENTETE_FPM + 1;
    expect([texte(sommaire, `A${l + 1}`), texte(sommaire, `B${l + 1}`), texte(sommaire, `F${l + 1}`)]).toEqual(['52110002', 'Banque Equity', 'Aucun extrait dans la sélection']);
    // Le cartouche prend les bornes demandées.
    expect(d.identites[0]).toEqual({ dateDebut: '2026-02-01', dateFin: '2026-02-28' });
  });

  it('refuse AVANT le premier octet · compte d’un autre dossier, sélection vide, liste tronquée', async () => {
    const ouvertures: string[] = [];
    const ouvrir = (nom: string) => {
      ouvertures.push(nom);
      return new Writable({ write: (_m, _e, cb) => cb() });
    };
    const d = monter({ comptesTrouves: [C1] });
    const service = new ExtraitsBancairesService(d.prisma, d.rapprochements, d.exportService);
    await expect(service.editionChainee(T, { compteIds: ['c1', 'c2'], du: null, au: null }, ouvrir)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.editionChainee(T, { compteIds: ['c1'], du: jour('2027-01-01'), au: null }, ouvrir)).rejects.toThrow(/Aucun extrait dans la sélection/);
    const tronquee = monter({ total: LIMITE_EXTRAITS + 1 });
    const serviceTronque = new ExtraitsBancairesService(tronquee.prisma, tronquee.rapprochements, tronquee.exportService);
    await expect(serviceTronque.editionChainee(T, { compteIds: [], du: null, au: null }, ouvrir)).rejects.toBeInstanceOf(BadRequestException);
    expect(ouvertures).toEqual([]);
  });
});
