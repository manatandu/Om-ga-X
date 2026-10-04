import { StatutExercice } from '@prisma/client';
import { ExerciceService } from './exercice.service';

// La clôture annuelle n'avait AUCUN test unitaire, et son report à-nouveau
// passe désormais par le calcul partagé avec le report provisoire. Ce spec
// fige les deux écritures qu'elle produit et le remplacement du provisoire.
const N = { id: 'n', tenantId: 't', statut: StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const N1 = { id: 'n1', tenantId: 't', statut: StatutExercice.OUVERT, dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
const ligne = (debit: number, credit: number, lettre: string | null = null) => ({
  debit,
  credit,
  lettre,
  libelle: 'L',
  dateEcheance: null,
  ecriture: { libelle: 'E' },
});
const COMPTES = [
  { id: '601', numero: '60110000', intitule: 'Achats', modeReportANouveau: 'AUCUN', lignesEcriture: [ligne(1000, 0)] },
  { id: '701', numero: '70110000', intitule: 'Ventes', modeReportANouveau: 'AUCUN', lignesEcriture: [ligne(0, 1500)] },
  { id: '521', numero: '52110000', intitule: 'Banque', modeReportANouveau: 'SOLDE', lignesEcriture: [ligne(1500, 0), ligne(0, 1000)] },
  { id: '131', numero: '13100000', intitule: 'Excédent', modeReportANouveau: 'SOLDE', lignesEcriture: [] },
  { id: '411', numero: '41110000', intitule: 'Clients', modeReportANouveau: 'DETAIL', lignesEcriture: [ligne(300, 0), ligne(200, 0, 'AA'), ligne(0, 200, 'AA')] },
  { id: '401', numero: '40110000', intitule: 'Fournisseurs', modeReportANouveau: 'DETAIL', lignesEcriture: [ligne(0, 300)] },
];

/**
 * LA LECTURE DU REPORT (audit final F185) · la clôture demande à la base les
 * sommes des comptes au SOLDE et de gestion, et ne lit ligne à ligne que le
 * DÉTAIL. Cette doublure les sert depuis les lignes du jeu en HONORANT les
 * filtres que la lecture pose, et lève sur tout filtre qu'elle ne sait pas
 * lire · une doublure qui ignore un filtre valide un code qui ne charge pas.
 */
type LigneJeu = { lignesEcriture: Record<string, unknown>[] } & Record<string, unknown>;
const estReference = (x: unknown): x is { name: string } => !!x && typeof x === 'object' && 'modelName' in (x as object);
function champ(r: Record<string, unknown>, v: unknown, f: unknown): boolean {
  if (f === null || typeof f !== 'object') return v === f;
  return Object.entries(f as Record<string, unknown>).every(([op, x]) => {
    const o = estReference(x) ? r[x.name] : x;
    if (op === 'not') return o === null ? v !== null : typeof o === 'object' ? !champ(r, v, o) : v !== null && v !== o;
    if (v === null || v === undefined) return false;
    if (op === 'equals') return v === o;
    if (op === 'in') return (o as unknown[]).includes(v);
    if (op === 'gt') return (v as number) > (o as number);
    if (op === 'gte') return (v as number) >= (o as number);
    if (op === 'lt') return (v as number) < (o as number);
    if (op === 'lte') return (v as number) <= (o as number);
    throw new Error(`doublure : filtre « ${op} » non honoré`);
  });
}
function correspond(r: Record<string, unknown>, where: unknown): boolean {
  return Object.entries((where ?? {}) as Record<string, unknown>).every(([cle, f]) => {
    if (cle === 'AND') return ([] as unknown[]).concat(f).every((w) => correspond(r, w));
    if (cle === 'OR') return (f as unknown[]).some((w) => correspond(r, w));
    if (cle === 'NOT') return ([] as unknown[]).concat(f).every((w) => !correspond(r, w));
    if (cle === 'ecriture' || cle === 'compte') return correspond(r[cle] as Record<string, unknown>, f);
    return champ(r, r[cle], f);
  });
}
function lectureDuReport(comptes: LigneJeu[]) {
  const lignes = comptes.flatMap((c) =>
    c.lignesEcriture.map((l, i) => ({
      id: `${c.id}-${String(i).padStart(4, '0')}`,
      compteId: c.id,
      compte: c,
      deviseId: null,
      montantDevise: null,
      coursApplique: null,
      ...l,
      ecriture: { tenantId: 't', exerciceId: 'n', statut: 'VALIDEE', ...(l.ecriture as object) },
    })),
  ) as Record<string, unknown>[];
  const projeter = (r: Record<string, unknown>, select: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(select).map(([k, v]) => [k, v === true ? r[k] : { libelle: (r[k] as { libelle: string }).libelle }]),
    );
  return {
    compte: {
      findMany: jest.fn(async (a: { where: unknown; select: Record<string, unknown>; include?: unknown }) => {
        if (a.include) throw new Error('doublure : include non honoré');
        return comptes
          .filter((c) => correspond({ tenantId: 't', ...c }, a.where))
          .sort((x, y) => ((x.numero as string) < (y.numero as string) ? -1 : 1))
          .map((c) => Object.fromEntries(Object.keys(a.select).map((k) => [k, c[k]])));
      }),
    },
    ligneEcriture: {
      fields: { credit: { modelName: 'LigneEcriture', name: 'credit' } },
      groupBy: jest.fn(async (a: { by: string[]; where: unknown; _sum: Record<string, true> }) => {
        const groupes = new Map<string, Record<string, unknown>>();
        for (const l of lignes.filter((x) => correspond(x, a.where))) {
          const cle = JSON.stringify(a.by.map((k) => l[k]));
          const g = groupes.get(cle) ?? { ...Object.fromEntries(a.by.map((k) => [k, l[k]])), _sum: {} as Record<string, number | null> };
          const somme = g._sum as Record<string, number | null>;
          for (const k of Object.keys(a._sum)) somme[k] = l[k] === null ? (somme[k] ?? null) : (somme[k] ?? 0) + (l[k] as number);
          groupes.set(cle, g);
        }
        return [...groupes.values()];
      }),
      findMany: jest.fn(async (a: { where: unknown; select: Record<string, unknown>; take: number; cursor?: { id: string }; skip?: number }) => {
        let r = lignes.filter((x) => correspond(x, a.where)).sort((x, y) => ((x.id as string) < (y.id as string) ? -1 : 1));
        if (a.cursor) r = r.slice(r.findIndex((x) => x.id === a.cursor!.id) + (a.skip ?? 0));
        return r.slice(0, a.take).map((x) => projeter(x, a.select));
      }),
    },
  };
}

function service(provisoire: { id: string; numeroPiece: number; lignes: { lettre: null; rapprochementId: null }[] } | null, creancesDouteuses: unknown[] = []) {
  const lecture = lectureDuReport(COMPTES);
  const tx = {
    compte: { findMany: lecture.compte.findMany, findUnique: jest.fn().mockResolvedValue({ id: '131' }) },
    journal: { findFirst: jest.fn().mockResolvedValue({ id: 'od', code: 'OD' }) },
    // Lu par son identifiant (contrôles relus dans la transaction, M2), l'exercice
    // clôturé ; sinon le suivant.
    exercice: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => Promise.resolve(where?.id === 'n' ? N : N1)),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({ ...N, statut: 'CLOTURE' }),
    },
    // Les créances douteuses relues DANS la transaction (A7, M2).
    creanceDouteuse: { findMany: jest.fn().mockResolvedValue(creancesDouteuses) },
    ecriture: {
      findFirst: jest.fn().mockResolvedValue(provisoire),
      // AU2 · aucune ouverture déjà passée dans N+1 par défaut, et N porte
      // des écritures.
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(4),
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ lignes: [] }),
    },
    // AU2 · aucune ligne au premier jour de N+1 par défaut (`ouvertureDejaPassee`).
    ligneEcriture: {
      ...lecture.ligneEcriture,
      // Le gel (`lignesFigees`) relit des lignes par identifiant · aucune ici.
      findMany: jest.fn((a: Parameters<typeof lecture.ligneEcriture.findMany>[0]) =>
        ((a.where as Record<string, unknown>).id as { in?: unknown } | undefined)?.in ? Promise.resolve([]) : lecture.ligneEcriture.findMany(a),
      ),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    cloture: { findMany: jest.fn().mockResolvedValue([]) },
    rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    // L'exercice lu par son identifiant, et les deux questions d'ordre
    // (précédent encore ouvert, suivant déjà clos) · aucun par défaut.
    exercice: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.dateFin || where.dateDebut ? null : N),
      ),
    },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    ecriture: { count: jest.fn().mockResolvedValue(0) },
    // Aucun lettrage dénoué en souffrance (décision D3, `ecartsRealisesNonConstates`).
    ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
    // Les créances douteuses du module (ligne A7, B1) · aucune par défaut, et
    // jamais lues hors de la transaction de clôture (M2).
    creanceDouteuse: { findMany: jest.fn().mockRejectedValue(new Error('lue hors de la transaction de clôture')) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const journalService = { prochainNumeroPiece: jest.fn().mockResolvedValue(50) };
  return { s: new ExerciceService(prisma as never, journalService as never), tx };
}

describe('Clôture annuelle', () => {
  it('solde la gestion sur le résultat, puis passe le report définitif · la ligne lettrée ne passe pas', async () => {
    const { s, tx } = service(null);
    await s.cloturer('t', 'n', 'u');
    const [cloture, ran] = tx.ecriture.create.mock.calls.map((c) => c[0].data);
    expect(cloture.exerciceId).toBe('n');
    expect(cloture.lignes.create.find((l: { compteId: string }) => l.compteId === '131')).toMatchObject({ credit: 500 });
    expect(ran.exerciceId).toBe('n1');
    expect(ran.estANouveauProvisoire).toBeUndefined();
    const lignes = ran.lignes.create as { compteId: string; debit: number; credit: number }[];
    expect(lignes.find((l) => l.compteId === '521')).toMatchObject({ debit: 500 });
    expect(lignes.find((l) => l.compteId === '131')).toMatchObject({ credit: 500 });
    expect(lignes.filter((l) => l.compteId === '411')).toHaveLength(1);
    expect(lignes.reduce((t, l) => t + l.debit - l.credit, 0)).toBe(0);
    expect(tx.exercice.update).toHaveBeenCalledWith({ where: { id: 'n' }, data: { statut: StatutExercice.CLOTURE } });
  });

  /**
   * AUDIT FINAL F4 · l'écriture de solde entrait au brouillard et ne pouvait
   * plus être validée (exercice clos) · absente du livre-journal, elle
   * laissait l'affectation sans résultat. Et elle portait le même drapeau que
   * l'à-nouveau, d'où la fausse ouverture de la balance (F5).
   */
  it('passe les deux écritures VALIDÉES, et marque seule l’écriture de solde', async () => {
    const { s, tx } = service(null);
    await s.cloturer('t', 'n', 'u');
    const [cloture, ran] = tx.ecriture.create.mock.calls.map((c) => c[0].data);
    expect({ statut: cloture.statut, valideeBy: cloture.valideeBy, solde: cloture.estSoldeDesComptesDeGestion }).toEqual({
      statut: 'VALIDEE',
      valideeBy: 'u',
      solde: true,
    });
    expect({ statut: ran.statut, solde: ran.estSoldeDesComptesDeGestion }).toEqual({ statut: 'VALIDEE', solde: undefined });
  });

  /**
   * AUDIT FINAL F185 · la clôture lisait toutes les lignes de l'exercice avec
   * le plan. Le plan se lit sans elles, les comptes au SOLDE et de gestion en
   * sommes, et le DÉTAIL seul ligne à ligne, par les colonnes du report.
   */
  it('F185 · la clôture lit le plan sans ses lignes, le reste en sommes, le DÉTAIL par les seules colonnes du report', async () => {
    const { s, tx } = service(null);
    await s.cloturer('t', 'n', 'u');
    expect(tx.compte.findMany.mock.calls[0][0].include).toBeUndefined();
    expect(tx.ligneEcriture.groupBy).toHaveBeenCalled();
    const detail = tx.ligneEcriture.findMany.mock.calls[0][0];
    expect(detail.select.ecriture).toEqual({ select: { libelle: true } });
    expect(Object.keys(detail.select).sort()).toEqual(
      ['compteId', 'coursApplique', 'credit', 'dateEcheance', 'debit', 'deviseId', 'ecriture', 'id', 'lettre', 'libelle', 'montantDevise'],
    );
  });

  it('refuse de clôturer avant l’exercice précédent (audit final F6)', async () => {
    const { s, tx } = service(null);
    (s as any).prisma.exercice.findFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        where.dateFin ? { dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') } : where.dateDebut ? null : N,
      ),
    );
    await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/2025 n'est pas clôturé/);
    expect(tx.ecriture.create).not.toHaveBeenCalled();
  });

  it('refuse de clôturer quand un exercice postérieur est déjà clos (audit final F6)', async () => {
    const { s, tx } = service(null);
    (s as any).prisma.exercice.findFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(where.dateDebut ? { dateDebut: new Date('2027-01-01') } : where.dateFin ? null : N),
    );
    await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/postérieur est déjà clôturé/);
    expect(tx.ecriture.create).not.toHaveBeenCalled();
  });

  it('remplace le report PROVISOIRE et lui reprend son numéro de pièce', async () => {
    const { s, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ lettre: null, rapprochementId: null }] });
    await s.cloturer('t', 'n', 'u');
    expect(tx.ecriture.delete).toHaveBeenCalledWith({ where: { id: 'p' } });
    const ran = tx.ecriture.create.mock.calls[1][0].data;
    expect(ran.numeroPiece).toBe(3);
  });

  it('refuse de clôturer tant qu’il reste du brouillard', async () => {
    const { s } = service(null);
    (s as any).prisma.ecriture.count.mockResolvedValue(1);
    await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/brouillard/);
  });
});

/**
 * AU2 · un bilan d'ouverture IMPORTÉ dans N+1, puis la clôture de N · la
 * clôture AJOUTAIT son report à l'import, chaque compte doublé dans N+1, la
 * balance bouclée (reproduit sur vraie base · client 600 000 pour 300 000).
 * AUDCIF art. 34 · SYCEBNL art. 16, 4) · AUDCIF art. 20, al. 2.
 */
describe('AU2 · clôture de N avec une ouverture déjà passée dans N+1', () => {
  const IMPORT = { id: 'imp', numeroPiece: 1, statut: 'VALIDEE', journal: { code: 'OD' } };
  const ligneImport = (id: string, compteId: string, debit: number, credit: number, extra: Record<string, unknown> = {}) => ({
    id, ecritureId: 'imp', compteId, compte: { numero: `N${compteId}` }, debit, credit, libelle: 'Import',
    dateEcheance: null, deviseId: null, montantDevise: null, coursApplique: null, lettrageId: null, rapprochementId: null, ...extra,
  });
  /**
   * La position du premier jour de N+1 · écritures et lignes, servies quand la
   * requête porte le filtre du premier jour (`OR` date ou date de valeur).
   */
  function avecOuverture(ecritures: Record<string, unknown>[], lignes: Record<string, unknown>[]) {
    const { s, tx } = service(null);
    tx.ecriture.findMany.mockResolvedValue(ecritures);
    const parDefaut = tx.ligneEcriture.findMany.getMockImplementation()!;
    tx.ligneEcriture.findMany.mockImplementation(((a: { where: { ecriture?: { AND?: unknown } }; cursor?: unknown }) =>
      a.where.ecriture?.AND ? Promise.resolve(a.cursor ? [] : lignes) : parDefaut(a as never)) as never);
    tx.ligneEcriture.count.mockResolvedValue(lignes.length);
    const lecturePlan = tx.compte.findMany.getMockImplementation()!;
    // Comptes nommés par leur identifiant · aucun lettrable (R6 rejoué sur vraie base).
    (tx.compte as Record<string, unknown>).findMany = jest.fn((a: { where: { id?: { in: string[] }; lettrable?: boolean } }) =>
      a.where.lettrable ? Promise.resolve([]) : a.where.id ? Promise.resolve(a.where.id.in.map((id) => ({ id, numero: `N${id}`, intitule: '' }))) : lecturePlan(a as never),
    );
    (tx as Record<string, unknown>).devise = { findMany: jest.fn().mockResolvedValue([{ id: 'usd', code: 'USD' }]) };
    return { s, tx };
  }
  // Le report de la clôture · 521 D 500, 411 D 300 (détail), 401 C 300, 131 C 500.
  const importExact = [
    ligneImport('i1', '521', 500, 0), ligneImport('i2', '411', 300, 0), ligneImport('i3', '401', 0, 300), ligneImport('i4', '131', 0, 500),
  ];
  const faux = [ligneImport('i1', '521', 500, 0), ligneImport('i2', '411', 450, 0), ligneImport('i3', '401', 0, 300), ligneImport('i4', '131', 0, 650)];

  it('une ouverture qui correspond au bilan de clôture · aucun report ajouté, et c’est dit', async () => {
    const { s, tx } = avecOuverture([IMPORT], importExact);
    const r = (await s.cloturer('t', 'n', 'u')) as unknown as { issueOuverture: string[] };
    expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
    expect(tx.ecriture.create.mock.calls[0][0].data.estSoldeDesComptesDeGestion).toBe(true);
    expect(r.issueOuverture.join(' ')).toMatch(/correspond au bilan de clôture/);
  });

  it('R1 · le périmètre est le PREMIER JOUR, toutes origines, sans compte de gestion ni provisoire', async () => {
    const { s, tx } = avecOuverture([IMPORT], importExact);
    await s.cloturer('t', 'n', 'u');
    const where = tx.ecriture.findMany.mock.calls.at(-1)![0].where;
    expect(where).toMatchObject({
      exerciceId: 'n1',
      estANouveauProvisoire: false,
      estSoldeDesComptesDeGestion: false,
      AND: [
        { OR: [{ date: N1.dateDebut }, { dateValeur: N1.dateDebut }] },
        {
          OR: [
            { OR: [{ estGenereeParCloture: true }, { journal: { type: 'GENERAL' } }] },
            { corrigeEcriture: { is: { OR: [{ estGenereeParCloture: true }, { journal: { type: 'GENERAL' } }] } } },
          ],
        },
      ],
      lignes: { none: { compte: { classe: { in: ['CLASSE_6', 'CLASSE_7', 'CLASSE_8'] } } } },
    });
    // Troisième tour · un journal d'achats, de ventes ou de trésorerie n'y
    // entre jamais · une opération de banque du 1er janvier n'est ni comptée
    // ni inscrite en négatif.
    expect(JSON.stringify(where)).not.toMatch(/TRESORERIE|ACHATS|VENTES/);
    // Aucun drapeau d'origine n'est exigé · une ressaisie par OD en fait partie.
    expect(where.estGenereeParCloture).toBeUndefined();
  });

  it('R1 · import 600, négatif lié, OD de 300 · concordant, rien n’est ajouté (le report ne double pas)', async () => {
    const ecritures = [IMPORT, { id: 'neg', numeroPiece: 2, statut: 'VALIDEE', journal: { code: 'OD' } }, { id: 'od', numeroPiece: 3, statut: 'VALIDEE', journal: { code: 'OD' } }];
    const lignes = [
      ligneImport('a1', '411', 600, 0), ligneImport('a2', '131', 0, 600),
      ligneImport('b1', '411', -600, 0, { ecritureId: 'neg' }), ligneImport('b2', '131', 0, -600, { ecritureId: 'neg' }),
      ligneImport('c1', '411', 300, 0, { ecritureId: 'od' }), ligneImport('c2', '521', 500, 0, { ecritureId: 'od' }),
      ligneImport('c3', '401', 0, 300, { ecritureId: 'od' }), ligneImport('c4', '131', 0, 500, { ecritureId: 'od' }),
    ];
    const { s, tx } = avecOuverture(ecritures, lignes);
    const r = (await s.cloturer('t', 'n', 'u', { ouvertureImportee: 'RECTIFIER' })) as unknown as { issueOuverture: string[] };
    expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
    expect(r.issueOuverture.join(' ')).toMatch(/correspond au bilan de clôture/);
  });

  it('une ouverture entièrement annulée · plus de déclaration, le report entier passe (R10)', async () => {
    const lignes = [ligneImport('a1', '411', 600, 0), ligneImport('a2', '131', 0, 600), ligneImport('b1', '411', -600, 0), ligneImport('b2', '131', 0, -600)];
    const { s, tx } = avecOuverture([IMPORT], lignes);
    await s.cloturer('t', 'n', 'u');
    const ran = tx.ecriture.create.mock.calls[1][0].data.lignes.create as { compteId: string; debit: number }[];
    expect(ran.find((l) => l.compteId === '521')).toMatchObject({ debit: 500 });
  });

  it('R2 · le report porte le 521 en dollars, l’import en francs seuls · ÉCART nommé avec sa devise, jamais concordant', async () => {
    const { s, tx } = avecOuverture([IMPORT], importExact);
    // Le report rend la banque en devise (une ligne en USD).
    const parDefaut = tx.ligneEcriture.groupBy.getMockImplementation()!;
    tx.ligneEcriture.groupBy.mockImplementation((async (a: { by: string[]; where: { debit?: unknown } }) =>
      a.by.includes('deviseId') && a.where.debit && (a.where.debit as { gte?: unknown }).gte !== undefined
        ? [{ compteId: '521', deviseId: 'usd', _sum: { debit: 1500, credit: 0, montantDevise: 1 } }, ...(await parDefaut(a as never)).filter((g: { compteId: string }) => g.compteId !== '521')]
        : parDefaut(a as never)) as never);
    await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/N521 \(clôture 1500\.00, ouverture 0\.00\) en USD \(clôture 1\.00, ouverture 0\.00\)/);
  });

  it('un import divergent, rien de déclaré · refus qui nomme les positions, les montants et les deux gestes', async () => {
    const { s } = avecOuverture([IMPORT], faux);
    await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(
      /N411 \(clôture 300\.00, ouverture 450\.00\).*AUDCIF art\. 34.*Rectifier l'import.*Conserver l'import/,
    );
  });

  it('CONSERVER · rien n’est passé, motif ET positions s’écrivent sur l’exercice ; sans motif, refus', async () => {
    const sans = avecOuverture([IMPORT], faux);
    await expect(sans.s.cloturer('t', 'n', 'u', { ouvertureImportee: 'CONSERVER' })).rejects.toThrow(/motif écrit/);
    const { s, tx } = avecOuverture([IMPORT], faux);
    await s.cloturer('t', 'n', 'u', { ouvertureImportee: 'CONSERVER', motifConservation: 'N tenu pour les comparatifs' });
    expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
    const data = tx.exercice.update.mock.calls[0][0].data;
    expect(data.motifOuvertureSuivanteConservee).toBe('N tenu pour les comparatifs');
    expect(data.ecartsOuvertureSuivanteConservee).toMatchObject({
      total: 2,
      tronque: false,
      ecarts: expect.arrayContaining([expect.objectContaining({ numero: 'N411', cloture: 300, ouverture: 450 })]),
    });
  });

  it('un exercice SANS écriture · rien à reporter, l’import fait foi sans déclaration', async () => {
    const { s, tx } = avecOuverture([IMPORT], faux);
    tx.ecriture.count.mockResolvedValue(0);
    const r = (await s.cloturer('t', 'n', 'u')) as unknown as { issueOuverture: string[] };
    expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
    expect(r.issueOuverture.join(' ')).toMatch(/aucune écriture/);
  });

  it('RECTIFIER · ses lignes inscrites en NÉGATIF puis le report exact ; une ligne lettrée inscrite en négatif est NOMMÉE (R6)', async () => {
    const avecLettree = faux.map((l) => (l.id === 'i2' ? { ...l, lettrageId: 'g' } : l));
    const { s, tx } = avecOuverture([IMPORT], avecLettree);
    const r = (await s.cloturer('t', 'n', 'u', { ouvertureImportee: 'RECTIFIER' })) as unknown as { issueOuverture: string[] };
    const ran = tx.ecriture.create.mock.calls[1][0].data;
    const lignes = ran.lignes.create as { compteId: string; debit: number; credit: number }[];
    expect(lignes.filter((l) => l.compteId === '521' || l.compteId === '401')).toHaveLength(0);
    expect(lignes.filter((l) => l.compteId === '411')).toEqual([
      expect.objectContaining({ debit: -450, credit: -0 }),
      expect.objectContaining({ debit: 300, credit: 0 }),
    ]);
    expect(lignes.reduce((t, l) => t + l.debit - l.credit, 0)).toBe(0);
    expect(ran.statut).toBe('VALIDEE');
    expect(ran.motifCorrection).toMatch(/AUDCIF art\. 34.*art\. 20/);
    expect(r.issueOuverture.join(' ')).toMatch(/lettrées ou pointées.*N411 OD n° 1 débit 450\.00, lettrée/);
    const ouverture = (c: string) => [...faux, ...lignes].filter((l) => l.compteId === c).reduce((t, l) => t + l.debit - l.credit, 0);
    expect([ouverture('521'), ouverture('411'), ouverture('401'), ouverture('131')]).toEqual([500, 300, -300, -500]);
  });

  it('une écriture du premier jour AU BROUILLARD · la clôture est refusée, les gestes ouverts sont nommés', async () => {
    const { s } = avecOuverture([{ ...IMPORT, statut: 'BROUILLARD' }], importExact);
    await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/au brouillard \(OD n° 1\).*Validez-les/);
  });

  it('une ligne provisoire lettrée sur un compte où l’ouverture fait foi · le lettrage passe sur la ligne importée', async () => {
    const { s, tx } = avecOuverture([IMPORT], importExact);
    tx.ecriture.findFirst.mockResolvedValue({
      id: 'p',
      numeroPiece: 2,
      lignes: [{ id: 'pl', compteId: '411', debit: 300, credit: 0, dateEcheance: null, deviseId: null, montantDevise: null, lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null }],
    });
    (tx.ligneEcriture as Record<string, unknown>).update = jest.fn().mockResolvedValue({});
    await s.cloturer('t', 'n', 'u');
    expect((tx.ligneEcriture as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: 'i2' },
      data: { lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null },
    });
  });
});

/**
 * AU1 · une ligne du report PROVISOIRE de N+1 lettrée, puis figée par une
 * clôture de période de N+1 · la clôture de N refusait (« délettrez-les ») et
 * le délettrage aussi (ligne figée) · N ne se clôturait plus jamais.
 */
describe('AU1 · la clôture reporte le lettrage du provisoire sur le définitif', () => {
  const tenue = { id: 'pl', compteId: '411', debit: 300, credit: 0, dateEcheance: null, deviseId: null, montantDevise: null, lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null };
  const definitif = (lignes: Record<string, unknown>[]) => ({ data }: { data: { exerciceId: string } }) =>
    Promise.resolve({ lignes: data.exerciceId === 'n1' ? lignes : [] });
  const d = (id: string, compteId: string, debit: number, extra: Record<string, unknown> = {}) => ({ id, compteId, debit, credit: 0, dateEcheance: null, deviseId: null, montantDevise: null, ...extra });

  it('la clôture passe, et la ligne définitive de même compte et montant reçoit le groupe', async () => {
    const { s, tx } = service({ id: 'p', numeroPiece: 3, lignes: [tenue] as never });
    tx.ecriture.create.mockImplementation(definitif([d('d521', '521', 500), d('d411', '411', 300)]) as never);
    (tx.ligneEcriture as Record<string, unknown>).update = jest.fn().mockResolvedValue({});
    const r = (await s.cloturer('t', 'n', 'u')) as unknown as { issueOuverture: string[] };
    expect((tx.ligneEcriture as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: 'd411' },
      data: { lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null },
    });
    expect(tx.ecriture.delete).toHaveBeenCalledWith({ where: { id: 'p' } });
    expect(r.issueOuverture.join(' ')).toMatch(/reportées sur l'à-nouveau définitif/);
  });

  it('R3 et R4 · deux lignes de même montant aux échéances différentes · aucune devinette, le groupe est DÉLETTRÉ, écrit sur l’exercice, nommé, à relettrer', async () => {
    const { s: sv, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ ...tenue, dateEcheance: new Date('2027-02-01') }] as never });
    tx.ecriture.create.mockImplementation(
      definitif([d('x', '411', 300, { dateEcheance: new Date('2027-03-01') }), d('y', '411', 300, { dateEcheance: new Date('2027-04-01') })]) as never,
    );
    (tx.ligneEcriture as Record<string, unknown>).update = jest.fn().mockResolvedValue({});
    const parDefaut = tx.ligneEcriture.findMany.getMockImplementation()!;
    tx.ligneEcriture.findMany.mockImplementation(((a: { where: Record<string, unknown> }) =>
      a.where.lettrageId === 'g'
        ? Promise.resolve([{ id: 'reg', debit: 0, credit: 300, deviseId: null, montantDevise: null, ecriture: { date: new Date('2027-01-20') } }])
        : parDefaut(a as never)) as never);
    (tx.ligneEcriture as Record<string, unknown>).updateMany = jest.fn().mockResolvedValue({ count: 1 });
    tx.ligneEcriture.count.mockResolvedValue(2);
    (tx as Record<string, unknown>).lettrage = {
      findFirst: jest.fn().mockResolvedValue({ code: 'A', compteId: '411', compte: { numero: '41110000', intitule: 'Clients' } }),
      delete: jest.fn().mockResolvedValue({}),
    };
    const r = (await sv.cloturer('t', 'n', 'u')) as unknown as { issueOuverture: string[] };
    expect((tx.ligneEcriture as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled();
    expect((tx.ligneEcriture as unknown as { updateMany: jest.Mock }).updateMany).toHaveBeenCalledWith({
      where: { lettrageId: 'g', ecriture: { tenantId: 't' } },
      data: { lettre: null, lettrageId: null, aRelettrerDepuis: expect.any(Date) },
    });
    expect((tx as unknown as { lettrage: { delete: jest.Mock } }).lettrage.delete).toHaveBeenCalledWith({ where: { id: 'g' } });
    expect(tx.exercice.update.mock.calls[0][0].data.defaitsParLaCloture).toEqual([
      expect.objectContaining({ type: 'LETTRAGE', compte: '41110000', groupe: 'A', lignes: [{ date: '2027-01-20', montant: -300 }] }),
    ]);
    expect(r.issueOuverture.join(' ')).toMatch(/Lettrage A DÉLETTRÉ.*paiement du 2027-01-20.*À relettrer · 2 ligne\(s\) de même montant proposée\(s\)/);
  });

  it('R3 · une seule candidate à une autre échéance · appariée ; la devise ne se relâche jamais', async () => {
    const { s, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ ...tenue, dateEcheance: new Date('2027-02-01') }] as never });
    tx.ecriture.create.mockImplementation(definitif([d('x', '411', 300, { dateEcheance: new Date('2027-03-01') })]) as never);
    (tx.ligneEcriture as Record<string, unknown>).update = jest.fn().mockResolvedValue({});
    await s.cloturer('t', 'n', 'u');
    expect((tx.ligneEcriture as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'x' } }));
  });

  it('R5 · une ligne POINTÉE sans équivalent · le pointage est défait et nommé, jamais un refus (rapprochement en cours ou clos)', async () => {
    for (const statut of ['EN_COURS', 'CLOTURE']) {
      const { s: sv, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ ...tenue, debit: 999, lettre: null, lettrageId: null, rapprochementId: 'r' }] as never });
      tx.rapprochementBancaire.findMany.mockResolvedValue([{ id: 'r', statut, dateReleve: new Date('2027-01-31'), compte: { numero: '52110000' } }]);
      const r = (await sv.cloturer('t', 'n', 'u')) as unknown as { issueOuverture: string[] };
      expect(r.issueOuverture.join(' ')).toMatch(/Pointage défait · la ligne d'à-nouveau provisoire \(débit 999\.00\) quitte le rapprochement du relevé du 2027-01-31/);
      expect(tx.exercice.update.mock.calls[0][0].data.defaitsParLaCloture).toEqual([
        expect.objectContaining({ type: 'POINTAGE', compte: '52110000', releve: '2027-01-31', montant: 999 }),
      ]);
    }
  });
});

/**
 * AUDIT FINAL F7 · la clôture de période, définitive et valable pour tous
 * les journaux, acceptait n'importe quelle date · une faute sur l'année
 * figeait le dossier entier sans retour.
 */
describe('Clôture de période · bornée à l’exercice', () => {
  const service = () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { exercice: { findFirst: jest.fn().mockResolvedValue(N) }, cloture: { create } };
    return { s: new ExerciceService(prisma as never, {} as never), create };
  };

  it('refuse une date hors de l’exercice, et ne crée rien', async () => {
    const { s, create } = service();
    await expect(s.clorePeriode('t', 'n', 'u', { dateLimite: '2062-03-31' })).rejects.toThrow(/hors de l'exercice/);
    expect(create).not.toHaveBeenCalled();
  });

  it('accepte une date de l’exercice', async () => {
    const { s, create } = service();
    await s.clorePeriode('t', 'n', 'u', { dateLimite: '2026-03-31' });
    expect(create.mock.calls[0][0].data.dateLimite).toEqual(new Date('2026-03-31'));
  });
});

describe('Clôture annuelle · dépréciation orpheline d’une créance douteuse (ligne A7, B1)', () => {
  it('refuse tant qu’une créance perdue garde sa dépréciation sans revue de l’exercice, et nomme créance, montants et issue', async () => {
    // Revue de N-1 qui déprécie 800 ; perte de 1 000 en N ; N sans revue.
    const orpheline = {
      id: 'cd-1',
      montant: 1_000,
      dateReclassement: new Date('2025-06-30'),
      declareeOuverture: false,
      depreciationOuverture: 0,
      compteCreance: { numero: '41110001', intitule: 'Client Kasa' },
      ajustements: [{ exerciceId: 'n-1', ecart: 800, exercice: { dateFin: new Date('2025-12-31') } }],
      mouvements: [{ date: new Date('2026-05-10'), montant: 1_000 }],
    };
    const { s, tx } = service(null, [orpheline]);
    await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/41110001 Client Kasa \(dépréciation en place 800\.00, reste au 416 0\.00\).*Passez la revue/);
    expect(tx.ecriture.create).not.toHaveBeenCalled();
    // M2 · RELUE DANS LA TRANSACTION · la lecture passe par `tx`, jamais par le client hors transaction.
    expect(tx.creanceDouteuse.findMany).toHaveBeenCalled();
  });
});
