import { TauxTvaService } from './taux-tva.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * LES GROUPES DE LETTRAGE SE LISENT COMME SUR `main` (A7 bis, quatrième
 * reprise, décision du coordinateur). Le prorata entre les factures d'un
 * groupe partiel, convention qu'aucun texte ne fixe, est retiré · pour un
 * dossier sans créance douteuse désignée, chaque groupe rend ce que rendait
 * le moteur de `main` (8315e0c).
 *
 * LES VALEURS ATTENDUES ONT ÉTÉ RELEVÉES EN FAISANT TOURNER LE MOTEUR DE
 * `main` sur ces mêmes jeux (fichier de `main` copié à côté le temps du
 * relevé, puis retiré), jamais calculées à la main d'après la règle qu'on
 * croit qu'il appliquait. Deux écarts sont VOULUS, et ne figurent pas ici ·
 * la créance non lettrée (défaut (1), art. 25, 2°) et un groupe à UNE facture
 * réglée en plusieurs fois (défaut (2), décret art. 57) ; leurs propres specs
 * les tiennent.
 */

const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCreanceId: 'c443', compteCollecteId: 'c443', compteDeductibleId: 'c445' };
const jour = (d: string) => new Date(`${d}T00:00:00.000Z`);
const mois = (m: string) => {
  const debut = jour(`${m}-01`);
  return [debut, new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 0))] as const;
};

type LigneGroupe = { debit: number; credit: number; date: string; avoir?: boolean };

/** Une ligne de TVA collectée, sa contrepartie de produit et sa ligne client lettrée dans le groupe donné. */
function vente(p: {
  id: string;
  date: string;
  tva: number;
  ttc: number;
  produit: string;
  compteTva?: string;
  groupe: { statut: 'PARTIEL' | 'SOLDE'; solde: number; createdAt?: string; lignes: LigneGroupe[] } | null;
  numeroClient?: string;
}) {
  const groupe = p.groupe
    ? {
        statut: p.groupe.statut,
        solde: p.groupe.solde,
        soldeAt: null,
        createdAt: p.groupe.createdAt ? jour(p.groupe.createdAt) : undefined,
        lignes: p.groupe.lignes.map((g) => ({
          debit: g.debit,
          credit: g.credit,
          ecriture: { date: jour(g.date), createdAt: jour(g.date), _count: { lignes: g.avoir ? 1 : 0 } },
        })),
      }
    : null;
  return {
    id: p.id,
    tauxTvaId: TAUX.id,
    compteId: 'c443',
    compte: { numero: p.compteTva ?? '44320000' },
    debit: 0,
    credit: p.tva,
    ecriture: {
      date: jour(p.date),
      libelle: `Facture ${p.id}`,
      facture: null,
      lignes: [
        {
          id: `t-${p.id}`,
          debit: p.ttc,
          credit: 0,
          compteId: 'c-client',
          deviseId: null,
          montantDevise: null,
          dateEcheance: null,
          libelle: null,
          compte: { numero: p.numeroClient ?? '41110101', classe: 'CLASSE_4', tiersCompte: null },
          lettrage: groupe,
        },
        { id: `p-${p.id}`, debit: 0, credit: p.ttc - p.tva, compte: { numero: p.produit, classe: 'CLASSE_7' }, lettrage: null },
      ],
    },
  };
}

function avoir(p: { id: string; date: string; tva: number; ttc: number }) {
  return {
    id: p.id,
    tauxTvaId: TAUX.id,
    compteId: 'c443',
    compte: { numero: '44320000' },
    debit: p.tva,
    credit: 0,
    ecriture: { date: jour(p.date), libelle: `Avoir ${p.id}`, facture: null, lignes: [] },
  };
}

function prisma(lignes: unknown[], liquidations: unknown[] = []) {
  return {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
    tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
    ecriture: { count: jest.fn().mockResolvedValue(0) },
    ligneEcriture: {
      findMany: jest.fn(({ where }: { where: { compteId?: { in?: string[] } } }) => Promise.resolve(where.compteId?.in ? [] : lignes)),
      aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
    creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue(liquidations) },
  } as unknown as PrismaService;
}

/** Les jeux, et les périodes lues. */
const JEUX: Record<string, { lignes: unknown[]; periodes: string[] }> = {
  'groupe partiel à une facture (un règlement)': {
    lignes: [
      vente({
        id: 'F',
        date: '2026-01-15',
        tva: 160_000,
        ttc: 1_160_000,
        produit: '70610000',
        groupe: { statut: 'PARTIEL', solde: 696_000, lignes: [{ debit: 1_160_000, credit: 0, date: '2026-01-15' }, { debit: 0, credit: 464_000, date: '2026-03-12' }] },
      }),
    ],
    periodes: ['2026-01', '2026-03'],
  },
  'groupe avec une facture de biens et une facture de services': (() => {
    const lignesGroupe: LigneGroupe[] = [
      { debit: 580_000, credit: 0, date: '2026-01-10' },
      { debit: 1_160_000, credit: 0, date: '2026-01-15' },
      { debit: 0, credit: 1_000_000, date: '2026-03-12' },
    ];
    const groupe = { statut: 'PARTIEL' as const, solde: 740_000, lignes: lignesGroupe };
    return {
      lignes: [
        vente({ id: 'G', date: '2026-01-10', tva: 80_000, ttc: 580_000, produit: '70110000', compteTva: '44310000', groupe }),
        vente({ id: 'S', date: '2026-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
      ],
      periodes: ['2026-01', '2026-03'],
    };
  })(),
  'avoir dans le groupe': (() => {
    const groupe = {
      statut: 'SOLDE' as const,
      solde: 0,
      lignes: [
        { debit: 1_160_000, credit: 0, date: '2026-01-15' },
        { debit: 0, credit: 116_000, date: '2026-02-05', avoir: true },
        { debit: 0, credit: 1_044_000, date: '2026-03-12' },
      ],
    };
    return {
      lignes: [
        vente({ id: 'F', date: '2026-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
        avoir({ id: 'A', date: '2026-02-05', tva: 16_000, ttc: 116_000 }),
      ],
      periodes: ['2026-01', '2026-02', '2026-03'],
    };
  })(),
  'groupe à deux factures (500 000 réglés)': (() => {
    const groupe = {
      statut: 'PARTIEL' as const,
      solde: 1_820_000,
      lignes: [
        { debit: 1_160_000, credit: 0, date: '2026-12-10' },
        { debit: 1_160_000, credit: 0, date: '2026-12-11' },
        { debit: 0, credit: 500_000, date: '2026-12-20' },
      ],
    };
    return {
      lignes: [
        vente({ id: 'F1', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
        vente({ id: 'F2', date: '2026-12-11', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
      ],
      periodes: ['2026-12'],
    };
  })(),
  'facture B ajoutée au groupe d’un paiement antérieur': (() => {
    // A (janvier) réglée 1 160 000 le 10 février ; B (mars) ajoutée au même
    // groupe, qui devient partiel · B prend la date du paiement de février.
    const groupe = {
      statut: 'PARTIEL' as const,
      solde: 1_160_000,
      lignes: [
        { debit: 1_160_000, credit: 0, date: '2026-01-15' },
        { debit: 0, credit: 1_160_000, date: '2026-02-10' },
        { debit: 1_160_000, credit: 0, date: '2026-03-05' },
      ],
    };
    return {
      lignes: [
        vente({ id: 'A', date: '2026-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
        vente({ id: 'B', date: '2026-03-05', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
      ],
      periodes: ['2026-01', '2026-02', '2026-03'],
    };
  })(),
};

async function rendu(Moteur: new (p: PrismaService, e: EcritureService) => { declaration: (t: string, a: Date, b: Date) => Promise<{ totalCollecte: number; avoirsCollecteConstates: number }> }, jeu: { lignes: unknown[]; periodes: string[] }) {
  const s = new Moteur(prisma(jeu.lignes), {} as EcritureService);
  const r: Record<string, [number, number]> = {};
  for (const m of jeu.periodes) {
    const d = await s.declaration('t1', ...mois(m));
    r[m] = [d.totalCollecte, d.avoirsCollecteConstates];
  }
  return r;
}

/**
 * CE QUE REND `main` (8315e0c), relevé le 2026-10-04 sur ces jeux · par
 * période, [TVA collectée exigible, avoirs constatés].
 */
const RENDU_DE_MAIN: Record<string, Record<string, [number, number]>> = {
  'groupe partiel à une facture (un règlement)': { '2026-01': [0, 0], '2026-03': [64_000, 0] },
  'groupe avec une facture de biens et une facture de services': { '2026-01': [80_000, 0], '2026-03': [57_931.03, 0] },
  'avoir dans le groupe': { '2026-01': [0, 0], '2026-02': [0, 16_000], '2026-03': [160_000, 0] },
  'groupe à deux factures (500 000 réglés)': { '2026-12': [0, 0] },
  'facture B ajoutée au groupe d’un paiement antérieur': { '2026-01': [0, 0], '2026-02': [0, 0], '2026-03': [0, 0] },
};

describe('Sans créance désignée, chaque groupe rend ce que rend main', () => {
  for (const [nom, jeu] of Object.entries(JEUX)) {
    it(nom, async () => {
      expect(await rendu(TauxTvaService as never, jeu)).toEqual(RENDU_DE_MAIN[nom]);
    });
  }

  it('une liquidation de l’ancien moteur se relit telle qu’elle a déclaré · mars reste 57 931,03, avril 0', async () => {
    // Le groupe des biens et des services, mars liquidé par l'ancien moteur
    // (aucun figé), après le paiement du 12 mars.
    const jeu = JEUX['groupe avec une facture de biens et une facture de services'];
    const [debut, fin] = mois('2026-03');
    const s = new TauxTvaService(
      prisma(jeu.lignes, [{ id: 'liqM', dateDebut: debut, dateFin: fin, createdAt: jour('2026-04-02'), tvaEncaissementFigee: null }]),
      {} as EcritureService,
    );
    expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(57_931.03);
    expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(0);
  });

  it('à-nouveau N vers N+1 · F0 (N) et F1 (N+1) réglées ensemble · le règlement n’est jamais compté deux fois', async () => {
    // F0 facturée en décembre N, jamais lettrée ; en N+1 sa ligne d'à-nouveau,
    // F1 et un règlement de 2 320 000 forment un groupe SOLDÉ. main lisait F0
    // au comptant (décembre) ; la branche lit F0 par le groupe RÉEL de son
    // à-nouveau, par la règle de main · 160 000 chacune en février, 320 000,
    // jamais 480 000.
    const groupeN1 = {
      statut: 'SOLDE',
      solde: 0,
      soldeAt: null,
      createdAt: jour('2027-02-20'),
      lignes: [
        { debit: 1_160_000, credit: 0, ecriture: { date: jour('2027-01-01'), estANouveauProvisoire: false, estGenereeParCloture: true, createdAt: jour('2027-01-01') } },
        { debit: 1_160_000, credit: 0, ecriture: { date: jour('2027-01-15'), estANouveauProvisoire: false, estGenereeParCloture: false, createdAt: jour('2027-01-15') } },
        { debit: 0, credit: 2_320_000, ecriture: { date: jour('2027-02-15'), estANouveauProvisoire: false, estGenereeParCloture: false, createdAt: jour('2027-02-15') } },
      ],
    };
    const f0 = vente({ id: 'F0', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
    f0.ecriture.libelle = 'Facture F0';
    const f1 = vente({ id: 'F1', date: '2027-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
    (f1.ecriture.lignes[0] as { lettrage: unknown }).lettrage = groupeN1;
    const aNouveau = {
      id: 'an0',
      compteId: 'c-client',
      debit: 1_160_000,
      credit: 0,
      deviseId: null,
      montantDevise: null,
      dateEcheance: null,
      libelle: 'RAN détail 41110101 · Facture F0',
      ecriture: { date: jour('2027-01-01'), exerciceId: 'ex2027' },
      lettrage: groupeN1,
    };
    const p = prisma([f0, f1]);
    (p.ligneEcriture.findMany as jest.Mock).mockImplementation(({ where }: { where: { compteId?: { in?: string[] } } }) =>
      Promise.resolve(where.compteId?.in ? [aNouveau] : [f0, f1]),
    );
    const s = new TauxTvaService(p, {} as EcritureService);
    expect((await s.declaration('t1', ...mois('2026-12'))).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2027-02'))).totalCollecte).toBe(320_000);
  });
});

describe('BLOQUANT 4 · l’ancien moteur se reconstitue tel qu’il a déclaré (fraction CUMULÉE)', () => {
  // Service, TVA 160 000 (TTC 1 160 000) facturé le 15 janvier ; paiements de
  // 232 000 le 10/02, 232 000 le 10/03 et 696 000 le 10/05, tous lettrés au
  // fil de l'eau. Février liquidé le 1er mars, mars le 1er avril, par l'ancien
  // moteur · 32 000 (20 %) puis 64 000 (la fraction CUMULÉE, 40 %) ont été
  // versés. Il reste 64 000 à déclarer en mai, 160 000 au total.
  const ligne = vente({
    id: 'F',
    date: '2026-01-15',
    tva: 160_000,
    ttc: 1_160_000,
    produit: '70610000',
    groupe: {
      statut: 'SOLDE',
      solde: 0,
      createdAt: '2026-02-10',
      lignes: [
        { debit: 1_160_000, credit: 0, date: '2026-01-15' },
        { debit: 0, credit: 232_000, date: '2026-02-10' },
        { debit: 0, credit: 232_000, date: '2026-03-10' },
        { debit: 0, credit: 696_000, date: '2026-05-10' },
      ],
    },
  });
  const liquidations = [
    { id: 'liqF', dateDebut: mois('2026-02')[0], dateFin: mois('2026-02')[1], createdAt: jour('2026-03-01'), tvaEncaissementFigee: null },
    { id: 'liqM', dateDebut: mois('2026-03')[0], dateFin: mois('2026-03')[1], createdAt: jour('2026-04-01'), tvaEncaissementFigee: null },
  ];
  it('février 32 000 et mars 64 000 relus tels que versés, mai 64 000', async () => {
    const s = new TauxTvaService(prisma([ligne], liquidations), {} as EcritureService);
    expect((await s.declaration('t1', ...mois('2026-02'))).totalCollecte).toBe(32_000);
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(64_000);
    expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2026-05'))).totalCollecte).toBe(64_000);
  });

  it('declareParAncienMoteur · le groupe tel qu’il était à l’instant de chaque liquidation', () => {
    const tiers = ligne.ecriture.lignes.filter((x) => (x as { lettrage?: unknown }).lettrage) as never;
    expect(TauxTvaService.declareParAncienMoteur(tiers, 160_000, jour('2026-01-15'), liquidations[0] as never)).toBe(32_000);
    expect(TauxTvaService.declareParAncienMoteur(tiers, 160_000, jour('2026-01-15'), liquidations[1] as never)).toBe(64_000);
  });
});
