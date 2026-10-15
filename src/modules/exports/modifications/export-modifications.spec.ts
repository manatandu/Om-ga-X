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
  mouvementDe,
  pieceDuFichier,
} from './export-modifications';
import { ImportService } from '../../import/import.service';
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

/** Un filtre Prisma lu sur les seules formes que le service écrit. */
function correspond(ligne: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([cle, attendu]) => {
    const valeur = ligne[cle];
    if (attendu === undefined) return true;
    if (attendu === null) return valeur === null || valeur === undefined;
    if (typeof attendu === 'object' && !(attendu instanceof Date)) {
      const a = attendu as { in?: unknown[]; not?: unknown };
      if ('in' in a) return (a.in ?? []).includes(valeur);
      if ('not' in a) return valeur !== a.not;
      throw new Error(`Filtre non pris en charge par la doublure · ${cle}`);
    }
    return valeur === attendu;
  });
}

/** Tri et curseur, comme Prisma · ordre puis la ligne APRÈS le curseur (`skip: 1`). */
function paginer<T extends { id: string }>(
  lignes: T[],
  args: { orderBy?: unknown; take?: number; cursor?: { id: string }; skip?: number },
): T[] {
  const ordres = (Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : []) as Record<string, 'asc' | 'desc'>[];
  const triees = [...lignes].sort((a, b) => {
    for (const o of ordres) {
      const [cle, sens] = Object.entries(o)[0];
      const va = (a as Record<string, unknown>)[cle] as Date | string | number;
      const vb = (b as Record<string, unknown>)[cle] as Date | string | number;
      const c = va instanceof Date ? va.getTime() - (vb as Date).getTime() : va < vb ? -1 : va > vb ? 1 : 0;
      if (c !== 0) return sens === 'asc' ? c : -c;
    }
    return 0;
  });
  let depart = 0;
  if (args.cursor) depart = triees.findIndex((l) => l.id === args.cursor!.id) + (args.skip ?? 0);
  return triees.slice(depart, args.take !== undefined ? depart + args.take : undefined);
}

function nouveauFaux() {
  const ecritures: Ecriture[] = [];
  const registre: Array<Record<string, unknown> & { id: string }> = [];
  const exports: Array<Record<string, unknown> & { id: string; tenantId: string; numero: number }> = [];
  let compteur = 0;
  const id = (prefixe: string) => `${prefixe}-${String(++compteur).padStart(5, '0')}`;
  const prisma: Record<string, unknown> = {
    ecriture: {
      findMany: async (args: { where: Record<string, unknown>; select?: Record<string, unknown>; include?: unknown; orderBy?: unknown; take?: number; cursor?: { id: string }; skip?: number }) => {
        const filtrees = ecritures.filter((e) => correspond(e as unknown as Record<string, unknown>, args.where));
        const page = paginer(filtrees, args);
        if (args.select) {
          return page.map((e) => ({
            id: e.id,
            ...(args.select!.date ? { date: e.date } : {}),
            ...(args.select!.statut ? { statut: e.statut } : {}),
            ...(args.select!._count ? { _count: { lignes: e.lignes.length } } : {}),
          }));
        }
        return page.map((e) => ({ ...e, lignes: e.lignes.map((l) => ({ ...l })) }));
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
      findMany: async ({ where }: { where: Record<string, unknown> }) => exports.filter((e) => correspond(e, where)),
      count: async ({ where }: { where: Record<string, unknown> }) => exports.filter((e) => correspond(e, where)).length,
    },
    user: { findMany: async () => [{ id: 'u1', email: 'comptable@cabinet.cd' }] },
    $executeRaw: async () => 0,
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
  return { service, ajouter, retirer, ecritures, registre, exports };
}

/** Relit le classeur rangé · les feuilles et leurs lignes, valeurs en texte. */
async function relire(contenu: Buffer) {
  const classeur = new ExcelJS.Workbook();
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
