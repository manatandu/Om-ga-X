import { ClasseCompte, TypeJournal } from '@prisma/client';
import { EcritureService } from '../comptabilite/ecriture.service';
import {
  LecteurOuverturePassee,
  filtreOuverturePasseeAuPremierJour,
  lignesDeContrePassationDeclaree,
  negatifsTardifs,
  negatifsTardifsLisibles,
  ouverturePasseeNonNulle,
  positionDOuverturePassee,
} from './ouverture-passee';

/**
 * LE PÉRIMÈTRE DE L'OUVERTURE PASSÉE AU PREMIER JOUR, ÉVALUÉ (paquet 1, A8).
 *
 * Reproduit sur vraie base le 2026-10-08 · une réévaluation des devises de N
 * contre-passée par le module au 01/01 de N+1, N encore ouvert (A5 ter), était
 * lue par la clôture de N comme une ouverture DIVERGENTE ; la seule issue,
 * « Rectifier », l'inscrivait en négatif · client à 2 900 000 au lieu de
 * 2 800 000 en N+1, 479 à -100 000 au lieu de zéro, balance bouclée.
 *
 * Le filtre est écrit une fois et lu par quatre lecteurs (clôture et aperçu
 * AU2, états sans exercice précédent, 585 du groupe, candidates de la
 * reconduction du lettrage). Ce spec ÉVALUE la requête sur des écritures en
 * mémoire, avec un évaluateur qui honore chaque opérateur qu'elle pose et lève
 * sur tout autre · ce qui dépend de ce qu'une requête ramène se teste sur la
 * requête (CLAUDE.md, F4b).
 */
type Rangee = Record<string, unknown>;

function champ(v: unknown, f: unknown): boolean {
  if (f === null || typeof f !== 'object' || f instanceof Date) {
    return f instanceof Date ? v instanceof Date && v.getTime() === f.getTime() : (v ?? null) === f;
  }
  return Object.entries(f as Rangee).every(([op, x]) => {
    if (op === 'in') return (x as unknown[]).includes(v);
    throw new Error(`évaluateur : opérateur « ${op} » non honoré`);
  });
}

/** Une relation à un (`is`, `isNot`) · absente, elle vaut `null`. */
function relation(x: Rangee | null | undefined, f: Rangee): boolean {
  if ('is' in f) return f.is === null ? !x : !!x && evaluer(x, f.is);
  if ('isNot' in f) return f.isNot === null ? !!x : !x || !evaluer(x, f.isNot);
  return !!x && evaluer(x, f);
}

function evaluer(r: Rangee, where: unknown): boolean {
  return Object.entries((where ?? {}) as Rangee).every(([cle, f]) => {
    if (cle === 'AND') return (f as unknown[]).every((w) => evaluer(r, w));
    if (cle === 'OR') return (f as unknown[]).some((w) => evaluer(r, w));
    if (cle === 'journal' || cle === 'corrigeEcriture' || cle === 'reevaluationExtourne' || cle === 'compte') {
      return relation(r[cle] as Rangee | null | undefined, f as Rangee);
    }
    if (cle === 'lignes') {
      const { none, ...reste } = f as { none?: unknown };
      if (Object.keys(reste).length > 0 || none === undefined) throw new Error('évaluateur : filtre de lignes non honoré');
      return !((r.lignes as Rangee[] | undefined) ?? []).some((l) => evaluer(l, none));
    }
    if (cle === 'classe') return champ(r.classe, f);
    return champ(r[cle], f);
  });
}

const N1 = { id: 'n1', dateDebut: new Date('2027-01-01') };
const filtre = filtreOuverturePasseeAuPremierJour('t', N1);
const OD = { type: TypeJournal.GENERAL };
const BQ = { type: TypeJournal.TRESORERIE };
const bilan = (numero: string) => ({ compte: { classe: ClasseCompte.CLASSE_4, numero } });
const ecriture = (x: Rangee): Rangee => ({
  tenantId: 't',
  exerciceId: 'n1',
  date: N1.dateDebut,
  dateValeur: null,
  estANouveauProvisoire: false,
  estSoldeDesComptesDeGestion: false,
  estGenereeParCloture: false,
  journal: OD,
  corrigeEcriture: null,
  corrigeEcritureId: null,
  reevaluationExtourne: null,
  lignes: [bilan('41110001'), bilan('47910000')],
  ...x,
});

describe('A8 · la contre-passation d’une réévaluation n’est pas une ouverture', () => {
  it('une ouverture saisie en OD au premier jour reste dans le périmètre (AU2 inchangé)', () => {
    expect(evaluer(ecriture({}), filtre)).toBe(true);
  });

  it('la contre-passation du MODULE, reconnue par sa liaison, en sort', () => {
    expect(evaluer(ecriture({ reevaluationExtourne: { id: 'r26' } }), filtre)).toBe(false);
  });

  it('le négatif de cette contre-passation (annulation de la réévaluation, D6, liaison gardée) en sort avec elle', () => {
    const extourne = { journal: OD, estGenereeParCloture: false, reevaluationExtourne: { id: 'r26' } };
    expect(evaluer(ecriture({ corrigeEcritureId: 'x', corrigeEcriture: extourne }), filtre)).toBe(false);
  });

  it('une contre-passation ANNULÉE seule (déliée) et son négatif restent, et se soldent', () => {
    const extourneDeliee = { journal: OD, estGenereeParCloture: false, reevaluationExtourne: null };
    expect(evaluer(ecriture({}), filtre)).toBe(true);
    expect(evaluer(ecriture({ corrigeEcritureId: 'x', corrigeEcriture: extourneDeliee }), filtre)).toBe(true);
  });

  it('les autres bornes tiennent · journal de trésorerie, compte de gestion, provisoire, lendemain', () => {
    expect(evaluer(ecriture({ journal: BQ }), filtre)).toBe(false);
    expect(evaluer(ecriture({ lignes: [bilan('41110001'), { compte: { classe: ClasseCompte.CLASSE_7, numero: '77610000' } }] }), filtre)).toBe(false);
    expect(evaluer(ecriture({ estANouveauProvisoire: true }), filtre)).toBe(false);
    expect(evaluer(ecriture({ date: new Date('2027-01-02') }), filtre)).toBe(false);
    expect(evaluer(ecriture({ date: new Date('2027-01-02'), dateValeur: N1.dateDebut }), filtre)).toBe(true);
  });

  it('l’exclusion est DANS le AND · le lecteur qui ne reprend que `AND` et `lignes` (reconduction du lettrage) l’a aussi', () => {
    const { AND, lignes } = filtre as { AND: unknown; lignes: unknown };
    expect(evaluer(ecriture({ reevaluationExtourne: { id: 'r26' } }), { AND, lignes })).toBe(false);
    expect(evaluer(ecriture({}), { AND, lignes })).toBe(true);
  });
});

describe('A8 · la contre-passation faite à la main et DÉCLARÉE · ses seules lignes de l’écart', () => {
  // L'écriture des écarts de la réévaluation de N · client +100 000 (gain
  // latent, 479), fournisseur +50 000 (perte latente, 478), banque +30 000
  // (réalisé, 776, jamais contre-passé · AUDCIF art. 57).
  const ecarts = {
    lignes: [
      { compteId: 'c411', debit: 100_000, credit: 0, compte: { numero: '41110001' } },
      { compteId: 'c4791', debit: 0, credit: 100_000, compte: { numero: '47910000' } },
      { compteId: 'c4783', debit: 50_000, credit: 0, compte: { numero: '47830000' } },
      { compteId: 'c401', debit: 0, credit: 50_000, compte: { numero: '40110001' } },
      { compteId: 'c521', debit: 30_000, credit: 0, compte: { numero: '52110000' } },
      { compteId: 'c776', debit: 0, credit: 30_000, compte: { numero: '77610000' } },
    ],
  };

  it('écarte, par écriture, les comptes de l’écart de conversion (tiers, 478, 479), jamais la banque', () => {
    const r = lignesDeContrePassationDeclaree([{ id: 'od', reevaluationContrePassationDeclaree: { annuleeLe: null, ecritureEcarts: ecarts } }]);
    expect([...(r.get('od') ?? [])].sort()).toEqual(['c401', 'c411', 'c4783', 'c4791']);
  });

  it('une écriture sans déclaration, ou déclarée pour une réévaluation ANNULÉE, n’écarte rien', () => {
    expect(lignesDeContrePassationDeclaree([{ id: 'od' }, { id: 'od2', reevaluationContrePassationDeclaree: null }]).size).toBe(0);
    expect(
      lignesDeContrePassationDeclaree([{ id: 'od', reevaluationContrePassationDeclaree: { annuleeLe: new Date('2027-02-01'), ecritureEcarts: ecarts } }]).size,
    ).toBe(0);
  });
});

describe('B2 · le négatif d’une écriture du premier jour en fait partie, quelle que soit sa date (AUDCIF art. 20, al. 2)', () => {
  const od = { journal: OD, estGenereeParCloture: false, reevaluationExtourne: null, date: N1.dateDebut, dateValeur: null };
  const plusTard = new Date('2027-02-15');

  it('le négatif daté du 15/02 d’une OD du 01/01 entre dans le périmètre', () => {
    expect(evaluer(ecriture({ date: plusTard, corrigeEcritureId: 'od', corrigeEcriture: od }), filtre)).toBe(true);
  });

  it('le négatif d’une écriture qui n’est PAS du premier jour n’y entre pas', () => {
    const odDuLendemain = { ...od, date: new Date('2027-01-02') };
    expect(evaluer(ecriture({ date: plusTard, corrigeEcritureId: 'od', corrigeEcriture: odDuLendemain }), filtre)).toBe(false);
  });

  it('le négatif d’une écriture de trésorerie du premier jour n’y entre pas (même journal, opération de l’exercice)', () => {
    const banque = { ...od, journal: BQ };
    expect(evaluer(ecriture({ journal: BQ, date: plusTard, corrigeEcritureId: 'bq', corrigeEcriture: banque }), filtre)).toBe(false);
  });

  it('le négatif d’une contre-passation du MODULE, daté plus tard, reste dehors', () => {
    const extourne = { ...od, reevaluationExtourne: { id: 'r26' } };
    expect(evaluer(ecriture({ date: plusTard, corrigeEcritureId: 'x', corrigeEcriture: extourne }), filtre)).toBe(false);
  });

  it('dans le AND aussi · la reconduction du lettrage le lit', () => {
    const { AND, lignes } = filtre as { AND: unknown; lignes: unknown };
    expect(evaluer(ecriture({ date: plusTard, corrigeEcritureId: 'od', corrigeEcriture: od }), { AND, lignes })).toBe(true);
  });
});

/**
 * La position NETTE de l'ouverture (B2, M4, m4) · une doublure qui ÉVALUE les
 * trois lectures (comptage des lignes, écritures, lignes par tranches) sur des
 * écritures en mémoire.
 */
describe('B2 · une ouverture qui se solde n’est pas une ouverture (`ouverturePasseeNonNulle`)', () => {
  const ligne = (id: string, ecritureId: string, compteId: string, debit: number, credit: number) => ({
    id, ecritureId, compteId, debit, credit, deviseId: null, montantDevise: null, compte: { classe: ClasseCompte.CLASSE_4, numero: compteId },
  });
  const odOuverture = ecriture({
    id: 'od', statut: 'VALIDEE', numeroPiece: 2,
    lignes: [ligne('l1', 'od', 'c521', 10_500_000, 0), ligne('l2', 'od', 'c101', 0, 10_000_000), ligne('l3', 'od', 'c131', 0, 500_000)],
  });
  const negatif = ecriture({
    id: 'neg', statut: 'VALIDEE', numeroPiece: 3, date: new Date('2027-02-15'), corrigeEcritureId: 'od', corrigeEcriture: odOuverture,
    lignes: [ligne('n1', 'neg', 'c521', -10_500_000, 0), ligne('n2', 'neg', 'c101', 0, -10_000_000), ligne('n3', 'neg', 'c131', 0, -500_000)],
  });
  function lecteur(ecritures: Rangee[]): LecteurOuverturePassee {
    const retenues = (w: unknown) => ecritures.filter((e) => evaluer(e, w));
    return {
      ligneEcriture: {
        count: jest.fn(({ where }: { where: { ecriture: unknown } }) =>
          Promise.resolve(retenues(where.ecriture).reduce((n, e) => n + (e.lignes as Rangee[]).length, 0))),
        findMany: jest.fn(({ where, cursor }: { where: { ecriture: unknown }; cursor?: unknown }) =>
          Promise.resolve(cursor ? [] : retenues(where.ecriture).flatMap((e) => e.lignes as Rangee[]))),
      },
      ecriture: {
        findMany: jest.fn(({ where }: { where: unknown }) =>
          Promise.resolve(retenues(where).map((e) => ({ ...e, journal: { code: 'OD' }, reevaluationContrePassationDeclaree: e.reevaluationContrePassationDeclaree ?? null })))),
      },
    } as unknown as LecteurOuverturePassee;
  }

  it('l’OD seule est une ouverture · ses pièces sont nommées', async () => {
    expect(await ouverturePasseeNonNulle(lecteur([odOuverture]), 't', N1, { validees: true })).toEqual({ nombre: 1, pieces: ['OD n° 2'] });
  });

  it('l’OD et son négatif daté plus tard se soldent compte par compte · aucune ouverture', async () => {
    expect(await ouverturePasseeNonNulle(lecteur([odOuverture, negatif]), 't', N1, { validees: true })).toBeNull();
  });

  it('au livre-journal seul · un négatif encore au brouillard n’annule rien', async () => {
    const auBrouillard = { ...negatif, statut: 'BROUILLARD' };
    expect(await ouverturePasseeNonNulle(lecteur([odOuverture, auBrouillard]), 't', N1, { validees: true })).toEqual({ nombre: 1, pieces: ['OD n° 2'] });
  });

  it('aucune écriture au premier jour · aucune ouverture', async () => {
    expect(await ouverturePasseeNonNulle(lecteur([]), 't', N1, { validees: true })).toBeNull();
  });

  /**
   * Second tour, BLOQUANT 1 · la position nulle DIT le négatif inscrit hors du
   * premier jour · la clôture fait déclarer, les états le nomment.
   */
  it('second tour, B1 · une position nulle dit son négatif inscrit après le premier jour, jamais celui du premier jour', async () => {
    expect(await positionDOuverturePassee(lecteur([odOuverture, negatif]), 't', N1, { validees: true })).toEqual({
      etat: 'NULLE',
      negatifsTardifs: [{ piece: 'OD n° 3', date: new Date('2027-02-15') }],
    });
    const duPremierJour = { ...negatif, date: N1.dateDebut };
    expect(await positionDOuverturePassee(lecteur([odOuverture, duPremierJour]), 't', N1, { validees: true })).toEqual({ etat: 'NULLE', negatifsTardifs: [] });
    expect(await positionDOuverturePassee(lecteur([]), 't', N1, { validees: true })).toEqual({ etat: 'AUCUNE' });
    expect(await positionDOuverturePassee(lecteur([odOuverture]), 't', N1, { validees: true })).toEqual({ etat: 'NON_NULLE', nombre: 1, pieces: ['OD n° 2'] });
  });

  /**
   * Relecture du paquet 1, M4 · le CÂBLAGE · les états d'un exercice sans
   * précédent lisent l'ouverture par `EcritureService.ouverturePasseeAuPremierJour`,
   * qui comptait les écritures du périmètre · une OD annulée par son négatif
   * vidait le tableau des flux sans issue. Elle juge désormais la position
   * nette, comme la clôture.
   */
  it('M4 · les états lisent l’ouverture NETTE · l’OD et son négatif ne vident plus le tableau des flux', async () => {
    const service = (ecritures: Rangee[]) =>
      new EcritureService(
        { ...lecteur(ecritures), exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', dateDebut: N1.dateDebut }) } } as never,
        {} as never,
        {} as never,
        {} as never,
      );
    expect(await service([odOuverture, negatif]).ouverturePasseeAuPremierJour('t', 'n1')).toBeNull();
    expect(await service([odOuverture]).ouverturePasseeAuPremierJour('t', 'n1')).toEqual({ nombre: 1, pieces: ['OD n° 2'] });
  });

  it('second tour, B1 · le câblage des états · `positionDOuvertureAuPremierJour` dit le négatif inscrit après le premier jour', async () => {
    const service = new EcritureService(
      { ...lecteur([odOuverture, negatif]), exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', dateDebut: N1.dateDebut }) } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(await service.positionDOuvertureAuPremierJour('t', 'n1')).toEqual({
      etat: 'NULLE',
      negatifsTardifs: [{ piece: 'OD n° 3', date: new Date('2027-02-15') }],
    });
  });
});

/**
 * SECOND TOUR DE RELECTURE DU PAQUET 1, BLOQUANT 1 · le négatif lié inscrit
 * HORS du premier jour (ni daté ni valorisé au premier jour, comme le
 * périmètre lit le premier jour) · sa ressaisie a pu se faire ce jour-là, hors
 * du périmètre. AUDCIF art. 20, al. 2.
 */
describe('second tour, B1 · `negatifsTardifs`', () => {
  const jour1 = new Date('2027-01-01');
  const base = { numeroPiece: 4, journal: { code: 'OD' }, dateValeur: null };

  it('un négatif lié daté du 15/03 est tardif, et se nomme avec sa date', () => {
    const t = negatifsTardifs([{ ...base, date: new Date('2027-03-15'), corrigeEcritureId: 'od' }], jour1);
    expect(t).toEqual([{ piece: 'OD n° 4', date: new Date('2027-03-15') }]);
    expect(negatifsTardifsLisibles(t)).toBe('OD n° 4 du 15/03/2027');
  });

  it('daté ou valorisé au premier jour, ou sans liaison, il ne l’est pas', () => {
    expect(negatifsTardifs([{ ...base, date: jour1, corrigeEcritureId: 'od' }], jour1)).toEqual([]);
    expect(negatifsTardifs([{ ...base, date: new Date('2027-03-15'), dateValeur: jour1, corrigeEcritureId: 'od' }], jour1)).toEqual([]);
    expect(negatifsTardifs([{ ...base, date: new Date('2027-03-15'), corrigeEcritureId: null }], jour1)).toEqual([]);
  });
});
