import * as ExcelJS from 'exceljs';
import { ModeExportEcritures, StatutEcriture } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ExportModificationsService } from './export-modifications.service';
import {
  COLONNES_ECHANGE,
  FEUILLE_ECRITURES,
  FEUILLE_EXPORT,
  FEUILLE_SUPPRIMEES,
  PiecesDistinctes,
  empreinteEcriture,
  libelleMouvement,
  motifEnvoiNonRelu,
  mouvementDe,
  pieceDuFichier,
} from './export-modifications';
import { ImportService } from '../../import/import.service';
import { lireFichier } from '../../import/lecture-fichier';
import { TypeImport } from '../../import/dto/import.dto';

/**
 * L'EXPORT DES SEULES MODIFICATIONS (ligne sage-l7, fonction 99).
 *
 * LA DOUBLURE HONORE LES REQUÊTES QUE LE SERVICE POSE (CLAUDE.md, passe F4b) ·
 * filtres par égalité, `in`, `not`, nul ; tri et curseur ; `_count` des
 * lignes ; transaction · ce que le service obtient dépend de ce qu'il
 * demande, jamais d'une liste rendue telle quelle. Le scénario sur vraie base
 * (fiche de la ligne) rejoue le tout à travers une clôture.
 */

const DOSSIER = 'dossier-1';
const AUTRE = 'dossier-2';

type Ligne = {
  id: string;
  ecritureId: string;
  compte: { numero: string };
  libelle: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  montantDevise: Prisma.Decimal | null;
  coursApplique: Prisma.Decimal | null;
  dateEcheance: Date | null;
  devise: { code: string } | null;
};
type Ecriture = {
  id: string;
  tenantId: string;
  date: Date;
  dateValeur: Date | null;
  journal: { code: string };
  numeroPiece: number | null;
  reference: string | null;
  libelle: string;
  statut: StatutEcriture;
  estANouveauProvisoire: boolean;
  lignes: Ligne[];
};

/** Une valeur comparable · une date par son instant (deux `Date` égales ne sont pas `===`). */
const comparable = (v: unknown) => (v instanceof Date ? v.getTime() : v) as number | string;

/**
 * Un filtre Prisma lu sur les seules formes que le service écrit · égalité,
 * `in`, `not`, `gt` (dates par leur instant), nul, `AND` et `OR` (la
 * pagination par la clé), et le filtre de relation `ecriture` des lignes.
 */
function correspond(ligne: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([cle, attendu]) => {
    if (cle === 'AND') return (attendu as Record<string, unknown>[]).every((w) => correspond(ligne, w));
    if (cle === 'OR') return (attendu as Record<string, unknown>[]).some((w) => correspond(ligne, w));
    const valeur = ligne[cle];
    if (attendu === undefined) return true;
    if (attendu === null) return valeur === null || valeur === undefined;
    if (typeof attendu === 'object' && !(attendu instanceof Date)) {
      const a = attendu as { in?: unknown[]; not?: unknown; gt?: unknown; lt?: unknown };
      if ('in' in a) return (a.in ?? []).includes(valeur);
      if ('not' in a) return valeur !== a.not;
      if ('lt' in a) return valeur !== null && valeur !== undefined && comparable(valeur) < comparable(a.lt);
      if ('gt' in a) return valeur !== null && valeur !== undefined && comparable(valeur) > comparable(a.gt);
      if (valeur && typeof valeur === 'object') return correspond(valeur as Record<string, unknown>, attendu as Record<string, unknown>);
      throw new Error(`Filtre non pris en charge par la doublure · ${cle}`);
    }
    return comparable(valeur) === comparable(attendu);
  });
}

/**
 * Tri et curseur, COMME PRISMA · ordre, puis la ligne APRÈS le curseur
 * (`skip: 1`) ; un curseur dont la ligne n'existe plus ne rend RIEN (c'est le
 * défaut que la pagination par la clé corrige, relecture M6 · la doublure
 * repartait du début et le masquait).
 */
function paginer<T extends { id: string }>(
  lignes: T[],
  args: { orderBy?: unknown; take?: number; cursor?: { id: string }; skip?: number },
): T[] {
  const ordres = (Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : []) as Record<string, 'asc' | 'desc'>[];
  const triees = [...lignes].sort((a, b) => {
    for (const o of ordres) {
      const [cle, sens] = Object.entries(o)[0];
      const va = comparable((a as Record<string, unknown>)[cle]);
      const vb = comparable((b as Record<string, unknown>)[cle]);
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      if (c !== 0) return sens === 'asc' ? c : -c;
    }
    return 0;
  });
  let depart = 0;
  if (args.cursor) {
    const rang = triees.findIndex((l) => l.id === args.cursor!.id);
    if (rang < 0) return [];
    depart = rang + (args.skip ?? 0);
  }
  return triees.slice(depart, args.take !== undefined ? depart + args.take : undefined);
}

function nouveauFaux() {
  const ecritures: Ecriture[] = [];
  const registre: Array<Record<string, unknown> & { id: string }> = [];
  const exports: Array<Record<string, unknown> & { id: string; tenantId: string; numero: number }> = [];
  const lecturesDesLignes: Array<Record<string, unknown>> = [];
  // Appelé après chaque tranche des écritures JAMAIS PARTIES rendue au
  // service · un test y simule un autre poste qui modifie la base pendant
  // l'inventaire (M6, B1), quelle que soit la requête qui lit la tranche.
  const crochets: { surTrancheJamaisParties?: (rendues: Array<{ id: string; date: Date }>) => void } = {};
  let compteur = 0;
  const id = (prefixe: string) => `${prefixe}-${String(++compteur).padStart(5, '0')}`;
  const prisma: Record<string, unknown> = {
    ecriture: {
      findMany: async (args: { where: Record<string, unknown>; select?: Record<string, unknown>; include?: unknown; orderBy?: unknown; take?: number; cursor?: { id: string }; skip?: number }) => {
        const filtrees = ecritures.filter((e) => correspond(e as unknown as Record<string, unknown>, args.where));
        const page = paginer(filtrees, args);
        if (args.select) {
          if (args.select._count) throw new Error("`_count` agrège toute la table des lignes (relecture M2) · le service compte par regroupement.");
          if (args.select.date && !args.select.statut) crochets.surTrancheJamaisParties?.(page.map((e) => ({ id: e.id, date: e.date })));
          return page.map((e) => ({
            id: e.id,
            ...(args.select!.date ? { date: e.date } : {}),
            ...(args.select!.statut ? { statut: e.statut } : {}),
            ...(args.select!.numeroPiece ? { numeroPiece: e.numeroPiece } : {}),
            ...(args.select!.journal ? { journal: e.journal } : {}),
          }));
        }
        return page.map((e) => ({ ...e, lignes: e.lignes.map((l) => ({ ...l })) }));
      },
      findFirst: async (args: { where: Record<string, unknown> }) => {
        const e = ecritures.find((x) => correspond(x as unknown as Record<string, unknown>, args.where));
        return e ? { numeroPiece: e.numeroPiece, date: e.date, journal: e.journal } : null;
      },
    },
    ligneEcriture: {
      groupBy: async (args: { by: string[]; where: { ecritureId: { in: string[] }; ecriture?: Record<string, unknown> } }) => {
        lecturesDesLignes.push(args.where);
        return ecritures
          .filter((e) => args.where.ecritureId.in.includes(e.id) && correspond(e as unknown as Record<string, unknown>, args.where.ecriture))
          .map((e) => ({ ecritureId: e.id, _count: { _all: e.lignes.length } }));
      },
    },
    ecritureExportee: {
      findMany: async (args: { where: Record<string, unknown>; orderBy?: unknown; take?: number; cursor?: { id: string }; skip?: number }) =>
        paginer(registre.filter((r) => correspond(r, args.where)), args).map((r) => ({ ...r })),
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const avant = registre.length;
        for (let i = registre.length - 1; i >= 0; i--) if (correspond(registre[i], where)) registre.splice(i, 1);
        return { count: avant - registre.length };
      },
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        for (const d of data) registre.push({ id: id('reg'), supprimeeAuNumero: null, ...d });
        return { count: data.length };
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let n = 0;
        for (const r of registre) if (correspond(r, where)) (Object.assign(r, data), n++);
        return { count: n };
      },
    },
    exportEcritures: {
      aggregate: async ({ where }: { where: Record<string, unknown> }) => {
        const nums = exports.filter((e) => correspond(e, where)).map((e) => e.numero);
        return { _max: { numero: nums.length ? Math.max(...nums) : null } };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const e = { id: id('exp'), ...data } as (typeof exports)[number];
        exports.push(e);
        return { id: e.id };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => exports.find((e) => correspond(e, where)) ?? null,
      findMany: async ({ where, take, select }: { where: Record<string, unknown>; take?: number; select?: Record<string, boolean> }) =>
        exports
          .filter((e) => correspond(e, where))
          .sort((a, b) => b.numero - a.numero)
          .slice(0, take)
          .map((e) => (select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, e[k]])) : e)),
      count: async ({ where }: { where: Record<string, unknown> }) => exports.filter((e) => correspond(e, where)).length,
    },
    user: { findMany: async () => [{ id: 'u1', email: 'comptable@cabinet.cd' }] },
    $executeRaw: async () => 0,
    // Le décompte des écritures jamais parties (NOT EXISTS sur le registre),
    // rejoué sur la doublure · dossier, statut, (date, identifiant) au moins
    // ceux de la première qui attend.
    $queryRaw: async (morceaux: TemplateStringsArray, ...valeurs: unknown[]) => {
      const texte = morceaux.join('?');
      if (!texte.includes('NOT EXISTS')) throw new Error('Requête brute non prise en charge par la doublure.');
      const [dossier, statut, date, idDepuis] = valeurs as [string, Prisma.Sql, Date, string];
      const brouillardCompris = statut.strings.join('?').includes('<>');
      const connues = new Set(registre.filter((r) => r.tenantId === dossier).map((r) => r.ecritureId));
      const n = ecritures.filter(
        (e) =>
          e.tenantId === dossier &&
          !e.estANouveauProvisoire &&
          (brouillardCompris ? e.statut !== StatutEcriture.SITUATION : e.statut === StatutEcriture.VALIDEE) &&
          (e.date.getTime() > date.getTime() || (e.date.getTime() === date.getTime() && e.id >= idDepuis)) &&
          !connues.has(e.id),
      ).length;
      return [{ n }];
    },
  };
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  const exportService = {
    identiteEtat: async () => ({ entite: 'ASBL Essai', nif: 'A123', periode: 'Toutes périodes', devise: 'CDF', immatriculation: '' }),
  };
  const service = new ExportModificationsService(prisma as never, exportService as never);

  const d = (x: number) => new Prisma.Decimal(x);
  const ajouter = (p: Partial<Omit<Ecriture, 'date'>> & { date: string; montant?: number; tenantId?: string }) => {
    const eid = id('ecr');
    const montant = p.montant ?? 1000;
    const e: Ecriture = {
      id: eid,
      tenantId: p.tenantId ?? DOSSIER,
      date: new Date(`${p.date}T00:00:00Z`),
      dateValeur: null,
      journal: { code: 'BQ' },
      numeroPiece: p.numeroPiece === undefined ? compteur : p.numeroPiece,
      reference: null,
      libelle: p.libelle ?? 'Pièce',
      statut: p.statut ?? StatutEcriture.VALIDEE,
      estANouveauProvisoire: p.estANouveauProvisoire ?? false,
      lignes: [],
    };
    e.lignes = [
      { id: id('lig'), ecritureId: eid, compte: { numero: '60110000' }, libelle: null, debit: d(montant), credit: d(0), montantDevise: null, coursApplique: null, dateEcheance: null, devise: null },
      { id: id('lig'), ecritureId: eid, compte: { numero: '52110000' }, libelle: null, debit: d(0), credit: d(montant), montantDevise: null, coursApplique: null, dateEcheance: null, devise: null },
    ];
    ecritures.push(e);
    return e;
  };
  const retirer = (e: Ecriture) => ecritures.splice(ecritures.indexOf(e), 1);
  return { service, ajouter, retirer, ecritures, registre, exports, lecturesDesLignes, crochets };
}

/** Relit le classeur rangé · les feuilles et leurs lignes, valeurs en texte. */
async function relire(contenu: Buffer, moteur: typeof ExcelJS = ExcelJS) {
  // Après `jest.resetModules()`, le classeur se relit par un ExcelJS chargé
  // de nouveau · l'ancien chargerait ses flux dans le nouveau registre.
  const classeur = new moteur.Workbook();
  await classeur.xlsx.load(contenu as unknown as ArrayBuffer);
  const feuille = (nom: string) => {
    const f = classeur.getWorksheet(nom);
    if (!f) throw new Error(`Feuille absente · ${nom}`);
    const lignes: unknown[][] = [];
    f.eachRow((r) => lignes.push((r.values as unknown[]).slice(1)));
    return lignes;
  };
  return { noms: classeur.worksheets.map((f) => f.name), feuille };
}

const contenuRange = (f: ReturnType<typeof nouveauFaux>, numero: number) =>
  Buffer.from(f.exports.find((e) => e.numero === numero)!.contenu as Buffer);

describe('export des seules modifications · registre et fichier', () => {
  it('le premier export porte tout, le second ne porte que ce qui est né depuis, rien en double', async () => {
    const f = nouveauFaux();
    f.ajouter({ date: '2026-01-10' });
    f.ajouter({ date: '2026-01-05' });
    f.ajouter({ date: '2026-01-07', tenantId: AUTRE });
    const premier = await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    expect(premier).toMatchObject({ numero: 1, nombreEcritures: 2, nombreNouvelles: 2, nombreLignes: 4, nombreSupprimees: 0 });
    // Le dossier voisin n'est ni lu ni compté.
    expect(f.registre.map((r) => r.tenantId)).toEqual([DOSSIER, DOSSIER]);

    // Rien de neuf · aucun numéro n'est pris.
    await expect(f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(
      /Aucune modification depuis l'export n° 1/,
    );
    expect(f.exports).toHaveLength(1);

    const troisieme = f.ajouter({ date: '2026-02-01' });
    const second = await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    expect(second).toMatchObject({ numero: 2, nombreEcritures: 1, nombreNouvelles: 1 });
    const { feuille } = await relire(contenuRange(f, 2));
    const ids = feuille(FEUILLE_ECRITURES).slice(1).map((l) => l[15]);
    expect(new Set(ids)).toEqual(new Set([troisieme.id]));
  });

  it('une écriture du brouillard modifiée repart entière et dit l’envoi qu’elle remplace ; validée depuis, elle le dit', async () => {
    const f = nouveauFaux();
    const b = f.ajouter({ date: '2026-03-01', statut: StatutEcriture.BROUILLARD, montant: 500 });
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);

    // Réenregistrée à l'identique (lignes recréées sous d'autres
    // identifiants) · même empreinte, rien ne repart.
    b.lignes = b.lignes.map((l, i) => ({ ...l, id: `recree-${i}` }));
    await expect(f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification/);

    b.lignes[0].debit = new Prisma.Decimal(750);
    b.lignes[1].credit = new Prisma.Decimal(750);
    const deux = await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    expect(deux).toMatchObject({ numero: 2, nombreModifiees: 1, nombreNouvelles: 0 });
    let lignes = (await relire(contenuRange(f, 2))).feuille(FEUILLE_ECRITURES);
    expect(lignes[1][14]).toBe("Modifiée · remplace l'envoi n° 1");
    expect(lignes[1][6]).toBe(750);

    // La validation est une modification · son entrée au livre-journal.
    b.statut = StatutEcriture.VALIDEE;
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    lignes = (await relire(contenuRange(f, 3))).feuille(FEUILLE_ECRITURES);
    expect(lignes[1][13]).toBe('Validée');
    expect(lignes[1][14]).toBe("Modifiée · remplace l'envoi n° 2 · validée depuis");

    // Partie validée, elle ne se relit plus (art. 22, 2°).
    await expect(f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification/);
  });

  it('une écriture du brouillard retirée après son envoi est nommée une fois, avec l’envoi qui la portait', async () => {
    const f = nouveauFaux();
    const b = f.ajouter({ date: '2026-03-01', statut: StatutEcriture.BROUILLARD, libelle: 'Achat retiré' });
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    f.retirer(b);
    const deux = await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    expect(deux).toMatchObject({ numero: 2, nombreEcritures: 0, nombreSupprimees: 1 });
    const supprimees = (await relire(contenuRange(f, 2))).feuille(FEUILLE_SUPPRIMEES);
    expect(supprimees[0]).toEqual(COLONNES_SUPPRIMEES_ENTETES);
    expect(supprimees[1][0]).toBe(b.id);
    expect(supprimees[1][4]).toBe('Achat retiré');
    expect(supprimees[1][5]).toBe(1);
    // Dite une fois · le registre la marque, l'export suivant n'a plus rien.
    await expect(f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification/);
  });

  it('brouillard non compris · seul le livre-journal part ; la pièce du brouillard partira validée', async () => {
    const f = nouveauFaux();
    f.ajouter({ date: '2026-01-02' });
    const b = f.ajouter({ date: '2026-01-03', statut: StatutEcriture.BROUILLARD });
    const un = await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, false);
    expect(un.nombreEcritures).toBe(1);
    b.statut = StatutEcriture.VALIDEE;
    const deux = await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, false);
    expect(deux).toMatchObject({ nombreEcritures: 1, nombreNouvelles: 1 });
  });

  it('ni simulation ni à-nouveau provisoire ne partent', async () => {
    const f = nouveauFaux();
    f.ajouter({ date: '2026-01-02', statut: StatutEcriture.SITUATION });
    f.ajouter({ date: '2026-01-01', statut: StatutEcriture.BROUILLARD, estANouveauProvisoire: true });
    await expect(f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(
      /Aucune écriture à exporter/,
    );
  });

  it('un autre export rangé pendant la production refuse le second, sans numéro pris', async () => {
    const f = nouveauFaux();
    f.ajouter({ date: '2026-01-02' });
    const inventaire = f.service.inventaire.bind(f.service);
    jest.spyOn(f.service, 'inventaire').mockImplementationOnce(async (...a) => {
      const inv = await inventaire(...a);
      f.exports.push({ id: 'concurrent', tenantId: DOSSIER, numero: 1 });
      return inv;
    });
    await expect(f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(
      /Un autre export \(n° 1\) a été produit pendant celui-ci/,
    );
    expect(f.registre).toHaveLength(0);
  });

  it('le fichier se relit par l’import des écritures · toutes les colonnes exigées sont reconnues, une pièce par écriture', async () => {
    const f = nouveauFaux();
    // Deux pièces sans numéro le même jour dans le même journal · l'import les
    // fondrait en une si le fichier ne les distinguait pas.
    f.ajouter({ date: '2026-04-01', numeroPiece: null, montant: 100 });
    f.ajouter({ date: '2026-04-01', numeroPiece: null, montant: 200 });
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    const contenu = contenuRange(f, 1);
    const relu = await relire(contenu);
    expect(relu.noms).toEqual([FEUILLE_ECRITURES, FEUILLE_SUPPRIMEES, FEUILLE_EXPORT]);
    const lignes = relu.feuille(FEUILLE_ECRITURES);
    expect(lignes[0]).toEqual(COLONNES_ECHANGE.map((c) => c.header));
    expect(new Set(lignes.slice(1).map((l) => l[2])).size).toBe(2);

    const importService = new ImportService(null as never, null as never);
    const analyse = await importService.analyser({
      type: TypeImport.ECRITURES,
      nomFichier: 'export.xlsx',
      contenuBase64: contenu.toString('base64'),
    } as never);
    expect(analyse.manquants).toEqual([]);
    expect(analyse.mappingPropose).toMatchObject({
      date: 'Date',
      journal: 'Code journal',
      piece: 'N° de pièce',
      numero: 'Numéro de compte',
      libelle: 'Libellé',
      debit: 'Débit',
      credit: 'Crédit',
      montantDevise: 'Montant en devise',
      devise: 'Devise',
      cours: 'Cours',
    });
    const recap = relu.feuille(FEUILLE_EXPORT);
    expect(recap.find((l) => l[0] === 'Export n°')?.[1]).toBe(1);
    expect(recap.find((l) => l[0] === 'Portée')?.[1]).toBe('Premier export');
  });

  it('un envoi qui remplace ou retire une pièce est REFUSÉ ENTIER par l’import, en le nommant ; le premier envoi se relit (M3)', async () => {
    const f = nouveauFaux();
    const b = f.ajouter({ date: '2026-04-01', statut: StatutEcriture.BROUILLARD });
    const c = f.ajouter({ date: '2026-04-02', statut: StatutEcriture.BROUILLARD });
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    const importService = new ImportService(null as never, null as never);
    const tableauDe = (n: number) => lireFichier('export.xlsx', contenuRange(f, n).toString('base64'));
    // Le premier envoi · des « Nouvelle » seulement, aucune suppression.
    const premier = await tableauDe(1);
    expect(premier.lignesSupprimees).toBe(0);
    expect(motifEnvoiNonRelu(premier.colonnes, premier.lignes, 0)).toBeNull();

    // Le second · une pièce modifiée, une retirée.
    b.libelle = 'Libellé corrigé';
    f.retirer(c);
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    const contenu = contenuRange(f, 2);
    const analyse = await importService.analyser({ type: TypeImport.ECRITURES, nomFichier: 'export.xlsx', contenuBase64: contenu.toString('base64') } as never);
    // Refusé AVANT toute lecture du dossier (la doublure de Prisma est nulle).
    await expect(
      importService.executer(DOSSIER, 'u1', {
        type: TypeImport.ECRITURES,
        nomFichier: 'export.xlsx',
        contenuBase64: contenu.toString('base64'),
        mapping: analyse.mappingPropose,
      } as never),
    ).rejects.toThrow(
      /2 lignes de la colonne « Mouvement » remplacent ou renvoient une pièce déjà envoyée \(première à la ligne 2 · « Modifiée · remplace l'envoi n° 1 »\) · l'import les créerait une seconde fois ; la feuille « Supprimées » nomme 1 pièce retirée.*Rien n'est importé/,
    );
  });

  it('au-delà du plafond, l’export des modifications part par lots dans l’ordre des dates et dit ce qui attend ; le complet est refusé', async () => {
    const ancien = process.env.EXPORT_MAX_LIGNES;
    jest.resetModules();
    process.env.EXPORT_MAX_LIGNES = '4';
    try {
      // Le plafond se lit au chargement du module · relu ici sous 4 lignes.
      const { ExportModificationsService: Service } = await import('./export-modifications.service');
      const f = nouveauFaux();
      const service = new Service((f.service as unknown as { prisma: unknown }).prisma as never, { identiteEtat: async () => ({ entite: 'X', nif: '', periode: '', devise: 'CDF' }) } as never);
      const tardive = f.ajouter({ date: '2026-03-01' });
      f.ajouter({ date: '2026-01-01' });
      f.ajouter({ date: '2026-02-01' });
      await expect(service.exporter(DOSSIER, 'u1', ModeExportEcritures.COMPLET, true)).rejects.toThrow(/refusé plutôt qu'amputé/);
      const un = await service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
      expect(un).toMatchObject({ nombreEcritures: 2, nombreLignes: 4, nombreEnAttente: 1 });
      expect(f.registre.map((r) => r.ecritureId)).not.toContain(tardive.id);
      const deux = await service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
      expect(deux).toMatchObject({ nombreEcritures: 1, nombreEnAttente: 0 });
      expect(f.registre.map((r) => r.ecritureId)).toContain(tardive.id);
    } finally {
      if (ancien === undefined) delete process.env.EXPORT_MAX_LIGNES;
      else process.env.EXPORT_MAX_LIGNES = ancien;
      jest.resetModules();
    }
  });

  it('un brouillard retiré pendant l’inventaire n’arrête plus la lecture · la tranche suivante part de la clé (M6)', async () => {
    const f = nouveauFaux();
    // Une tranche pleine (5 000) et deux écritures au-delà.
    for (let i = 0; i < 5002; i++) f.ajouter({ date: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}` });
    const prisma = (f.service as unknown as { prisma: { ecriture: { findMany: (a: { select?: Record<string, unknown> }) => Promise<Array<{ id: string }>> } } }).prisma;
    const lire = prisma.ecriture.findMany;
    let premiere = true;
    prisma.ecriture.findMany = async (a) => {
      const rendues = await lire(a);
      // Après la PREMIÈRE tranche des écritures jamais parties, sa dernière
      // écriture est retirée (brouillard supprimé pendant la lecture).
      if (premiere && a.select?.date && !a.select?.statut && rendues.length > 0) {
        premiere = false;
        f.retirer(f.ecritures.find((e) => e.id === rendues[rendues.length - 1].id)!);
      }
      return rendues;
    };
    const apercu = await f.service.apercu(DOSSIER, true);
    // La pièce retirée était déjà lue (l'export, lui, la saute à l'écriture
    // du fichier) · les DEUX suivantes le sont aussi. Le curseur de Prisma
    // relisait la ligne retirée · la seconde tranche revenait vide, et
    // l'aperçu disait 5 000, deux pièces jamais parties tues.
    expect(apercu.nouvelles).toBe(5002);
    expect(premiere).toBe(false);
  });

  it('une pièce jamais partie dont la date avance pendant l’inventaire est retenue UNE fois, et part une fois (B1)', async () => {
    jest.resetModules();
    // Des tranches de deux écritures · la frontière de tranche, sans en
    // fabriquer cinq mille.
    jest.doMock('../../../common/lecture-par-lots', () => ({ ...jest.requireActual('../../../common/lecture-par-lots'), LOT_LECTURE: 2 }));
    try {
      const { ExportModificationsService: Service } = await import('./export-modifications.service');
      const f = nouveauFaux();
      const prisma = (f.service as unknown as { prisma: unknown }).prisma;
      const service = new Service(prisma as never, { identiteEtat: async () => ({ entite: 'X', nif: '', periode: '', devise: 'CDF' }) } as never);
      for (let i = 1; i <= 5; i++) f.ajouter({ date: `2026-01-0${i}` });
      let deplacee: string | undefined;
      f.crochets.surTrancheJamaisParties = (rendues) => {
        // Après la PREMIÈRE tranche, un autre poste corrige la date d'une pièce
        // déjà lue · elle passe au 31 décembre, au-delà de la clé de la tranche.
        if (deplacee || rendues.length === 0) return;
        deplacee = rendues[0].id;
        f.ecritures.find((e) => e.id === deplacee)!.date = new Date('2026-12-31T00:00:00Z');
      };
      const apercu = await service.apercu(DOSSIER, true);
      expect(deplacee).toBeDefined();
      // Retenue deux fois, elle se comptait six fois sur cinq pièces.
      expect(apercu).toMatchObject({ nouvelles: 5, lignes: 10 });

      // L'export · la pièce déplacée (de nouveau, la première lue) part une fois.
      for (const e of f.ecritures) e.date = new Date(`2026-01-0${1 + f.ecritures.indexOf(e)}T00:00:00Z`);
      deplacee = undefined;
      const envoi = await service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
      expect(deplacee).toBeDefined();
      expect(envoi).toMatchObject({ nombreEcritures: 5, nombreNouvelles: 5, nombreLignes: 10 });
      const lignes = (await relire(contenuRange(f, 1), await import('exceljs'))).feuille(FEUILLE_ECRITURES).slice(1);
      // Ses deux lignes, une fois · deux fois, l'import fondait les deux en
      // une pièce aux montants doublés.
      expect(lignes.filter((l) => l[15] === deplacee)).toHaveLength(2);
      expect(f.registre.filter((r) => r.ecritureId === deplacee)).toHaveLength(1);
    } finally {
      jest.dontMock('../../../common/lecture-par-lots');
      jest.resetModules();
    }
  });

  it('les lignes se comptent par regroupement sur la tranche, et ce qui attend par la base, sans lire la suite (M2)', async () => {
    const ancien = process.env.EXPORT_MAX_LIGNES;
    jest.resetModules();
    process.env.EXPORT_MAX_LIGNES = '4';
    try {
      const { ExportModificationsService: Service } = await import('./export-modifications.service');
      const f = nouveauFaux();
      const prisma = (f.service as unknown as { prisma: Record<string, { findMany?: unknown }> }).prisma;
      const service = new Service(prisma as never, { identiteEtat: async () => ({ entite: 'X', nif: '', periode: '', devise: 'CDF' }) } as never);
      for (let i = 1; i <= 10; i++) f.ajouter({ date: `2026-01-${String(i).padStart(2, '0')}` });
      const apercu = await service.apercu(DOSSIER, true);
      expect(apercu).toMatchObject({ nouvelles: 2, lignes: 4, enAttente: 8 });
      // Le regroupement ne porte que sur les écritures de la tranche, du dossier.
      expect(f.lecturesDesLignes.length).toBeGreaterThan(0);
      for (const w of f.lecturesDesLignes) expect(w).toMatchObject({ ecriture: { tenantId: DOSSIER, statut: { not: StatutEcriture.SITUATION } } });
    } finally {
      if (ancien === undefined) delete process.env.EXPORT_MAX_LIGNES;
      else process.env.EXPORT_MAX_LIGNES = ancien;
      jest.resetModules();
    }
  });

  it('une pièce qu’aucun export ne peut porter est NOMMÉE, jamais dite « aucune modification » (m3)', async () => {
    const ancien = process.env.EXPORT_MAX_LIGNES;
    jest.resetModules();
    process.env.EXPORT_MAX_LIGNES = '4';
    try {
      const { ExportModificationsService: Service } = await import('./export-modifications.service');
      const f = nouveauFaux();
      const prisma = (f.service as unknown as { prisma: unknown }).prisma;
      const service = new Service(prisma as never, { identiteEtat: async () => ({ entite: 'X', nif: '', periode: '', devise: 'CDF' }) } as never);
      const grosse = f.ajouter({ date: '2026-01-01', numeroPiece: 17 });
      grosse.lignes = [...grosse.lignes, ...grosse.lignes, ...grosse.lignes].map((l, i) => ({ ...l, id: `g-${i}` }));
      f.ajouter({ date: '2026-01-02' });
      const apercu = await service.apercu(DOSSIER, true);
      expect(apercu.horsPlafond).toMatch(/pièce n° 17 du journal BQ, du 01\/01\/2026, porte 6 lignes, au-delà du plafond de 4 lignes/);
      expect(apercu.enAttente).toBe(1);
      await expect(service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/pièce n° 17 du journal BQ/);
      expect(f.exports).toHaveLength(0);
    } finally {
      if (ancien === undefined) delete process.env.EXPORT_MAX_LIGNES;
      else process.env.EXPORT_MAX_LIGNES = ancien;
      jest.resetModules();
    }
  });

  it('un brouillard envoyé puis modifié, hors de la portée, se compte à l’aperçu et au récapitulatif (m8)', async () => {
    const f = nouveauFaux();
    const b = f.ajouter({ date: '2026-01-02', statut: StatutEcriture.BROUILLARD });
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    b.libelle = 'Libellé corrigé';
    f.ajouter({ date: '2026-01-03' });
    expect((await f.service.apercu(DOSSIER, false)).brouillardModifieHorsPortee).toBe(1);
    // Inchangé, il ne se compte pas.
    expect((await f.service.apercu(DOSSIER, true)).brouillardModifieHorsPortee).toBe(0);
    const deux = await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, false);
    expect(deux.brouillardModifieHorsPortee).toBe(1);
    const recap = (await relire(contenuRange(f, 2))).feuille(FEUILLE_EXPORT);
    expect(recap.find((l) => l[0] === 'Envoyées au brouillard, modifiées depuis, hors de cette portée')?.[1]).toBe(1);
  });

  it('l’export complet renvoie tout, dit ce qui était déjà parti, et ne fait rien repartir ensuite', async () => {
    const f = nouveauFaux();
    f.ajouter({ date: '2026-01-02' });
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    f.ajouter({ date: '2026-01-03' });
    const complet = await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.COMPLET, true);
    expect(complet).toMatchObject({ numero: 2, nombreEcritures: 2, nombreNouvelles: 1, nombreModifiees: 0 });
    const lignes = (await relire(contenuRange(f, 2))).feuille(FEUILLE_ECRITURES);
    expect(lignes.slice(1).map((l) => l[14])).toEqual(['Déjà envoyée au n° 1', 'Déjà envoyée au n° 1', 'Nouvelle', 'Nouvelle']);
    await expect(f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true)).rejects.toThrow(/Aucune modification/);
  });
});

describe('liste des exports', () => {
  /**
   * LA LISTE SE LIT · le 500 « Cannot access 'exports' before initialization »
   * (une variable locale `exports` masquait celui du module compilé en
   * CommonJS) n'a été vu qu'au premier serveur réel, faute d'un test qui
   * appelle `lister`.
   */
  it('les plus récents d’abord, l’auteur en courriel, sans le fichier, le total dit', async () => {
    const f = nouveauFaux();
    f.ajouter({ date: '2026-01-02' });
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    f.ajouter({ date: '2026-01-03' });
    await f.service.exporter(DOSSIER, 'u1', ModeExportEcritures.MODIFICATIONS, true);
    const liste = await f.service.lister(DOSSIER);
    expect(liste.exports.map((e) => [e.numero, e.produitPar, e.nombreNouvelles])).toEqual([
      [2, 'comptable@cabinet.cd', 1],
      [1, 'comptable@cabinet.cd', 1],
    ]);
    expect(liste.exports.every((e) => !('contenu' in e))).toBe(true);
    expect([liste.total, liste.tronque, liste.plusAnciensAvant]).toEqual([2, false, null]);
  });

  it('la liste se poursuit par le numéro · un ancien export se retrouve et se retélécharge (m5)', async () => {
    const f = nouveauFaux();
    for (let n = 1; n <= 52; n++) {
      f.exports.push({ id: `exp-${n}`, tenantId: DOSSIER, numero: n, produitPar: 'u1', nomFichier: `ecritures-export-${n}.xlsx`, contenu: Buffer.from(`envoi ${n}`) });
    }
    const premiere = await f.service.lister(DOSSIER);
    expect([premiere.exports.length, premiere.exports[0].numero, premiere.plusAnciensAvant, premiere.tronque]).toEqual([50, 52, 3, true]);
    const suite = await f.service.lister(DOSSIER, premiere.plusAnciensAvant!);
    expect([suite.exports.map((e) => e.numero), suite.plusAnciensAvant]).toEqual([[2, 1], null]);
    expect((await f.service.fichier(DOSSIER, 'exp-1')).contenu.toString()).toBe('envoi 1');
  });
});

const COLONNES_SUPPRIMEES_ENTETES = ["Identifiant de l'écriture", 'Date', 'Code journal', 'N° de pièce', 'Libellé', "Envoyée à l'export n°"];

describe('règles pures de l’export des modifications', () => {
  const base = {
    id: 'e1',
    date: new Date('2026-01-01T00:00:00Z'),
    dateValeur: null,
    journal: 'BQ',
    numeroPiece: 3,
    reference: null,
    libelle: 'X',
    statut: StatutEcriture.BROUILLARD,
    lignes: [
      { compte: '601', libelle: null, debit: '10.00', credit: '0.00', devise: null, montantDevise: null, cours: null, echeance: null },
      { compte: '521', libelle: null, debit: '0.00', credit: '10.00', devise: null, montantDevise: null, cours: null, echeance: null },
    ],
  };

  it('l’empreinte ne dépend pas de l’ordre des lignes, mais du lettrage non plus · il n’y entre pas', () => {
    const a = empreinteEcriture(base);
    expect(empreinteEcriture({ ...base, lignes: [...base.lignes].reverse() })).toBe(a);
    expect(empreinteEcriture({ ...base, statut: StatutEcriture.VALIDEE })).not.toBe(a);
    expect(empreinteEcriture({ ...base, dateValeur: new Date('2025-12-31T00:00:00Z') })).not.toBe(a);
    // L'échéance d'une ligne est du contenu.
    expect(empreinteEcriture({ ...base, lignes: [{ ...base.lignes[0], echeance: '2026-02-01' }, base.lignes[1]] })).not.toBe(a);
  });

  it('le mouvement se lit contre le registre', () => {
    const entree = { numeroExport: 4, statutExporte: StatutEcriture.BROUILLARD, empreinte: 'abc' };
    expect(mouvementDe(undefined, 'abc')).toBe('NOUVELLE');
    expect(mouvementDe(entree, 'abc')).toBe('RENVOYEE');
    expect(mouvementDe(entree, 'def')).toBe('MODIFIEE');
    expect(libelleMouvement('MODIFIEE', entree, StatutEcriture.BROUILLARD)).toBe("Modifiée · remplace l'envoi n° 4");
  });

  it('deux pièces sans numéro, ou au même numéro, du même jour et du même journal restent distinctes', () => {
    expect(pieceDuFichier(null, 'abcdef0123')).toBe('sans n° · abcdef01');
    const p = new PiecesDistinctes();
    const jour = new Date('2026-01-01T00:00:00Z');
    expect(p.piece({ id: 'aaaaaaaa1', date: jour, journal: 'BQ', numeroPiece: 7 })).toBe('7');
    expect(p.piece({ id: 'bbbbbbbb2', date: jour, journal: 'BQ', numeroPiece: 7 })).toBe('7 · bbbbbbbb');
    expect(p.piece({ id: 'cccccccc3', date: jour, journal: 'AC', numeroPiece: 7 })).toBe('7');
  });
});
