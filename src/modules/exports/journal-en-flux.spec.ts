import { Writable } from 'stream';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as ExcelJS from 'exceljs';
import * as JSZip from 'jszip';
import { ExportService } from './export.service';
import { PrismaService } from '../../common/prisma.service';
import { PLAFOND_ECRITURES_PAR_FENETRE, perimetreJournal } from '../comptabilite/ecriture.service';
import { LIGNE_ENTETE, PREMIERE_LIGNE_DONNEES, OPTIONS_CLASSEUR_EN_FLUX } from './classeur-en-flux';
import { TITRES_COLONNES_JOURNAL } from './journal-edition';

// Chaque cas écrit puis relit un classeur en flux · sous une suite chargée l'un
// d'eux a dépassé les cinq secondes par défaut de Jest (2026-10-04), sans
// qu'aucune assertion ait changé.
jest.setTimeout(30000);

/**
 * LE JOURNAL EXPORTÉ SORTAIT FAUX, ET RIEN NE LE DISAIT.
 *
 * `journalExcel` appelait `EcritureService.lister()` sans limite. Or `lister`
 * n'en rend jamais plus de `PLAFOND_ECRITURES_PAR_FENETRE`, soit 2 000 · le
 * plafond d'une FENÊTRE, posé pour qu'un écran ne tue pas le serveur. Un
 * fichier n'est pas une fenêtre : le journal d'un dossier de trois mille
 * écritures s'exportait amputé du tiers, sans un mot.
 *
 * Et la ligne TOTAUX aggravait l'amputation au lieu de la révéler. Elle porte
 * une formule `SUM` sur les lignes écrites ET, en valeur jointe, l'agrégat SQL
 * de la période ENTIÈRE. Le même classeur annonçait donc deux totaux : Excel
 * recalcule et montre le tronqué, tout ce qui lit sans moteur de calcul (un
 * import, un convertisseur, un aperçu) lit le complet.
 *
 * Le livre-journal est un livre obligatoire (AUDCIF art. 22, 6°). Le grand
 * livre porte déjà, en toutes lettres, qu'« un livre amputé en silence est un
 * document FAUX » · le journal n'avait pas eu droit à la même phrase.
 *
 * Depuis le 2026-10-16 (décision de Manasse, « Comme Sage »), le journal se
 * présente comme l'édition de Sage · un bloc par journal sous son en-tête,
 * sept colonnes, les totaux du journal, et la piste du réviseur dans une
 * seconde feuille. Les propriétés de la lecture (par lots, sans troncature,
 * sans doublon) n'ont pas bougé · elles se relisent sur la nouvelle feuille.
 */

const EXERCICE = { id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };

/**
 * La feuille « Journal » d'un seul bloc · quatre lignes d'en-tête (titre et
 * période, journal et unité, tirage, mention), les titres des sept colonnes
 * en ligne 5, les données dès la ligne 6. Les rangs sont RÉÉCRITS ici · les
 * importer rendrait le test d'accord avec n'importe quelle mise en page.
 */
const TITRES_DU_BLOC = 5;
const DONNEES = 6;
/** Rangs des colonnes de la feuille « Journal ». */
const JOUR = 1;
const PIECE = 2;
const COMPTE = 3;
const TIERS = 4;
const LIBELLE = 5;
const DEBIT = 6;
const CREDIT = 7;

type Journal = { id: string; code: string; intitule: string; type: string };
const ACHATS: Journal = { id: 'j-ach', code: 'ACH', intitule: 'Achats', type: 'ACHATS' };
const BANQUE: Journal = { id: 'j-bq', code: 'BQ', intitule: 'Banque', type: 'TRESORERIE' };

/** Une écriture à deux lignes, équilibrée · le grain de l'export. */
const ecriture = (i: number, journal: Journal = ACHATS) => ({
  id: `e-${String(i).padStart(6, '0')}`,
  journalId: journal.id,
  date: new Date('2026-03-01'),
  dateValeur: null as Date | null,
  numeroPiece: i,
  reference: `FAC-${i}`,
  libelle: `Écriture ${i}`,
  statut: 'VALIDEE',
  motifCorrection: null as string | null,
  createdAt: new Date('2026-03-02'),
  createdBy: 'u-1',
  valideeAt: new Date('2026-03-03') as Date | null,
  valideeBy: 'u-1' as string | null,
  correction: null as { numeroPiece: number } | null,
  corrigeEcriture: null as { numeroPiece: number } | null,
  lignes: [
    { debit: 100, credit: 0, libelle: 'débit', compte: { numero: '60410000', tiersCompte: null, _count: { individuels: 0 } } },
    {
      debit: 0,
      credit: 100,
      libelle: 'crédit',
      compte: { numero: '40110001', tiersCompte: { tiers: { code: 'F-KINPAP' } }, _count: { individuels: 0 } },
    },
  ],
});
type Ecriture = ReturnType<typeof ecriture>;

/** Une valeur comparable · une date par son instant. */
const comparable = (v: unknown) => (v instanceof Date ? v.getTime() : v) as number | string;

/**
 * Le filtre de la tranche, lu comme PostgreSQL · `AND`, `OR`, égalité, nul et
 * `gt` (la pagination par la clé, `apresLaCle`), et le journal du bloc ; le
 * reste du périmètre (dossier, exercice, statut) est l'affaire d'autres tests
 * et passe.
 */
function correspond(e: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([cle, attendu]) => {
    if (cle === 'AND') return (attendu as Record<string, unknown>[]).every((w) => correspond(e, w));
    if (cle === 'OR') return (attendu as Record<string, unknown>[]).some((w) => correspond(e, w));
    if (!['date', 'numeroPiece', 'id', 'journalId'].includes(cle)) return true;
    const v = e[cle];
    if (attendu === null) return v === null;
    if (attendu && typeof attendu === 'object' && !(attendu instanceof Date)) {
      // Les bornes · `gt` de la clé de tranche, `gte` et `lte` de la période.
      const b = attendu as { gt?: unknown; gte?: unknown; lte?: unknown };
      if (v === null) return false;
      return (
        (b.gt === undefined || comparable(v) > comparable(b.gt)) &&
        (b.gte === undefined || comparable(v) >= comparable(b.gte)) &&
        (b.lte === undefined || comparable(v) <= comparable(b.lte))
      );
    }
    return v !== null && comparable(v) === comparable(attendu);
  });
}

/**
 * Un faux Prisma qui PAGINE VRAIMENT · il honore `take`, le journal du bloc et
 * le filtre de la clé, dans l'ordre du service (date, pièce, identifiant). Une
 * doublure qui rendrait tout d'un coup validerait un service qui ne lit pas
 * par lots, et une doublure qui rendrait toujours la même chose bouclerait
 * sans fin. Un curseur de Prisma est REFUSÉ · sa ligne relue en base peut
 * avoir disparu (M6). Décomptes et blocs se lisent sur les écritures du
 * départ, comme la base les compterait avant le premier octet.
 */
function service(depart: number | Ecriture[], journaux: Journal[] = [ACHATS]) {
  const toutes: Ecriture[] = typeof depart === 'number' ? Array.from({ length: depart }, (_, i) => ecriture(i + 1)) : depart;
  const findMany = jest.fn(async ({ take, cursor, where }: { take: number; cursor?: unknown; where?: Record<string, unknown> }) => {
    if (cursor) throw new Error('Le journal exporté ne pagine plus par le curseur de Prisma (relecture M6).');
    // Dans l'ordre du service · une date changée en route change le rang.
    const ordre = (a: Ecriture, b: Ecriture) =>
      a.date.getTime() - b.date.getTime() || a.numeroPiece - b.numeroPiece || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return toutes
      .filter((e) => correspond(e as unknown as Record<string, unknown>, where))
      .sort(ordre)
      .slice(0, take);
  });
  const parBloc = new Map<string, { journalId: string; statut: string; _count: { _all: number } }>();
  for (const e of toutes) {
    const cle = `${e.journalId}|${e.statut}`;
    const g = parBloc.get(cle) ?? { journalId: e.journalId, statut: e.statut, _count: { _all: 0 } };
    g._count._all++;
    parBloc.set(cle, g);
  }
  const prisma = {
    ligneEcriture: { count: jest.fn().mockResolvedValue(toutes.reduce((n, e) => n + e.lignes.length, 0)) },
    ecriture: {
      findMany,
      count: jest.fn().mockResolvedValue(toutes.length),
      groupBy: jest.fn().mockResolvedValue([...parBloc.values()]),
    },
    journal: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        journaux.filter((j) => where.id.in.includes(j.id)).sort((a, b) => a.code.localeCompare(b.code)),
      ),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u-1', email: 'comptable@vmg.cd' }]) },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nom: 'Dossier', numeroImpot: 'A1', devise: 'CDF' }) },
    exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE), findUnique: jest.fn().mockResolvedValue(EXERCICE) },
  };
  const svc = new ExportService(
    prisma as unknown as PrismaService,
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  return { svc, findMany, toutes };
}

/** Recueille le classeur en flux dans un tampon. */
function tampon() {
  const morceaux: Buffer[] = [];
  const sortie = new Writable({
    write(m, _e, cb) {
      morceaux.push(Buffer.from(m));
      cb();
    },
  });
  return { sortie, octets: () => Buffer.concat(morceaux) };
}

/** Exécute l'export et relit le classeur produit. */
async function exporter(
  depart: number | Ecriture[],
  filtres: Record<string, unknown> = { exerciceId: 'ex' },
  journaux: Journal[] = [ACHATS],
) {
  const { svc, findMany } = service(depart, journaux);
  const { sortie, octets } = tampon();
  let nomFichier = '';
  await svc.journalExcelEnFlux('t1', filtres, (nom) => {
    nomFichier = nom;
    return sortie;
  });
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(octets() as never);
  return {
    feuille: classeur.getWorksheet('Journal')!,
    piste: classeur.getWorksheet('Piste de révision')!,
    classeur,
    octets: octets(),
    nomFichier,
    findMany,
  };
}

/** Les rangs dont la colonne 5 porte ce texte. */
function rangsDe(feuille: ExcelJS.Worksheet, texte: string): number[] {
  const rangs: number[] = [];
  feuille.eachRow((r, n) => {
    if (r.getCell(LIBELLE).value === texte) rangs.push(n);
  });
  return rangs;
}

describe('Journal exporté en flux', () => {
  it('N’EST PLUS AMPUTÉ au plafond de la fenêtre', async () => {
    // 2 500 écritures, soit au-delà des 2 000 que `lister` rendait. Deux
    // lignes par écriture : 5 000 lignes attendues, pas 4 000.
    expect(PLAFOND_ECRITURES_PAR_FENETRE).toBe(2000);
    const { feuille } = await exporter(2500);
    // L'en-tête du bloc (4) + les titres (1) + les données + les totaux du
    // journal + une ligne blanche + les totaux de la période.
    expect(feuille.rowCount).toBe(TITRES_DU_BLOC + 5000 + 3);
    expect(feuille.getRow(DONNEES + 5000).getCell(LIBELLE).value).toBe('Totaux du journal ACH');
    expect(feuille.getRow(DONNEES + 5002).getCell(LIBELLE).value).toBe('Totaux de la période');
  });

  it('les DEUX totaux sont le même · la formule et la valeur jointe', async () => {
    // C'est ici que l'amputation devenait un mensonge : la valeur jointe
    // venait d'un agrégat sur la période entière, la formule ne couvrait que
    // les lignes écrites. Le classeur disait deux chiffres selon son lecteur.
    const { feuille } = await exporter(2500);
    const duJournal = feuille.getRow(DONNEES + 5000).getCell(DEBIT).value as ExcelJS.CellFormulaValue;
    expect(duJournal.formula).toBe(`SUM(F${DONNEES}:F${DONNEES + 4999})`);
    expect(duJournal.result).toBe(2500 * 100);
    const dePeriode = feuille.getRow(DONNEES + 5002).getCell(DEBIT).value as ExcelJS.CellFormulaValue;
    expect(dePeriode.formula).toBe(`F${DONNEES + 5000}`);
    expect(dePeriode.result).toBe(2500 * 100);
  });

  it('lit PAR LOTS · la mémoire ne dépend plus de la taille du dossier', async () => {
    // Un seul appel pour tout charger, c'est le classeur en mémoire qui
    // revient par la porte de la lecture.
    const { findMany } = await exporter(2500);
    expect(findMany.mock.calls.length).toBeGreaterThan(1);
    for (const [args] of findMany.mock.calls) {
      expect((args as { take: number }).take).toBeLessThanOrEqual(500);
    }
  });

  it('la tranche suivante part des VALEURS de la dernière écriture rendue · ni doublon, ni saut', async () => {
    // Une clé posée en arrière rejoue une partie du lot précédent (des pièces
    // en double), une clé en avant en saute. Les deux rendent un journal faux,
    // et le lot suivant a toujours l'air normal. Le journal se lit en DEUX
    // passages (les lignes, puis la piste) · seul un appel qui porte une clé
    // continue le précédent.
    const { findMany } = await exporter(1200);
    let suites = 0;
    for (const [rang, [a]] of findMany.mock.calls.entries()) {
      const appel = a as unknown as { where: { AND?: [unknown, { OR: Array<{ AND: unknown[] }> }] } };
      if (!appel.where.AND) continue;
      suites++;
      const lotPrecedent = (await findMany.mock.results[rang - 1].value) as Array<{ id: string; date: Date; numeroPiece: number }>;
      const fin = lotPrecedent[lotPrecedent.length - 1];
      const branches = appel.where.AND[1].OR;
      // La dernière branche · même date, même pièce, identifiant au-delà.
      expect(branches[branches.length - 1].AND).toEqual([{ date: fin.date }, { numeroPiece: fin.numeroPiece }, { id: { gt: fin.id } }]);
    }
    // Deux tranches de suite par passage, deux passages.
    expect(suites).toBe(4);
  });

  it('une écriture retirée pendant l’export ne tronque pas le journal, et la piste qui ne la porte plus est refusée (relecture M6)', async () => {
    // Le brouillard supprimé pendant la production · avec le curseur de
    // Prisma, la ligne-curseur absente rendait une tranche vide, et le journal
    // sortait avec ses 500 premières pièces, ses totaux bouclant sur elles. Le
    // premier passage lit désormais tout (les 2 400 lignes comptées) ; le
    // second, qui écrit la piste, ne retrouve plus la pièce · le classeur dirait
    // deux livres différents, il est refusé, jamais remis amputé.
    const { svc, findMany, toutes } = service(1200);
    const lire = findMany.getMockImplementation()!;
    findMany.mockImplementation(async (a) => {
      const rendues = await lire(a);
      if (rendues.length === 500 && findMany.mock.calls.length === 1) toutes.splice(toutes.indexOf(rendues[499]), 1);
      return rendues;
    });
    const { sortie } = tampon();
    await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(
      /Piste de révision du journal : 1\s199 lignes lues sur 1\s200 comptées au départ/,
    );
  });

  it('une pièce dont la date AVANCE pendant l’export ne s’écrit qu’une fois, et les totaux restent justes (relecture TypeScript, M2)', async () => {
    const { svc, findMany, toutes } = service(1200);
    const lire = findMany.getMockImplementation()!;
    let deplacee: string | undefined;
    findMany.mockImplementation(async (a) => {
      const rendues = await lire(a);
      // Après la première tranche, un autre poste corrige la date d'une pièce
      // déjà lue · elle passe au 31 décembre, au-delà de la clé de la tranche.
      if (!deplacee && rendues.length > 0) {
        deplacee = rendues[0].id;
        toutes.find((e) => e.id === deplacee)!.date = new Date('2026-12-31');
      }
      return rendues;
    });
    const { sortie, octets } = tampon();
    await svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie);
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(octets() as never);
    const feuille = classeur.getWorksheet('Journal')!;
    // Écrite deux fois, la pièce portait quatre lignes et le total 120 100.
    expect(feuille.rowCount).toBe(TITRES_DU_BLOC + 2400 + 3);
    const debit = feuille.getRow(DONNEES + 2400).getCell(DEBIT).value as ExcelJS.CellFormulaValue;
    expect(debit.result).toBe(1200 * 100);
  });

  it('une pièce dont la date RECULE pendant l’export n’est jamais relue · le livre est refusé avant ses totaux, jamais remis amputé (M2)', async () => {
    const { svc, findMany, toutes } = service(1200);
    const lire = findMany.getMockImplementation()!;
    let deplacee = false;
    findMany.mockImplementation(async (a) => {
      const rendues = await lire(a);
      // Après la première tranche, la dernière pièce, pas encore lue, passe
      // au 1er janvier · en deçà de la clé, elle ne sera jamais relue.
      if (!deplacee) {
        deplacee = true;
        toutes.find((e) => e.id === 'e-001200')!.date = new Date('2026-01-01');
      }
      return rendues;
    });
    const sortie = new Writable({ write: (_m, _e, cb) => cb() });
    await expect(svc.journalExcelEnFlux('t1', { exerciceId: 'ex' }, () => sortie)).rejects.toThrow(
      /Journal : 2\s398 lignes lues sur 2\s400 comptées au départ/,
    );
  });

  it('l’en-tête du bloc dit le dossier, le journal, la période, l’unité et le tirage, puis les sept colonnes', async () => {
    // La présentation de l'édition de Sage (décision de Manasse du
    // 2026-10-16) · l'en-tête s'écrit AVANT les données, une feuille en flux
    // ne se relit pas.
    const { feuille } = await exporter(3);
    expect(feuille.getRow(1).getCell(1).value).toBe('JOURNAL · Dossier');
    expect(String(feuille.getRow(1).getCell(7).value)).toContain('2026');
    expect(feuille.getRow(2).getCell(1).value).toBe('ACH · Achats');
    expect(feuille.getRow(2).getCell(7).value).toBe('Tenue de compte : CDF');
    // Le tirage à la seconde, au jour de Kinshasa (`tirageAKinshasa`).
    expect(String(feuille.getRow(3).getCell(1).value)).toMatch(/^Tiré le \d{2}\/\d{2}\/\d{2} à \d{2}:\d{2}:\d{2}/);
    const titres = Array.from({ length: 7 }, (_v, i) => feuille.getRow(TITRES_DU_BLOC).getCell(i + 1).value);
    expect(titres).toEqual(['Jour', 'N° pièce', 'N° compte', 'N° tiers', 'Libellé', 'Débit', 'Crédit']);
    expect(titres).toEqual([...TITRES_COLONNES_JOURNAL]);
    // La page se lit à l'en-tête d'impression, que chaque page porte.
    expect(feuille.headerFooter.oddHeader).toContain('Page &P / &N');
  });

  it('les titres des colonnes s’écrivent une fois par bloc · ni en ligne 1, ni deux fois (relevé de Manasse du 2026-10-16)', async () => {
    // `columns` muni de `header` écrivait les en-têtes en ligne 1, derrière
    // le titre, et le journal les montrait deux fois.
    const { feuille, piste } = await exporter(3);
    const lignesDeTitres: number[] = [];
    feuille.eachRow((r, n) => {
      if (r.getCell(JOUR).value === 'Jour') lignesDeTitres.push(n);
    });
    expect(lignesDeTitres).toEqual([TITRES_DU_BLOC]);
    // La piste garde sa coiffe · le titre seul en ligne 1, les en-têtes une
    // fois, en ligne 4.
    const nb = piste.getRow(LIGNE_ENTETE).cellCount;
    expect(nb).toBe(13);
    for (let c = 2; c <= nb; c++) expect(piste.getRow(1).getCell(c).value ?? null).toBeNull();
    const titres = Array.from({ length: nb }, (_v, i) => piste.getRow(LIGNE_ENTETE).getCell(i + 1).value);
    // Le titre de la colonne des corrections est un titre, sans article.
    expect(titres).toContain('Correction');
    expect(titres).toContain('Motif de la correction');
  });

  it('une ligne porte le jour, la pièce, le compte, le tiers du compte individuel et son libellé', async () => {
    const { feuille } = await exporter(1);
    const debit = feuille.getRow(DONNEES);
    const credit = feuille.getRow(DONNEES + 1);
    expect((debit.getCell(JOUR).value as Date).toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(debit.getCell(PIECE).value).toBe(1);
    expect(debit.getCell(COMPTE).value).toBe('60410000');
    // Un compte sans tiers laisse la case vide, jamais un zéro.
    expect(debit.getCell(TIERS).value ?? null).toBeNull();
    expect(debit.getCell(LIBELLE).value).toBe('débit');
    expect(debit.getCell(DEBIT).value).toBe(100);
    expect(debit.getCell(CREDIT).value ?? null).toBeNull();
    expect(credit.getCell(TIERS).value).toBe('F-KINPAP');
    expect(credit.getCell(CREDIT).value).toBe(100);
  });

  it('le collectif qui porte des comptes individuels ne désigne aucun tiers', async () => {
    // Le collectif reste rattaché au tiers qui l'a reçu le premier (point 13)
    // · une ligne passée au collectif ne se lit pas comme la sienne.
    const e = ecriture(1);
    e.lignes[1].compte = { numero: '40110000', tiersCompte: { tiers: { code: 'F-PREMIER' } }, _count: { individuels: 3 } };
    const { feuille } = await exporter([e]);
    expect(feuille.getRow(DONNEES + 1).getCell(TIERS).value ?? null).toBeNull();
  });

  it('la date de valeur reste mentionnée distinctement · dans le libellé de la ligne (AUDCIF art. 22, 4°)', async () => {
    const e = ecriture(1);
    e.dateValeur = new Date('2026-02-27');
    const sansLibelle = ecriture(2);
    sansLibelle.lignes[0].libelle = '';
    const { feuille, piste } = await exporter([e, sansLibelle]);
    expect(feuille.getRow(DONNEES).getCell(LIBELLE).value).toBe('débit · valeur au 27/02/2026');
    // Une ligne sans libellé prend celui de son écriture.
    expect(feuille.getRow(DONNEES + 2).getCell(LIBELLE).value).toBe('Écriture 2');
    // Et la piste lui garde sa colonne.
    expect((piste.getRow(PREMIERE_LIGNE_DONNEES).getCell(3).value as Date).toISOString().slice(0, 10)).toBe('2026-02-27');
  });

  it('un journal par bloc, un saut de page entre eux, et les totaux de la période additionnent les journaux', async () => {
    const ecritures = [ecriture(1), ecriture(2), ecriture(3, BANQUE)];
    const { feuille, octets } = await exporter(ecritures, { exerciceId: 'ex' }, [ACHATS, BANQUE]);
    const totauxAch = rangsDe(feuille, 'Totaux du journal ACH');
    const totauxBq = rangsDe(feuille, 'Totaux du journal BQ');
    expect(totauxAch).toEqual([DONNEES + 4]);
    // Bloc BQ · son en-tête (4), ses titres (1), ses deux lignes, puis ses totaux.
    expect(totauxBq).toEqual([DONNEES + 4 + 5 + 2 + 1]);
    expect(feuille.getRow(DONNEES + 5).getCell(1).value).toBe('JOURNAL · Dossier');
    expect(feuille.getRow(DONNEES + 6).getCell(1).value).toBe('BQ · Banque');
    const periode = rangsDe(feuille, 'Totaux de la période')[0];
    const debit = feuille.getRow(periode).getCell(DEBIT).value as ExcelJS.CellFormulaValue;
    // Une somme sur toute la colonne compterait chaque montant deux fois.
    expect(debit.formula).toBe(`F${totauxAch[0]}+F${totauxBq[0]}`);
    expect(debit.result).toBe(300);
    // Le saut de page se pose sous les totaux du premier journal · lu dans la
    // feuille écrite, le lecteur d'ExcelJS ne rendant pas les sauts.
    const xml = await (await JSZip.loadAsync(octets)).file('xl/worksheets/sheet1.xml')!.async('string');
    expect(xml).toMatch(new RegExp(`<rowBreaks[^>]*>\\s*<brk id="${totauxAch[0]}"`));
  });

  it('le brouillard se dit au titre du bloc et s’imprime en italique · hors du livre-journal (AUDCIF art. 22, 2°)', async () => {
    const validee = ecriture(1);
    const brouillard = { ...ecriture(2), statut: 'BROUILLARD', valideeAt: null, valideeBy: null };
    const { feuille } = await exporter([validee, brouillard]);
    expect(feuille.getRow(1).getCell(1).value).toBe('JOURNAL ET BROUILLARD · Dossier');
    expect(feuille.getRow(4).getCell(1).value).toBe('Lignes en italique · hors du livre-journal, non validées.');
    expect(feuille.getRow(DONNEES).font?.italic ?? false).toBe(false);
    expect(feuille.getRow(DONNEES + 2).getCell(LIBELLE).font?.italic).toBe(true);
  });

  it('la piste de révision porte une ligne par écriture · statut, saisie, validation, corrections', async () => {
    const erronee = { ...ecriture(1), correction: { numeroPiece: 2 } };
    const negatif = { ...ecriture(2), corrigeEcriture: { numeroPiece: 1 }, motifCorrection: 'Facture saisie deux fois' };
    const { piste } = await exporter([erronee, negatif]);
    const premiere = piste.getRow(PREMIERE_LIGNE_DONNEES);
    const seconde = piste.getRow(PREMIERE_LIGNE_DONNEES + 1);
    expect(premiere.getCell(1).value).toBe('ACH');
    expect(premiere.getCell(4).value).toBe(1);
    expect(premiere.getCell(7).value).toBe('Validée');
    // L'auteur en COURRIEL · un auditeur ne lit pas un uuid.
    expect(premiere.getCell(9).value).toBe('comptable@vmg.cd');
    expect(premiere.getCell(12).value).toBe('Annulée par la pièce n° 2');
    expect(seconde.getCell(12).value).toBe('Annule la pièce n° 1');
    expect(seconde.getCell(13).value).toBe('Facture saisie deux fois');
    expect(piste.rowCount).toBe(LIGNE_ENTETE + 2);
  });

  it('un journal sans écriture le dit · jamais un fichier vide', async () => {
    const { feuille, piste } = await exporter([]);
    expect(feuille.getRow(1).getCell(1).value).toBe('JOURNAL · Dossier');
    expect(feuille.getRow(5).getCell(1).value).toBe('Aucune écriture sur la période.');
    expect(rangsDe(feuille, 'Totaux de la période')).toHaveLength(1);
    expect(piste.rowCount).toBe(LIGNE_ENTETE);
  });

  it('garde les formats de cellule · sans eux une date sort en numéro de série', async () => {
    // `useStyles: true` est ce qui coûte le plus de temps au flux, et c'est
    // pourtant non négociable · un export comptable illisible n'est pas un
    // export.
    expect(OPTIONS_CLASSEUR_EN_FLUX.useStyles).toBe(true);
    // `useSharedStrings` doit rester FAUX · mesuré à 1 195 Mo contre 450 Mo
    // pour un demi-million de lignes, il défait tout le bénéfice du flux.
    expect(OPTIONS_CLASSEUR_EN_FLUX.useSharedStrings).toBe(false);
    // Le format se lit sur la CELLULE du classeur relu · c'est ce que verra
    // Excel. Le poser sur la colonne après coup n'aurait rien changé aux
    // lignes déjà commises, et ce test-là l'a prouvé avant de le corriger.
    //
    // LA VALEUR EXACTE EST EXIGÉE, JAMAIS `toBeTruthy()`. Première rédaction de
    // ce test, et elle ne prouvait RIEN : retirer le `numFmt` de la colonne
    // Date la laissait passer, parce qu'ExcelJS donne d'office un format de
    // date intégré à toute cellule dont la valeur est une `Date`. Ce format
    // par défaut est AMÉRICAIN · une date du 3 avril sortirait « 4/3 », qui se
    // lit comme le 4 mars sur un état comptable congolais. Le défaut même que
    // le test annonce combattre lui échappait, et il a fallu réinjecter la
    // panne pour s'en apercevoir.
    //
    // Les littéraux sont RÉÉCRITS ici plutôt qu'importés : importer la
    // constante rendrait le test d'accord avec n'importe quelle valeur, y
    // compris fausse.
    const { feuille, piste } = await exporter(3);
    const premiere = feuille.getRow(DONNEES);
    // L'exercice tient en douze mois · le jour se lit sans l'année, comme sur
    // l'édition de Sage, l'en-tête donnant la période.
    expect(premiere.getCell(JOUR).numFmt).toBe('DD/MM');
    expect(premiere.getCell(DEBIT).numFmt).toBe('#,##0.00');
    expect(premiere.getCell(CREDIT).numFmt).toBe('#,##0.00');
    // La piste · 2 Date, 3 Date de valeur, 8 Saisie le.
    const ligne = piste.getRow(PREMIERE_LIGNE_DONNEES);
    expect(ligne.getCell(2).numFmt).toBe('DD/MM/YYYY');
    expect(ligne.getCell(3).numFmt).toBe('DD/MM/YYYY');
    expect(ligne.getCell(8).numFmt).toBe('DD/MM/YYYY HH:mm');
  });

  it('au-delà de douze mois, le jour porte son année · deux 15/01 ne se confondent pas', async () => {
    const { feuille } = await exporter(1, { exerciceId: 'ex', dateDebut: '2025-07-01', dateFin: '2026-12-31' });
    expect(feuille.getRow(DONNEES).getCell(JOUR).numFmt).toBe('DD/MM/YY');
  });

  it('le périmètre du journal est celui de la fenêtre · une seule écriture du filtre', () => {
    // Deux filtres écrits séparément auraient donné deux journaux plausibles
    // et différents pour les mêmes critères.
    const filtres = { exerciceId: 'ex', journalId: 'j', dateDebut: '2026-01-01', recherche: 'vente' };
    expect(perimetreJournal('t1', filtres)).toEqual({
      tenantId: 't1',
      exerciceId: 'ex',
      journalId: 'j',
      date: { gte: new Date('2026-01-01') },
      // Depuis la recherche d'écritures (point 8), le libellé se cherche sur
      // l'écriture ET sur ses lignes · une ligne libellée « vente » dans une
      // pièce intitulée autrement était introuvable.
      AND: [
        {
          OR: [
            { libelle: { contains: 'vente', mode: 'insensitive' } },
            { lignes: { some: { libelle: { contains: 'vente', mode: 'insensitive' } } } },
          ],
        },
      ],
    });
  });

  /**
   * Audit du 2026-09-26, F1 · la fenêtre du journal envoie
   * `inclureBrouillard=false` quand la case est décochée, et la route
   * d'export ne lisait pas ce paramètre. L'écran montrait le livre-journal,
   * le fichier rendait le brouillard avec : deux journaux pour un filtre.
   */
  it('brouillard décoché · l’export ne lit que les écritures VALIDÉES', async () => {
    const { findMany } = await exporter(3, { exerciceId: 'ex', inclureBrouillard: false });
    expect(findMany.mock.calls[0][0].where?.statut).toBe('VALIDEE');
  });

  it('sans le paramètre · le brouillard reste inclus, comme à l’écran', async () => {
    const { findMany } = await exporter(3);
    // Le brouillard reste · seules les écritures de situation, qui ne sont
    // pas au livre-journal, sortent (ligne sage-l1, fonction 12).
    expect(findMany.mock.calls[0][0].where?.statut).toEqual({ not: 'SITUATION' });
  });

  it('la route d’export lit le paramètre et le transmet', () => {
    const source = readFileSync(join(__dirname, 'export.controller.ts'), 'utf8');
    const debut = source.indexOf("@Get('journal')");
    const corps = source.slice(debut, source.indexOf('@Get(', debut + 1));
    expect(corps).toContain("@Query('inclureBrouillard')");
    expect(corps).toMatch(/inclureBrouillard:\s*inclureBrouillard !== 'false'/);
  });
});
