import { TauxTvaService } from './taux-tva.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * LIGNE tva-decisions, POINTS A ET B (décision par la loi du 2026-10-08).
 *
 * (A) LE NÉGATIF D'UNE FACTURE · le crédit NÉGATIF du 443 qui annule une vente
 *     (AUDCIF art. 20, al. 2) était écarté comme un montant nul, et la taxe
 *     d'une vente annulée au journal restait déclarée. Il se lit au signe près,
 *     à la date de la facture corrigée (O.-L. n° 10/001, art. 25) ; la période
 *     de la vente liquidée, la taxe se récupère une fois, au premier jour non
 *     liquidé (art. 52, al. 1 ; décret n° 011/42, art. 126), NOMMÉE. Jumeau à la
 *     déduction · le débit négatif du 445 d'un achat annulé.
 *
 * (B) LA LIGNE VALIDÉE APRÈS LA LIQUIDATION QUI DEVAIT LA LIRE · rattachée au
 *     premier jour non liquidé (AUDCIF art. 22, 4°), nommée avec sa date
 *     d'origine ; avoir sur vente compris (décret, art. 126).
 *
 * LA DOUBLURE HONORE LA REQUÊTE · statut VALIDÉE, date au plus tard la fin de
 * période, taux lus ; liquidations filtrées sur leurs bornes comme en base.
 */
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };

interface Ligne {
  id: string;
  /** 443 (vente) ou 445 (achat). */
  famille: '443' | '445';
  date: string;
  validee?: string;
  debit?: number;
  credit?: number;
  piece?: number;
  corrige?: { piece: number; date: string; validee?: string };
  /** Contrepartie de nature · 701 (biens), 706 (services), 601 (achat de biens). */
  contrepartie?: string;
  /** Ligne de tiers de l'écriture (411 ou 401), lettrée ou non. */
  tiers?: {
    numero: string;
    debit?: number;
    credit?: number;
    lettrage?: unknown;
    /** Désignations de la ligne dans une créance douteuse, et les pertes non annulées qui ont annulé leur taxe (M4). */
    designations?: Array<{ id: string; pertes: Array<{ date: string; detail: string[]; impayeTtc?: number }> }>;
  };
  statut?: 'VALIDEE' | 'BROUILLARD';
}

interface Liq {
  id: string;
  dateDebut: string;
  dateFin: string;
  creeLe: string;
  net?: number;
  /** Passée sous la règle des lignes tardives et des négatifs · par défaut oui (`false` · une liquidation d'avant). */
  regle?: boolean;
  /** L'instant de la lecture de sa déclaration, s'il est gardé. */
  lu?: string;
}

const D = (s: string) => new Date(s);
const fin = (s: string) => new Date(`${s}T23:59:59.999Z`);

function service(lignes: Ligne[], liquidations: Liq[] = [], regime = 'LIVRAISONS') {
  const liqs = liquidations.map((l) => ({
    id: l.id,
    tenantId: 't1',
    dateDebut: D(l.dateDebut),
    dateFin: fin(l.dateFin),
    createdAt: D(l.creeLe),
    tvaEncaissementFigee: {},
    regleTardifs: l.regle ?? true,
    instantLecture: l.lu ? D(l.lu) : null,
    net: l.net ?? 0,
    ecritureId: `e-${l.id}`,
    ecriture: { id: `e-${l.id}`, libelle: 'Liquidation', date: fin(l.dateFin) },
  }));
  const respecte = (l: (typeof liqs)[number], where: Record<string, any>) => {
    if (where.tenantId && where.tenantId !== l.tenantId) return false;
    if (where.dateFin?.lt && !(l.dateFin < where.dateFin.lt)) return false;
    if (where.dateFin?.gte && !(l.dateFin >= where.dateFin.gte)) return false;
    if (where.dateDebut?.lte && !(l.dateDebut <= where.dateDebut.lte)) return false;
    if (where.tvaEncaissementFigee) return false;
    return true;
  };
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: regime, referentiel: 'SYSCOHADA', dateAutorisationDebitsTva: null }) },
    tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
    ecriture: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    ligneEcriture: {
      findMany: jest.fn().mockImplementation(({ where, cursor }: { where: Record<string, any>; cursor?: unknown }) => {
        if (cursor) return Promise.resolve([]);
        if (!where?.compte?.OR) return Promise.resolve([]);
        const taux: string[] = where.tauxTvaId?.in ?? [];
        const lte: Date | undefined = where.ecriture?.OR?.[0]?.date?.lte;
        // La branche du point A · le négatif d'une facture de la période.
        const lteCorrigee: Date | undefined = where.ecriture?.OR?.find((b: any) => b.corrigeEcriture)?.corrigeEcriture?.is?.date?.lte;
        // La lecture d'une liquidation, bornée à son instant (second tour, MAJEUR).
        const borne: Date | undefined = where.ecriture?.AND?.[0]?.OR?.[0]?.valideeAt?.lte;
        return Promise.resolve(
          lignes
            .filter((l) => !borne || D(l.validee ?? l.date) <= borne)
            .filter((l) => (l.statut ?? 'VALIDEE') === where.ecriture.statut)
            .filter(() => taux.includes(TAUX.id))
            .filter((l) => !lte || D(l.date) <= lte || (!!l.corrige && !!lteCorrigee && D(l.corrige.date) <= lteCorrigee))
            .map((l) => {
              const numeroTva = l.famille === '443' ? '44310000' : '44520000';
              const lignesEcriture: any[] = [];
              if (l.contrepartie) {
                const classe = l.contrepartie.startsWith('7') ? 'CLASSE_7' : l.contrepartie.startsWith('2') ? 'CLASSE_2' : 'CLASSE_6';
                const montant = ((l.credit ?? 0) + (l.debit ?? 0)) * 6.25;
                lignesEcriture.push({
                  id: `${l.id}-c`,
                  compteId: `c${l.contrepartie}`,
                  debit: classe === 'CLASSE_7' ? 0 : montant,
                  credit: classe === 'CLASSE_7' ? montant : 0,
                  compte: { numero: `${l.contrepartie}10000`.slice(0, 8), classe },
                  lettrage: null,
                });
              }
              if (l.tiers) {
                lignesEcriture.push({
                  id: `${l.id}-t`,
                  compteId: `c${l.tiers.numero}`,
                  debit: l.tiers.debit ?? 0,
                  credit: l.tiers.credit ?? 0,
                  compte: { numero: l.tiers.numero, classe: 'CLASSE_4', tiersCompte: null },
                  lettrage: l.tiers.lettrage ?? null,
                  lettrageId: l.tiers.lettrage ? 'g1' : null,
                  creancesDouteusesDesignees: (l.tiers.designations ?? []).map((d) => ({
                    id: d.id,
                    // Le détail figé de la perte · l'impayé éteint et la taxe à l'encaissement annulée.
                    creance: {
                      mouvements: d.pertes.map((p) => ({
                        date: D(p.date),
                        detailTva: p.detail.map((x) => ({ designationId: x, impayeTtc: p.impayeTtc ?? 1_160_000, tvaAnnulable: 1 })),
                      })),
                    },
                  })),
                });
              }
              return {
                id: l.id,
                tauxTvaId: TAUX.id,
                compteId: `c${numeroTva}`,
                debit: l.debit ?? 0,
                credit: l.credit ?? 0,
                compte: { numero: numeroTva },
                ecriture: {
                  id: `e${l.id}`,
                  date: D(l.date),
                  libelle: `Pièce ${l.piece ?? l.id}`,
                  createdAt: D(l.validee ?? l.date),
                  valideeAt: D(l.validee ?? l.date),
                  facture: null,
                  recuperationTvaCreance: null,
                  numeroPiece: l.piece ?? null,
                  corrigeEcriture: l.corrige
                    ? {
                        numeroPiece: l.corrige.piece,
                        date: D(l.corrige.date),
                        valideeAt: D(l.corrige.validee ?? l.corrige.date),
                        createdAt: D(l.corrige.validee ?? l.corrige.date),
                      }
                    : null,
                  lignes: lignesEcriture,
                },
              };
            }),
        );
      }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
    },
    factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
    creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    imputationPaiement: { findMany: jest.fn().mockResolvedValue([]) },
    evenementAudit: { findMany: jest.fn().mockResolvedValue([]) },
    liquidationTva: {
      findMany: jest.fn().mockImplementation(({ where }: { where: Record<string, any> }) =>
        Promise.resolve(liqs.filter((l) => respecte(l, where ?? {})).sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime())),
      ),
      findFirst: jest.fn().mockImplementation(({ where, orderBy }: { where: Record<string, any>; orderBy?: Record<string, string> }) => {
        const r = liqs.filter((l) => respecte(l, where ?? {}));
        if (orderBy?.dateFin === 'desc') r.sort((a, b) => b.dateFin.getTime() - a.dateFin.getTime());
        else r.sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
        return Promise.resolve(r[0] ?? null);
      }),
    },
  } as unknown as PrismaService;
  return new TauxTvaService(prisma, {} as EcritureService);
}

const MARS = [D('2027-03-01'), fin('2027-03-31')] as const;
const AVRIL = [D('2027-04-01'), fin('2027-04-30')] as const;
const MAI = [D('2027-05-01'), fin('2027-05-31')] as const;
const JANVIER = [D('2027-01-01'), fin('2027-01-31')] as const;
const FEVRIER = [D('2027-02-01'), fin('2027-02-28')] as const;

describe('Point A · le négatif d’une vente se lit au signe près', () => {
  const vente: Ligne = { id: 'v1', famille: '443', date: '2027-01-15', credit: 160_000, piece: 12, contrepartie: '701' };

  it('dans la période de la vente, il l’annule · rien n’est déclaré, et il est nommé', async () => {
    const s = service([vente, { id: 'n1', famille: '443', date: '2027-01-25', credit: -160_000, piece: 19, corrige: { piece: 12, date: '2027-01-15' }, contrepartie: '701' }]);
    const d = await s.declaration('t1', ...JANVIER);
    expect(d.totalCollecte).toBe(0);
    expect(d.recuperationArt52).toBe(0);
    expect(d.negatifsDeFactures).toEqual([
      expect.objectContaining({ piece: 19, factureCorrigee: { piece: 12, date: '2027-01-15' }, sens: 'VENTE', montant: 160_000, pese: 'ANNULEE_ICI' }),
    ]);
  });

  it('négatif inscrit en février d’une vente de janvier NON liquidé · il pèse sur janvier, la bonne période', async () => {
    const s = service([vente, { id: 'n1', famille: '443', date: '2027-02-10', credit: -160_000, piece: 19, corrige: { piece: 12, date: '2027-01-15' }, contrepartie: '701' }]);
    expect((await s.declaration('t1', ...JANVIER)).totalCollecte).toBe(0);
    const fev = await s.declaration('t1', ...FEVRIER);
    expect(fev.totalCollecte).toBe(0);
    expect(fev.recuperationArt52).toBe(0);
  });

  it('janvier LIQUIDÉ avant le négatif · janvier garde ce qu’il a déclaré, la taxe se récupère en février, une fois, nommée', async () => {
    const lignes: Ligne[] = [
      vente,
      { id: 'n1', famille: '443', date: '2027-02-20', validee: '2027-02-20', credit: -160_000, piece: 19, corrige: { piece: 12, date: '2027-01-15' }, contrepartie: '701' },
    ];
    const liqs: Liq[] = [{ id: 'L1', dateDebut: '2027-01-01', dateFin: '2027-01-31', creeLe: '2027-02-05' }];
    const s = service(lignes, liqs);
    const jan = await s.declaration('t1', ...JANVIER);
    expect(jan.totalCollecte).toBe(160_000);
    const fev = await s.declaration('t1', ...FEVRIER);
    expect(fev.totalCollecte).toBe(0);
    expect(fev.recuperationArt52).toBe(160_000);
    expect(fev.netAvantImputation).toBe(-160_000);
    expect(fev.negatifsDeFactures[0]).toEqual(expect.objectContaining({ pese: 'REPRISE_ICI', montant: 160_000 }));
    expect(fev.rattachementsTardifs).toEqual([
      expect.objectContaining({ nature: 'NEGATIF_DE_VENTE', dateOrigine: '2027-01-15', rattacheeAu: '2027-02-20', montant: -160_000 }),
    ]);
    // Une fois · mars ne la reprend pas.
    const mars = await service(lignes, [...liqs, { id: 'L2', dateDebut: '2027-02-01', dateFin: '2027-02-28', creeLe: '2027-03-05' }]).declaration('t1', ...MARS);
    expect(mars.recuperationArt52).toBe(0);
    expect(mars.totalCollecte).toBe(0);
  });

  it('négatif validé AVANT la liquidation de janvier · janvier l’a vu, il s’y annule', async () => {
    const s = service(
      [vente, { id: 'n1', famille: '443', date: '2027-01-25', validee: '2027-01-25', credit: -160_000, piece: 19, corrige: { piece: 12, date: '2027-01-15' }, contrepartie: '701' }],
      [{ id: 'L1', dateDebut: '2027-01-01', dateFin: '2027-01-31', creeLe: '2027-02-05' }],
    );
    expect((await s.declaration('t1', ...JANVIER)).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...FEVRIER)).recuperationArt52).toBe(0);
  });

  it('prestation à l’encaissement impayée · le négatif la retire de l’attente, sans rien collecter', async () => {
    const s = service([
      { id: 'p1', famille: '443', date: '2027-01-10', credit: 160_000, piece: 3, contrepartie: '706', tiers: { numero: '41110000', debit: 1_160_000 } },
      { id: 'n1', famille: '443', date: '2027-01-20', credit: -160_000, piece: 4, corrige: { piece: 3, date: '2027-01-10' }, contrepartie: '706', tiers: { numero: '41110000', debit: -1_160_000 } },
    ]);
    const d = await s.declaration('t1', ...JANVIER);
    expect(d.totalCollecte).toBe(0);
    // Le taux n'a plus aucun mouvement · ni collecte ni attente.
    expect(d.lignes[0]?.enAttente ?? 0).toBe(0);
    expect(d.negatifsDeFactures[0].pese).toBe('RETIREE_DE_L_ATTENTE');
  });

  it('prestation lettrée avec son propre négatif · elle n’est pas « encaissée » au jour du négatif', async () => {
    const groupe = {
      id: 'g1',
      statut: 'SOLDE',
      solde: 0,
      soldeAt: D('2027-01-20'),
      createdAt: D('2027-01-20'),
      lignes: [
        { id: 'p1-t', compteId: 'c41110000', debit: 1_160_000, credit: 0, ecriture: { id: 'ep1', date: D('2027-01-10'), corrigeEcritureId: null, _count: { lignes: 0 } } },
        { id: 'n1-t', compteId: 'c41110000', debit: -1_160_000, credit: 0, ecriture: { id: 'en1', date: D('2027-01-20'), corrigeEcritureId: 'ep1', _count: { lignes: 0 } } },
      ],
    };
    const s = service([
      { id: 'p1', famille: '443', date: '2027-01-10', credit: 160_000, piece: 3, contrepartie: '706', tiers: { numero: '41110000', debit: 1_160_000, lettrage: groupe } },
      { id: 'n1', famille: '443', date: '2027-01-20', credit: -160_000, piece: 4, corrige: { piece: 3, date: '2027-01-10' }, contrepartie: '706', tiers: { numero: '41110000', debit: -1_160_000, lettrage: groupe } },
    ]);
    const d = await s.declaration('t1', ...JANVIER);
    expect(d.totalCollecte).toBe(0);
  });

  it('jumeau · le négatif d’un achat de janvier liquidé reprend la déduction en février', async () => {
    const s = service(
      [
        { id: 'a1', famille: '445', date: '2027-01-12', debit: 16_000, piece: 7, contrepartie: '601' },
        { id: 'na1', famille: '445', date: '2027-02-10', validee: '2027-02-10', debit: -16_000, piece: 8, corrige: { piece: 7, date: '2027-01-12' }, contrepartie: '601' },
      ],
      [{ id: 'L1', dateDebut: '2027-01-01', dateFin: '2027-01-31', creeLe: '2027-02-05' }],
    );
    expect((await s.declaration('t1', ...JANVIER)).totalDeductible).toBe(16_000);
    const fev = await s.declaration('t1', ...FEVRIER);
    expect(fev.totalDeductible).toBe(-16_000);
    expect(fev.negatifsDeFactures[0]).toEqual(expect.objectContaining({ sens: 'ACHAT', pese: 'REPRISE_ICI' }));
  });

  it('la liquidation porte au CRÉDIT du 443 une collecte devenue négative, et ne refuse pas une collecte négative', () => {
    const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'taux-tva.service.ts'), 'utf8') as string;
    const corps = source.slice(source.indexOf('async comptabiliserLiquidation('), source.indexOf('private async liquidationChevauchante('));
    expect(corps).toContain('Math.abs(decl.totalCollecte) <= EPSILON');
    expect(corps).toContain("{ compteId, debit: 0, credit: -montant, libelle: 'Liquidation TVA · ventes annulées par inscription en négatif' }");
  });
});

describe('Point B · la ligne validée après la liquidation qui devait la lire', () => {
  const liqsAvant: Liq[] = [
    { id: 'L3', dateDebut: '2027-03-01', dateFin: '2027-03-31', creeLe: '2027-04-05' },
    { id: 'L4', dateDebut: '2027-04-01', dateFin: '2027-04-30', creeLe: '2027-05-05' },
  ];

  it('une vente de mars validée en mai, mars et avril liquidés · déclarée en mai, nommée avec sa date d’origine', async () => {
    const s = service([{ id: 'v1', famille: '443', date: '2027-03-10', validee: '2027-05-10', credit: 160_000, piece: 30, contrepartie: '701' }], liqsAvant);
    const mars = await s.declaration('t1', ...MARS);
    expect(mars.totalCollecte).toBe(0);
    const mai = await s.declaration('t1', ...MAI);
    expect(mai.totalCollecte).toBe(160_000);
    expect(mai.rattachementsTardifs).toEqual([
      expect.objectContaining({ nature: 'COLLECTE', dateOrigine: '2027-03-10', rattacheeAu: '2027-05-01', montant: 160_000, piece: 30 }),
    ]);
  });

  it('avril liquidé APRÈS la validation · avril l’a vue, elle reste à avril, jamais deux fois', async () => {
    const liqs: Liq[] = [liqsAvant[0], { ...liqsAvant[1], creeLe: '2027-05-15' }];
    const s = service([{ id: 'v1', famille: '443', date: '2027-03-10', validee: '2027-05-10', credit: 160_000, contrepartie: '701' }], liqs);
    expect((await s.declaration('t1', ...AVRIL)).totalCollecte).toBe(160_000);
    expect((await s.declaration('t1', ...MAI)).totalCollecte).toBe(0);
  });

  it('un achat de mars validé en mai · sa déduction s’exerce en mai (art. 37, al. 2)', async () => {
    const s = service([{ id: 'a1', famille: '445', date: '2027-03-10', validee: '2027-05-10', debit: 16_000, contrepartie: '601' }], liqsAvant);
    const mai = await s.declaration('t1', ...MAI);
    expect(mai.totalDeductible).toBe(16_000);
    expect(mai.rattachementsTardifs[0]).toEqual(expect.objectContaining({ nature: 'DEDUCTION', dateOrigine: '2027-03-10' }));
  });

  it('un avoir sur vente de mars validé après la liquidation d’avril · récupéré en mai, jamais en avril', async () => {
    const lignes: Ligne[] = [{ id: 'av1', famille: '443', date: '2027-03-12', validee: '2027-05-10', debit: 80_000, contrepartie: '701' }];
    const s = service(lignes, liqsAvant);
    expect((await s.declaration('t1', ...AVRIL)).recuperationArt52).toBe(0);
    const mai = await s.declaration('t1', ...MAI);
    expect(mai.recuperationArt52).toBe(80_000);
    expect(mai.rattachementsTardifs[0]).toEqual(expect.objectContaining({ nature: 'AVOIR_SUR_VENTE', rattacheeAu: '2027-05-01' }));
  });

  it('un avoir validé AVANT la liquidation d’avril · avril le récupère par la fenêtre ordinaire, mai rien', async () => {
    const s = service([{ id: 'av1', famille: '443', date: '2027-03-12', validee: '2027-04-10', debit: 80_000, contrepartie: '701' }], liqsAvant);
    expect((await s.declaration('t1', ...AVRIL)).recuperationArt52).toBe(80_000);
    expect((await s.declaration('t1', ...MAI)).recuperationArt52).toBe(0);
  });

  it('la règle pure · premier jour qu’aucune liquidation antérieure à la validation ne couvre', () => {
    const liqs = liqsAvant.map((l) => ({ dateDebut: D(l.dateDebut), dateFin: fin(l.dateFin), createdAt: D(l.creeLe), regleTardifs: true }));
    const r = (date: Date, tardive: boolean) => ({ date, tardive, ancienMoteur: false, dansUnTrou: false });
    expect(TauxTvaService.rattachementTardif(D('2027-03-10'), D('2027-04-01'), liqs)).toEqual(r(D('2027-03-10'), false));
    expect(TauxTvaService.rattachementTardif(D('2027-03-10'), D('2027-04-10'), liqs)).toEqual(r(D('2027-04-01'), true));
    expect(TauxTvaService.rattachementTardif(D('2027-03-10'), D('2027-05-10'), liqs)).toEqual(r(D('2027-05-01'), true));
    expect(TauxTvaService.rattachementTardif(D('2027-03-10'), D('2027-05-10'), liqs, D('2027-05-20'))).toEqual(r(D('2027-05-20'), true));
    expect(TauxTvaService.rattachementTardif(D('2027-03-10'), null, liqs)).toEqual(r(D('2027-03-10'), false));
    expect(TauxTvaService.recuperationTardive(D('2027-03-12'), D('2027-04-10'), liqs)).toBeNull();
    expect(TauxTvaService.recuperationTardive(D('2027-03-12'), D('2027-05-10'), liqs)).toEqual({ date: D('2027-05-01'), ancienMoteur: false, dansUnTrou: false });
  });
});

/*
  RELECTURES DU 2026-10-08 (premier tour) · ce que les liquidations ont VU, et
  les négatifs qui ne pèsent pas ici.
*/
describe('Relectures · ce qu’une liquidation a vu, et ce qui se nomme', () => {
  const vente: Ligne = { id: 'v1', famille: '443', date: '2027-01-15', credit: 160_000, piece: 12, contrepartie: '701' };

  it('MAJEUR 4 · une liquidation d’AVANT la règle n’a lu aucun négatif · repris au premier jour non liquidé, nommé « ancien moteur »', async () => {
    const lignes: Ligne[] = [
      vente,
      { id: 'n1', famille: '443', date: '2027-01-25', validee: '2027-01-25', credit: -160_000, piece: 19, corrige: { piece: 12, date: '2027-01-15' }, contrepartie: '701' },
    ];
    // Janvier liquidé le 5 février, APRÈS le négatif, par un moteur qui l'écartait.
    const s = service(lignes, [{ id: 'L1', dateDebut: '2027-01-01', dateFin: '2027-01-31', creeLe: '2027-02-05', regle: false }]);
    const fev = await s.declaration('t1', ...FEVRIER);
    expect(fev.recuperationArt52).toBe(160_000);
    expect(fev.rattachementsTardifs).toEqual([expect.objectContaining({ nature: 'NEGATIF_DE_VENTE', rattacheeAu: '2027-02-01', ancienMoteur: true })]);
    expect(fev.rattachementsAncienMoteurTotal).toBe(1);
    expect(fev.mentionExigibilite).toContain('LIQUIDATIONS D’AVANT LA RÈGLE DES LIGNES TARDIVES');
    // Sous la règle, la même liquidation l'a lu · il s'annule en janvier.
    const regle = service(lignes, [{ id: 'L1', dateDebut: '2027-01-01', dateFin: '2027-01-31', creeLe: '2027-02-05' }]);
    expect((await regle.declaration('t1', ...FEVRIER)).recuperationArt52).toBe(0);
  });

  it('M1 · une liquidation d’avant la règle, lue APRÈS la validation, n’a pas repris la ligne d’une autre période · portée plus loin, nommée', async () => {
    const liqs: Liq[] = [
      { id: 'L3', dateDebut: '2027-03-01', dateFin: '2027-03-31', creeLe: '2027-04-05', regle: false },
      { id: 'L4', dateDebut: '2027-04-01', dateFin: '2027-04-30', creeLe: '2027-05-15', regle: false },
    ];
    const s = service([{ id: 'v1', famille: '443', date: '2027-03-10', validee: '2027-05-10', credit: 160_000, contrepartie: '701' }], liqs);
    expect((await s.declaration('t1', ...AVRIL)).totalCollecte).toBe(0);
    const mai = await s.declaration('t1', ...MAI);
    expect(mai.totalCollecte).toBe(160_000);
    expect(mai.rattachementsTardifs).toEqual([expect.objectContaining({ nature: 'COLLECTE', rattacheeAu: '2027-05-01', ancienMoteur: true })]);
  });

  it('mineur 11 · l’instant de LECTURE prime sur la création · une ligne validée pendant la lecture n’est pas tenue pour vue', async () => {
    const liqs: Liq[] = [
      { id: 'L3', dateDebut: '2027-03-01', dateFin: '2027-03-31', creeLe: '2027-04-05' },
      { id: 'L4', dateDebut: '2027-04-01', dateFin: '2027-04-30', creeLe: '2027-05-15', lu: '2027-05-09' },
    ];
    const s = service([{ id: 'v1', famille: '443', date: '2027-03-10', validee: '2027-05-10', credit: 160_000, contrepartie: '701' }], liqs);
    expect((await s.declaration('t1', ...AVRIL)).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...MAI)).totalCollecte).toBe(160_000);
  });

  it('trou entre deux liquidations · la période jamais liquidée qui reçoit la ligne est DITE', async () => {
    const liqs: Liq[] = [
      { id: 'L1', dateDebut: '2027-01-01', dateFin: '2027-01-31', creeLe: '2027-02-03' },
      { id: 'L3', dateDebut: '2027-03-01', dateFin: '2027-03-31', creeLe: '2027-04-05' },
    ];
    const s = service([{ ...vente, validee: '2027-02-10' }], liqs);
    const fev = await s.declaration('t1', ...FEVRIER);
    expect(fev.totalCollecte).toBe(160_000);
    expect(fev.rattachementsTardifs[0]).toEqual(expect.objectContaining({ dansUnTrou: true }));
    expect(fev.mentionExigibilite).toContain('PÉRIODE JAMAIS LIQUIDÉE ENTRE DEUX LIQUIDATIONS');
  });

  it('MAJEUR 5 · facture de janvier jamais liquidée, négatif de mars · il pèse sur janvier, et mars le NOMME sans le compter', async () => {
    const lignes: Ligne[] = [
      vente,
      { id: 'n1', famille: '443', date: '2027-03-05', credit: -160_000, piece: 19, corrige: { piece: 12, date: '2027-01-15' }, contrepartie: '701' },
    ];
    const s = service(lignes);
    expect((await s.declaration('t1', ...JANVIER)).totalCollecte).toBe(0);
    const mars = await s.declaration('t1', ...MARS);
    expect(mars.totalCollecte).toBe(0);
    expect(mars.negatifsDeFactures).toEqual([expect.objectContaining({ pese: 'PESE_SUR_UNE_PERIODE_NON_LIQUIDEE', montant: 160_000 })]);
    expect(mars.negatifsNonPortesTotal).toBe(1);
    expect(mars.negatifsDeFacturesTotal).toBe(0);
    expect(mars.mentionExigibilite).toContain('NÉGATIFS DE FACTURES NOMMÉS SANS PESER ICI');
  });

  it('mineur 7 · le négatif d’une prestation impayée se retire de l’attente de la période de la FACTURE, jamais de la sienne', async () => {
    const s = service([
      { id: 'p1', famille: '443', date: '2027-01-10', credit: 160_000, piece: 3, contrepartie: '706', tiers: { numero: '41110000', debit: 1_160_000 } },
      { id: 'n1', famille: '443', date: '2027-02-20', credit: -160_000, piece: 4, corrige: { piece: 3, date: '2027-01-10' }, contrepartie: '706', tiers: { numero: '41110000', debit: -1_160_000 } },
    ]);
    const jan = await s.declaration('t1', ...JANVIER);
    expect(jan.lignes[0]?.enAttente ?? 0).toBe(0);
    const fev = await s.declaration('t1', ...FEVRIER);
    // L'attente de février n'est jamais négative.
    expect(fev.lignes.every((x) => x.enAttente >= 0)).toBe(true);
  });

  it('M2 · le négatif d’un achat de services à l’encaissement n’est pas tu · nommé sans peser', async () => {
    const s = service([
      { id: 'a1', famille: '445', date: '2027-02-05', debit: 16_000, piece: 7, contrepartie: '624', tiers: { numero: '40110000', credit: 116_000 } },
      { id: 'na1', famille: '445', date: '2027-02-20', debit: -16_000, piece: 8, corrige: { piece: 7, date: '2027-02-05' }, contrepartie: '624', tiers: { numero: '40110000', credit: -116_000 } },
    ]);
    const fev = await s.declaration('t1', ...FEVRIER);
    expect(fev.totalDeductible).toBe(0);
    expect(fev.negatifsDeFactures).toEqual([expect.objectContaining({ sens: 'ACHAT', pese: 'ACHAT_A_L_ENCAISSEMENT_NON_REPRIS' })]);
  });

  it('achat déchu · le négatif tardif ne reprend pas une déduction qui n’a jamais été prise (art. 37, al. 2)', async () => {
    const liqs: Liq[] = [{ id: 'L', dateDebut: '2025-01-01', dateFin: '2027-01-31', creeLe: '2027-02-05' }];
    const s = service(
      [
        { id: 'a1', famille: '445', date: '2025-03-10', validee: '2027-02-10', debit: 16_000, piece: 7, contrepartie: '601' },
        { id: 'na1', famille: '445', date: '2027-02-15', validee: '2027-02-15', debit: -16_000, piece: 8, corrige: { piece: 7, date: '2025-03-10', validee: '2027-02-10' }, contrepartie: '601' },
      ],
      liqs,
    );
    const fev = await s.declaration('t1', ...FEVRIER);
    expect(fev.totalDeductible).toBe(0);
    expect(fev.negatifsDeFactures).toEqual([expect.objectContaining({ pese: 'DEDUCTION_DECHUE_RIEN_A_REPRENDRE' })]);
  });

  it('la facture et son négatif portés le même jour tardif · ils se compensent, sans récupération ni note de crédit à réclamer', async () => {
    const s = service(
      [
        { ...vente, validee: '2027-02-10' },
        { id: 'n1', famille: '443', date: '2027-02-12', validee: '2027-02-12', credit: -160_000, piece: 19, corrige: { piece: 12, date: '2027-01-15', validee: '2027-02-10' }, contrepartie: '701' },
      ],
      [{ id: 'L1', dateDebut: '2027-01-01', dateFin: '2027-01-31', creeLe: '2027-02-05' }],
    );
    const fev = await s.declaration('t1', ...FEVRIER);
    expect(fev.totalCollecte).toBe(0);
    expect(fev.recuperationArt52).toBe(0);
    expect(fev.negatifsDeFactures).toEqual([expect.objectContaining({ pese: 'ANNULEE_ICI' })]);
  });

  it('mineur 6 · une récupération portée après le 31 décembre de l’année qui suit sa constatation est DITE hors délai (art. 126, art. 37 al. 2)', async () => {
    const s = service(
      [{ id: 'av1', famille: '443', date: '2027-03-12', validee: '2029-01-10', debit: 80_000, contrepartie: '701' }],
      [{ id: 'L', dateDebut: '2027-04-01', dateFin: '2028-12-31', creeLe: '2029-01-05' }],
    );
    const jan = await s.declaration('t1', D('2029-01-01'), fin('2029-01-31'));
    expect(jan.recuperationArt52).toBe(80_000);
    expect(jan.rattachementsTardifs[0]).toEqual(expect.objectContaining({ nature: 'AVOIR_SUR_VENTE', horsDelaiArt37: true }));
    expect(jan.rattachementsHorsDelaiTotal).toBe(1);
    expect(TauxTvaService.horsDelaiArt37(D('2027-03-12'), D('2028-12-31'))).toBe(false);
    expect(TauxTvaService.horsDelaiArt37(D('2027-03-12'), D('2029-01-01'))).toBe(true);
  });

  it('M4 · la taxe qu’une perte a annulée ne redevient jamais exigible par un lettrage postérieur à la perte', async () => {
    const groupe = {
      id: 'g1',
      statut: 'SOLDE',
      solde: 0,
      soldeAt: D('2028-01-01'),
      createdAt: D('2028-01-02'),
      lignes: [
        { id: 'p1-t', compteId: 'c41110000', debit: 1_160_000, credit: 0, ecriture: { id: 'ep1', date: D('2027-01-10'), corrigeEcritureId: null, _count: { lignes: 0 } } },
        // Le report du reclassement, lu comme un règlement au 1er janvier.
        { id: 'r-t', compteId: 'c41110000', debit: 0, credit: 1_160_000, ecriture: { id: 'er', date: D('2028-01-01'), corrigeEcritureId: null, _count: { lignes: 0 } } },
      ],
    };
    const facture = (designations: NonNullable<Ligne['tiers']>['designations']): Ligne => ({
      id: 'p1',
      famille: '443',
      date: '2027-01-10',
      credit: 160_000,
      piece: 3,
      contrepartie: '706',
      tiers: { numero: '41110000', debit: 1_160_000, lettrage: groupe, designations },
    });
    const JANVIER_2028 = [D('2028-01-01'), fin('2028-01-31')] as const;
    // Sans perte, le groupe date la taxe au 1er janvier.
    expect((await service([facture([])]).declaration('t1', ...JANVIER_2028)).totalCollecte).toBe(160_000);
    // La perte du 30 novembre 2027 en a annulé la taxe · rien n'est exigible, et c'est compté.
    const d = await service([facture([{ id: 'des1', pertes: [{ date: '2027-11-30', detail: ['des1'] }] }])]).declaration('t1', ...JANVIER_2028);
    expect(d.totalCollecte).toBe(0);
    expect(d.taxeAnnuleeParUnePerte).toBe(160_000);
    expect(d.mentionExigibilite).toContain('TAXE ANNULÉE PAR UNE PERTE');
    // Une perte qui ne nomme pas cette désignation ne retient rien.
    expect((await service([facture([{ id: 'des1', pertes: [{ date: '2027-11-30', detail: ['autre'] }] }])]).declaration('t1', ...JANVIER_2028)).totalCollecte).toBe(160_000);
  });

  /*
    SECOND TOUR, BLOQUANT 1 · la moitié contestée (580 000) reclassée, désignée,
    perdue avec duplicata le 15 mars (80 000 annulés) ; le client paie l'autre
    moitié le 20 avril, lettrée avec la facture · ses 80 000 sont exigibles en
    avril. L'exclusion sans plafond les écartait, et le 4432 les gardait.
  */
  it('M4 borné · l’autre moitié payée après la perte reste exigible · seule la part annulée est écartée', async () => {
    const groupe = {
      id: 'g1',
      statut: 'PARTIEL',
      solde: 580_000,
      soldeAt: null,
      createdAt: D('2027-04-20'),
      lignes: [
        { id: 'p1-t', compteId: 'c41110000', debit: 1_160_000, credit: 0, ecriture: { id: 'ep1', date: D('2027-01-10'), corrigeEcritureId: null, _count: { lignes: 0 } } },
        { id: 'r-t', compteId: 'c41110000', debit: 0, credit: 580_000, ecriture: { id: 'er', date: D('2027-04-20'), corrigeEcritureId: null, _count: { lignes: 0 } } },
      ],
    };
    const s = service([
      {
        id: 'p1',
        famille: '443',
        date: '2027-01-10',
        credit: 160_000,
        piece: 3,
        contrepartie: '706',
        tiers: { numero: '41110000', debit: 1_160_000, lettrage: groupe, designations: [{ id: 'des1', pertes: [{ date: '2027-03-15', detail: ['des1'], impayeTtc: 580_000 }] }] },
      },
    ]);
    const avril = await s.declaration('t1', D('2027-04-01'), fin('2027-04-30'));
    expect(avril.totalCollecte).toBe(80_000);
    expect(avril.taxeAnnuleeParUnePerte).toBe(0);
    // Mineur b · janvier · la moitié annulée n'est plus « en attente », elle est dite annulée.
    const jan = await s.declaration('t1', ...JANVIER);
    expect(jan.lignes[0]?.enAttente ?? 0).toBe(0);
    expect(jan.attenteAnnuleeParUnePerte).toBe(80_000);
    expect(jan.mentionExigibilite).toContain('TAXE ANNULÉE PAR UNE PERTE, HORS DE L’ATTENTE');
  });

  it('la règle pure · ce qui est déclaré compte d’abord, puis le plafond borne ce qui suit la perte', () => {
    const t = (d: string, m: number) => ({ date: D(d), montant: m, origine: D(d) });
    const r = TauxTvaService.bornerParLaPerte([t('2027-02-10', 40_000), t('2027-04-20', 80_000), t('2028-01-01', 40_000)], 0, 160_000, 80_000, D('2027-03-15'));
    // 40 000 avant la perte, puis 40 000 sur les 80 000 d'avril (plafond 80 000), rien en 2028.
    expect(r.admises.map((x) => x.montant)).toEqual([40_000, 40_000]);
    expect(r.ecartees.map((x) => x.montant)).toEqual([40_000, 40_000]);
    expect(TauxTvaService.partAnnuleeParLaPerte({ impayeTtc: 580_000 }, 160_000, 1_160_000)).toBe(80_000);
    expect(TauxTvaService.partAnnuleeParLaPerte({ impayeTtc: 580_000 }, 160_000, 0)).toBe(160_000);
  });

  /*
    SECOND TOUR, MAJEUR · une ligne validée APRÈS l'instant de lecture d'une
    liquidation n'est pas lue par elle · elle sera reprise, une fois, par la
    période suivante.
  */
  it('la lecture d’une liquidation est bornée à son instant · la ligne validée pendant le calcul n’y entre pas', async () => {
    const lignes: Ligne[] = [vente, { id: 'v3', famille: '443', date: '2027-01-20', validee: '2027-02-02T10:00:00Z', credit: 80_000, contrepartie: '701' }];
    // Pendant la liquidation de janvier, celle-ci n'existe pas encore.
    const pendant = service(lignes);
    expect((await pendant.declaration('t1', ...JANVIER, { instantLecture: D('2027-02-02T09:59:00Z') })).totalCollecte).toBe(160_000);
    // Janvier liquidé (lu à 9 h 59) · février reprend V3, une fois.
    const apres = service(lignes, [{ id: 'L1', dateDebut: '2027-01-01', dateFin: '2027-01-31', creeLe: '2027-02-02T10:05:00Z', lu: '2027-02-02T09:59:00Z' }]);
    expect((await apres.declaration('t1', ...FEVRIER)).totalCollecte).toBe(80_000);
  });

  it('un négatif orphelin dans le groupe ne règle rien · la taxe reste en attente, et c’est nommé', async () => {
    const groupe = {
      id: 'g1',
      statut: 'PARTIEL',
      solde: 660_000,
      soldeAt: null,
      createdAt: D('2027-01-20'),
      lignes: [
        { id: 'p1-t', compteId: 'c41110000', debit: 1_160_000, credit: 0, ecriture: { id: 'ep1', date: D('2027-01-10'), corrigeEcritureId: null, _count: { lignes: 0 } } },
        // Un négatif d'une AUTRE pièce, sans sa ligne annulée dans le groupe.
        { id: 'n-t', compteId: 'c41110000', debit: -500_000, credit: 0, ecriture: { id: 'en', date: D('2027-01-20'), corrigeEcritureId: 'ailleurs', _count: { lignes: 0 } } },
      ],
    };
    const s = service([
      { id: 'p1', famille: '443', date: '2027-01-10', credit: 160_000, piece: 3, contrepartie: '706', tiers: { numero: '41110000', debit: 1_160_000, lettrage: groupe } },
    ]);
    const d = await s.declaration('t1', ...JANVIER);
    expect(d.totalCollecte).toBe(0);
    expect(d.negatifsOrphelinsDansUnGroupe).toBe(1);
  });
});
