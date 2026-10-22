import 'reflect-metadata';
import { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExtraitsBancairesService, LIMITE_EXTRAITS } from './extraits-bancaires.service';
import { MENTION_EXTRAIT, type SelectionExtraits } from './extraits-bancaires';
import { LIGNE_ENTETE_FPM } from '../exports/presentation-fpm';
import { departParmiLesClos } from './rapprochement.service';
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

type Doublure = { prisma: PrismaService; exportService: ExportService; identites: unknown[] };

type Filtre = {
  compteId?: { in: string[] } | string;
  dateReleve?: { gte?: Date; lt?: Date };
  statut?: string;
  id?: { in: string[] };
  rapprochementId?: string | { in: string[] };
  OR?: Array<{ AND?: Array<Record<string, unknown>> }>;
};

/** Les rapprochements qui passent le filtre de la tranche (comptes, dates sur le jour du relevé). */
const dansLaSelection = (where: Filtre) =>
  RAPPROCHEMENTS.filter((r) => {
    const comptes = typeof where.compteId === 'string' ? [where.compteId] : where.compteId?.in;
    if (comptes && !comptes.includes(r.compteId)) return false;
    if (where.dateReleve?.gte && r.dateReleve.getTime() < where.dateReleve.gte.getTime()) return false;
    if (where.dateReleve?.lt && r.dateReleve.getTime() >= where.dateReleve.lt.getTime()) return false;
    if (where.statut && r.statut !== where.statut) return false;
    return true;
  });

/** Les lignes d'un relevé, avec un identifiant, dans l'ordre du rang · la clé de la tranche (`apresLaCle`) est honorée. */
const lignesDe = (where: Filtre) => {
  const id = typeof where.rapprochementId === 'string' ? where.rapprochementId : '';
  const toutes = (LIGNES[id] ?? []).map((l) => ({ ...l, id: `${id}-l${l.rang}` }));
  const apres = where.OR?.[0]?.AND?.[0] as { rang?: { gt: number } } | undefined;
  return apres?.rang ? toutes.filter((l) => l.rang > apres.rang!.gt) : toutes;
};

function monter(options: { total?: number; comptesTrouves?: typeof C1[]; lignesRetirees?: string } = {}): Doublure {
  const identites: unknown[] = [];
  const prisma = {
    rapprochementBancaire: {
      // Le décompte honore le filtre de la SÉLECTION · `total` ne vaut que pour
      // un dossier lu en entier (le cas B1 du premier tour).
      count: jest.fn(async ({ where }: { where: Filtre }) => (where.compteId || where.dateReleve ? dansLaSelection(where).length : (options.total ?? RAPPROCHEMENTS.length))),
      findMany: jest.fn(async ({ where, take }: { where: Filtre; take?: number }) => dansLaSelection(where).slice(0, take)),
      groupBy: jest.fn(async () => {
        const parCompte = new Map<string, number>();
        for (const r of RAPPROCHEMENTS) parCompte.set(r.compteId, (parCompte.get(r.compteId) ?? 0) + 1);
        return [...parCompte.entries()].map(([compteId, n]) => ({ compteId, _count: { _all: n } }));
      }),
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
      findMany: jest.fn(async ({ where, take }: { where: Filtre; take?: number }) =>
        lignesDe(where)
          .filter((l) => options.lignesRetirees !== where.rapprochementId)
          .slice(0, take)
          .map((l) => ({ ...l, _count: { lignesEcriture: l.rapprochee ? 1 : 0, encoursOuverture: 0 } })),
      ),
      aggregate: jest.fn(async ({ where }: { where: Filtre }) => {
        const dates = lignesDe(where).map((l) => l.date.getTime());
        return { _min: { date: dates.length ? new Date(Math.min(...dates)) : null }, _max: { date: dates.length ? new Date(Math.max(...dates)) : null } };
      }),
    },
    compte: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        (options.comptesTrouves ?? [C1, C2]).filter((c) => where.id.in.includes(c.id)),
      ),
    },
  } as unknown as PrismaService;
  const exportService = {
    identiteEtat: jest.fn(async (_t: string, periode: unknown) => {
      identites.push(periode);
      return { entite: 'Association Essai', nif: 'A1', periode: 'du 01/01/2026 au 28/02/2026', devise: 'CDF' };
    }),
  } as unknown as ExportService;
  return { prisma, exportService, identites };
}

const TOUT: SelectionExtraits = { compteIds: [], du: null, au: null };

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

describe('departParmiLesClos · la règle du solde de départ, une pour le module et pour la liste', () => {
  const clos = [
    { clotureAt: jour('2026-02-05'), soldeReleve: 1_100, dateDepart: jour('2025-12-31') },
    { clotureAt: jour('2026-03-05'), soldeReleve: 900, dateDepart: null },
  ];
  it('un rapprochement ouvert prend le clos le plus récent, ancré, la tête de chaîne datant le départ', () => {
    expect(departParmiLesClos({ clotureAt: null, soldeDepartDeclare: 5 }, [...clos].reverse())).toEqual({
      soldeDepart: 900,
      regle: { ancre: true, dateDepart: jour('2025-12-31') },
      premier: false,
    });
  });
  it('un rapprochement clos ne lit que les clos qui le précèdent, jamais lui-même', () => {
    expect(departParmiLesClos({ clotureAt: jour('2026-03-05') }, clos).soldeDepart).toBe(1_100);
    expect(departParmiLesClos({ clotureAt: jour('2026-02-05'), soldeDepartDeclare: 100, dateDepart: jour('2025-12-31') }, clos)).toEqual({
      soldeDepart: 100,
      regle: { ancre: false, dateDepart: jour('2025-12-31') },
      premier: true,
    });
  });
  it('sans clos avant lui, le solde déclaré ou rien · jamais zéro présumé', () => {
    expect(departParmiLesClos({ clotureAt: null }, []).soldeDepart).toBeNull();
    expect(departParmiLesClos({ clotureAt: null, soldeDepartDeclare: 0 }, []).soldeDepart).toBe(0);
  });
});

describe('ExtraitsBancairesService.listerExtraits', () => {
  it('rend chaque relevé importé avec ses nombres, son solde de départ et son écart, par agrégats, et les comptes à extrait', async () => {
    const d = monter();
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
    const r = await service.listerExtraits(T);
    expect(r.total).toBe(3);
    expect(r.tronque).toBe(false);
    expect(r.extraits.map((e) => [e.rapprochementId, e.soldeDepart, e.mouvementsNet, e.ecartReleve, e.nombreLignes, e.nombreRapprochees, e.statut])).toEqual([
      ['r1', 100, 1000, 0, 2, 1, 'CLOTURE'],
      ['r2', 1100, -200, 0, 1, 1, 'EN_COURS'],
      ['r3', null, 50, null, 1, 0, 'EN_COURS'],
    ]);
    expect(r.comptes).toEqual([
      { ...C1, extraits: 2 },
      { ...C2, extraits: 1 },
    ]);
    expect(r.comptesTronques).toBe(false);
    // La borne du dossier est écrite dans chaque appel, et la liste ne lit
    // que les rapprochements qui portent un relevé ; les clos des comptes de
    // la tranche sont lus en UNE fois (jamais deux requêtes par extrait).
    const appels = (d.prisma.rapprochementBancaire.findMany as jest.Mock).mock.calls.map((c) => c[0]);
    expect(appels).toHaveLength(2);
    expect(appels[0].where.tenantId).toBe(T);
    expect(appels[0].where.releve).toEqual({ some: { tenantId: T } });
    expect(appels[0].take).toBe(LIMITE_EXTRAITS);
    expect(appels[1].where).toEqual({ tenantId: T, compteId: { in: ['c1', 'c2'] }, statut: 'CLOTURE' });
  });

  it('se restreint aux comptes et aux dates DANS la requête (comptage et tranche sur le même filtre), et juge la troncature sur la sélection', async () => {
    const d = monter({ total: LIMITE_EXTRAITS + 1 });
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
    const r = await service.listerExtraits(T, { compteIds: ['c1'], du: jour('2026-02-01'), au: jour('2026-02-28') });
    expect(r.extraits.map((e) => e.rapprochementId)).toEqual(['r2']);
    expect([r.total, r.tronque]).toEqual([1, false]);
    const compte = (d.prisma.rapprochementBancaire.count as jest.Mock).mock.calls[0][0].where;
    const tranche = (d.prisma.rapprochementBancaire.findMany as jest.Mock).mock.calls[0][0].where;
    expect(tranche).toEqual(compte);
    expect(tranche.compteId).toEqual({ in: ['c1'] });
    // Le jour « au » entre entier · borne haute au lendemain, exclue.
    expect(tranche.dateReleve).toEqual({ gte: jour('2026-02-01'), lt: jour('2026-03-01') });
    // Le dossier entier, lui, est tronqué, et le dit.
    const entier = await service.listerExtraits(T);
    expect(entier.tronque).toBe(true);
  });
});

describe('ExtraitsBancairesService.editionChainee · relue dans le classeur', () => {
  it('une feuille de sommaire puis une feuille par extrait, compte par compte, du plus ancien au plus récent', async () => {
    const d = monter();
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
    let resultat: { feuilles: number; lignes: number; comptesSansExtrait: { numero: string; intitule: string }[] } | null = null;
    let nomFichier = '';
    const classeur = await lire(async (ouvrir) => {
      resultat = await service.editionChainee(T, { compteIds: [], du: null, au: null }, (nom) => {
        nomFichier = nom;
        return ouvrir();
      });
    });
    expect(resultat).toEqual({ feuilles: 4, lignes: 4, comptesSansExtrait: [] });
    // Du plus ancien au plus récent des relevés RETENUS (min et max, jamais le
    // premier et le dernier de l'ordre compte-puis-date · premier tour, M3).
    expect(nomFichier).toBe('extraits-bancaires-2026-01-31-2026-02-28.xlsx');
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
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
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
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
    const classeur = await lire((ouvrir) => service.editionChainee(T, { compteIds: ['c2'], du: null, au: null }, () => ouvrir()));
    const f = classeur.getWorksheet('52110002 2026-01-31')!;
    const l = LIGNE_ENTETE_FPM + 1;
    expect([texte(f, `C${l}`), texte(f, `G${l}`), texte(f, `H${l}`)]).toEqual(['Solde de départ', null, 'inconnu']);
    expect([texte(f, `F${l + 1}`), texte(f, `G${l + 1}`)]).toEqual([50, null]);
  });

  it('les bornes de date écartent un extrait, et un compte choisi sans extrait est dit au sommaire, jamais tu', async () => {
    const d = monter();
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
    let resultat: { comptesSansExtrait: { numero: string; intitule: string }[] } | null = null;
    const classeur = await lire(async (ouvrir) => {
      resultat = await service.editionChainee(T, { compteIds: ['c1', 'c2'], du: jour('2026-02-01'), au: jour('2026-02-28') }, () => ouvrir());
    });
    expect(resultat!.comptesSansExtrait).toEqual([{ numero: '52110002', intitule: 'Banque Equity' }]);
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
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
    await expect(service.editionChainee(T, { compteIds: ['c1', 'c2'], du: null, au: null }, ouvrir)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.editionChainee(T, { compteIds: ['c1'], du: jour('2027-01-01'), au: null }, ouvrir)).rejects.toThrow(/Aucun extrait dans la sélection/);
    const tronquee = monter({ total: LIMITE_EXTRAITS + 1 });
    const serviceTronque = new ExtraitsBancairesService(tronquee.prisma, tronquee.exportService);
    await expect(serviceTronque.editionChainee(T, TOUT, ouvrir)).rejects.toThrow(/au-delà des 200/);
    expect(ouvertures).toEqual([]);
  });

  it('un dossier au-delà de la tranche édite encore UN compte sur UN mois · la troncature se juge sur la sélection (premier tour, B1)', async () => {
    const d = monter({ total: LIMITE_EXTRAITS + 1 });
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
    const classeur = await lire((ouvrir) => service.editionChainee(T, { compteIds: ['c1'], du: jour('2026-02-01'), au: jour('2026-02-28') }, () => ouvrir()));
    expect(classeur.worksheets.map((f) => f.name)).toEqual(['Sommaire', '52110001 2026-02-28']);
  });

  it('un relevé qui change entre la liste et sa feuille arrête le flux, jamais une feuille qui dit un décompte faux', async () => {
    const d = monter({ lignesRetirees: 'r2' });
    const service = new ExtraitsBancairesService(d.prisma, d.exportService);
    await expect(lire((ouvrir) => service.editionChainee(T, { compteIds: ['c1'], du: null, au: null }, () => ouvrir()))).rejects.toThrow(/a changé pendant l'édition/);
  });
});
