import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { Referentiel, TypeRelance } from '@prisma/client';
import { ecartsDesGroupesParEcheance, poidsDesLignesLues, poidsDesLignesOuvertes, type LigneOuverte } from './reste-des-lignes-ouvertes';
import { EcritureService } from '../comptabilite/ecriture.service';
import { NoteAnnexeService } from '../notes-annexes/note-annexe.service';
import { RelancesService } from '../relances/relances.service';
import { LOT_LECTURE } from '../../common/lecture-par-lots';
import type { PrismaService } from '../../common/prisma.service';
import type { CourrierService } from '../courrier/courrier.service';

/**
 * UNE FACTURE RÉGLÉE EN PARTIE PÈSE SON RESTE (simulation du logiciel complet
 * du 2026-10-08, lot M, et ses deux relectures). La SARL C1 doit 3 480 000
 * (facture de septembre, échéance au 05/10/2026), en a payé 1 000 000 en
 * octobre, les deux lignes lettrées en partiel · la NOTE 7 rendait 9 280 000
 * « à un an au plus » pour un solde de 8 280 000, la balance âgée 3 480 000 en
 * septembre et − 1 000 000 en octobre, l'avis préventif réclamait 3 480 000.
 * Attendu · 2 480 000 à l'échéance de la facture, rien ailleurs.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const ligne = (
  id: string,
  debit: number,
  credit: number,
  date: string,
  lettrageId: string | null,
  echeance: string | null = null,
  devise: { deviseId: string; montantDevise: number } | null = null,
): LigneOuverte => ({
  id,
  debit,
  credit,
  lettrageId,
  dateEcheance: echeance ? d(echeance) : null,
  deviseId: devise?.deviseId ?? null,
  montantDevise: devise?.montantDevise ?? null,
  ecriture: { date: d(date) },
});

describe('poids des lignes ouvertes · la règle', () => {
  it('une créance réglée en partie pèse son reste, le règlement plus rien', () => {
    const { poids } = poidsDesLignesOuvertes([
      ligne('f', 3_480_000, 0, '2026-09-05', 'g', '2026-10-05'),
      ligne('r', 0, 1_000_000, '2026-10-10', 'g'),
    ]);
    expect(poids.get('f')).toBe(2_480_000);
    expect(poids.get('r')).toBe(0);
  });

  it('une dette réglée en partie garde son sens créditeur', () => {
    const { poids } = poidsDesLignesOuvertes([
      ligne('f', 0, 2_320_000, '2026-09-05', 'g', '2026-10-05'),
      ligne('r', 500_000, 0, '2026-09-20', 'g'),
    ]);
    expect(poids.get('f')).toBe(-1_820_000);
    expect(poids.get('r')).toBe(0);
  });

  it('plusieurs factures · le règlement éteint la plus ancienne d’abord', () => {
    const { poids } = poidsDesLignesOuvertes([
      ligne('b', 2_000_000, 0, '2026-03-01', 'g', '2026-04-01'),
      ligne('a', 1_000_000, 0, '2026-01-10', 'g', '2026-02-10'),
      ligne('r', 0, 1_500_000, '2026-05-01', 'g'),
    ]);
    expect(poids.get('a')).toBe(0);
    expect(poids.get('b')).toBe(1_500_000);
    expect(poids.get('r')).toBe(0);
  });

  it('l’ordre est celui de la LOI · la facture échue avant la plus ancienne non échue (art. 154 ; second tour, M1)', () => {
    // F1 de janvier n'échoit qu'en décembre, F2 de mars en mars · le
    // règlement d'avril éteint F2, échue, et F1 reste due en entier.
    const { poids } = poidsDesLignesOuvertes([
      ligne('f1', 1_000_000, 0, '2026-01-15', 'g', '2026-12-15'),
      ligne('f2', 2_000_000, 0, '2026-03-01', 'g', '2026-03-31'),
      ligne('r', 0, 1_000_000, '2026-04-10', 'g'),
    ]);
    expect(poids.get('f1')).toBe(1_000_000);
    expect(poids.get('f2')).toBe(1_000_000);
    expect(poids.get('r')).toBe(0);
  });

  it('la part DÉCLARÉE d’un paiement prime l’ordre légal (art. 151 et 153 · le client C2 de la simulation)', () => {
    const lignes = [
      ligne('fp001', 1_160_000, 0, '2026-05-05', 'g'),
      ligne('fv004', 672_800, 0, '2026-05-06', 'g'),
      ligne('paie', 0, 1_160_000, '2026-05-20', 'g'),
    ];
    // Sans déclaration · la plus ancienne d'abord, FV-004 reste due.
    expect(poidsDesLignesOuvertes(lignes).poids.get('fv004')).toBe(672_800);
    // La quittance acceptée impute 672 800 sur FV-004 et 487 200 sur FP-001 ·
    // FP-001 reste due pour 672 800, FV-004 est soldée.
    const declarations = new Map([['paie', [{ ligneFactureId: 'fv004', montant: 672_800 }, { ligneFactureId: 'fp001', montant: 487_200 }]]]);
    const { poids, nonRepartis } = poidsDesLignesOuvertes(lignes, new Map(), new Set(), declarations);
    expect(nonRepartis).toEqual([]);
    expect(poids.get('fp001')).toBe(672_800);
    expect(poids.get('fv004')).toBe(0);
    expect(poids.get('paie')).toBe(0);
  });

  it('une part déclarée au-delà de ce que la facture doit ne se répartit pas, et le groupe est nommé', () => {
    const { nonRepartis } = poidsDesLignesOuvertes(
      [ligne('f', 500_000, 0, '2026-05-05', 'g'), ligne('p', 0, 300_000, '2026-05-20', 'g')],
      new Map(),
      new Set(),
      new Map([['p', [{ ligneFactureId: 'f', montant: 600_000 }]]]),
    );
    expect(nonRepartis).toEqual(['g']);
  });

  it('un négatif qui a deux origines possibles ne devine pas la sienne (second tour, m1)', () => {
    const { nonRepartis } = poidsDesLignesOuvertes([
      ligne('fjan', 1_000_000, 0, '2026-01-05', 'g'),
      ligne('fmar', 1_000_000, 0, '2026-03-05', 'g'),
      ligne('fneg', -1_000_000, 0, '2026-03-20', 'g'),
      ligne('r', 0, 500_000, '2026-04-01', 'g'),
    ]);
    expect(nonRepartis).toEqual(['g']);
  });

  it('un groupe RECONDUIT se lit à la pièce d’origine de ses à-nouveaux, jamais à leur identifiant (relecture TypeScript, bloquant 1)', () => {
    // Les deux à-nouveaux sont datés du 1er janvier, et l'identifiant de F2
    // se trie AVANT celui de F1 · sans l'origine, F2 serait éteinte d'abord.
    const lignes = [
      ligne('an-0001', 2_000_000, 0, '2027-01-01', 'g', '2029-06-30'), // F2, origine mars 2026
      ligne('an-0002', 1_000_000, 0, '2027-01-01', 'g', '2026-02-10'), // F1, origine janvier 2026
      ligne('reg', 0, 1_500_000, '2027-02-01', 'g'),
    ];
    const origines = new Map([
      ['an-0001', { date: d('2026-03-01'), id: 'f2-2026' }],
      ['an-0002', { date: d('2026-01-10'), id: 'f1-2026' }],
    ]);
    const { poids } = poidsDesLignesOuvertes(lignes, origines);
    expect(poids.get('an-0002')).toBe(0);
    expect(poids.get('an-0001')).toBe(1_500_000);
  });

  it('une facture annulée par son négatif s’éteint avec lui, jamais sur la plus ancienne (relecture, mineur 4)', () => {
    const { poids, nonRepartis } = poidsDesLignesOuvertes([
      ligne('f0', 1_000_000, 0, '2026-01-05', 'g', '2026-02-05'),
      ligne('f', 2_000_000, 0, '2026-03-01', 'g', '2029-03-01'),
      ligne('fneg', -2_000_000, 0, '2026-03-20', 'g', '2029-03-01'),
      ligne('r', 0, 300_000, '2026-04-01', 'g'),
    ]);
    expect(nonRepartis).toEqual([]);
    expect(poids.get('f')).toBe(0);
    expect(poids.get('fneg')).toBe(0);
    expect(poids.get('f0')).toBe(700_000);
    expect(poids.get('r')).toBe(0);
  });

  it('un négatif sans son origine garde la lecture ligne à ligne, et le groupe est nommé', () => {
    const { poids, nonRepartis } = poidsDesLignesOuvertes([
      ligne('f', 1_000_000, 0, '2026-01-05', 'g', '2026-02-05'),
      ligne('rneg', 0, -400_000, '2026-02-01', 'g'),
    ]);
    expect(nonRepartis).toEqual(['g']);
    expect(poids.size).toBe(0);
  });

  it('un reste négatif d’une facture en devise garde la lecture ligne à ligne (relecture, mineur 3)', () => {
    const usd = (montantDevise: number) => ({ deviseId: 'usd', montantDevise });
    const { poids, nonRepartis } = poidsDesLignesOuvertes([
      ligne('f1', 100_000, 0, '2026-01-05', 'g', '2026-02-05', usd(100)),
      ligne('f2', 100_000, 0, '2026-02-05', 'g', '2026-03-05', usd(100)),
      ligne('f3', 1_000_000, 0, '2026-03-05', 'g', '2029-03-05'),
      ligne('r', 0, 400_000, '2026-04-01', 'g', null, usd(150)),
    ]);
    expect(nonRepartis).toEqual(['g']);
    expect(poids.size).toBe(0);
  });

  it('une ligne hors groupe, ou seule de son groupe, se lit à son montant · elle n’est pas dans la table', () => {
    const { poids } = poidsDesLignesOuvertes([ligne('x', 700, 0, '2026-01-01', null), ligne('y', 0, 300, '2026-01-02', 'seul')]);
    expect(poids.size).toBe(0);
  });

  it('un groupe dont les lignes reçues se compensent ne pèse rien', () => {
    const { poids } = poidsDesLignesOuvertes([ligne('f', 900, 0, '2026-01-01', 'g'), ligne('r', 0, 900, '2026-02-01', 'g')]);
    expect(poids.get('f')).toBe(0);
    expect(poids.get('r')).toBe(0);
  });
});

/** Une ligne de la base de la doublure · son exercice, son compte, son libellé, et si elle est un report. */
type LigneDeBase = LigneOuverte & {
  statut?: string;
  compteId?: string;
  libelle?: string | null;
  exerciceId?: string;
  aNouveau?: boolean;
  lettre?: string | null;
};

/**
 * La doublure honore la requête · `groupBy` compte les lignes du groupe
 * admises par la borne (date, statut), `lettrage.findMany` rend les groupes
 * reconduits demandés (aucun ici), `ligneEcriture.findMany` rend les lignes
 * demandées par identifiant et d'à-nouveau (`ECRITURE_D_A_NOUVEAU`), ou les
 * lignes non lettrées d'un exercice et de ses comptes (la clé du report),
 * `exercice.findFirst` le plus récent qui finit avant la borne.
 */
function lecteur(base: LigneDeBase[], exercices: Array<{ id: string; dateDebut: Date; dateFin: Date }> = []) {
  const vue = (l: LigneDeBase) => ({
    id: l.id,
    compteId: l.compteId ?? 'c411',
    debit: l.debit,
    credit: l.credit,
    libelle: l.libelle ?? null,
    dateEcheance: l.dateEcheance,
    lettrageId: l.lettrageId,
    compte: { numero: '41110001' },
    ecriture: {
      date: l.ecriture.date,
      libelle: 'Pièce sans libellé de ligne',
      estANouveauProvisoire: false,
      estGenereeParCloture: l.aNouveau === true,
      estSoldeDesComptesDeGestion: false,
    },
  });
  type Requete = {
    where: { id?: { in: string[] }; ecriture?: { exerciceId?: string; OR?: unknown }; compteId?: { in: string[] }; lettre?: null };
    cursor?: unknown;
  };
  return {
    exercice: {
      findFirst: jest.fn(
        async (a: { where: { dateFin: { lt: Date } } }) =>
          exercices.filter((e) => e.dateFin < a.where.dateFin.lt).sort((x, y) => y.dateFin.getTime() - x.dateFin.getTime())[0] ?? null,
      ),
    },
    ligneEcriture: {
      findMany: jest.fn(async (a: Requete) => {
        if (a.cursor) return [];
        const w = a.where;
        return base
          .filter(
            (l) =>
              (!w.id || w.id.in.includes(l.id)) &&
              (!w.ecriture?.OR || l.aNouveau === true) &&
              (!w.ecriture?.exerciceId || l.exerciceId === w.ecriture.exerciceId) &&
              (!w.compteId || w.compteId.in.includes(l.compteId ?? 'c411')) &&
              (!('lettre' in w) || (l.lettre ?? null) === null),
          )
          .map(vue);
      }),
      groupBy: jest.fn(async (a: { where: { lettrageId?: { in: string[] }; ecriture?: { date?: { lte: Date }; statut?: string } } }) => {
        const ids = a.where.lettrageId?.in ?? [];
        return ids.map((id) => ({
          lettrageId: id,
          _count: {
            _all: base.filter(
              (l) =>
                l.lettrageId === id &&
                (!a.where.ecriture?.date || l.ecriture.date <= a.where.ecriture.date.lte) &&
                (!a.where.ecriture?.statut || (l.statut ?? 'VALIDEE') === a.where.ecriture.statut),
            ).length,
          },
        }));
      }),
    },
    lettrage: { findMany: jest.fn(async () => []) },
    imputationPaiement: { findMany: jest.fn(async () => []) },
  };
}

describe('poids des lignes ouvertes · un groupe se répartit s’il est lu en entier', () => {
  it('un groupe à cheval sur l’exercice précédent garde la lecture ligne à ligne (relecture, majeur 1)', async () => {
    // F0 de décembre N-1, F2 et R de N, lettrés ensemble · lues dans N, F2 et
    // R seules · R n'est jamais prise pour la facture.
    const base = [
      ligne('f0', 0, 1_000_000, '2025-12-10', 'g', '2026-01-10'),
      ligne('f2', 0, 500_000, '2026-01-15', 'g', '2029-03-15'),
      ligne('r', 800_000, 0, '2026-02-10', 'g'),
    ];
    const lues = base.filter((l) => l.ecriture.date >= d('2026-01-01'));
    const p = await poidsDesLignesLues(lecteur(base), 't', lues, { dateMax: d('2026-12-31') }, 'essai');
    expect(p.poids.size).toBe(0);
    expect(p.nonRepartis).toEqual([]);
  });

  it('un règlement postérieur à la date d’arrêté ne retire pas le groupe · il n’est pas dans la borne', async () => {
    const base = [
      ligne('f', 3_480_000, 0, '2026-09-05', 'g', '2026-10-05'),
      ligne('r', 0, 1_000_000, '2026-10-10', 'g'),
      ligne('r2', 0, 2_480_000, '2027-02-01', 'g'),
    ];
    const lues = base.filter((l) => l.ecriture.date <= d('2026-12-31'));
    const p = await poidsDesLignesLues(lecteur(base), 't', lues, { dateMax: d('2026-12-31') }, 'essai');
    expect(p.poids.get('f')).toBe(2_480_000);
  });
});

/**
 * PAQUET 1, B7 · UN GROUPE D'À-NOUVEAUX LETTRÉ À LA MAIN S'IMPUTE PAR LA LOI.
 * Rejoué sur vraie base (scénario paquet1-b, B7) · deux factures de 2026
 * reportées au détail en 2027, lettrées à la main avec un règlement de 2027
 * (aucun groupe de 2026 reconduit) · `main` les éteignait au PRORATA, leurs
 * à-nouveaux portant la même date du 1er janvier ; la loi éteint la plus
 * ANCIENNE d'abord (Code civil, Livre III, art. 154).
 */
describe('poids des lignes ouvertes · les à-nouveaux d’un groupe posé à la main (paquet 1, B7)', () => {
  const exercices = [
    { id: 'e2026', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') },
    { id: 'e2027', dateDebut: d('2027-01-01'), dateFin: d('2027-12-31') },
  ];
  const de2026 = (id: string, debit: number, date: string, echeance: string, libelle: string): LigneDeBase => ({
    ...ligne(id, debit, 0, date, null, echeance),
    exerciceId: 'e2026',
    libelle,
  });
  const report = (id: string, debit: number, echeance: string, libelle: string, lettrageId = 'g'): LigneDeBase => ({
    ...ligne(id, debit, 0, '2027-01-01', lettrageId, echeance),
    exerciceId: 'e2027',
    libelle: `RAN détail 41110001 · ${libelle}`,
    aNouveau: true,
  });
  const reglement = (id: string, credit: number, date: string, lettrageId = 'g'): LigneDeBase => ({
    ...ligne(id, 0, credit, date, lettrageId),
    exerciceId: 'e2027',
    libelle: 'Règlement',
  });
  const lire = (base: LigneDeBase[]) =>
    poidsDesLignesLues(lecteur(base, exercices), 't', base.filter((l) => l.exerciceId === 'e2027'), { dateMax: d('2027-12-31') }, 'essai');

  afterEach(() => jest.restoreAllMocks());

  it('la facture la plus ancienne est éteinte la première, jamais au prorata', async () => {
    // L'identifiant du report de F2 se trie AVANT celui de F1.
    const base = [
      de2026('f1', 1_000_000, '2026-03-01', '2026-03-31', 'Facture FV-B7-1'),
      de2026('f2', 1_000_000, '2026-09-01', '2026-09-30', 'Facture FV-B7-2'),
      report('an-a', 1_000_000, '2026-09-30', 'Facture FV-B7-2'),
      report('an-b', 1_000_000, '2026-03-31', 'Facture FV-B7-1'),
      reglement('reg', 1_000_000, '2027-02-15'),
    ];
    const p = await lire(base);
    expect(p.poids.get('an-b')).toBe(0);
    expect(p.poids.get('an-a')).toBe(1_000_000);
    expect(p.poids.get('reg')).toBe(0);
    expect(p.nonRepartis).toEqual([]);
  });

  it('même montant, même libellé · l’échéance que le report recopie distingue les deux factures', async () => {
    // Sans l'échéance dans la clé, les reports (triés par identifiant) et les
    // origines (triées par date) s'échangeaient · le report d'août prenait la
    // date de février, et la facture de février restait due.
    const base = [
      de2026('fev', 600_000, '2026-02-01', '2026-02-28', 'Vente marchandises'),
      de2026('aou', 600_000, '2026-08-01', '2026-08-31', 'Vente marchandises'),
      report('an-a', 600_000, '2026-08-31', 'Vente marchandises'),
      report('an-b', 600_000, '2026-02-28', 'Vente marchandises'),
      reglement('reg', 600_000, '2027-02-20'),
    ];
    const p = await lire(base);
    expect(p.poids.get('an-b')).toBe(0);
    expect(p.poids.get('an-a')).toBe(600_000);
  });

  it('tout ou rien · une origine non retrouvée laisse le groupe à la date du report, et il est consigné', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const base = [
      de2026('f1', 1_000_000, '2026-03-01', '2026-03-31', 'Facture FV-B7-1'),
      report('an-b', 1_000_000, '2026-03-31', 'Facture FV-B7-1'),
      report('an-c', 1_000_000, '2026-06-30', 'Facture inconnue'),
      reglement('reg', 1_000_000, '2027-02-15'),
    ];
    const p = await lire(base);
    // F1 seule datée de mars passerait pour la plus ancienne · rien n'est deviné.
    expect(p.poids.get('an-b')).toBe(500_000);
    expect(p.poids.get('an-c')).toBe(500_000);
    expect(warn.mock.calls.some(([m]) => String(m).includes('pièce d\'origine') && String(m).includes('g'))).toBe(true);
  });

  it('une seule facture dans le groupe · rien à départager, rien de consigné', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const base = [report('an-c', 1_000_000, '2026-06-30', 'Facture inconnue'), reglement('reg', 400_000, '2027-02-15')];
    const p = await lire(base);
    expect(p.poids.get('an-c')).toBe(600_000);
    expect(warn).not.toHaveBeenCalled();
  });

  it('une lecture qui rend plus que demandé n’invente aucun report', async () => {
    // La doublure rend toutes les lignes, quel que soit le filtre · seules les
    // lignes demandées ET d'à-nouveau sont prises pour des reports.
    const base = [
      de2026('f1', 1_000_000, '2026-03-01', '2026-03-31', 'Facture FV-B7-1'),
      de2026('f2', 1_000_000, '2026-09-01', '2026-09-30', 'Facture FV-B7-2'),
      report('an-a', 1_000_000, '2026-09-30', 'Facture FV-B7-2'),
      report('an-b', 1_000_000, '2026-03-31', 'Facture FV-B7-1'),
      reglement('reg', 1_000_000, '2027-02-15'),
    ];
    const l = lecteur(base, exercices);
    const touteLaBase = base.map((x) => ({
      ...x,
      compteId: 'c411',
      compte: { numero: '41110001' },
      ecriture: { ...x.ecriture, estGenereeParCloture: x.aNouveau === true },
    }));
    const parId = l.ligneEcriture.findMany;
    l.ligneEcriture.findMany = jest.fn(async (a: Parameters<typeof parId>[0]) => (a.where.id ? touteLaBase : parId(a))) as never;
    const p = await poidsDesLignesLues(l, 't', base.filter((x) => x.exerciceId === 'e2027'), { dateMax: d('2027-12-31') }, 'essai');
    expect(p.poids.get('an-b')).toBe(0);
    expect(p.poids.get('an-a')).toBe(1_000_000);
  });
});

describe('poids des lignes ouvertes · la balance âgée', () => {
  /**
   * L'association U1 doit 2 000 000 reportés de 2025 (à-nouveau sans
   * échéance), et en a payé 800 000 en mars 2026, lettrés en partiel avec le
   * report · 1 200 000 « avant le 01/01/2026 », rien en mars.
   */
  it('le reste d’un report réglé en partie reste antérieur à l’exercice', async () => {
    const compte = { id: 'c411', numero: '41110001', intitule: 'U1' };
    const lignes = [
      {
        ...ligne('ran', 2_000_000, 0, '2026-01-01', 'g'),
        compte,
        ecriture: { date: d('2026-01-01'), estGenereeParCloture: true, estSoldeDesComptesDeGestion: false },
      },
      {
        ...ligne('reg', 0, 800_000, '2026-03-15', 'g'),
        compte,
        ecriture: { date: d('2026-03-15'), estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
      },
    ];
    const prisma = {
      ...lecteur(lignes),
      exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }) },
      ligneEcriture: { ...lecteur(lignes).ligneEcriture, findMany: jest.fn().mockResolvedValue(lignes) },
      tiersCompte: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const r = await new EcritureService(prisma, {} as never, {} as never, {} as never).balanceAgee('t', {
      exerciceId: 'ex',
      dateReference: '2026-05-31',
      type: 'CLIENTS_41',
    });
    expect(r.debiteurs).toHaveLength(1);
    expect(r.debiteurs[0].solde).toBe(1_200_000);
    expect(r.debiteurs[0].montants[0]).toBe(1_200_000);
    expect(r.debiteurs[0].montants.slice(1).every((m) => m === 0)).toBe(true);
  });
});

describe('poids des lignes ouvertes · les notes par échéance', () => {
  /**
   * La facture et son règlement tombent dans DEUX LOTS (la doublure honore
   * l'ordre, le curseur et la taille) · une version qui calculerait le poids
   * lot par lot laisserait la facture entière dans sa colonne.
   */
  it('la colonne « à un an au plus » vaut le solde, à travers deux lots', async () => {
    const remplissage = Array.from({ length: LOT_LECTURE }, (_, i) => ({
      ...ligne(`m${String(i).padStart(6, '0')}`, 1, 0, '2026-11-01', null, '2026-12-01'),
      compte: { numero: '41110001' },
    }));
    const lignes = [
      { ...ligne('a-facture', 3_480_000, 0, '2026-09-05', 'g', '2026-10-05'), compte: { numero: '41110001' } },
      ...remplissage,
      { ...ligne('z-reglement', 0, 1_000_000, '2026-10-10', 'g'), compte: { numero: '41110001' } },
    ].sort((x, y) => x.id.localeCompare(y.id));
    const findMany = jest.fn(async (a: { take: number; cursor?: { id: string }; skip?: number }) => {
      const debut = a.cursor ? lignes.findIndex((l) => l.id === a.cursor!.id) + (a.skip ?? 0) : 0;
      return lignes.slice(debut, debut + a.take);
    });
    const prisma = {
      exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31') }) },
      ligneEcriture: {
        findMany,
        groupBy: jest.fn(async () => [{ lettrageId: 'g', _count: { _all: 2 } }]),
      },
      lettrage: { findMany: jest.fn(async () => []) },
      imputationPaiement: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;
    const service = new NoteAnnexeService({} as never, {} as never, prisma, {} as never, {} as never);
    const echeances = await (service as unknown as {
      chargerEcheances: (t: string, e: string) => Promise<Map<string, { unAn: number; deuxAns: number; plusDeDeuxAns: number; nonVentile: number }>>;
    }).chargerEcheances('t', 'ex');
    expect(findMany.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(echeances.get('41110001')).toEqual({ unAn: 2_480_000 + LOT_LECTURE, deuxAns: 0, plusDeDeuxAns: 0, nonVentile: 0 });
  });
});

describe('poids des lignes ouvertes · les relances (relecture, bloquant 6)', () => {
  it('l’avis préventif réclame le reste de la facture, jamais la facture entière', async () => {
    const tiers = { id: 't-c1', nom: 'C1', type: 'CLIENT', email: null, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null };
    const compte = { id: 'c-41110001', numero: '41110001', intitule: 'Client C1', tiersCompte: { tiers } };
    const base = [
      ligne('f', 3_480_000, 0, '2026-10-01', 'g', '2026-11-05'),
      ligne('r', 0, 1_000_000, '2026-10-10', 'g'),
    ];
    const lignes = base.map((l) => ({
      ...l,
      lettre: null,
      libelle: l.id,
      compte,
      ecriture: { ...l.ecriture, libelle: 'Pièce', estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
    }));
    const prisma = {
      ...lecteur(base),
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA }) },
      ligneEcriture: { ...lecteur(base).ligneEcriture, findMany: jest.fn().mockResolvedValue(lignes) },
      niveauRelance: { findMany: jest.fn().mockResolvedValue([]) },
      relance: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const [p] = await new RelancesService(prisma, {} as CourrierService).positions('t', {
      exerciceId: 'ex',
      type: TypeRelance.PREVENTIVE,
      dateReference: '2026-10-20',
    });
    expect(p.montantDu).toBe(2_480_000);
    expect(p.lignes.map((l) => l.montant)).toEqual([2_480_000]);
  });
});

describe('poids des lignes ouvertes · la NOTE 3 des SMT (relecture, majeur 8)', () => {
  it('l’écart d’une facture réglée en partie va à la part de SON échéance, le règlement sans échéance n’en change aucune', async () => {
    const base = [
      { ...ligne('f', 3_480_000, 0, '2026-12-05', 'g', '2027-02-05'), compteId: 'c1' },
      { ...ligne('r', 0, 1_000_000, '2026-12-20', 'g'), compteId: 'c1' },
    ];
    const db = {
      ligneEcriture: {
        ...lecteur(base).ligneEcriture,
        groupBy: jest.fn(async (a: { by: string[]; where: { lettrageId?: { in: string[] } } }) =>
          a.where.lettrageId?.in ? lecteur(base).ligneEcriture.groupBy(a as never) : [{ lettrageId: 'g', _count: { _all: 2 } }],
        ),
        findMany: jest.fn(async () => base),
      },
      lettrage: { findMany: jest.fn(async () => []) },
      imputationPaiement: { findMany: jest.fn(async () => []) },
    };
    const ecarts = await ecartsDesGroupesParEcheance(db, 't', {}, d('2026-12-31'), 'essai');
    expect(ecarts.get('c1')).toEqual({ nonEchu: -1_000_000, echu: 0 });
  });
});

describe('poids des lignes ouvertes · les jumeaux qui lisent les mêmes lignes', () => {
  // Le câblage se teste avec la règle (F4a) · chaque lecture des lignes
  // ouvertes de tiers par échéance passe par le poids.
  const lire = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
  it('l’échéancier range chaque ligne lettrée à son poids', () => {
    expect(lire('comptabilite/ecriture.service.ts')).toMatch(/for \(const l of lettrees\) ranger\(l, poidsOuMontant\(poids, l\)\);/);
  });
  it('la NOTE 3 des deux SMT porte l’écart des groupes à la part de l’échéance', () => {
    for (const f of ['etats-financiers/etats-financiers-smt.service.ts', 'etats-financiers-syscohada/etats-financiers-smt-syscohada.service.ts']) {
      expect(lire(f)).toMatch(/await ecartsDesGroupesParEcheance\(this\.prisma, tenantId, lignesOuvertes, exercice\.dateFin,/);
    }
  });
  it('les relances lisent la paire à cheval, puis le poids', () => {
    expect(lire('relances/relances.service.ts')).toMatch(/const net = paires\?\.reste\.get\(l\.id\)\?\.francs \?\? poidsOuMontant\(poids, l\);/);
  });
});
