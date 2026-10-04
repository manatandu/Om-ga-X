import { TauxTvaService, LiquidationEncaissement } from './taux-tva.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * LIGNE A7 BIS, PARTIE 1 · LES DEUX DÉFAUTS DU MOTEUR DE TVA.
 *
 * (1) O.-L. n° 10/001, art. 25, 2° · la taxe d'une prestation de services est
 * exigible « au moment de l'encaissement du prix, des acomptes ou avances ».
 * Le moteur lisait une prestation dont la ligne du client n'est dans aucun
 * lettrage comme un COMPTANT, exigible à la facture · une prestation impayée
 * était déclarée au mois de la facture.
 *
 * (2) Décret n° 011/42, art. 57 · « l'encaissement s'entend de la perception
 * des sommes, à quelque titre que ce soit, notamment avances, acomptes et
 * règlement pour solde ». Un groupe à une seule facture gardait la date du
 * DERNIER règlement et la fraction CUMULÉE.
 *
 * Et la TRANSITION · ce qu'une liquidation a déclaré reste déclaré, rien ne
 * l'est deux fois, rien ne se perd (leçons B1 et B3 de la cinquième relecture
 * d'A7).
 *
 * Chiffres à la main · prestation de 1 000 000 HT à 16 %, TVA 160 000, TTC
 * 1 160 000. Réglée 40 % (464 000) en mars et 60 % (696 000) en mai · 64 000
 * exigibles en mars, 96 000 en mai, rien en janvier.
 */

const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCollecteId: 'c443', compteDeductibleId: 'c445' };

type Groupe = {
  statut: 'PARTIEL' | 'SOLDE';
  solde: number;
  createdAt?: Date;
  reglements: Array<{ date: string; montant: number }>;
};

let compteur = 0;

/**
 * Une écriture de vente ou d'achat · la ligne de TVA, sa contrepartie de
 * nature, la ligne du tiers (lettrée ou non) et, au besoin, une ligne de
 * trésorerie dans l'écriture même.
 */
function ecriture(opts: {
  compteTva: string;
  contrepartie: string;
  date: string;
  tva: number;
  tiers?: { numero?: string; montant: number; groupe?: Groupe | null };
  tresorerie?: number;
  avoir?: boolean;
  id?: string;
}) {
  const vente = opts.compteTva.startsWith('443');
  const avoir = opts.avoir === true;
  // Sens de la facture sur le tiers · débit chez le client, crédit chez le
  // fournisseur ; un avoir l'inverse.
  const facture = (m: number) => (vente !== avoir ? { debit: m, credit: 0 } : { debit: 0, credit: m });
  const reglement = (m: number) => (vente !== avoir ? { debit: 0, credit: m } : { debit: m, credit: 0 });
  const lignes: unknown[] = [];
  if (opts.tiers) {
    const g = opts.tiers.groupe;
    lignes.push({
      ...facture(opts.tiers.montant),
      compteId: 'c-tiers',
      deviseId: null,
      montantDevise: null,
      dateEcheance: null,
      libelle: null,
      compte: { numero: opts.tiers.numero ?? (vente ? '41110001' : '40110001'), classe: 'CLASSE_4', tiersCompte: null },
      lettrage: g
        ? {
            statut: g.statut,
            solde: g.solde,
            soldeAt: null,
            createdAt: g.createdAt,
            lignes: [
              { ...facture(opts.tiers.montant), ecriture: { date: new Date(opts.date) } },
              ...g.reglements.map((r) => ({ ...reglement(r.montant), ecriture: { date: new Date(r.date) } })),
            ],
          }
        : null,
    });
  }
  if (opts.tresorerie) {
    lignes.push({ ...facture(opts.tresorerie), compte: { numero: '57110000', classe: 'CLASSE_5' }, lettrage: null });
  }
  lignes.push({
    debit: vente !== avoir ? 0 : opts.tva * 6.25,
    credit: vente !== avoir ? opts.tva * 6.25 : 0,
    compte: { numero: opts.contrepartie, classe: `CLASSE_${opts.contrepartie[0]}` },
    lettrage: null,
  });
  const montantTva = vente !== avoir ? { debit: 0, credit: opts.tva } : { debit: opts.tva, credit: 0 };
  return {
    id: opts.id ?? `ltva-${++compteur}`,
    tauxTvaId: TAUX.id,
    compteId: vente ? 'c443' : 'c445',
    compte: { numero: opts.compteTva },
    // Une vente CRÉDITE le 443, un achat DÉBITE le 445 ; un avoir l'inverse.
    ...montantTva,
    ecriture: { date: new Date(opts.date), libelle: 'Facture F1', facture: null, lignes },
  };
}

function service(lignes: unknown[], liquidations: LiquidationEncaissement[] = [], aNouveaux: unknown[] = []) {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
    tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
    ecriture: { count: jest.fn().mockResolvedValue(0) },
    ligneEcriture: {
      // Deux lectures · les lignes de TVA, et les lignes d'à-nouveau des
      // comptes de créance (`relierAuxANouveaux`), reconnues à leur filtre
      // par compte.
      findMany: jest.fn(({ where }: { where: { compteId?: { in?: string[] } } }) =>
        Promise.resolve(where.compteId?.in ? aNouveaux : lignes),
      ),
      aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    liquidationTva: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(
        liquidations.map((l) => ({ ...l, tvaEncaissementFigee: l.figee })),
      ),
    },
  } as unknown as PrismaService;
  return new TauxTvaService(prisma, {} as EcritureService);
}

const jour = (d: string) => new Date(`${d}T00:00:00.000Z`);
const mois = (m: string) => {
  const debut = jour(`${m}-01`);
  const fin = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 0));
  return [debut, fin] as const;
};
const JANVIER = mois('2026-01');
const FEVRIER = mois('2026-02');
const MARS = mois('2026-03');
const AVRIL = mois('2026-04');
const MAI = mois('2026-05');

const prestation = (groupe: Groupe | null, extra: Partial<Parameters<typeof ecriture>[0]> = {}) =>
  ecriture({
    compteTva: '44320000',
    contrepartie: '70610000',
    date: '2026-01-15',
    tva: 160_000,
    tiers: { montant: 1_160_000, groupe },
    ...extra,
  });

describe('(1) Une prestation impayée n’est pas exigible (O.-L. n° 10/001, art. 25, 2°)', () => {
  it('créance du client non lettrée · rien en janvier, 160 000 en attente', async () => {
    const s = service([prestation(null)]);
    const d = await s.declaration('t1', ...JANVIER);
    expect(d.totalCollecte).toBe(0);
    expect(d.tvaEnAttenteEncaissement).toBe(160_000);
  });

  it('un 411 COLLECTIF sans tiers rattaché, non lettré, n’est pas davantage un encaissement', async () => {
    const s = service([prestation(null, { tiers: { numero: '41110000', montant: 1_160_000, groupe: null } })]);
    expect((await s.declaration('t1', ...JANVIER)).totalCollecte).toBe(0);
  });

  it('une prestation réglée dans l’écriture même (trésorerie) reste exigible à sa date', async () => {
    const s = service([prestation(null, { tiers: undefined, tresorerie: 1_160_000 })]);
    const d = await s.declaration('t1', ...JANVIER);
    expect(d.totalCollecte).toBe(160_000);
    expect(d.tvaEnAttenteEncaissement).toBe(0);
  });

  it('réglée à 40 % dans l’écriture, le reste en créance · 64 000 en janvier, 96 000 en attente', async () => {
    const s = service([prestation(null, { tiers: { montant: 696_000, groupe: null }, tresorerie: 464_000 })]);
    const d = await s.declaration('t1', ...JANVIER);
    expect(d.totalCollecte).toBe(64_000);
    expect(d.tvaEnAttenteEncaissement).toBe(96_000);
  });

  it('une avance déjà reçue (419) imputée sur la facture est un encaissement, daté de la facture', async () => {
    const s = service([prestation(null, { tiers: { numero: '41910000', montant: 1_160_000, groupe: null } })]);
    expect((await s.declaration('t1', ...JANVIER)).totalCollecte).toBe(160_000);
  });

  it('une VENTE DE BIENS impayée reste exigible à la facture (art. 25, 1°), inchangée', async () => {
    const s = service([
      ecriture({ compteTva: '44310000', contrepartie: '70110000', date: '2026-01-15', tva: 160_000, tiers: { montant: 1_160_000, groupe: null } }),
    ]);
    const d = await s.declaration('t1', ...JANVIER);
    expect(d.totalCollecte).toBe(160_000);
    expect(d.tvaEnAttenteEncaissement).toBe(0);
  });

  it('un ACHAT de services impayé n’ouvre aucune déduction (art. 37 al. 1, décret art. 96)', async () => {
    const achat = (groupe: Groupe | null) =>
      ecriture({ compteTva: '44540000', contrepartie: '62400000', date: '2026-01-15', tva: 160_000, tiers: { montant: 1_160_000, groupe } });
    expect((await service([achat(null)]).declaration('t1', ...JANVIER)).totalDeductible).toBe(0);
    const paye = achat({ statut: 'SOLDE', solde: 0, reglements: [{ date: '2026-02-10', montant: 1_160_000 }] });
    const s = service([paye]);
    expect((await s.declaration('t1', ...JANVIER)).totalDeductible).toBe(0);
    expect((await s.declaration('t1', ...FEVRIER)).totalDeductible).toBe(160_000);
  });

  it('un AVOIR sur prestation reste constaté à sa date (décret art. 126), inchangé', async () => {
    const s = service([
      ecriture({
        compteTva: '44320000',
        contrepartie: '70610000',
        date: '2026-03-05',
        tva: 16_000,
        avoir: true,
        tiers: { montant: 116_000, groupe: null },
      }),
    ]);
    const d = await s.declaration('t1', ...MARS);
    expect(d.avoirsCollecteConstates).toBe(16_000);
    expect(d.totalCollecte).toBe(0);
  });
});

describe('(2) Une tranche par encaissement (décret n° 011/42, art. 57)', () => {
  const reglee = prestation({
    statut: 'SOLDE',
    solde: 0,
    reglements: [
      { date: '2026-03-12', montant: 464_000 },
      { date: '2026-05-20', montant: 696_000 },
    ],
  });

  it('64 000 en mars, 96 000 en mai, rien en janvier', async () => {
    const s = service([reglee]);
    const janvier = await s.declaration('t1', ...JANVIER);
    expect(janvier.totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...MARS)).totalCollecte).toBe(64_000);
    expect((await s.declaration('t1', ...AVRIL)).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...MAI)).totalCollecte).toBe(96_000);
  });

  it('un groupe encore PARTIEL après le premier acompte · 64 000 en mars, 96 000 en attente', async () => {
    const s = service([prestation({ statut: 'PARTIEL', solde: 696_000, reglements: [{ date: '2026-03-12', montant: 464_000 }] })]);
    expect((await s.declaration('t1', ...MARS)).totalCollecte).toBe(64_000);
    expect((await s.declaration('t1', ...JANVIER)).tvaEnAttenteEncaissement).toBe(96_000);
  });

  it('la déclaration fige, ligne par ligne, ce qu’elle déclare à l’encaissement', async () => {
    const s = service([{ ...reglee, id: 'L1' }]);
    expect((await s.declaration('t1', ...MARS)).figeEncaissement).toEqual({ L1: 64_000 });
  });
});

describe('Transition · ce qu’une liquidation a déclaré reste déclaré, une fois', () => {
  it('ANCIEN MOTEUR · janvier liquidé quand la créance n’était pas lettrée · déclarée en entier en janvier, jamais au règlement', async () => {
    // Janvier liquidé le 5 février sous l'ancien moteur (aucun figé) · la
    // créance, lettrée le 20 mars avec le règlement du 12 mars, était lue au
    // comptant et ses 160 000 ont été déclarés en janvier.
    const ligne = prestation({
      statut: 'SOLDE',
      solde: 0,
      createdAt: new Date('2026-03-20T10:00:00Z'),
      reglements: [{ date: '2026-03-12', montant: 1_160_000 }],
    });
    const s = service(
      [ligne],
      [{ id: 'liqJ', dateDebut: JANVIER[0], dateFin: JANVIER[1], createdAt: new Date('2026-02-05T10:00:00Z'), figee: null }],
    );
    expect((await s.declaration('t1', ...JANVIER)).totalCollecte).toBe(160_000);
    expect((await s.declaration('t1', ...MARS)).totalCollecte).toBe(0);
  });

  it('ANCIEN MOTEUR · janvier liquidé quand la créance était déjà lettrée au règlement de mars · déclarée en mars', async () => {
    const ligne = prestation({
      statut: 'SOLDE',
      solde: 0,
      createdAt: new Date('2026-01-31T10:00:00Z'),
      reglements: [{ date: '2026-01-31', montant: 464_000 }, { date: '2026-03-12', montant: 696_000 }],
    });
    const s = service(
      [ligne],
      [{ id: 'liqJ', dateDebut: JANVIER[0], dateFin: JANVIER[1], createdAt: new Date('2026-02-05T10:00:00Z'), figee: null }],
    );
    expect((await s.declaration('t1', ...JANVIER)).totalCollecte).toBe(64_000);
    expect((await s.declaration('t1', ...MARS)).totalCollecte).toBe(96_000);
  });

  it('NOUVEAU MOTEUR · un règlement de février lettré après la liquidation de février est REPORTÉ en mars, une seule fois', async () => {
    const ligne = {
      ...prestation({
        statut: 'SOLDE',
        solde: 0,
        createdAt: new Date('2026-03-05T10:00:00Z'),
        reglements: [{ date: '2026-02-10', montant: 1_160_000 }],
      }),
      id: 'L1',
    };
    const liquidations: LiquidationEncaissement[] = [
      { id: 'liqJ', dateDebut: JANVIER[0], dateFin: JANVIER[1], createdAt: new Date('2026-02-02'), figee: {} },
      { id: 'liqF', dateDebut: FEVRIER[0], dateFin: FEVRIER[1], createdAt: new Date('2026-03-01'), figee: {} },
    ];
    const s = service([ligne], liquidations);
    // Février montre ce qu'il a liquidé · rien.
    expect((await s.declaration('t1', ...FEVRIER)).totalCollecte).toBe(0);
    const mars = await s.declaration('t1', ...MARS);
    expect(mars.totalCollecte).toBe(160_000);
    expect(mars.figeEncaissement).toEqual({ L1: 160_000 });
    // Avril ne le reprend pas.
    expect((await s.declaration('t1', ...AVRIL)).totalCollecte).toBe(0);
    // Et une fois mars liquidé avec son figé, rien ne revient.
    const apres = service(
      [ligne],
      [...liquidations, { id: 'liqM', dateDebut: MARS[0], dateFin: MARS[1], createdAt: new Date('2026-04-01'), figee: { L1: 160_000 } }],
    );
    expect((await apres.declaration('t1', ...MARS)).totalCollecte).toBe(160_000);
    expect((await apres.declaration('t1', ...AVRIL)).totalCollecte).toBe(0);
  });
});

describe('repartirEncaissement · la règle seule', () => {
  const base = { ligneId: 'L', montant: 160_000, dateEcriture: jour('2026-01-15'), lettreeA: () => true };

  it('sans liquidation, chaque tranche reste à sa date', () => {
    const r = TauxTvaService.repartirEncaissement({
      ...base,
      tranches: [
        { date: jour('2026-03-12'), montant: 64_000 },
        { date: jour('2026-05-20'), montant: 96_000 },
      ],
      liquidations: [],
    });
    expect(r.libres.map((x) => x.montant)).toEqual([64_000, 96_000]);
  });

  it('un trop-déclaré de l’ancien moteur absorbe les tranches suivantes, jamais au-delà', () => {
    const r = TauxTvaService.repartirEncaissement({
      ...base,
      lettreeA: () => false,
      tranches: [
        { date: jour('2026-03-12'), montant: 64_000 },
        { date: jour('2026-05-20'), montant: 96_000 },
      ],
      liquidations: [{ id: 'J', dateDebut: jour('2026-01-01'), dateFin: jour('2026-01-31'), createdAt: jour('2026-02-05'), figee: null }],
    });
    expect(r.parLiquidation.get('J')).toBe(160_000);
    expect(r.libres).toEqual([]);
  });

  it('un report saute les liquidations contiguës jusqu’au premier jour libre', () => {
    const r = TauxTvaService.repartirEncaissement({
      ...base,
      tranches: [{ date: jour('2026-02-10'), montant: 160_000 }],
      liquidations: [
        { id: 'F', dateDebut: jour('2026-02-01'), dateFin: jour('2026-02-28'), createdAt: jour('2026-03-01'), figee: {} },
        { id: 'M', dateDebut: jour('2026-03-01'), dateFin: jour('2026-03-31'), createdAt: jour('2026-04-01'), figee: {} },
      ],
    });
    expect(r.libres).toEqual([{ date: jour('2026-04-01'), montant: 160_000, origine: jour('2026-02-28') }]);
  });
});

describe('Créance de N réglée en N+1 par sa ligne d’à-nouveau (constat d’A6 bis)', () => {
  const facture = ecriture({
    compteTva: '44320000',
    contrepartie: '70610000',
    date: '2026-12-10',
    tva: 160_000,
    tiers: { montant: 1_160_000, groupe: null },
  });
  const aNouveau = (id: string, exerciceId = 'ex2027', reglee = true) => ({
    id,
    compteId: 'c-tiers',
    debit: 1_160_000,
    credit: 0,
    deviseId: null,
    montantDevise: null,
    dateEcheance: null,
    libelle: 'RAN détail 41110001 · Facture F1',
    ecriture: { date: jour('2027-01-01'), exerciceId },
    lettrage: reglee
      ? {
          createdAt: new Date('2027-02-20'),
          lignes: [
            { debit: 1_160_000, credit: 0, ecriture: { date: jour('2027-01-01'), estANouveauProvisoire: false, estGenereeParCloture: true } },
            { debit: 0, credit: 1_160_000, ecriture: { date: jour('2027-02-15'), estANouveauProvisoire: false, estGenereeParCloture: false } },
          ],
        }
      : null,
  });
  const DECEMBRE = mois('2026-12');
  const FEVRIER_N1 = mois('2027-02');

  it('rien en décembre N, 160 000 en février N+1, au règlement lettré avec l’à-nouveau', async () => {
    const s = service([facture], [], [aNouveau('an1')]);
    const decembre = await s.declaration('t1', ...DECEMBRE);
    expect(decembre.totalCollecte).toBe(0);
    // « En attente » se lit sur l'état COURANT (voir tva-exigibilite.spec) ·
    // encaissée depuis, la facture n'y figure plus.
    expect(decembre.tvaEnAttenteEncaissement).toBe(0);
    expect((await s.declaration('t1', ...FEVRIER_N1)).totalCollecte).toBe(160_000);
  });

  it('deux lignes d’à-nouveau candidates dans un même exercice · aucun lien deviné, la taxe reste en attente', async () => {
    const s = service([facture], [], [aNouveau('an1'), aNouveau('an2', 'ex2027', false)]);
    expect((await s.declaration('t1', ...FEVRIER_N1)).totalCollecte).toBe(0);
  });

  it('TRANSITION · décembre N liquidé sous l’ancien moteur l’a déclarée en entier, février N+1 ne la reprend pas', async () => {
    const s = service(
      [facture],
      [{ id: 'liqD', dateDebut: DECEMBRE[0], dateFin: DECEMBRE[1], createdAt: new Date('2027-01-10'), figee: null }],
      [aNouveau('an1')],
    );
    expect((await s.declaration('t1', ...DECEMBRE)).totalCollecte).toBe(160_000);
    expect((await s.declaration('t1', ...FEVRIER_N1)).totalCollecte).toBe(0);
  });
});
