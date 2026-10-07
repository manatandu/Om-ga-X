import { TauxTvaService } from './taux-tva.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * LES GROUPES DE LETTRAGE SE LISENT COMME SUR `main` (A7 bis, quatrième
 * reprise, décision du coordinateur), SAUF LE GROUPE À PLUSIEURS FACTURES DE
 * MÊME COMPOSITION (ligne TVA 24-26, constat F1, 2026-10-04). Le prorata
 * entre les factures d'un groupe partiel, convention qu'aucun texte ne fixe,
 * reste retiré · pour un dossier sans créance douteuse désignée, chaque
 * groupe rend ce que rendait le moteur de `main` (8315e0c), à une exception
 * près, DITE CAS PAR CAS dans `RENDU_ATTENDU` · quand toutes les factures du
 * groupe portent la même taxe par franc engagé (même taux, même compte),
 * chaque somme perçue rend exigible sa taxe (O.-L. n° 10/001, art. 25, 2° ;
 * décret n° 011/42, art. 57), et toute imputation possible des paiements
 * donne le même montant · `main` rendait 0 tant que le groupe n'était pas
 * soldé.
 *
 * GROUPE DE COMPOSITION DIFFÉRENTE · REVU LE 2026-10-07 (décision par la loi,
 * point 4). Le Code civil, Livre III, art. 151 à 154, dit quelle facture une
 * somme paie · la déclaration du débiteur ou la quittance qu'il a acceptée,
 * sinon l'ordre légal (échues d'abord, la plus ancienne, au prorata à date
 * égale). La règle de `main` n'est plus gardée pour ces groupes ; elle ne
 * reste qu'au groupe qui porte un avoir, une ligne illisible ou un à-nouveau
 * dont la facture n'est pas retrouvée, NOMMÉ pour ce motif. Le jeu « biens et
 * services » rend la même chose que `main` (la facture de biens, la plus
 * ancienne, est payée la première) ; le jeu « services et facture sans taxe »
 * dit l'écart.
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

/**
 * `ecriture` · l'identifiant de l'écriture qui porte la ligne (la facture, ou
 * le règlement) ; `echeance` · l'échéance de la ligne (art. 154, dette échue).
 */
type LigneGroupe = { debit: number; credit: number; date: string; avoir?: boolean; ecriture?: string; echeance?: string; corrige?: string };

/** Une ligne de TVA collectée, sa contrepartie de produit et sa ligne client lettrée dans le groupe donné. */
function vente(p: {
  id: string;
  date: string;
  tva: number;
  ttc: number;
  produit: string;
  compteTva?: string;
  groupe: { id?: string; statut: 'PARTIEL' | 'SOLDE'; solde: number; createdAt?: string; lignes: LigneGroupe[] } | null;
  numeroClient?: string;
  /** Jour de SAISIE de l'écriture, s'il diffère de sa date. */
  saisie?: string;
}) {
  const groupe = p.groupe
    ? {
        id: p.groupe.id,
        statut: p.groupe.statut,
        solde: p.groupe.solde,
        soldeAt: null,
        createdAt: p.groupe.createdAt ? jour(p.groupe.createdAt) : undefined,
        lignes: p.groupe.lignes.map((g, i) => ({
          id: g.ecriture ? `g-${g.ecriture}-${i}` : undefined,
          debit: g.debit,
          credit: g.credit,
          dateEcheance: g.echeance ? jour(g.echeance) : null,
          ecriture: {
            id: g.ecriture,
            libelle: g.ecriture ? `Facture ${g.ecriture}` : undefined,
            corrigeEcritureId: g.corrige ?? null,
            date: jour(g.date),
            createdAt: jour(g.date),
            _count: { lignes: g.avoir ? 1 : 0 },
          },
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
      id: p.id,
      date: jour(p.date),
      createdAt: jour(p.saisie ?? p.date),
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

/** Une imputation déclarée (Code civil, Livre III, art. 151 et 153), telle que la base la garde. */
type Declaree = { ligneReglementId: string; ligneFactureId: string; montant: number; retireeLe?: Date | null; tenantId?: string };

function prisma(lignes: unknown[], liquidations: unknown[] = [], evenementsAudit: unknown[] = [], declarees: Declaree[] = []) {
  return {
    // LA DOUBLURE HONORE LA REQUÊTE · dossier, déclarations actives, paiements
    // demandés · une lecture qui oublierait l'un des trois rendrait ici ce
    // qu'elle ne doit pas.
    imputationPaiement: {
      findMany: jest.fn(({ where }: { where: { tenantId: string; retireeLe: null; ligneReglementId: { in: string[] } } }) =>
        Promise.resolve(
          declarees.filter(
            (d) =>
              (d.tenantId ?? 't1') === where.tenantId &&
              where.retireeLe === null &&
              !d.retireeLe &&
              where.ligneReglementId.in.includes(d.ligneReglementId),
          ),
        ),
      ),
    },
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', regimeExigibiliteTva: 'LIVRAISONS', referentiel: 'SYSCOHADA' }) },
    tauxTva: { findMany: jest.fn().mockResolvedValue([TAUX]) },
    // `findFirst` · une écriture d'à-nouveau existe dans le dossier (garde de
    // `prolongerParLesANouveaux`).
    ecriture: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue({ id: 'an' }) },
    ligneEcriture: {
      findMany: jest.fn(({ where }: { where: { compteId?: { in?: string[] } } }) => Promise.resolve(where.compteId?.in ? [] : lignes)),
      aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 0, debit: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    factureCreanceDouteuse: { findMany: jest.fn().mockResolvedValue([]) },
    creanceDouteuse: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    liquidationTva: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue(liquidations) },
    evenementAudit: { findMany: jest.fn().mockResolvedValue(evenementsAudit) },
    // 2026 clôturé, 2027 et 2028 ouverts · la prolongation par les
    // à-nouveaux ne se lance qu'avec un exercice clos.
    exercice: { count: jest.fn().mockResolvedValue(3) },
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
      { debit: 580_000, credit: 0, date: '2026-01-10', ecriture: 'G' },
      { debit: 1_160_000, credit: 0, date: '2026-01-15', ecriture: 'S' },
      { debit: 0, credit: 1_000_000, date: '2026-03-12', ecriture: 'R' },
    ];
    const groupe = { id: 'GBS', statut: 'PARTIEL' as const, solde: 740_000, lignes: lignesGroupe };
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
      id: 'G2',
      statut: 'PARTIEL' as const,
      solde: 1_820_000,
      lignes: [
        { debit: 1_160_000, credit: 0, date: '2026-12-10', ecriture: 'F1' },
        { debit: 1_160_000, credit: 0, date: '2026-12-11', ecriture: 'F2' },
        { debit: 0, credit: 500_000, date: '2026-12-20', ecriture: 'R1' },
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
    // groupe, qui devient partiel. `main` rendait 0 partout · la taxe de A,
    // encaissée le 10 février, n'était plus exigible nulle part.
    const groupe = {
      id: 'GAB',
      statut: 'PARTIEL' as const,
      solde: 1_160_000,
      lignes: [
        { debit: 1_160_000, credit: 0, date: '2026-01-15', ecriture: 'A' },
        { debit: 0, credit: 1_160_000, date: '2026-02-10', ecriture: 'RA' },
        { debit: 1_160_000, credit: 0, date: '2026-03-05', ecriture: 'B' },
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

/**
 * CE QUE REND LA LIGNE TVA 24-26, CAS PAR CAS.
 *  · groupe à une facture · INCHANGÉ (règle de `main`, tranche unique).
 *  · biens et services · INCHANGÉ, et NOMMÉ · la facture de biens est
 *    exigible à sa livraison (art. 25, 1°), celle de services à
 *    l'encaissement · la taxe exigible le 12 mars dépend de la facture que
 *    le million paie, que le corpus ne dit pas.
 *  · avoir dans le groupe · INCHANGÉ (une facture seule).
 *  · deux factures de services, 500 000 réglés · CHANGÉ, 0 devient
 *    500 000 × 160 000 / 1 160 000 = 68 965,52 (34 482,76 par facture), la
 *    même taxe quelle que soit la facture payée.
 *  · B ajoutée au groupe de A payée · CHANGÉ, février 0 devient 160 000, la
 *    taxe de A encaissée le 10 février ; mars reste 0.
 */
const RENDU_ATTENDU: Record<string, Record<string, [number, number]>> = {
  ...RENDU_DE_MAIN,
  'groupe à deux factures (500 000 réglés)': { '2026-12': [68_965.52, 0] },
  'facture B ajoutée au groupe d’un paiement antérieur': { '2026-01': [0, 0], '2026-02': [160_000, 0], '2026-03': [0, 0] },
};

describe('Sans créance désignée, chaque groupe rend ce que rend main, sauf le groupe à plusieurs factures de même composition (F1)', () => {
  for (const [nom, jeu] of Object.entries(JEUX)) {
    it(nom, async () => {
      expect(await rendu(TauxTvaService as never, jeu)).toEqual(RENDU_ATTENDU[nom]);
    });
  }

  it('F1 · deux prestations, 500 000 encaissés · le reste est en attente, rien n’est dit « indéterminé »', async () => {
    const s = new TauxTvaService(prisma(JEUX['groupe à deux factures (500 000 réglés)'].lignes), {} as EcritureService);
    const d = await s.declaration('t1', ...mois('2026-12'));
    expect(d.tvaEnAttenteEncaissement).toBe(251_034.48);
    expect(d.tvaEnAttenteImputationIndeterminee).toBe(0);
    expect(d.groupesImputationIndeterminee).toEqual([]);
  });

  it('F1 · le solde du 15 janvier 2027 rend exigible le reste, 251 034,48, et le total des deux mois vaut 320 000', async () => {
    const groupe = {
      id: 'G2',
      statut: 'SOLDE' as const,
      solde: 0,
      lignes: [
        { debit: 1_160_000, credit: 0, date: '2026-12-10', ecriture: 'F1' },
        { debit: 1_160_000, credit: 0, date: '2026-12-11', ecriture: 'F2' },
        { debit: 0, credit: 500_000, date: '2026-12-20', ecriture: 'R1' },
        { debit: 0, credit: 1_820_000, date: '2027-01-15', ecriture: 'R2' },
      ],
    };
    const lignes = [
      vente({ id: 'F1', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
      vente({ id: 'F2', date: '2026-12-11', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe }),
    ];
    const s = new TauxTvaService(prisma(lignes), {} as EcritureService);
    expect((await s.declaration('t1', ...mois('2026-12'))).totalCollecte).toBe(68_965.52);
    expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(251_034.48);
  });

  it('point 4 · biens et services · le million du 12 mars est IMPUTÉ (art. 154) · G (10 janvier) d’abord, S reçoit 420 000 · 57 931,03, rien de « non déterminé »', async () => {
    const s = new TauxTvaService(prisma(JEUX['groupe avec une facture de biens et une facture de services'].lignes), {} as EcritureService);
    const d = await s.declaration('t1', ...mois('2026-03'));
    // 420 000 × 160 000 / 1 160 000 = 57 931,03.
    expect(d.totalCollecte).toBe(57_931.03);
    expect(d.groupesImputationIndeterminee).toEqual([]);
    expect(d.groupesImputationIndetermineeTotal).toBe(0);
    expect(d.tvaEnAttenteImputationIndeterminee).toBe(0);
    expect(d.imputationsDesPaiements).toEqual([{ factures: ['Facture G', 'Facture S'], encaisse: 1_000_000, fondement: 'LEGALE' }]);
    expect(d.mentionExigibilite).not.toContain('IMPUTATION N’EST PAS DÉTERMINÉE');
    expect(d.mentionExigibilite).toContain('IMPUTATION DES PAIEMENTS · factures « Facture G », « Facture S », 1');
    expect(d.mentionExigibilite).toContain('imputation légale, Code civil, Livre III, art. 154');
    expect(d.mentionExigibilite).toContain('ni intérêt, ni pénalité, ni sûreté');
  });

  it('F1 · un mois liquidé reste FIGÉ · février liquidé avec A seule (160 000), B entrée en mars · rien de plus en mars ni en avril', async () => {
    const jeu = JEUX['facture B ajoutée au groupe d’un paiement antérieur'];
    const [debut, fin] = mois('2026-02');
    const liq = [{ id: 'liqF', dateDebut: debut, dateFin: fin, createdAt: jour('2026-03-01'), tvaEncaissementFigee: { A: 160_000 } }];
    const s = new TauxTvaService(prisma(jeu.lignes, liq), {} as EcritureService);
    expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(160_000);
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(0);
  });

  it('F1 · un mois liquidé par l’ancien moteur (aucun figé) reste ce qu’il a déclaré · décembre 0, le reste reporté en janvier', async () => {
    // L'ancien moteur a déclaré 0 en décembre (fraction cumulée nulle) ; la
    // taxe de l'encaissement du 20 décembre, jamais déclarée, est reportée
    // au premier jour non liquidé, une fois.
    const jeu = JEUX['groupe à deux factures (500 000 réglés)'];
    const [debut, fin] = mois('2026-12');
    const liq = [{ id: 'liqD', dateDebut: debut, dateFin: fin, createdAt: jour('2027-01-05'), tvaEncaissementFigee: null }];
    const s = new TauxTvaService(prisma(jeu.lignes, liq), {} as EcritureService);
    expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(68_965.52);
  });

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

describe('Cinquième reprise · saisie après la liquidation, reconstitution incertaine nommée, avoir dans le groupe de l’à-nouveau', () => {
  it('BLOQUANT · facture du 20 mars SAISIE le 15 avril, mars liquidé le 1er avril par l’ancien moteur · mars 0, mai 160 000 (comme main)', async () => {
    const ligne = vente({
      id: 'F',
      date: '2026-03-20',
      saisie: '2026-04-15',
      tva: 160_000,
      ttc: 1_160_000,
      produit: '70610000',
      groupe: {
        statut: 'SOLDE',
        solde: 0,
        createdAt: '2026-05-10',
        lignes: [{ debit: 1_160_000, credit: 0, date: '2026-03-20' }, { debit: 0, credit: 1_160_000, date: '2026-05-10' }],
      },
    });
    const liq = [{ id: 'liqM', dateDebut: mois('2026-03')[0], dateFin: mois('2026-03')[1], createdAt: jour('2026-04-01'), tvaEncaissementFigee: null }];
    const s = new TauxTvaService(prisma([ligne], liq), {} as EcritureService);
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2026-05'))).totalCollecte).toBe(160_000);
    expect(TauxTvaService.declareParAncienMoteur([], 160_000, jour('2026-03-20'), liq[0] as never, jour('2026-04-15'))).toBe(0);
  });

  it('un groupe lu par l’ancien moteur et COMPLÉTÉ après la liquidation (journal d’audit) · reconstitution incertaine NOMMÉE, montant compris', async () => {
    // Février liquidé le 1er mars par l'ancien moteur ; le groupe G1 (né le
    // 10 février) voit son reste changer le 5 mars · un paiement de février
    // y est entré après la liquidation.
    const ligne = vente({
      id: 'F',
      date: '2026-01-15',
      tva: 160_000,
      ttc: 1_160_000,
      produit: '70610000',
      groupe: {
        id: 'G1',
        statut: 'PARTIEL',
        solde: 696_000,
        createdAt: '2026-02-10',
        lignes: [
          { debit: 1_160_000, credit: 0, date: '2026-01-15' },
          { debit: 0, credit: 232_000, date: '2026-02-10' },
          { debit: 0, credit: 232_000, date: '2026-02-20' },
        ],
      },
    });
    const liq = [{ id: 'liqF', dateDebut: mois('2026-02')[0], dateFin: mois('2026-02')[1], createdAt: jour('2026-03-01'), tvaEncaissementFigee: null }];
    const audit = [
      { id: 'e1', action: 'MODIFICATION', entiteId: 'G1', horodatage: jour('2026-03-05'), avant: { solde: 928_000 }, apres: { solde: 696_000 } },
      // Un verrou posé ne change pas le reste · ignoré.
      { id: 'e2', action: 'MODIFICATION', entiteId: 'G9', horodatage: jour('2026-03-06'), avant: { solde: 10 }, apres: { solde: 10 } },
    ];
    const s = new TauxTvaService(prisma([ligne], liq, audit), {} as EcritureService);
    const d = await s.declaration('t1', ...mois('2026-04'));
    expect(d.reconstitutionsIncertaines).toEqual([{ facture: 'Facture F', dateDebut: '2026-02-01', dateFin: '2026-02-28', montantReconstitue: 64_000 }]);
    expect(d.reconstitutionsIncertainesTotal).toBe(1);
    expect(d.mentionExigibilite).toContain('reconstitution incertaine pour la facture « Facture F »');
    expect(d.mentionExigibilite).toContain('à vérifier contre la déclaration déposée');
  });

  it('un paiement DÉLETTRÉ après la liquidation (groupe né avant elle supprimé) · reconstitution incertaine nommée', async () => {
    const ligne = vente({ id: 'F', date: '2026-01-15', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
    const liq = [{ id: 'liqF', dateDebut: mois('2026-02')[0], dateFin: mois('2026-02')[1], createdAt: jour('2026-03-01'), tvaEncaissementFigee: null }];
    const audit = [{ id: 'e1', action: 'SUPPRESSION', entiteId: 'G1', horodatage: jour('2026-03-05'), avant: { compteId: 'c-client', createdAt: '2026-02-10T00:00:00.000Z' }, apres: null }];
    const s = new TauxTvaService(prisma([ligne], liq, audit), {} as EcritureService);
    const d = await s.declaration('t1', ...mois('2026-04'));
    expect(d.reconstitutionsIncertaines.map((r) => r.facture)).toEqual(['Facture F']);
  });

  it('sans ancienne liquidation, le journal d’audit n’est pas lu', async () => {
    const p = prisma(JEUX['avoir dans le groupe'].lignes);
    await new TauxTvaService(p, {} as EcritureService).declaration('t1', ...mois('2026-03'));
    expect((p as unknown as { evenementAudit: { findMany: jest.Mock } }).evenementAudit.findMany).not.toHaveBeenCalled();
  });

  it('un AVOIR dans le groupe de l’à-nouveau n’est pas un règlement · F0 entière au paiement, comme main', async () => {
    // F0 (décembre N), son à-nouveau lettré en N+1 avec un avoir de 116 000
    // (20 janvier) et un paiement de 1 044 000 (15 février). Lu comme un
    // règlement, l'avoir aurait sa tranche de 16 000 en janvier.
    const groupeN1 = {
      statut: 'SOLDE',
      solde: 0,
      soldeAt: null,
      createdAt: jour('2027-02-20'),
      lignes: [
        { debit: 1_160_000, credit: 0, ecriture: { date: jour('2027-01-01'), createdAt: jour('2027-01-01'), estANouveauProvisoire: false, estGenereeParCloture: true, _count: { lignes: 0 } } },
        { debit: 0, credit: 116_000, ecriture: { date: jour('2027-01-20'), createdAt: jour('2027-01-20'), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 1 } } },
        { debit: 0, credit: 1_044_000, ecriture: { date: jour('2027-02-15'), createdAt: jour('2027-02-15'), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 0 } } },
      ],
    };
    const f0 = vente({ id: 'F0', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
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
    const p = prisma([f0]);
    (p.ligneEcriture.findMany as jest.Mock).mockImplementation(({ where }: { where: { compteId?: { in?: string[] } } }) =>
      Promise.resolve(where.compteId?.in ? [aNouveau] : [f0]),
    );
    // La lecture de l'à-nouveau demande le décompte des avoirs et l'instant de saisie.
    const s = new TauxTvaService(p, {} as EcritureService);
    expect((await s.declaration('t1', ...mois('2027-01'))).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2027-02'))).totalCollecte).toBe(160_000);
    const appel = (p.ligneEcriture.findMany as jest.Mock).mock.calls.find((c) => c[0].where.compteId?.in)[0];
    expect(appel.select.lettrage.select.lignes.select.ecriture.select).toMatchObject({ createdAt: true, _count: expect.any(Object) });
  });
});

describe('F1 · les briques du groupe à plusieurs factures', () => {
  it('fractionsDuGroupe · une tranche par encaissement, sur le total des factures du groupe', () => {
    expect(TauxTvaService.fractionsDuGroupe([{ date: jour('2026-12-20'), montant: 500_000 }], 2_320_000, false)).toEqual([
      { date: jour('2026-12-20'), fraction: 500_000 / 2_320_000 },
      { date: null, fraction: 1 - 500_000 / 2_320_000 },
    ]);
    // Soldé avec un écart d'arrondi · rattaché au dernier règlement.
    const soldee = TauxTvaService.fractionsDuGroupe([{ date: jour('2026-12-20'), montant: 2_319_999.99 }], 2_320_000, true);
    expect(soldee).toHaveLength(1);
    expect(soldee[0].fraction).toBeCloseTo(1, 12);
  });

  it('repartirLibresEntreLignes · au centime, la somme rendue vaut celle du groupe, aucune ligne au-delà de sa taxe', () => {
    const libres = [{ date: jour('2026-12-20'), montant: 68_965.52, origine: jour('2026-12-20') }];
    const r = TauxTvaService.repartirLibresEntreLignes(libres, [160_000, 160_000]);
    expect(r.map((x) => x[0].montant).reduce((t, v) => t + v, 0)).toBeCloseTo(68_965.52, 2);
    const plafonnee = TauxTvaService.repartirLibresEntreLignes([{ date: jour('2026-02-10'), montant: 160_000, origine: jour('2026-02-10') }], [0, 160_000]);
    expect(plafonnee[0]).toEqual([]);
    expect(plafonnee[1][0].montant).toBe(160_000);
  });

  it('groupeAPlusieursFactures · null pour un groupe à une facture ou sans identifiant', () => {
    const une = { debit: 1_160_000, credit: 0, lettrage: { id: 'G', statut: 'PARTIEL', solde: 1, lignes: [{ debit: 1_160_000, credit: 0 }, { debit: 0, credit: 5, ecriture: { date: jour('2026-01-02') } }] } };
    expect(TauxTvaService.groupeAPlusieursFactures([une])).toBeNull();
    const deux = { ...une, lettrage: { ...une.lettrage, lignes: [...une.lettrage.lignes, { debit: 10, credit: 0 }] } };
    expect(TauxTvaService.groupeAPlusieursFactures([deux])?.id).toBe('G');
    expect(TauxTvaService.groupeAPlusieursFactures([{ ...deux, lettrage: { ...deux.lettrage, id: undefined as unknown as string } }])).toBeNull();
  });
});

describe('F1 à travers la clôture · le groupe partiel de N se poursuit par ses à-nouveaux', () => {
  // Rejeu sur vraie base (2026-10-04) · F1 et F2 de décembre 2026, 500 000
  // encaissés le 20/12, groupe PARTIEL à la clôture ; le report Détail
  // recopie les trois lignes en 2027, lettrées avec le solde de 1 820 000 du
  // 15/01/2027. Lue sur son seul groupe de 2026, la taxe ne voyait jamais
  // le solde · 251 034,48 restaient en attente pour toujours.
  const ligneN = (id: string, debit: number, credit: number, date: string, libelle: string) => ({
    id: `t-${id}`,
    compteId: 'c-client',
    libelle: null,
    dateEcheance: null,
    deviseId: null,
    montantDevise: null,
    debit,
    credit,
    ecriture: { id, libelle, date: jour(date), createdAt: jour(date), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 0 } },
  });
  const groupeN = {
    id: 'GN',
    statut: 'PARTIEL' as const,
    solde: 1_820_000,
    soldeAt: null,
    createdAt: jour('2026-12-20'),
    lignes: [
      ligneN('F1', 1_160_000, 0, '2026-12-10', 'Facture F1'),
      ligneN('F2', 1_160_000, 0, '2026-12-11', 'Facture F2'),
      ligneN('R1', 0, 500_000, '2026-12-20', 'Règlement partiel'),
    ],
  };
  const ran = (id: string, debit: number, credit: number, libelle: string) => ({
    id,
    compteId: 'c-client',
    libelle: `RAN détail 41110101 · ${libelle}`,
    dateEcheance: null,
    deviseId: null,
    montantDevise: null,
    debit,
    credit,
    ecriture: { id: 'AN27', libelle: 'À-nouveau', date: jour('2027-01-01'), createdAt: jour('2027-01-01'), estANouveauProvisoire: false, estGenereeParCloture: true, exerciceId: 'ex2027', _count: { lignes: 0 } },
  });
  const lignesGPrime = [
    ran('anF1', 1_160_000, 0, 'Facture F1'),
    ran('anF2', 1_160_000, 0, 'Facture F2'),
    ran('anR1', 0, 500_000, 'Règlement partiel'),
    ligneN('R2', 0, 1_820_000, '2027-01-15', 'Solde'),
  ];
  const groupePrime = { id: 'G27', statut: 'SOLDE', solde: 0, lignes: lignesGPrime };
  const aNouveaux = lignesGPrime.slice(0, 3).map((l) => ({ ...l, lettrage: groupePrime }));
  const ventes = () => [
    vente({ id: 'F1', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null }),
    vente({ id: 'F2', date: '2026-12-11', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null }),
  ].map((v) => {
    (v.ecriture.lignes[0] as { lettrage: unknown }).lettrage = groupeN;
    return v;
  });

  function base(liquidations: unknown[], ran: unknown[]) {
    const p = prisma(ventes(), liquidations);
    (p.ligneEcriture.findMany as jest.Mock).mockImplementation(({ where }: { where: { compteId?: { in?: string[] } } }) =>
      Promise.resolve(where.compteId?.in ? ran : ventes()),
    );
    return p;
  }

  it('décembre liquidé (figé) · janvier 2027 rend 251 034,48, le total vaut 320 000', async () => {
    const [debut, fin] = mois('2026-12');
    const liq = [{ id: 'liqD', dateDebut: debut, dateFin: fin, createdAt: jour('2027-01-05'), tvaEncaissementFigee: { F1: 34_482.76, F2: 34_482.76 } }];
    const s = new TauxTvaService(base(liq, aNouveaux), {} as EcritureService);
    expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(68_965.52);
    const janvier = await s.declaration('t1', ...mois('2027-01'));
    expect(janvier.totalCollecte).toBe(251_034.48);
    expect(janvier.groupesImputationIndeterminee).toEqual([]);
  });

  it('deux reports candidats dans le même exercice · rien n’est relié (aucune devinette), et les factures sont NOMMÉES', async () => {
    const doublon = { ...aNouveaux[0], id: 'anF1bis' };
    const s = new TauxTvaService(base([], [...aNouveaux, doublon]), {} as EcritureService);
    const d = await s.declaration('t1', ...mois('2027-01'));
    expect(d.totalCollecte).toBe(0);
    expect(d.rapprochementsANouveauAbandonnes).toEqual([
      { facture: 'Facture F1', date: '2026-12-10', tva: 160_000, motif: 'plusieurs à-nouveaux candidats, rapprochement non fait' },
      { facture: 'Facture F2', date: '2026-12-11', tva: 160_000, motif: 'plusieurs à-nouveaux candidats, rapprochement non fait' },
    ]);
    expect(d.rapprochementsANouveauAbandonnesTotal).toBe(2);
    expect(d.mentionExigibilite).toContain('RAPPROCHEMENT PAR L’À-NOUVEAU NON FAIT · facture « Facture F1 » du 10/12/2026, 160');
  });

  it('relierAuxANouveaux · une facture non lettrée de N, deux à-nouveaux candidats lettrés en N+1 · NOMMÉE, jamais tue', async () => {
    const f0 = vente({ id: 'F0', date: '2026-12-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
    const groupe = {
      statut: 'SOLDE',
      solde: 0,
      soldeAt: null,
      createdAt: jour('2027-02-20'),
      lignes: [{ debit: 0, credit: 1_160_000, ecriture: { date: jour('2027-02-15'), createdAt: jour('2027-02-15'), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 0 } } }],
    };
    const an = (id: string) => ({
      id,
      compteId: 'c-client',
      debit: 1_160_000,
      credit: 0,
      deviseId: null,
      montantDevise: null,
      dateEcheance: null,
      libelle: 'RAN détail 41110101 · Facture F0',
      ecriture: { date: jour('2027-01-01'), exerciceId: 'ex2027' },
      lettrage: groupe,
    });
    const p = prisma([f0]);
    (p.ligneEcriture.findMany as jest.Mock).mockImplementation(({ where }: { where: { compteId?: { in?: string[] } } }) =>
      Promise.resolve(where.compteId?.in ? [an('a1'), an('a2')] : [f0]),
    );
    const d = await new TauxTvaService(p, {} as EcritureService).declaration('t1', ...mois('2027-02'));
    expect(d.totalCollecte).toBe(0);
    expect(d.rapprochementsANouveauAbandonnes).toEqual([
      { facture: 'Facture F0', date: '2026-12-10', tva: 160_000, motif: 'plusieurs à-nouveaux candidats, rapprochement non fait' },
    ]);
  });
});

describe('Second tour · l’ancien moteur ne voit jamais la prolongation, la chaîne se suit sur trois exercices', () => {
  const ligneN = (id: string, debit: number, credit: number, date: string, libelle: string) => ({
    id: `t-${id}`,
    compteId: 'c-client',
    libelle: null,
    dateEcheance: null,
    deviseId: null,
    montantDevise: null,
    debit,
    credit,
    ecriture: { id, libelle, date: jour(date), createdAt: jour(date), estANouveauProvisoire: false, estGenereeParCloture: false, _count: { lignes: 0 } },
  });
  const ran = (id: string, debit: number, credit: number, libelle: string, an: string, exercice: string, date: string) => ({
    id,
    compteId: 'c-client',
    libelle: `RAN détail 41110101 · ${libelle}`,
    dateEcheance: null,
    deviseId: null,
    montantDevise: null,
    debit,
    credit,
    ecriture: { id: an, libelle: 'À-nouveau', date: jour(date), createdAt: jour(date), estANouveauProvisoire: false, estGenereeParCloture: true, exerciceId: exercice, _count: { lignes: 0 } },
  });
  const vendre = (id: string, date: string, groupe: unknown) => {
    const v = vente({ id, date, tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: null });
    (v.ecriture.lignes[0] as { lettrage: unknown }).lettrage = groupe;
    return v;
  };
  const base = (ventes: () => unknown[], aNouveaux: unknown[], liquidations: unknown[] = []) => {
    const p = prisma(ventes(), liquidations);
    (p.ligneEcriture.findMany as jest.Mock).mockImplementation(({ where }: { where: { compteId?: { in?: string[] } } }) =>
      Promise.resolve(where.compteId?.in ? aNouveaux : ventes()),
    );
    return new TauxTvaService(p, {} as EcritureService);
  };
  const rendu = async (s: TauxTvaService, periodes: string[]) => {
    const r: Record<string, number> = {};
    for (const m of periodes) r[m] = (await s.declaration('t1', ...mois(m))).totalCollecte;
    return r;
  };
  const liqs = [
    { id: 'liqD', dateDebut: mois('2026-12')[0], dateFin: mois('2026-12')[1], createdAt: jour('2027-01-05'), tvaEncaissementFigee: null },
    { id: 'liqJ', dateDebut: mois('2027-01')[0], dateFin: mois('2027-01')[1], createdAt: jour('2027-02-05'), tvaEncaissementFigee: null },
  ];

  // BLOQUANT 1 · deux factures, décembre et janvier liquidés par l'ancien
  // moteur (0 et 0). La branche relisait janvier à 320 000, déclarés nulle
  // part · la prolongation était réputée vue par l'ancien moteur.
  const groupeDeux = {
    id: 'GN',
    statut: 'PARTIEL' as const,
    solde: 1_820_000,
    soldeAt: null,
    createdAt: jour('2026-12-20'),
    lignes: [ligneN('F1', 1_160_000, 0, '2026-12-10', 'Facture F1'), ligneN('F2', 1_160_000, 0, '2026-12-11', 'Facture F2'), ligneN('R1', 0, 500_000, '2026-12-20', 'Règlement partiel')],
  };
  const l27 = [
    ran('anF1', 1_160_000, 0, 'Facture F1', 'AN27', 'ex2027', '2027-01-01'),
    ran('anF2', 1_160_000, 0, 'Facture F2', 'AN27', 'ex2027', '2027-01-01'),
    ran('anR1', 0, 500_000, 'Règlement partiel', 'AN27', 'ex2027', '2027-01-01'),
    ligneN('R2', 0, 1_820_000, '2027-01-15', 'Solde'),
  ];
  const g27 = { id: 'G27', statut: 'SOLDE', solde: 0, lignes: l27 };
  const ans27 = l27.slice(0, 3).map((l) => ({ ...l, lettrage: g27 }));

  it('deux factures, liquidations de l’ancien moteur · décembre 0 et janvier 0 relus tels que versés, 320 000 au premier mois libre', async () => {
    const s = base(() => [vendre('F1', '2026-12-10', groupeDeux), vendre('F2', '2026-12-11', groupeDeux)], ans27, liqs);
    expect(await rendu(s, ['2026-12', '2027-01', '2027-02'])).toEqual({ '2026-12': 0, '2027-01': 0, '2027-02': 320_000 });
  });

  const groupeUne = {
    id: 'G1',
    statut: 'PARTIEL' as const,
    solde: 660_000,
    soldeAt: null,
    createdAt: jour('2026-12-20'),
    lignes: [ligneN('F1', 1_160_000, 0, '2026-12-10', 'Facture F1'), ligneN('R1', 0, 500_000, '2026-12-20', 'Règlement partiel')],
  };
  const u27 = [ran('anF1', 1_160_000, 0, 'Facture F1', 'AN27', 'ex2027', '2027-01-01'), ran('anR1', 0, 500_000, 'Règlement partiel', 'AN27', 'ex2027', '2027-01-01'), ligneN('R2', 0, 660_000, '2027-01-15', 'Solde')];
  const gu27 = { id: 'G27', statut: 'SOLDE', solde: 0, lignes: u27 };
  const ansU = u27.slice(0, 2).map((l) => ({ ...l, lettrage: gu27 }));

  it('une facture, liquidations de l’ancien moteur · décembre 68 965,52 (versé), janvier 0 (versé), 91 034,48 en février', async () => {
    const s = base(() => [vendre('F1', '2026-12-10', groupeUne)], ansU, liqs);
    expect(await rendu(s, ['2026-12', '2027-01', '2027-02'])).toEqual({ '2026-12': 68_965.52, '2027-01': 0, '2027-02': 91_034.48 });
  });

  it('une facture, aucune liquidation · décembre 68 965,52, janvier 91 034,48', async () => {
    const s = base(() => [vendre('F1', '2026-12-10', groupeUne)], ansU);
    expect(await rendu(s, ['2026-12', '2027-01', '2027-02'])).toEqual({ '2026-12': 68_965.52, '2027-01': 91_034.48, '2027-02': 0 });
  });

  // BLOQUANT 2 · une facture réglée sur trois exercices. Le report de N+1,
  // reconnu, était sauté · son propre report de N+2 se recomptait comme une
  // seconde facture, et la taxe de 2027 et 2028 disparaissait.
  const c27 = [ran('anF1', 1_160_000, 0, 'Facture F1', 'AN27', 'ex2027', '2027-01-01'), ran('anR1', 0, 500_000, 'Règlement partiel', 'AN27', 'ex2027', '2027-01-01'), ligneN('R2', 0, 300_000, '2027-06-15', 'Acompte 2')];
  const gc27 = { id: 'G27', statut: 'PARTIEL', solde: 360_000, lignes: c27 };
  const c28 = [
    ran('an2F1', 1_160_000, 0, 'RAN détail 41110101 · Facture F1', 'AN28', 'ex2028', '2028-01-01'),
    ran('an2R1', 0, 500_000, 'RAN détail 41110101 · Règlement partiel', 'AN28', 'ex2028', '2028-01-01'),
    ran('an2R2', 0, 300_000, 'Acompte 2', 'AN28', 'ex2028', '2028-01-01'),
    ligneN('R3', 0, 360_000, '2028-01-20', 'Solde'),
  ];
  const gc28 = { id: 'G28', statut: 'SOLDE', solde: 0, lignes: c28 };
  const ansC27 = c27.slice(0, 2).map((l) => ({ ...l, lettrage: gc27 }));
  const ansC = [...ansC27, ...c28.slice(0, 3).map((l) => ({ ...l, lettrage: gc28 }))];

  it('chaîne N, N+1, N+2 · 68 965,52, 41 379,31, 49 655,17, soit 160 000, et rien n’est nommé', async () => {
    const s = base(() => [vendre('F1', '2026-12-10', { ...groupeUne, id: 'G26' })], ansC);
    expect(await rendu(s, ['2026-12', '2027-06', '2028-01'])).toEqual({ '2026-12': 68_965.52, '2027-06': 41_379.31, '2028-01': 49_655.17 });
    const janvier = await s.declaration('t1', ...mois('2028-01'));
    expect(janvier.groupesImputationIndeterminee).toEqual([]);
    expect(janvier.tvaEnAttenteEncaissement).toBe(0);
  });

  it('chaîne · juin 2027, non liquidé, ne change pas à la saisie de 2028', async () => {
    const avant = base(() => [vendre('F1', '2026-12-10', { ...groupeUne, id: 'G26' })], ansC27);
    const apres = base(() => [vendre('F1', '2026-12-10', { ...groupeUne, id: 'G26' })], ansC);
    expect((await avant.declaration('t1', ...mois('2027-06'))).totalCollecte).toBe(41_379.31);
    expect((await apres.declaration('t1', ...mois('2027-06'))).totalCollecte).toBe(41_379.31);
  });

  it('à-nouveau PROVISOIRE, premier exercice non clos · le solde du 15/01/2027 lettré avec lui rend 91 034,48 en janvier', async () => {
    // Troisième tour · la garde sur l'exercice clos ignorait l'à-nouveau
    // provisoire, qui se lettre ; janvier, déclaré avant la clôture de 2026,
    // rendait 0 sans un mot.
    const provisoire = (l: ReturnType<typeof ran>) => ({ ...l, ecriture: { ...l.ecriture, estANouveauProvisoire: true, estGenereeParCloture: false } });
    const p27 = [provisoire(u27[0] as ReturnType<typeof ran>), provisoire(u27[1] as ReturnType<typeof ran>), u27[2]];
    const g = { id: 'G27', statut: 'SOLDE', solde: 0, lignes: p27 };
    const ventes = () => [vendre('F1', '2026-12-10', groupeUne)];
    const p = prisma(ventes());
    (p.ligneEcriture.findMany as jest.Mock).mockImplementation(({ where }: { where: { compteId?: { in?: string[] } } }) =>
      Promise.resolve(where.compteId?.in ? p27.slice(0, 2).map((l) => ({ ...l, lettrage: g })) : ventes()),
    );
    // Aucun exercice clôturé · 2026 est ouvert, 2027 aussi.
    (p as unknown as { exercice: { count: jest.Mock } }).exercice.count.mockImplementation(({ where }: { where: { statut?: string } }) =>
      Promise.resolve(where.statut ? 0 : 2),
    );
    const s = new TauxTvaService(p, {} as EcritureService);
    expect(await rendu(s, ['2026-12', '2027-01'])).toEqual({ '2026-12': 68_965.52, '2027-01': 91_034.48 });
    const d = await s.declaration('t1', ...mois('2027-01'));
    expect(d.tvaEnAttenteEncaissement).toBe(0);
  });

  it('la taxe d’un encaissement se calcule sur le groupe, arrondie une fois · 1 000 000 sur deux factures rend 137 931,03', async () => {
    const g = { ...groupeDeux, id: 'GR', solde: 1_320_000, lignes: [groupeDeux.lignes[0], groupeDeux.lignes[1], ligneN('R1', 0, 1_000_000, '2026-12-20', 'Acompte')] };
    const s = base(() => [vendre('F1', '2026-12-10', g), vendre('F2', '2026-12-11', g)], []);
    expect((await s.declaration('t1', ...mois('2026-12'))).totalCollecte).toBe(137_931.03);
  });

  it('sans écriture d’à-nouveau dans le dossier, aucun report n’est lu', async () => {
    const p = prisma([vendre('F1', '2026-12-10', groupeUne)]);
    (p as unknown as { ecriture: { findFirst: jest.Mock } }).ecriture.findFirst.mockResolvedValue(null);
    await new TauxTvaService(p, {} as EcritureService).declaration('t1', ...mois('2026-12'));
    expect((p.ligneEcriture.findMany as jest.Mock).mock.calls.some((c) => c[0].where.compteId?.in)).toBe(false);
  });

  it('un groupe d’à-nouveau au-delà de sa borne de lecture · rien n’est relié, et la facture est NOMMÉE', async () => {
    const remplissage = Array.from({ length: 501 }, (_, i) => ligneN(`X${i}`, 1, 0, '2027-02-01', `Divers ${i}`));
    const gTrop = { id: 'G27', statut: 'PARTIEL', solde: 1, lignes: [...u27, ...remplissage] };
    const s = base(() => [vendre('F1', '2026-12-10', groupeUne)], u27.slice(0, 2).map((l) => ({ ...l, lettrage: gTrop })));
    const d = await s.declaration('t1', ...mois('2027-01'));
    expect(d.totalCollecte).toBe(0);
    expect(d.rapprochementsANouveauAbandonnes.map((a) => a.motif)).toEqual(['groupe de lettrage de plus de 500 lignes, rapprochement non fait']);
  });
});

/**
 * DÉCISION PAR LA LOI DU 2026-10-07, POINT 4 · L'IMPUTATION DES PAIEMENTS
 * (Code civil, Livre III, art. 151 à 154) DATE LA TAXE D'UN GROUPE DE
 * COMPOSITION DIFFÉRENTE. Jeu · S, prestation de 1 160 000 TTC (TVA 160 000)
 * du 10 janvier 2026 ; X, facture sans taxe de 1 000 000 du 20 janvier ; un
 * paiement de 1 160 000 le 15 février. L'imputation légale (art. 154) paie S,
 * la plus ancienne · 160 000 exigibles en février. La règle de `main` (fraction
 * cumulée du groupe) rendait (1 160 000 - 1 000 000) / 1 160 000 × 160 000 =
 * 22 068,97, et le reste attendait le solde du groupe.
 */
describe('point 4 · l’imputation des paiements date la taxe d’un groupe de composition différente', () => {
  const groupeSX = (lignes: LigneGroupe[], statut: 'PARTIEL' | 'SOLDE' = 'PARTIEL', solde = 1_000_000) => ({ id: 'GSX', statut, solde, lignes });
  const sansEcheance: LigneGroupe[] = [
    { debit: 1_160_000, credit: 0, date: '2026-01-10', ecriture: 'S' },
    { debit: 1_000_000, credit: 0, date: '2026-01-20', ecriture: 'X' },
    { debit: 0, credit: 1_160_000, date: '2026-02-15', ecriture: 'R' },
  ];
  const lignesS = (lignes: LigneGroupe[], statut?: 'PARTIEL' | 'SOLDE', solde?: number) => [
    vente({ id: 'S', date: '2026-01-10', tva: 160_000, ttc: 1_160_000, produit: '70610000', groupe: groupeSX(lignes, statut, solde) }),
  ];

  it('S, la plus ancienne, est payée la première · février 160 000 (main rendait 22 068,97)', async () => {
    const s = new TauxTvaService(prisma(lignesS(sansEcheance)), {} as EcritureService);
    const fevrier = await s.declaration('t1', ...mois('2026-02'));
    expect(fevrier.totalCollecte).toBe(160_000);
    expect(fevrier.imputationsDesPaiements).toEqual([{ factures: ['Facture S', 'Facture X'], encaisse: 1_160_000, fondement: 'LEGALE' }]);
    expect(fevrier.groupesImputationIndeterminee).toEqual([]);
    expect((await s.declaration('t1', ...mois('2026-01'))).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
  });

  it('l’échue avant la non échue · S à échéance du 30 juin, X échue · le paiement va d’abord à X, S reçoit 160 000 · 22 068,97', async () => {
    const lignes: LigneGroupe[] = [
      { debit: 1_160_000, credit: 0, date: '2026-01-10', ecriture: 'S', echeance: '2026-06-30' },
      { debit: 1_000_000, credit: 0, date: '2026-01-20', ecriture: 'X', echeance: '2026-01-20' },
      { debit: 0, credit: 1_160_000, date: '2026-02-15', ecriture: 'R' },
    ];
    const s = new TauxTvaService(prisma(lignesS(lignes)), {} as EcritureService);
    // 160 000 × 160 000 / 1 160 000 = 22 068,97.
    expect((await s.declaration('t1', ...mois('2026-02'))).totalCollecte).toBe(22_068.97);
  });

  it('février liquidé par l’ancien moteur (22 068,97 versés) reste ce qu’il a déclaré · l’écart, 137 931,03, au 1er mars', async () => {
    const [debut, fin] = mois('2026-02');
    const liq = [{ id: 'liqF', dateDebut: debut, dateFin: fin, createdAt: jour('2026-03-02'), tvaEncaissementFigee: null }];
    const s = new TauxTvaService(prisma(lignesS(sansEcheance), liq), {} as EcritureService);
    expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(22_068.97);
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(137_931.03);
    expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(0);
  });

  it('février liquidé et FIGÉ à 22 068,97 · même report au premier jour non liquidé, rien deux fois', async () => {
    const [debut, fin] = mois('2026-02');
    const liq = [{ id: 'liqF', dateDebut: debut, dateFin: fin, createdAt: jour('2026-03-02'), tvaEncaissementFigee: { S: 22_068.97 } }];
    const s = new TauxTvaService(prisma(lignesS(sansEcheance), liq), {} as EcritureService);
    expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(22_068.97);
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(137_931.03);
  });

  it('le solde du groupe paie X ensuite · rien de plus pour S (déjà payée)', async () => {
    const lignes: LigneGroupe[] = [...sansEcheance, { debit: 0, credit: 1_000_000, date: '2026-03-20', ecriture: 'R2' }];
    const s = new TauxTvaService(prisma(lignesS(lignes, 'SOLDE', 0)), {} as EcritureService);
    expect((await s.declaration('t1', ...mois('2026-02'))).totalCollecte).toBe(160_000);
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
  });

  it('un avoir dans le groupe garde la fraction cumulée, et le groupe est NOMMÉ pour ce motif', async () => {
    const lignes: LigneGroupe[] = [...sansEcheance, { debit: 0, credit: 100_000, date: '2026-02-20', ecriture: 'AV', avoir: true }];
    const s = new TauxTvaService(prisma(lignesS(lignes, 'PARTIEL', 900_000)), {} as EcritureService);
    const d = await s.declaration('t1', ...mois('2026-02'));
    expect(d.imputationsDesPaiements).toEqual([]);
    expect(d.groupesImputationIndeterminee).toEqual([{ factures: ['Facture S'], encaisse: 1_260_000, motif: 'un avoir dans le groupe' }]);
    expect(d.mentionExigibilite).toContain('GROUPE DE LETTRAGE LU EN BLOC');
  });

  /*
    L'IMPUTATION DÉCLARÉE PRIME (art. 151 et 153) · les lignes du groupe sont
    `g-S-0` (S), `g-X-1` (X) et `g-R-2` (le paiement R).
  */
  it('le débiteur déclare payer X d’abord (1 000 000), S ne reçoit que 160 000 · 22 068,97, fondement DÉCLARÉ', async () => {
    const declarees: Declaree[] = [
      { ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_000_000 },
      { ligneReglementId: 'g-R-2', ligneFactureId: 'g-S-0', montant: 160_000 },
    ];
    const s = new TauxTvaService(prisma(lignesS(sansEcheance), [], [], declarees), {} as EcritureService);
    const fevrier = await s.declaration('t1', ...mois('2026-02'));
    expect(fevrier.totalCollecte).toBe(22_068.97);
    expect(fevrier.imputationsDesPaiements).toEqual([{ factures: ['Facture S', 'Facture X'], encaisse: 1_160_000, fondement: 'DECLAREE' }]);
  });

  it('une déclaration EN PARTIE · 500 000 déclarés sur X, le reste suit l’art. 154 et paie S (660 000) · 91 034,48', async () => {
    const declarees: Declaree[] = [{ ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 500_000 }];
    const s = new TauxTvaService(prisma(lignesS(sansEcheance), [], [], declarees), {} as EcritureService);
    const fevrier = await s.declaration('t1', ...mois('2026-02'));
    // 660 000 × 160 000 / 1 160 000 = 91 034,48.
    expect(fevrier.totalCollecte).toBe(91_034.48);
    expect(fevrier.imputationsDesPaiements[0].fondement).toBe('DECLAREE_EN_PARTIE');
  });

  it('une part déclarée au-delà du reste de la facture est DITE à part (avertissement), jamais mêlée à l’imputation', async () => {
    // 1 160 000 déclarés sur X, qui n'engage que 1 000 000 · 160 000 non retenus, imputés par l'art. 154 sur S.
    const declarees: Declaree[] = [{ ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_160_000 }];
    const s = new TauxTvaService(prisma(lignesS(sansEcheance), [], [], declarees), {} as EcritureService);
    const fevrier = await s.declaration('t1', ...mois('2026-02'));
    expect(fevrier.imputationsDesPaiements[0].declareNonRetenu).toBe(160_000);
    expect(fevrier.mentionExigibilite).toContain('IMPUTATION DÉCLARÉE NON RETENUE · factures « Facture S », « Facture X », 160');
    // La phrase de l'imputation ne porte plus que factures, sommes et fondement.
    const imputation = fevrier.mentionExigibilite.slice(fevrier.mentionExigibilite.indexOf('IMPUTATION DES PAIEMENTS'));
    expect(imputation.slice(0, imputation.indexOf('Lectures d’OmegaX'))).not.toContain('non retenu');
  });

  it('une déclaration RETIRÉE ou d’un autre dossier ne compte pas · l’imputation légale revient, 160 000', async () => {
    const declarees: Declaree[] = [
      { ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_000_000, retireeLe: jour('2026-03-01') },
      { ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_000_000, tenantId: 'autre' },
    ];
    const p = prisma(lignesS(sansEcheance), [], [], declarees);
    const fevrier = await new TauxTvaService(p, {} as EcritureService).declaration('t1', ...mois('2026-02'));
    expect(fevrier.totalCollecte).toBe(160_000);
    expect(fevrier.imputationsDesPaiements[0].fondement).toBe('LEGALE');
    // La lecture est bornée au dossier, aux déclarations actives et aux lignes du groupe.
    const appel = (p as unknown as { imputationPaiement: { findMany: jest.Mock } }).imputationPaiement.findMany.mock.calls[0][0];
    expect(appel.where).toEqual({ tenantId: 't1', retireeLe: null, ligneReglementId: { in: ['g-S-0', 'g-X-1', 'g-R-2'] } });
  });

  it('février liquidé (figé à 160 000) puis déclaration posée en mars · le mois liquidé reste, le trop-déclaré absorbe la suite', async () => {
    const [debut, fin] = mois('2026-02');
    const liq = [{ id: 'liqF', dateDebut: debut, dateFin: fin, createdAt: jour('2026-03-02'), tvaEncaissementFigee: { S: 160_000 } }];
    const declarees: Declaree[] = [
      { ligneReglementId: 'g-R-2', ligneFactureId: 'g-X-1', montant: 1_000_000 },
      { ligneReglementId: 'g-R-2', ligneFactureId: 'g-S-0', montant: 160_000 },
    ];
    const s = new TauxTvaService(prisma(lignesS(sansEcheance), liq, [], declarees), {} as EcritureService);
    expect((await s.declaration('t1', debut, fin)).totalCollecte).toBe(160_000);
    // Un mois liquidé garde ce qu'il a déclaré · rien n'est déclaré deux fois,
    // et le trop-déclaré absorbe ce que la suite rendrait.
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
  });

  /*
    M1 (relecture du 2026-10-07) · UNE INSCRIPTION EN NÉGATIF ANNULE SA LIGNE
    (AUDCIF art. 20, al. 2). S (prestation, 10 janvier) et X (sans taxe,
    20 janvier) ; P1 de 500 000 le 15 février, ANNULÉ le 10 mars par
    inscription en négatif (crédit de -500 000, pièce corrigée P1) ; P2 de
    500 000 le 15 avril. Février · rien (P1 annulé) ; avril · S, la plus
    ancienne, reçoit P2 · 500 000 × 160 000 / 1 160 000 = 68 965,52. Classée
    par son sens, l'annulation passait pour une facture et la taxe se datait
    en février.
  */
  it('M1 · un paiement annulé par inscription en négatif ne date rien · février 0, avril 68 965,52', async () => {
    const lignes: LigneGroupe[] = [
      { debit: 1_160_000, credit: 0, date: '2026-01-10', ecriture: 'S' },
      { debit: 1_000_000, credit: 0, date: '2026-01-20', ecriture: 'X' },
      { debit: 0, credit: 500_000, date: '2026-02-15', ecriture: 'P1' },
      { debit: 0, credit: -500_000, date: '2026-03-10', ecriture: 'N1', corrige: 'P1' },
      { debit: 0, credit: 500_000, date: '2026-04-15', ecriture: 'P2' },
    ];
    const s = new TauxTvaService(prisma(lignesS(lignes, 'PARTIEL', 1_660_000)), {} as EcritureService);
    expect((await s.declaration('t1', ...mois('2026-02'))).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2026-03'))).totalCollecte).toBe(0);
    expect((await s.declaration('t1', ...mois('2026-04'))).totalCollecte).toBe(68_965.52);
  });

  it('M1 · une inscription en négatif sans la ligne qu’elle annule · le groupe se lit en bloc, NOMMÉ', async () => {
    const lignes: LigneGroupe[] = [
      ...sansEcheance,
      { debit: 0, credit: -300_000, date: '2026-02-20', ecriture: 'N9', corrige: 'Z' },
    ];
    const s = new TauxTvaService(prisma(lignesS(lignes, 'PARTIEL', 1_300_000)), {} as EcritureService);
    const d = await s.declaration('t1', ...mois('2026-02'));
    expect(d.groupesImputationIndeterminee.map((g) => g.motif)).toEqual(['une inscription en négatif dans le groupe sans la ligne qu’elle annule']);
  });

  it('M1 · neutraliserLesNegatifs · la liaison d’abord, sinon le même compte au montant opposé ; la facture annulée sort aussi', () => {
    const l = (id: string, debit: number, credit: number, corrige: string | null = null) => ({ compteId: 'c', debit, credit, ecriture: { id, corrigeEcritureId: corrige } });
    const a = l('A', 0, 100);
    const b = l('B', 0, 100);
    const n = l('N', 0, -100, 'B');
    expect(TauxTvaService.neutraliserLesNegatifs([a, b, n])).toEqual([a]);
    const f = l('F', 500, 0);
    const nf = l('NF', -500, 0);
    expect(TauxTvaService.neutraliserLesNegatifs([f, nf, a])).toEqual([a]);
    expect(TauxTvaService.neutraliserLesNegatifs([a, l('N2', 0, -50)])).toBeNull();
  });
});

