import 'reflect-metadata';
import { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { PayloadTooLargeException } from '@nestjs/common';
import { ClasseCompte, NatureExtraitPeriode, TypeCompteDetailTotal } from '@prisma/client';
import { EcritureService } from '../../comptabilite/ecriture.service';
import { periodeDeLExtrait } from '../../comptabilite/periode-extrait';
import { ExportService } from '../export.service';
import { ExportFpmService } from '../export-fpm.service';
import { ExtraitsPeriodeService, type ExtraitNumerote } from './extraits-periode.service';

/**
 * LES EXTRAITS DE PÉRIODE, RELUS DANS LE CLASSEUR PRODUIT (ligne
 * export-periode · CLAUDE.md § 10, un test d'export relit le fichier).
 *
 * Ce qui casserait en silence · un extrait sans numéro ni date (AUDCIF
 * art. 22, 7°), un extrait qui se titre « Complète » (condition 2), un compte
 * dont le report disparaît du grand livre (condition 1), un numéro pris par un
 * export refusé (la suite aurait un trou sans document), un fichier interrompu
 * dont le numéro passerait au suivant.
 */

const EXERCICE = { id: 'ex', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') };
const TENANT = { id: 't1', nom: 'Association Essai', numeroImpot: 'A1', devise: null, referentiel: 'SYCEBNL' };
const PERIODE = periodeDeLExtrait(EXERCICE, { du: '2026-04-01', au: '2026-06-30' })!;

type Compte = { id: string; numero: string; intitule: string; classe: ClasseCompte; typeCompte: TypeCompteDetailTotal };
const compte = (id: string, numero: string, intitule: string, classe: ClasseCompte): Compte => ({
  id,
  numero,
  intitule,
  classe,
  typeCompte: TypeCompteDetailTotal.DETAIL,
});
const COMPTES: Compte[] = [
  compte('dotation', '10100000', 'Dotation', ClasseCompte.CLASSE_1),
  compte('banque', '52110000', 'Banque', ClasseCompte.CLASSE_5),
  compte('caisse', '57110000', 'Caisse', ClasseCompte.CLASSE_5),
  compte('achats', '60110000', 'Achats', ClasseCompte.CLASSE_6),
];
const COMPTE = new Map(COMPTES.map((c) => [c.id, c]));

type Ecriture = {
  tenantId: string;
  exerciceId: string;
  statut: string;
  date: Date;
  numeroPiece: number;
  libelle: string;
  journal: { code: string };
  estGenereeParCloture: boolean;
  estSoldeDesComptesDeGestion: boolean;
};
const ecr = (date: string, numeroPiece: number, o: Partial<Ecriture> = {}): Ecriture => ({
  tenantId: 't1',
  exerciceId: 'ex',
  statut: 'VALIDEE',
  date: new Date(`${date}T00:00:00Z`),
  numeroPiece,
  libelle: `Pièce ${numeroPiece}`,
  journal: { code: 'OD' },
  estGenereeParCloture: false,
  estSoldeDesComptesDeGestion: false,
  ...o,
});
const AN = ecr('2026-01-01', 1, { estGenereeParCloture: true, libelle: 'À-nouveau', journal: { code: 'AN' } });
const JANVIER = ecr('2026-01-15', 2);
const MARS = ecr('2026-03-31', 3, { statut: 'BROUILLARD' });
const AVRIL = ecr('2026-04-01', 4);
const JUILLET = ecr('2026-07-01', 5);

type Ligne = { id: string; compteId: string; debit: number; credit: number; lettre: null; libelle: null; ecriture: Ecriture };
const ligne = (id: string, compteId: string, debit: number, credit: number, ecriture: Ecriture): Ligne => ({
  id,
  compteId,
  debit,
  credit,
  lettre: null,
  libelle: null,
  ecriture,
});
/** Rangées comme la requête les rend · numéro du compte, date. */
const LIGNES: Ligne[] = [
  ligne('an2', 'dotation', 0, 1000, AN),
  ligne('an1', 'banque', 1000, 0, AN),
  ligne('j2', 'banque', 0, 200, JANVIER),
  ligne('m2', 'banque', 0, 50, MARS),
  ligne('p2', 'banque', 0, 300, AVRIL),
  ligne('a2', 'banque', 0, 999, JUILLET),
  ligne('m1', 'caisse', 50, 0, MARS),
  ligne('j1', 'achats', 200, 0, JANVIER),
  ligne('p1', 'achats', 300, 0, AVRIL),
  ligne('a1', 'achats', 999, 0, JUILLET),
];

// --- Un évaluateur des filtres Prisma employés (égalité, not, lt, gte, in, AND, OR).
function valeurRepond(v: unknown, c: unknown): boolean {
  if (c === null || typeof c !== 'object' || c instanceof Date) {
    return v instanceof Date && c instanceof Date ? v.getTime() === c.getTime() : v === c;
  }
  for (const [op, a] of Object.entries(c as Record<string, unknown>)) {
    if (op === 'not' ? valeurRepond(v, a) : false) return false;
    if (op === 'in' && !(a as unknown[]).includes(v)) return false;
    if (op === 'lt' && !((v as Date).getTime() < (a as Date).getTime())) return false;
    if (op === 'lte' && !((v as Date).getTime() <= (a as Date).getTime())) return false;
    if (op === 'gte' && !((v as Date).getTime() >= (a as Date).getTime())) return false;
    if (!['not', 'in', 'lt', 'lte', 'gte'].includes(op)) throw new Error(`Opérateur non lu · ${op}`);
  }
  return true;
}
function repond(e: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  for (const [cle, c] of Object.entries(where)) {
    if (c === undefined) continue;
    if (cle === 'AND') {
      if (!(Array.isArray(c) ? c : [c]).every((x) => repond(e, x as Record<string, unknown>))) return false;
    } else if (cle === 'OR') {
      if (!(c as Record<string, unknown>[]).some((x) => repond(e, x))) return false;
    } else if (!valeurRepond(e[cle], c)) return false;
  }
  return true;
}

function prismaEssai() {
  const choisies = (where: Record<string, unknown>) =>
    LIGNES.filter((x) => {
      const fc = where.compteId as { in: string[] } | string | undefined;
      if (typeof fc === 'string' && x.compteId !== fc) return false;
      if (fc && typeof fc === 'object' && !fc.in.includes(x.compteId)) return false;
      return repond(x.ecriture as never, where.ecriture as Record<string, unknown>);
    });
  const enLigne = (x: Ligne) => ({ ...x, compte: COMPTE.get(x.compteId)!, ecriture: x.ecriture });
  const extraits: Array<Record<string, unknown>> = [];
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(TENANT) },
    exercice: { findFirst: jest.fn(async ({ where }: any) => (where.id === 'ex' && where.tenantId === 't1' ? EXERCICE : null)) },
    ecriture: {
      count: jest.fn(async ({ where }: any) => new Set(LIGNES.filter((x) => repond(x.ecriture as never, where)).map((x) => x.ecriture)).size),
    },
    compte: {
      findMany: jest.fn(async ({ where }: any) => (where.numero ? [] : COMPTES)),
      findFirst: jest.fn(async ({ where }: any) => COMPTE.get(where.id) ?? null),
    },
    ligneEcriture: {
      count: jest.fn(async ({ where }: any) => choisies(where).length),
      findMany: jest.fn(async ({ where, take, cursor, skip }: any) => {
        const toutes = choisies(where).map(enLigne);
        const rang = cursor ? toutes.findIndex((x) => x.id === cursor.id) : -1;
        if (cursor && rang < 0) return [];
        const depart = cursor ? rang + (skip ?? 0) : 0;
        return toutes.slice(depart, depart + (take ?? toutes.length));
      }),
      groupBy: jest.fn(async ({ where }: any) => {
        const sommes = new Map<string, { debit: number; credit: number }>();
        for (const x of choisies(where)) {
          const s = sommes.get(x.compteId) ?? { debit: 0, credit: 0 };
          s.debit += x.debit;
          s.credit += x.credit;
          sommes.set(x.compteId, s);
        }
        return [...sommes].map(([compteId, s]) => ({ compteId, _sum: s }));
      }),
    },
    extraitPeriode: {
      aggregate: jest.fn(async () => ({ _max: { numero: extraits.length === 0 ? null : Math.max(...extraits.map((e) => e.numero as number)) } })),
      create: jest.fn(async ({ data }: any) => {
        const e = { id: `x${extraits.length + 1}`, etabliLe: new Date('2026-10-16T09:00:00Z'), ...data };
        extraits.push(e);
        return e;
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(extraits.find((e) => e.id === where.id)!, data)),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
  };
  (prisma as any).$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return { prisma, extraits };
}

function services() {
  const { prisma, extraits } = prismaEssai();
  const ecritures = new EcritureService(prisma as never, {} as never, {} as never, {} as never);
  const vide = {} as never;
  const exports = new ExportService(prisma as never, ecritures, vide, vide, vide, vide, vide, vide, vide, vide);
  return {
    prisma,
    extraits,
    fpm: new ExportFpmService(prisma as never, ecritures, exports),
    registre: new ExtraitsPeriodeService(prisma as never),
  };
}

async function lire(ecrire: (ouvrir: (nom: string) => Writable) => Promise<unknown>): Promise<{ classeur: ExcelJS.Workbook; nom: string }> {
  const morceaux: Buffer[] = [];
  let nom = '';
  const sortie = new Writable({
    write(m, _e, cb) {
      morceaux.push(Buffer.from(m));
      cb();
    },
  });
  await ecrire((n) => {
    nom = n;
    return sortie;
  });
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(Buffer.concat(morceaux) as never);
  return { classeur, nom };
}

/** Les huit premières cellules de chaque ligne, de la première à la dernière · vide rendu `null`. */
const valeurs = (f: ExcelJS.Worksheet) => {
  const lignes: unknown[][] = [];
  for (let i = 1; i <= f.rowCount; i++) {
    const r = f.getRow(i);
    lignes.push(Array.from({ length: 8 }, (_, k) => r.getCell(k + 1).value ?? null));
  }
  return lignes;
};

/** Le numéro, à prendre une fois, par le registre réel · ce que l'export reçoit. */
function demande(registre: ExtraitsPeriodeService, nature: NatureExtraitPeriode) {
  let numeroter: () => Promise<ExtraitNumerote> = async () => {
    throw new Error('produire non appelé');
  };
  const executer = <T>(travail: (d: { periode: typeof PERIODE; numeroter: () => Promise<ExtraitNumerote> }) => Promise<T>) =>
    registre.produire({ tenantId: 't1', nature, libelle: 'Balance des comptes', periode: PERIODE, etabliPar: 'u1' }, (n) => {
      numeroter = n;
      return travail({ periode: PERIODE, numeroter });
    });
  return executer;
}

describe('la balance d’une période · le report à la veille, l’extrait numéroté et daté', () => {
  it('se titre extrait, garde « Mouvements au » la veille, numéro et date en ligne 7 et au pied', async () => {
    const s = services();
    const { classeur, nom } = await lire((ouvrir) =>
      demande(s.registre, NatureExtraitPeriode.BALANCE)((d) => s.fpm.balanceGeneraleEnFlux('t1', 'ex', false, ouvrir, d)),
    );
    const f = classeur.getWorksheet('Balance')!;
    expect(nom).toBe('balance-2026-du-2026-04-01-au-2026-06-30.xlsx');
    expect(f.getCell('D4').value).toBe('Extrait du 01/04/2026 au 30/06/2026');
    expect(f.getCell('H2').value).toEqual(PERIODE.du);
    expect(f.getCell('H3').value).toEqual(PERIODE.au);
    expect(f.getCell('C8').value).toBe('Mouvements au 31/03/26');
    expect(String(f.getCell('A7').value)).toMatch(/^Extrait n° 1 établi le 16\/10\/2026 · Brouillard compris · 1 écriture non validée$/);
    expect(f.headerFooter.oddFooter).toContain('Extrait n° 1 · du 01/04/2026 au 30/06/2026');
    // Banque · 1 000 d'à-nouveau, 250 sortis avant le 1er avril, 300 en avril, rien d'après.
    const banque = valeurs(f).find((r) => r[0] === '52110000')!;
    expect(banque.slice(2, 8)).toEqual([1000, 250, null, 300, 450, null]);
    // La caisse n'a que son report · sa ligne reste, soldée à 50.
    const caisse = valeurs(f).find((r) => r[0] === '57110000')!;
    expect(caisse.slice(2, 8)).toEqual([50, null, null, null, 50, null]);
    expect(s.extraits).toEqual([expect.objectContaining({ numero: 1, nature: 'BALANCE', termineLe: expect.any(Date) })]);
  });

  it('LE NUMÉRO NE SE PREND QU’APRÈS LES REFUS · un export refusé par son volume ne laisse aucun trou', async () => {
    const s = services();
    s.prisma.ligneEcriture.count.mockResolvedValue(10_000_000);
    await expect(
      lire((ouvrir) => demande(s.registre, NatureExtraitPeriode.BALANCE)((d) => s.fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir, d))),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(s.extraits).toEqual([]);
  });
});

describe('le grand livre d’une période · chaque compte ouvre sur son report', () => {
  it('le report est la première ligne de chaque compte, le compte à report seul garde son bloc, et le livre rend la balance', async () => {
    const s = services();
    const { classeur } = await lire((ouvrir) =>
      demande(s.registre, NatureExtraitPeriode.GRAND_LIVRE)((d) => s.fpm.grandLivreEnFlux('t1', 'ex', ouvrir, { extrait: d })),
    );
    const f = classeur.getWorksheet('Grand-livre des comptes')!;
    const lignes = valeurs(f).slice(8);
    const textes = lignes.map((r) => [r[0] instanceof Date ? (r[0] as Date).toISOString().slice(0, 10) : r[0], r[3], r[5], r[6], r[7]]);
    expect(textes).toEqual([
      ['10100000', 'Dotation', null, null, null],
      ['2026-03-31', 'Report au 31/03/2026', null, 1000, -1000],
      [null, 'Total du compte', null, 1000, -1000],
      ['52110000', 'Banque', null, null, null],
      ['2026-03-31', 'Report au 31/03/2026', 1000, 250, 750],
      ['2026-04-01', 'Pièce 4', null, 300, 450],
      [null, 'Total du compte', 1000, 550, 450],
      ['57110000', 'Caisse', null, null, null],
      ['2026-03-31', 'Report au 31/03/2026', 50, null, 50],
      [null, 'Total du compte', 50, null, 50],
      ['60110000', 'Achats', null, null, null],
      ['2026-03-31', 'Report au 31/03/2026', 200, null, 200],
      ['2026-04-01', 'Pièce 4', 300, null, 500],
      [null, 'Total du compte', 500, null, 500],
      [null, 'Totaux', 1550, 1550, null],
      [null, 'Solde à la balance générale', 1550, 1550, null],
      [null, 'Écart : aucun', null, null, null],
    ]);
    // Condition 2 · l'extrait dit que le grand livre de l'exercice est ailleurs.
    expect(String(f.getCell('A7').value)).toContain("le grand livre de l'exercice est celui du 01/01/2026 au 31/12/2026");
    expect(f.getCell('D4').value).toBe('Extrait du 01/04/2026 au 30/06/2026');
  });

  it('le grand livre d’un seul compte · son report, sa période, et le numéro du compte dans le titre', async () => {
    const s = services();
    const { classeur, nom } = await lire((ouvrir) =>
      demande(s.registre, NatureExtraitPeriode.GRAND_LIVRE)((d) =>
        s.fpm.grandLivreEnFlux('t1', 'ex', ouvrir, { extrait: d, compteId: 'caisse' }),
      ),
    );
    expect(nom).toBe('grand-livre-57110000-2026-du-2026-04-01-au-2026-06-30.xlsx');
    const f = classeur.getWorksheet('Grand-livre des comptes')!;
    expect(f.getCell('D4').value).toBe('Extrait du 01/04/2026 au 30/06/2026 · compte 57110000');
    expect(valeurs(f).slice(8).map((r) => r[3])).toEqual(['Caisse', 'Report au 31/03/2026', 'Total du compte', 'Totaux', 'Solde à la balance générale', 'Écart : aucun']);
  });

  it('la balance avec les grands livres · la feuille d’un compte à report seul existe, son lien ne mène pas nulle part', async () => {
    const s = services();
    const { classeur } = await lire((ouvrir) =>
      demande(s.registre, NatureExtraitPeriode.BALANCE)((d) => s.fpm.balanceGeneraleEnFlux('t1', 'ex', true, ouvrir, d)),
    );
    expect(classeur.worksheets.map((f) => f.name)).toEqual(['Balance', '10100000', '52110000', '57110000', '60110000']);
    const caisse = classeur.getWorksheet('57110000')!;
    expect(valeurs(caisse).slice(8).map((r) => r[3])).toEqual(['Caisse', 'Report au 31/03/2026', 'Total du compte', 'Solde à la balance générale', 'Écart : aucun']);
  });
});

describe('le registre des extraits · le numéro reste, l’échec se dit', () => {
  it('un fichier interrompu après son numéro le garde, l’échec écrit, et l’erreur d’origine remonte', async () => {
    const s = services();
    await expect(
      s.registre.produire({ tenantId: 't1', nature: NatureExtraitPeriode.BALANCE, libelle: 'Balance des comptes', periode: PERIODE, etabliPar: 'u1' }, async (n) => {
        await n();
        throw new Error('connexion perdue');
      }),
    ).rejects.toThrow('connexion perdue');
    expect(s.extraits).toEqual([expect.objectContaining({ numero: 1, motifEchec: 'Production interrompue · connexion perdue', termineLe: null })]);
    // Le suivant prend le numéro d'après · jamais celui de l'interrompu.
    await s.registre.produire({ tenantId: 't1', nature: NatureExtraitPeriode.BALANCE, libelle: 'Balance des comptes', periode: PERIODE, etabliPar: 'u1' }, async (n) => n());
    expect(s.extraits.map((e) => e.numero)).toEqual([1, 2]);
  });

  it('un travail qui ne numérote pas ne prend aucun numéro', async () => {
    const s = services();
    await s.registre.produire({ tenantId: 't1', nature: NatureExtraitPeriode.BALANCE, libelle: 'x', periode: PERIODE, etabliPar: 'u1' }, async () => 'rien');
    expect(s.extraits).toEqual([]);
  });

  it('une marque de fin manquée est consignée, jamais substituée au fichier remis', async () => {
    const s = services();
    s.prisma.extraitPeriode.update.mockRejectedValueOnce(new Error('base indisponible'));
    const consigne = jest.spyOn((s.registre as any).logger, 'error').mockImplementation(() => undefined);
    await expect(
      s.registre.produire({ tenantId: 't1', nature: NatureExtraitPeriode.BALANCE, libelle: 'x', periode: PERIODE, etabliPar: 'u1' }, async (n) => {
        await n();
        return 'remis';
      }),
    ).resolves.toBe('remis');
    expect(consigne).toHaveBeenCalledWith(expect.stringContaining('fichier remis, fin non écrite (base indisponible)'));
  });

  it('le libellé relit le compte dans le dossier, et la création entre ENTIÈRE au journal d’audit', async () => {
    const s = services();
    await expect(s.registre.libelleDe('t1', NatureExtraitPeriode.GRAND_LIVRE, { compteId: 'banque' })).resolves.toBe(
      'Grand livre du compte 52110000 · Banque',
    );
    await expect(s.registre.libelleDe('t1', NatureExtraitPeriode.BALANCE, { avecGrandsLivres: true })).resolves.toBe(
      'Balance des comptes, avec le grand livre de chaque compte',
    );
    await expect(s.registre.libelleDe('t1', NatureExtraitPeriode.GRAND_LIVRE, { compteId: 'inconnu' })).rejects.toThrow(/Compte introuvable/);
    await s.registre.produire({ tenantId: 't1', nature: NatureExtraitPeriode.BALANCE, libelle: 'x', periode: PERIODE, etabliPar: 'u1' }, async (n) => {
      await n();
      return 'remis';
    });
    // Aucun `select` ne réduit l'état d'après que range le journal d'audit.
    expect(s.prisma.extraitPeriode.create.mock.calls[0][0]).not.toHaveProperty('select');
  });

  it('UN EXTRAIT VIDE NE PREND PAS DE NUMÉRO · ni report ni mouvement jusqu’au dernier jour, refus nommé', async () => {
    const s = services();
    // La caisse n'a rien avant le 31 mars · ni report ni mouvement en janvier.
    const janvier = periodeDeLExtrait(EXERCICE, { du: '2026-01-02', au: '2026-01-10' })!;
    await expect(s.registre.refuserSiVide('t1', 'ex', janvier, 'caisse')).rejects.toThrow(
      /Aucune écriture jusqu'au 10\/01\/2026 sur ce compte/,
    );
    expect(s.extraits).toEqual([]);
    // Le dossier entier sur la même quinzaine · l'à-nouveau suffit.
    await expect(s.registre.refuserSiVide('t1', 'ex', janvier)).resolves.toBeUndefined();
  });

  it('établi le jour de Kinshasa · à 23 h 30 en temps universel, c’est déjà le lendemain', async () => {
    const s = services();
    s.prisma.extraitPeriode.create.mockImplementationOnce(async ({ data }: any) => {
      const e = { id: 'x1', etabliLe: new Date('2026-10-15T23:30:00Z'), ...data };
      s.extraits.push(e);
      return e;
    });
    const { classeur } = await lire((ouvrir) =>
      demande(s.registre, NatureExtraitPeriode.BALANCE)((d) => s.fpm.balanceGeneraleEnFlux('t1', 'ex', false, ouvrir, d)),
    );
    expect(String(classeur.getWorksheet('Balance')!.getCell('A7').value)).toMatch(/^Extrait n° 1 établi le 16\/10\/2026 /);
  });
});

