import { TauxTvaService } from './taux-tva.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * RELECTURE DU 2026-10-07, BLOQUANTS B1 ET B2 · un groupe de N+1 qui réunit
 * des à-nouveaux se lit sur les FACTURES qu'ils reportent (Code civil,
 * Livre III, art. 154 · « la plus ancienne » est la facture, pas le 1er
 * janvier), et une imputation déclarée sur un report vise sa facture (art. 151).
 * Chaque montant attendu est calculé à la main dans son titre.
 */
const TAUX = { id: 'tx16', code: 'TVA16', intitule: 'TVA 16 %', taux: 16, compteCreanceId: 'c443', compteCollecteId: 'c443', compteDeductibleId: 'c445' };
const jour = (d: string) => new Date(`${d}T00:00:00.000Z`);
const mois = (m: string) => {
  const debut = jour(`${m}-01`);
  return [debut, new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 0))] as const;
};

type Ligne = {
  id: string;
  compteId: string;
  libelle: string | null;
  dateEcheance: Date | null;
  deviseId: null;
  montantDevise: null;
  debit: number;
  credit: number;
  lettrageId?: string | null;
  ecriture: {
    id: string;
    libelle: string;
    date: Date;
    createdAt: Date;
    estANouveauProvisoire: boolean;
    estGenereeParCloture: boolean;
    exerciceId?: string;
    _count: { lignes: number };
  };
};

/** La ligne au client d'une écriture de N (facture ou paiement). */
const ligneN = (id: string, debit: number, credit: number, date: string, libelle: string, echeance: string | null = null): Ligne => ({
  id: `t-${id}`,
  compteId: 'c-client',
  libelle: null,
  dateEcheance: echeance ? jour(echeance) : null,
  deviseId: null,
  montantDevise: null,
  debit,
  credit,
  lettrageId: null,
  ecriture: { id, libelle, date: jour(date), createdAt: jour(date), estANouveauProvisoire: false, estGenereeParCloture: false, exerciceId: 'ex2026', _count: { lignes: 0 } },
});
/** Le report d'une ligne au 1er janvier 2027. */
const ran = (id: string, origine: Ligne): Ligne => ({
  ...origine,
  id,
  libelle: `RAN détail 41110101 · ${origine.libelle ?? origine.ecriture.libelle}`,
  lettrageId: null,
  ecriture: { id: 'AN27', libelle: 'À-nouveau', date: jour('2027-01-01'), createdAt: jour('2027-01-01'), estANouveauProvisoire: false, estGenereeParCloture: true, exerciceId: 'ex2027', _count: { lignes: 0 } },
});

/** Une vente · la ligne de TVA, sa ligne au client (`tiers`) et son produit. */
function vente(p: { id: string; tva: number; produit: string; compteTva?: string; tiers: Ligne; lettrage?: unknown }) {
  return {
    id: p.id,
    tauxTvaId: TAUX.id,
    compteId: 'c443',
    compte: { numero: p.compteTva ?? '44320000' },
    debit: 0,
    credit: p.tva,
    ecriture: {
      id: p.tiers.ecriture.id,
      date: p.tiers.ecriture.date,
      createdAt: p.tiers.ecriture.date,
      libelle: p.tiers.ecriture.libelle,
      facture: null,
      lignes: [
        { ...p.tiers, compte: { numero: '41110101', classe: 'CLASSE_4', tiersCompte: null }, lettrage: p.lettrage ?? null },
        { id: `p-${p.id}`, debit: 0, credit: p.tiers.debit - p.tva, compte: { numero: p.produit, classe: 'CLASSE_7' }, lettrage: null },
      ],
    },
  };
}

type Declaree = { ligneReglementId: string; ligneFactureId: string; montant: number };

/**
 * LA DOUBLURE HONORE LES QUATRE LECTURES · les lignes de TVA ; les reports
 * des comptes (`compteId.in`, à-nouveaux) ; l'origine d'un report (compte,
 * date antérieure, montants) ; les lignes d'un groupe d'origine (`lettrageId`).
 */
function service(ventes: unknown[], reports: unknown[], origines: Ligne[], declarees: Declaree[] = [], liquidations: unknown[] = []) {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
    tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
    ecriture: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue({ id: 'an' }) },
    ligneEcriture: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: {
            compteId?: string | { in?: string[] };
            lettrageId?: string;
            ecriture?: { date?: { lt?: Date } };
            OR?: Array<{ debit: number; credit: number }>;
          };
        }) => {
          if (typeof where.compteId === 'object' && where.compteId?.in) return Promise.resolve(reports);
          if (typeof where.compteId === 'string') {
            return Promise.resolve(
              origines.filter(
                (o) =>
                  o.compteId === where.compteId &&
                  (!where.ecriture?.date?.lt || o.ecriture.date < where.ecriture.date.lt) &&
                  (!where.OR || where.OR.some((m) => m.debit === o.debit && m.credit === o.credit)),
              ),
            );
          }
          if (where.lettrageId) return Promise.resolve(origines.filter((o) => o.lettrageId === where.lettrageId));
          return Promise.resolve(ventes);
        },
      ),
      aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
    creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue(liquidations) },
    evenementAudit: { findMany: jest.fn().mockResolvedValue([]) },
    exercice: { count: jest.fn().mockResolvedValue(2) },
    imputationPaiement: {
      findMany: jest.fn(({ where }: { where: { ligneReglementId: { in: string[] } } }) =>
        Promise.resolve(declarees.filter((d) => where.ligneReglementId.in.includes(d.ligneReglementId))),
      ),
    },
  };
  return new TauxTvaService(prisma as unknown as PrismaService, {} as EcritureService);
}

describe('B1 · factures de N impayées, payées en N+1 par un groupe qui réunit leurs à-nouveaux', () => {
  /*
    S, prestation du 5 décembre 2026, 1 160 000 TTC (taxe 160 000) ; X, sans
    taxe, du 10 décembre, 1 000 000 ; rien payé en 2026. P de 1 160 000 le
    15 janvier 2027, lettré avec les deux reports. Art. 154 · les deux sont
    échues (aucune échéance), S est la plus ancienne · elle reçoit 1 160 000,
    160 000 de taxe en janvier. La fraction cumulée rendait (1 160 000 -
    1 000 000) / 1 160 000 × 160 000 = 22 068,97, sans nommer le groupe.
  */
  const S = ligneN('S', 1_160_000, 0, '2026-12-05', 'Facture S');
  const X = ligneN('X', 1_000_000, 0, '2026-12-10', 'Facture X');
  const P = ligneN('P', 0, 1_160_000, '2027-01-15', 'Paiement P');
  const anS = ran('anS', S);
  const anX = ran('anX', X);
  const G27 = { id: 'G27', statut: 'PARTIEL', solde: 1_000_000, soldeAt: null, createdAt: jour('2027-01-16'), lignes: [anS, anX, P] };
  const reports = [anS, anX].map((a) => ({ ...a, lettrage: G27 }));
  const ventes = [vente({ id: 'S', tva: 160_000, produit: '70610000', tiers: S })];

  it('S, la plus ancienne, reçoit P · 160 000 en janvier 2027, imputation LÉGALE, aucun groupe lu en bloc', async () => {
    const s = service(ventes, reports, [S, X]);
    const janvier = await s.declaration('t1', ...mois('2027-01'));
    expect(janvier.totalCollecte).toBe(160_000);
    expect(janvier.imputationsDesPaiements).toEqual([{ factures: ['Facture S', 'Facture X'], encaisse: 1_160_000, fondement: 'LEGALE' }]);
    expect(janvier.groupesImputationIndeterminee).toEqual([]);
  });

  it('la facture d’origine d’un report introuvable · le groupe est NOMMÉ (à-nouveau non retrouvé), jamais lu en silence', async () => {
    const s = service(ventes, reports, [S]);
    const janvier = await s.declaration('t1', ...mois('2027-01'));
    expect(janvier.groupesImputationIndeterminee).toEqual([
      { factures: ['Facture S'], encaisse: 1_160_000, motif: 'une ligne d’à-nouveau du groupe dont la facture n’est pas retrouvée' },
    ]);
  });

  it('deux factures d’origine candidates pour un report · rien n’est deviné, le groupe est NOMMÉ', async () => {
    const jumelle = { ...X, id: 't-X2', ecriture: { ...X.ecriture, id: 'X2' } };
    const s = service(ventes, reports, [S, X, jumelle]);
    const janvier = await s.declaration('t1', ...mois('2027-01'));
    expect(janvier.groupesImputationIndeterminee).toHaveLength(1);
  });

  /*
    LE CAS C DU REJEU SANS P1 · G, BIENS du 5 décembre (580 000 TTC, taxe
    80 000 à la livraison), échéance au 31 mars 2027 ; S, prestation du
    10 décembre (1 160 000 TTC, taxe 160 000), échéance au 31 décembre 2026 ;
    rien payé en 2026 ; P de 740 000 le 15 janvier 2027. Ce jour-là S est
    échue, G ne l'est pas · S reçoit 740 000 · 740 000 × 160 000 / 1 160 000 =
    102 068,97 en janvier ; G garde ses 80 000 en décembre.
  */
  it('cas C sans P1 · décembre 80 000 (G, biens), janvier 102 068,97 (S, échue, d’abord)', async () => {
    const G = ligneN('G', 580_000, 0, '2026-12-05', 'Facture G', '2027-03-31');
    const S2 = ligneN('S', 1_160_000, 0, '2026-12-10', 'Facture S', '2026-12-31');
    const P2 = ligneN('P', 0, 740_000, '2027-01-15', 'Paiement P');
    const anG = ran('anG', G);
    const anS2 = ran('anS', S2);
    const groupe = { id: 'G27', statut: 'PARTIEL', solde: 1_000_000, soldeAt: null, createdAt: jour('2027-01-16'), lignes: [anG, anS2, P2] };
    const s = service(
      [
        vente({ id: 'G', tva: 80_000, produit: '70110000', compteTva: '44310000', tiers: G }),
        vente({ id: 'S', tva: 160_000, produit: '70610000', tiers: S2 }),
      ],
      [anG, anS2].map((a) => ({ ...a, lettrage: groupe })),
      [G, S2],
    );
    expect((await s.declaration('t1', ...mois('2026-12'))).totalCollecte).toBe(80_000);
    expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(102_068.97);
  });
});

describe('B2 · imputation déclarée sur un paiement de N+1, groupe prolongé', () => {
  /*
    F1, prestation du 10 décembre 2026, 1 160 000 TTC (taxe 160 000) ; X, sans
    taxe, du 12 décembre, 1 000 000 ; R1 de 500 000 le 20 décembre, lettré
    avec les deux (groupe partiel). R2 de 1 000 000 le 15 janvier 2027, lettré
    avec les reports, que le client DÉCLARE payer X. Art. 154 seul · R1 à F1
    (la plus ancienne), R2 · 660 000 à F1 puis 340 000 à X · 660 000 × 160 000
    / 1 160 000 = 91 034,48 en janvier. Déclarée sur le report de X · F1 ne
    reçoit rien en janvier · 0.
  */
  const F1 = ligneN('F1', 1_160_000, 0, '2026-12-10', 'Facture F1');
  const X = ligneN('X', 1_000_000, 0, '2026-12-12', 'Facture X');
  const R1 = ligneN('R1', 0, 500_000, '2026-12-20', 'Règlement R1');
  const GN = { id: 'GN', statut: 'PARTIEL', solde: 1_660_000, soldeAt: null, createdAt: jour('2026-12-20'), lignes: [F1, X, R1] };
  const anF1 = ran('anF1', F1);
  const anX = ran('anX', X);
  const anR1 = ran('anR1', R1);
  const R2 = ligneN('R2', 0, 1_000_000, '2027-01-15', 'Règlement R2');
  const G27 = { id: 'G27', statut: 'PARTIEL', solde: 660_000, soldeAt: null, createdAt: jour('2027-01-16'), lignes: [anF1, anX, anR1, R2] };
  const reports = [anF1, anX, anR1].map((a) => ({ ...a, lettrage: G27 }));
  const ventes = () => [vente({ id: 'F1', tva: 160_000, produit: '70610000', tiers: F1, lettrage: GN })];

  it('sans déclaration · l’art. 154 · 91 034,48 en janvier', async () => {
    const s = service(ventes(), reports, [F1, X, R1]);
    expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(91_034.48);
  });

  it('R2 déclaré sur le REPORT de X · la déclaration vise X, F1 ne reçoit rien en janvier · 0, fondement DÉCLARÉE, rien de non retenu', async () => {
    const s = service(ventes(), reports, [F1, X, R1], [{ ligneReglementId: 't-R2', ligneFactureId: 'anX', montant: 1_000_000 }]);
    const janvier = await s.declaration('t1', ...mois('2027-01'));
    expect(janvier.totalCollecte).toBe(0);
    expect(janvier.imputationsDesPaiements[0].fondement).toBe('DECLAREE');
    expect(janvier.imputationsDesPaiements[0].declareNonRetenu).toBeUndefined();
  });
});

/**
 * SECOND TOUR (relecture du 2026-10-07, B-1 et M-b) · LA DOUBLURE TIENT UNE
 * SEULE BASE DE LIGNES, N et N+1, et honore chaque lecture par sa forme · les
 * reports des comptes (`compteId.in`, à-nouveaux, avec leur groupe), la pièce
 * d'origine d'un report (`compteId`, hors à-nouveaux, antérieure, mêmes
 * montants), les reports d'une pièce (`compteId`, à-nouveaux, postérieurs,
 * mêmes montants), les lignes d'un groupe (`lettrageId`), l'existence d'un
 * à-nouveau postérieur (`ecriture.findFirst`).
 */
const estAN = (l: Ligne) => l.ecriture.estGenereeParCloture || l.ecriture.estANouveauProvisoire;
type Requete = {
  compteId?: string | { in?: string[] };
  lettrageId?: string;
  ecriture?: { NOT?: unknown; date?: { lt?: Date; gt?: Date } };
  OR?: Array<{ debit: number; credit: number }>;
};
function moteur(ventes: unknown[], enBase: Ligne[], soldes: Record<string, number>, declarees: Declaree[] = []) {
  const groupe = (id: string | null | undefined) =>
    id ? { id, statut: 'PARTIEL', solde: soldes[id] ?? 0, soldeAt: null, createdAt: jour('2027-02-16'), lignes: enBase.filter((l) => l.lettrageId === id) } : null;
  const memesMontants = (where: Requete, l: Ligne) => !where.OR || where.OR.some((m) => m.debit === l.debit && m.credit === l.credit);
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
    tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
    ecriture: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(({ where }: { where: { date?: { gt?: Date } } }) =>
        Promise.resolve(enBase.some((l) => estAN(l) && (!where.date?.gt || l.ecriture.date > where.date.gt)) ? { id: 'an' } : null),
      ),
    },
    ligneEcriture: {
      findMany: jest.fn(({ where }: { where: Requete & Record<string, unknown> }) => {
        if ('aRelettrerDepuis' in where) return Promise.resolve([]);
        if (typeof where.compteId === 'object' && where.compteId?.in) {
          const comptes = where.compteId.in;
          return Promise.resolve(enBase.filter((l) => estAN(l) && comptes.includes(l.compteId)).map((l) => ({ ...l, lettrage: groupe(l.lettrageId) })));
        }
        if (typeof where.compteId === 'string') {
          const compteId = where.compteId;
          if (where.ecriture?.NOT) {
            return Promise.resolve(enBase.filter((l) => !estAN(l) && l.compteId === compteId && l.ecriture.date < where.ecriture!.date!.lt! && memesMontants(where, l)));
          }
          return Promise.resolve(enBase.filter((l) => estAN(l) && l.compteId === compteId && l.ecriture.date > where.ecriture!.date!.gt! && memesMontants(where, l)));
        }
        if (where.lettrageId) return Promise.resolve(enBase.filter((l) => l.lettrageId === where.lettrageId));
        return Promise.resolve(ventes);
      }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
    creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    evenementAudit: { findMany: jest.fn().mockResolvedValue([]) },
    exercice: { count: jest.fn().mockResolvedValue(2) },
    imputationPaiement: {
      findMany: jest.fn(({ where }: { where: { ligneReglementId: { in: string[] } } }) =>
        Promise.resolve(declarees.filter((d) => where.ligneReglementId.in.includes(d.ligneReglementId))),
      ),
    },
  };
  return new TauxTvaService(prisma as unknown as PrismaService, {} as EcritureService);
}
/** Une ligne de 2027 (facture ou paiement). */
const ligne27 = (id: string, debit: number, credit: number, date: string, libelle: string, lettrageId: string | null): Ligne => {
  const l = ligneN(id, debit, credit, date, libelle);
  return { ...l, lettrageId, ecriture: { ...l.ecriture, exerciceId: 'ex2027' } };
};
/** Une vente dont la taxe est sur son propre compte · deux compositions différentes. */
const venteSur = (compteId: string, p: Parameters<typeof vente>[0]) => ({ ...vente(p), compteId });

describe('SECOND TOUR B-1 · le report d’un paiement de N n’est jamais compté une seconde fois', () => {
  /*
    F1, prestation du 5 décembre 2026, 1 160 000 TTC (taxe 160 000) ; P0 de
    400 000 le 20 décembre, lettré avec F1 (G1, partiel). Clôture · report en
    détail de F1 (1 160 000) et de P0 (400 000). F2, prestation du 10 janvier
    2027, 580 000 TTC (taxe 80 000, sur un autre compte · composition
    différente). P de 500 000 le 15 février 2027.
    Décembre · P0 paie F1 · 400 000 × 160 000 / 1 160 000 = 55 172,41.
    Février · art. 154, F1 et F2 échues, F1 la plus ancienne (reste 760 000)
    reçoit les 500 000 · 500 000 × 160 000 / 1 160 000 = 68 965,52 ; F2 rien.
    Avant le second tour · 88 275,86 (le report de P0 payait F1 une seconde
    fois au 1er janvier, et P allait en partie à F2), le groupe dit deux fois.
  */
  const F1 = { ...ligneN('F1', 1_160_000, 0, '2026-12-05', 'Facture F1'), lettrageId: 'G1' };
  const P0 = { ...ligneN('P0', 0, 400_000, '2026-12-20', 'Paiement P0'), lettrageId: 'G1' };
  const rF1 = ran('rF1', F1);
  const rP0 = ran('rP0', P0);
  const F2 = ligne27('F2', 580_000, 0, '2027-01-10', 'Facture F2', 'G2');
  const P = ligne27('P', 0, 500_000, '2027-02-15', 'Paiement P', 'G2');
  const ventesAvec = (base: Ligne[]) => {
    const g = (id: string) => ({ id, statut: 'PARTIEL', solde: 0, soldeAt: null, createdAt: jour('2027-02-16'), lignes: base.filter((l) => l.lettrageId === id) });
    return [
      venteSur('c4432', { id: 'F1', tva: 160_000, produit: '70610000', tiers: F1, lettrage: g('G1') }),
      venteSur('c4431', { id: 'F2', tva: 80_000, produit: '70610000', compteTva: '44310000', tiers: F2, lettrage: g('G2') }),
    ];
  };

  it('les deux reports lettrés avec F2 et P · décembre 55 172,41, janvier 0, février 68 965,52, le groupe dit UNE fois', async () => {
    const base = [F1, P0, { ...rF1, lettrageId: 'G2' }, { ...rP0, lettrageId: 'G2' }, F2, P];
    const s = moteur(ventesAvec(base), base, { G1: 760_000, G2: 840_000 });
    expect((await s.declaration('t1', ...mois('2026-12'))).totalCollecte).toBe(55_172.41);
    expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(0);
    const fevrier = await s.declaration('t1', ...mois('2027-02'));
    expect(fevrier.totalCollecte).toBe(68_965.52);
    expect(fevrier.imputationsDesPaiements).toEqual([expect.objectContaining({ encaisse: 500_000, fondement: 'LEGALE' })]);
    expect(fevrier.groupesImputationIndeterminee).toEqual([]);
  });

  it('G bis · le report de P0 lettré seul avec F2 et P (celui de F1 resté ouvert) · février 68 965,52, jamais 93 793,11 (P0 compté une seconde fois pour F2)', async () => {
    const base = [F1, P0, rF1, { ...rP0, lettrageId: 'G2' }, F2, P];
    const s = moteur(ventesAvec(base), base, { G1: 760_000, G2: 480_000 });
    const fevrier = await s.declaration('t1', ...mois('2027-02'));
    expect(fevrier.totalCollecte).toBe(68_965.52);
    expect(fevrier.imputationsDesPaiements).toHaveLength(1);
  });

  it('UNE LECTURE · le groupe de N lu depuis N et celui de N+1 lu depuis N+1 rendent les mêmes lignes, sans aucun report', async () => {
    const base = [F1, P0, { ...rF1, lettrageId: 'G2' }, { ...rP0, lettrageId: 'G2' }, F2, P];
    const s = moteur([], base, {});
    const ids = async (gid: string) =>
      ((await s.traduireLesReports('t1', { id: gid, statut: 'PARTIEL', lignes: base.filter((l) => l.lettrageId === gid) }, 1)).lignes ?? [])
        .map((l) => l.id)
        .sort();
    expect(await ids('G1')).toEqual(['t-F1', 't-F2', 't-P', 't-P0']);
    expect(await ids('G2')).toEqual(['t-F1', 't-F2', 't-P', 't-P0']);
    const traduit = await s.traduireLesReports('t1', { id: 'G2', statut: 'PARTIEL', lignes: base.filter((l) => l.lettrageId === 'G2') }, 1);
    expect([...(traduit.reportsVers ?? [])]).toEqual([['rF1', 't-F1']]);
    expect([...(traduit.paiementsReportes ?? [])]).toEqual([['rP0', 't-P0']]);
  });

  it('le paiement d’origine d’un report introuvable · le groupe se lit en BLOC, nommé, jamais compté deux fois en silence', async () => {
    const orphelin = { ...rP0, libelle: 'RAN détail 41110101 · Paiement inconnu', lettrageId: 'G2' };
    const base = [F1, P0, { ...rF1, lettrageId: 'G2' }, orphelin, F2, P];
    const s = moteur([], base, {});
    const traduit = await s.traduireLesReports('t1', { id: 'G2', statut: 'PARTIEL', lignes: base.filter((l) => l.lettrageId === 'G2') }, 1);
    expect(TauxTvaService.lectureDuGroupe(traduit, 1).motifEnBloc).toBe('une ligne d’à-nouveau du groupe dont le paiement d’origine n’est pas retrouvé');
  });
});

describe('SECOND TOUR M-b · la déclaration qu’un groupe lu en bloc n’a pas lue est DITE', () => {
  /*
    F1 (prestation, 1 160 000, 5 janvier 2026), F2 (prestation, 580 000,
    10 janvier, autre compte), un AVOIR de 116 000 le 20 janvier, P de
    500 000 le 15 février déclaré par le client sur F2 · le groupe porte un
    avoir, il se lit en bloc (décret n° 011/42, art. 126) · la déclaration de
    500 000 n'est pas lue, et la déclaration de février le dit.
  */
  it('motif « un avoir dans le groupe » et 500 000 d’imputation déclarée non lus', async () => {
    const l26 = (id: string, debit: number, credit: number, date: string, libelle: string, avoir = 0): Ligne => {
      const l = ligneN(id, debit, credit, date, libelle);
      return { ...l, lettrageId: 'G', ecriture: { ...l.ecriture, _count: { lignes: avoir } } };
    };
    const A = l26('A', 1_160_000, 0, '2026-01-05', 'Facture A');
    const B = l26('B', 580_000, 0, '2026-01-10', 'Facture B');
    const AV = l26('AV', 0, 116_000, '2026-01-20', 'Avoir', 1);
    const P = l26('P', 0, 500_000, '2026-02-15', 'Paiement P');
    const base = [A, B, AV, P];
    const g = { id: 'G', statut: 'PARTIEL', solde: 1_124_000, soldeAt: null, createdAt: jour('2026-02-16'), lignes: base };
    const s = moteur(
      [
        venteSur('c4432', { id: 'A', tva: 160_000, produit: '70610000', tiers: A, lettrage: g }),
        venteSur('c4431', { id: 'B', tva: 80_000, produit: '70610000', compteTva: '44310000', tiers: B, lettrage: g }),
      ],
      [],
      {},
      [{ ligneReglementId: 't-P', ligneFactureId: 't-B', montant: 500_000 }],
    );
    const fevrier = await s.declaration('t1', ...mois('2026-02'));
    expect(fevrier.groupesImputationIndeterminee).toEqual([expect.objectContaining({ motif: 'un avoir dans le groupe', declarationsNonLues: 500_000 })]);
  });
});
