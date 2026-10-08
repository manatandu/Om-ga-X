import { StatutExercice } from '@prisma/client';
import { LettrageService } from './lettrage.service';
import type { PrismaService } from '../../common/prisma.service';
import {
  annonceDeReconduction,
  apparierAuReport,
  datesDOrigine,
  detailNonReconduit,
  groupesNonReconduits,
  libelleDuReport,
  messagesDeReconduction,
  operationsDeLaCloture,
  poserGroupeReconduit,
  restesDesFactures,
  restesParLImputationLegale,
  type LigneDeGroupe,
} from './reconduction-lettrage';
import { coutHistoriqueRegle, coutsHistoriquesSuccessifs } from '../reglements/ecart-change-realise';

/**
 * LIGNE LETTRAGE-CLÔTURE · les calculs purs de la reconduction et la lecture
 * de ce qui reste à relettrer (dossier clôturé avant la règle). AUDCIF
 * art. 34 ; fiches des comptes 40 et 41 (« crédité des avances et acomptes
 * ainsi que des règlements reçus des clients ») ; art. 54 et 55 en devise.
 */

const j = (s: string) => new Date(`${s}T00:00:00.000Z`);
const l = (id: string, debit: number, credit: number, date: string, x: Partial<LigneDeGroupe> = {}): LigneDeGroupe => ({
  id,
  debit,
  credit,
  deviseId: null,
  montantDevise: null,
  date: j(date),
  ...x,
});

describe('restesDesFactures · ce qu’une facture d’un groupe partiel doit encore', () => {
  it('la facture de 34 800 000 et l’acompte de 20 000 000 · le client doit 14 800 000, pas la facture', () => {
    const r = restesDesFactures([l('F', 34_800_000, 0, '2026-11-15'), l('A', 0, 20_000_000, '2026-10-01')], 'DEBIT');
    expect(r.get('F')).toEqual({ francs: 14_800_000, devise: null, regle: 20_000_000, deviseIndeterminee: false });
    // L'acompte n'est pas une facture · il n'a pas de reste.
    expect(r.has('A')).toBe(false);
  });

  it('plusieurs factures · les règlements s’inscrivent sur la plus ancienne pièce d’abord (ordre d’inscription)', () => {
    const r = restesDesFactures([l('F2', 10_000, 0, '2026-02-01'), l('F1', 10_000, 0, '2026-01-10'), l('P', 0, 15_000, '2026-03-01')], 'DEBIT');
    expect(r.get('F1')).toEqual({ francs: 0, devise: null, regle: 10_000, deviseIndeterminee: false });
    expect(r.get('F2')).toEqual({ francs: 5_000, devise: null, regle: 5_000, deviseIndeterminee: false });
  });

  it('un fournisseur · la facture est au crédit, le règlement au débit', () => {
    const r = restesDesFactures([l('F', 0, 1_000_000, '2026-05-01'), l('R', 400_000, 0, '2026-06-01')], 'CREDIT');
    expect(r.get('F')).toEqual({ francs: 600_000, devise: null, regle: 400_000, deviseIndeterminee: false });
  });

  it('EN DEVISE · la facture s’éteint dans sa devise, au COÛT HISTORIQUE (art. 54 et 55), jamais aux francs payés', () => {
    // 1 000 USD à 2 800 ; règlement partiel de 400 USD au coût historique
    // (le tiers est soldé à 1 120 000, l'écart réalisé est sur sa ligne).
    const r = restesDesFactures(
      [
        l('F', 0, 2_800_000, '2026-05-01', { deviseId: 'usd', montantDevise: 1000 }),
        l('R', 1_120_000, 0, '2026-06-01', { deviseId: 'usd', montantDevise: 400 }),
      ],
      'CREDIT',
    );
    expect(r.get('F')).toEqual({ francs: 1_680_000, devise: 600, regle: 1_120_000, deviseIndeterminee: false });
  });

  it('un groupe dont le reste est dans l’autre sens ne doit rien · l’acompte dépasse la facture', () => {
    const r = restesDesFactures([l('F', 1_000, 0, '2026-01-01'), l('A', 0, 1_500, '2026-01-02')], 'DEBIT');
    expect(r.get('F')).toEqual({ francs: 0, devise: null, regle: 1_000, deviseIndeterminee: false });
  });

  // RELECTURES DU 2026-10-08 (bloquant 1, B1) · un acompte en FRANCS SEULS ne
  // dit pas ce qu'il règle d'une facture en devise · le reste en devise est
  // INDÉTERMINÉ, jamais la devise entière.
  it('facture 1 000 USD, acompte 1 680 000 francs seuls · reste en francs 1 120 000, devise INDÉTERMINÉE', () => {
    const r = restesDesFactures(
      [l('F', 0, 2_800_000, '2026-05-01', { deviseId: 'usd', montantDevise: 1000 }), l('A', 1_680_000, 0, '2026-06-01')],
      'CREDIT',
    );
    expect(r.get('F')).toMatchObject({ francs: 1_120_000, deviseIndeterminee: true });
  });

  it('deux devises · 1 000 EUR réglés ne règlent jamais la facture en USD (B1 b)', () => {
    const r = restesDesFactures(
      [
        l('A', 2_800_000, 0, '2026-02-01', { deviseId: 'usd', montantDevise: 1000 }),
        l('B', 3_100_000, 0, '2026-03-01', { deviseId: 'eur', montantDevise: 1000 }),
        l('P', 0, 3_100_000, '2026-04-01', { deviseId: 'eur', montantDevise: 1000 }),
      ],
      'DEBIT',
    );
    expect(r.get('A')).toEqual({ francs: 2_800_000, devise: 1000, regle: 0, deviseIndeterminee: false });
    expect(r.get('B')).toEqual({ francs: 0, devise: 0, regle: 3_100_000, deviseIndeterminee: false });
  });

  it('un acompte en francs inscrit sur une facture en francs plus ancienne laisse la devise de l’autre DÉTERMINÉE', () => {
    const r = restesDesFactures(
      [
        l('Ffc', 500_000, 0, '2026-01-10'),
        l('Fusd', 2_800_000, 0, '2026-03-01', { deviseId: 'usd', montantDevise: 1000 }),
        l('A', 0, 500_000, '2026-04-01'),
      ],
      'DEBIT',
    );
    expect(r.get('Ffc')).toMatchObject({ francs: 0 });
    expect(r.get('Fusd')).toEqual({ francs: 2_800_000, devise: 1000, regle: 0, deviseIndeterminee: false });
  });

  // Mineur 11 · un règlement inscrit en NÉGATIF annule le règlement · jamais une facture.
  it('un règlement et son inscription en négatif · la facture redevient due en entier, le négatif n’est pas une facture', () => {
    const r = restesDesFactures(
      [l('F', 1_000_000, 0, '2026-01-10'), l('R', 0, 400_000, '2026-02-01'), l('Rneg', 0, -400_000, '2026-03-01')],
      'DEBIT',
    );
    expect([...r.keys()]).toEqual(['F']);
    expect(r.get('F')).toMatchObject({ francs: 1_000_000, regle: 0 });
  });

  // Majeur 2 (premier tour) et majeur du second · L'ORDRE D'INSCRIPTION se
  // lit sur la pièce d'ORIGINE (sa date, puis sa ligne) · jamais sur
  // l'identifiant tiré au hasard d'une ligne d'à-nouveau.
  it('à-nouveaux du même jour · la date d’ORIGINE décide, puis la ligne d’origine (`cle`), jamais l’identifiant d’à-nouveau', () => {
    const avecOrigine = restesDesFactures(
      [l('zzz', 1_000, 0, '2026-03-01'), l('aaa', 1_000, 0, '2026-06-01'), l('P', 0, 1_000, '2026-07-01')],
      'DEBIT',
    );
    expect(avecOrigine.get('zzz')!.francs).toBe(0);
    expect(avecOrigine.get('aaa')!.francs).toBe(1_000);
    // Même date d'origine · la ligne d'ORIGINE départage, comme à l'inscription
    // (`ordreDeReglement`) · « aaa » d'à-nouveau reporte la ligne « o2 ».
    const memeJour = restesDesFactures(
      [l('zzz', 1_000, 0, '2026-04-01', { cle: 'o1' }), l('aaa', 3_000, 0, '2026-04-01', { cle: 'o2' }), l('P', 0, 2_000, '2027-02-01')],
      'DEBIT',
    );
    expect(memeJour.get('zzz')!.francs).toBe(0);
    expect(memeJour.get('aaa')!.francs).toBe(2_000);
  });

  // MAJEUR DU SECOND TOUR · le reste servi est celui de l'inscription, et
  // l'art. 154 ne le change pas · une facture plus ancienne NON ÉCHUE reste
  // la première éteinte, comme le règlement l'a inscrite.
  it('cas (c) · F1 1 000 USD à 2 800, F2 1 000 USD à 2 500, 500 USD inscrits sur F1 (la plus ancienne, non échue) · reste 3 900 000', () => {
    const lignes = [
      l('F1', 2_800_000, 0, '2026-01-10', { deviseId: 'usd', montantDevise: 1000, dateEcheance: j('2026-12-31') }),
      l('F2', 2_500_000, 0, '2026-02-10', { deviseId: 'usd', montantDevise: 1000, dateEcheance: j('2026-03-10') }),
      // Le règlement de 500 USD inscrit au coût historique de F1 (ordreDeReglement).
      l('P', 0, coutHistoriqueRegle(
        [
          { id: 'F1', francs: 2_800_000, montantDevise: 1000, date: j('2026-01-10') },
          { id: 'F2', francs: 2_500_000, montantDevise: 1000, date: j('2026-02-10') },
        ],
        500,
      ), '2026-06-01', { deviseId: 'usd', montantDevise: 500 }),
    ];
    const r = restesDesFactures(lignes, 'DEBIT');
    expect(r.get('F1')).toEqual({ francs: 1_400_000, devise: 500, regle: 1_400_000, deviseIndeterminee: false });
    expect(r.get('F2')).toEqual({ francs: 2_500_000, devise: 1000, regle: 0, deviseIndeterminee: false });
    // La somme des restes est le solde inscrit au compte · 5 300 000 − 1 400 000.
    expect(r.get('F1')!.francs + r.get('F2')!.francs).toBe(3_900_000);
    // Le solde de 1 500 USD se calcule sur ces restes · 3 900 000, rien au-delà.
    expect(
      coutHistoriqueRegle(
        [
          { id: 'F1', francs: 1_400_000, montantDevise: 500, date: j('2026-01-10') },
          { id: 'F2', francs: 2_500_000, montantDevise: 1000, date: j('2026-02-10') },
        ],
        1_500,
      ),
    ).toBe(3_900_000);
    // L'art. 154, lui, porte les 500 USD sur F2 (échue) · il ne sert plus qu'à dire où ira la TVA.
    const loi = restesParLImputationLegale(lignes, 'DEBIT');
    expect(loi.get('F2')!.devise).toBe(500);
    expect(loi.get('F1')!.devise).toBe(1000);
  });

  it('cas (a) · 700 USD pour 1 000 000, réglés 33,33 puis 66,67 USD · le reste est ce que le compte porte (857 142,85), au centime', () => {
    const facture = { id: 'F', francs: 1_000_000, montantDevise: 700, date: j('2026-01-10') };
    const [h1, h2] = coutsHistoriquesSuccessifs([facture], [33.33, 66.67]);
    expect([h1, h2]).toEqual([47_614.29, 95_242.86]);
    const r = restesDesFactures(
      [
        l('F', 1_000_000, 0, '2026-01-10', { deviseId: 'usd', montantDevise: 700 }),
        l('P1', 0, h1, '2026-02-01', { deviseId: 'usd', montantDevise: 33.33 }),
        l('P2', 0, h2, '2026-03-01', { deviseId: 'usd', montantDevise: 66.67 }),
      ],
      'DEBIT',
    );
    expect(r.get('F')).toEqual({ francs: 857_142.85, devise: 600, regle: 142_857.15, deviseIndeterminee: false });
    // Le solde de 600 USD reprend ce reste entier · le groupe se solde à zéro en francs.
    expect(coutHistoriqueRegle([{ id: 'F', francs: 857_142.85, montantDevise: 600, date: j('2026-01-10') }], 600)).toBe(857_142.85);
  });

  it('cas (b) · ancien acompte de 400 USD inscrit au payé (1 200 000, D4) sur 1 000 USD à 2 800 · reste 1 600 000 et 600 USD', () => {
    const r = restesDesFactures(
      [
        l('F', 2_800_000, 0, '2026-01-10', { deviseId: 'usd', montantDevise: 1000 }),
        l('A', 0, 1_200_000, '2026-02-01', { deviseId: 'usd', montantDevise: 400 }),
      ],
      'DEBIT',
    );
    expect(r.get('F')).toEqual({ francs: 1_600_000, devise: 600, regle: 1_200_000, deviseIndeterminee: false });
  });

  it('une somme inscrite au payé qui ÉPUISE sa facture y laisse le réalisé jamais passé, en francs, sans devise', () => {
    const r = restesDesFactures(
      [
        l('F1', 2_800_000, 0, '2026-01-10', { deviseId: 'usd', montantDevise: 1000 }),
        l('F2', 2_800_000, 0, '2026-02-10', { deviseId: 'usd', montantDevise: 1000 }),
        // 1 000 USD payés 3 000 000 au payé · F1 épuisée dans sa devise, 200 000 de trop sur elle.
        l('P', 0, 3_000_000, '2026-03-01', { deviseId: 'usd', montantDevise: 1000 }),
      ],
      'DEBIT',
    );
    expect(r.get('F1')).toMatchObject({ francs: -200_000, devise: 0 });
    expect(r.get('F2')).toMatchObject({ francs: 2_800_000, devise: 1000 });
  });

  // Mineur du second tour · une devise annulée par un négatif, des francs
  // restants · les francs se gardent et la devise se dit inconnue.
  it('règlement en devise dont un négatif annule la devise et non tous les francs · francs gardés, devise INDÉTERMINÉE', () => {
    const r = restesDesFactures(
      [
        l('F', 2_800_000, 0, '2026-01-10', { deviseId: 'usd', montantDevise: 1000 }),
        l('P', 0, 1_200_000, '2026-02-01', { deviseId: 'usd', montantDevise: 400 }),
        l('Pneg', 0, -1_120_000, '2026-03-01', { deviseId: 'usd', montantDevise: 400 }),
      ],
      'DEBIT',
    );
    expect(r.get('F')).toEqual({ francs: 2_720_000, devise: 1000, regle: 80_000, deviseIndeterminee: true });
  });
});

describe('restesParLImputationLegale · l’art. 154, qui ne sert plus qu’à dire où ira la TVA', () => {
  it('à date égale, le PRORATA · jamais l’identifiant', () => {
    const r = restesParLImputationLegale([l('zzz', 1_000, 0, '2027-01-01'), l('aaa', 3_000, 0, '2027-01-01'), l('P', 0, 2_000, '2027-02-01')], 'DEBIT');
    expect(r.get('zzz')!.francs).toBe(500);
    expect(r.get('aaa')!.francs).toBe(1_500);
  });

  it('échue d’abord · une facture plus ancienne non échue passe après une plus récente échue', () => {
    const r = restesParLImputationLegale(
      [
        l('ancienne', 1_000, 0, '2026-01-10', { dateEcheance: j('2026-12-31') }),
        l('recente', 1_000, 0, '2026-02-10', { dateEcheance: j('2026-03-10') }),
        l('P', 0, 1_000, '2026-06-01'),
      ],
      'DEBIT',
    );
    expect(r.get('recente')!.francs).toBe(0);
    expect(r.get('ancienne')!.francs).toBe(1_000);
  });

  it('une devise annulée par un négatif ne divise jamais par zéro · ses francs restent imputés', () => {
    const r = restesParLImputationLegale(
      [
        l('F', 2_800_000, 0, '2026-01-10', { deviseId: 'usd', montantDevise: 1000 }),
        l('P', 0, 1_200_000, '2026-02-01', { deviseId: 'usd', montantDevise: 400 }),
        l('Pneg', 0, -1_120_000, '2026-03-01', { deviseId: 'usd', montantDevise: 400 }),
      ],
      'DEBIT',
    );
    expect(r.get('F')).toEqual({ francs: 2_720_000, devise: 1000 });
  });
});

describe('apparierAuReport · la ligne d’à-nouveau qui reporte chaque ligne, sans devinette', () => {
  const lu = (id: string, debit: number, credit: number, libelle: string) => ({
    id,
    compteId: '411',
    compteNumero: '41110000',
    debit,
    credit,
    dateEcheance: null,
    deviseId: null,
    montantDevise: null,
    libelle,
    ecriture: { exerciceId: 'n', date: j('2026-11-15'), libelle: 'Pièce' },
  });
  const accueil = (id: string, debit: number, credit: number, libelle: string | null) => ({
    id,
    compteId: '411',
    debit,
    credit,
    dateEcheance: null,
    deviseId: null,
    montantDevise: null,
    libelle,
  });

  it('deux factures de même montant · le libellé du report les départage', () => {
    const r = apparierAuReport(
      [lu('F1', 1_000, 0, 'Facture 1'), lu('A', 0, 400, 'Acompte')],
      [accueil('x2', 1_000, 0, 'RAN détail 41110000 · Facture 2'), accueil('x1', 1_000, 0, 'RAN détail 41110000 · Facture 1'), accueil('y', 0, 400, 'RAN détail 41110000 · Acompte')],
    );
    expect(r).toEqual(['x1', 'y']);
  });

  it('deux candidates indistinctes · rien n’est pris, la ligne reste sans accueil', () => {
    const r = apparierAuReport([lu('F1', 1_000, 0, 'Facture 1')], [accueil('x1', 1_000, 0, 'autre'), accueil('x2', 1_000, 0, 'autre encore')]);
    expect(r).toEqual([null]);
  });

  it('le libellé du report est celui que `lignesReportANouveau` écrit', () => {
    expect(libelleDuReport('41110000', { libelle: null, ecriture: { libelle: 'Vente' } })).toBe('RAN détail 41110000 · Vente');
  });
});

describe('messagesDeReconduction · ce que la clôture dit', () => {
  it('nomme le reconduit avec son reste, et le non reconduit avec son motif et son issue', () => {
    const m = messagesDeReconduction([
      { groupeN: { id: 'G', code: 'A', compte: '41110000', reste: 14_800_000 }, codeReconduit: 'B', motif: null },
      { groupeN: { id: 'H', code: 'C', compte: '40110000', reste: -1_680_000 }, codeReconduit: null, motif: 'une de ses lignes est déjà lettrée' },
    ]);
    expect(m[0]).toMatch(/1 lettrage\(s\) partiel\(s\) reconduit\(s\).*compte 41110000, a → b \(reste 14 800 000,00 au débit\)/);
    expect(m[1]).toMatch(/Lettrage partiel c du compte 40110000 \(reste 1 680 000,00 au crédit\) NON reconduit · une de ses lignes est déjà lettrée/);
    expect(m[1]).toMatch(/pré-lettrage/);
  });
});

/**
 * UNE BASE EN MÉMOIRE qui honore les filtres que la lecture pose, et lève sur
 * tout autre · une doublure qui ignore un filtre valide un code qui ne charge
 * pas (CLAUDE.md, F2a, F4b).
 */
type Rangee = Record<string, unknown>;
function vaut(r: Rangee, cle: string, f: unknown): boolean {
  const v = r[cle] ?? null;
  if (f === null || typeof f !== 'object' || f instanceof Date) return f instanceof Date ? v instanceof Date && v.getTime() === f.getTime() : v === f;
  return Object.entries(f as Rangee).every(([op, x]) => {
    if (op === 'in') return (x as unknown[]).includes(v);
    if (op === 'not') return x === null ? v !== null : v !== x;
    throw new Error(`doublure : filtre « ${op} » non honoré`);
  });
}
function correspond(r: Rangee, where: unknown): boolean {
  return Object.entries((where ?? {}) as Rangee).every(([cle, f]) => {
    if (cle === 'NOT') return !correspond(r, f);
    if (cle === 'OR') return (f as unknown[]).some((w) => correspond(r, w));
    if (cle === 'AND') return (f as unknown[]).every((w) => correspond(r, w));
    if (cle === 'ecriture' || cle === 'compte') return correspond(r[cle] as Rangee, f);
    // Les relations facultatives du périmètre de l'ouverture (AU2) · absentes, elles ne répondent pas,
    // sauf à `is: null` (paquet 1, A8 · la contre-passation d'une réévaluation, liée, en sort).
    if (cle === 'journal' || cle === 'corrigeEcriture' || cle === 'reevaluationExtourne') {
      const x = r[cle] as Rangee | null | undefined;
      if (f !== null && typeof f === 'object' && 'is' in (f as Rangee) && (f as Rangee).is === null) return !x;
      return x ? correspond(x, (f as { is?: unknown }).is ?? f) : false;
    }
    if (cle === 'lignes') {
      const { some, none } = f as { some?: unknown; none?: unknown };
      if (none !== undefined) return !((r.lignes as Rangee[] | undefined) ?? []).some((x) => correspond(x, none));
      if (some === undefined) throw new Error('doublure : filtre de lignes non honoré');
      return (r.lignes as Rangee[]).some((x) => correspond(x, some));
    }
    return vaut(r, cle, f);
  });
}
function projeter(r: Rangee, select: Rangee | undefined): Rangee {
  if (!select) return { ...r };
  return Object.fromEntries(
    Object.entries(select).map(([k, v]) => {
      if (v === true) return [k, r[k] ?? null];
      const sous = (v as { select: Rangee }).select;
      const x = r[k];
      return [k, Array.isArray(x) ? x.map((y) => projeter(y as Rangee, sous)) : x === null || x === undefined ? null : projeter(x as Rangee, sous)];
    }),
  );
}
function pagine<T extends { id: string }>(r: T[], a: { take?: number; cursor?: { id: string }; skip?: number }): T[] {
  let s = [...r].sort((x, y) => (x.id < y.id ? -1 : 1));
  if (a.cursor) s = s.slice(s.findIndex((x) => x.id === a.cursor!.id) + (a.skip ?? 0));
  return a.take === undefined ? s : s.slice(0, a.take);
}

describe('groupesNonReconduits · ce qui reste à relettrer d’un dossier clôturé avant la règle', () => {
  const N = { id: 'n', tenantId: 't', dateDebut: j('2026-01-01'), dateFin: j('2026-12-31'), statut: StatutExercice.CLOTURE };
  const N1 = { id: 'n1', tenantId: 't', dateDebut: j('2027-01-01'), dateFin: j('2027-12-31'), statut: StatutExercice.OUVERT };
  const compte = { id: '411', numero: '41110000', intitule: 'Client', modeReportANouveau: 'DETAIL' };
  const ecrN = { tenantId: 't', exerciceId: 'n', date: j('2026-11-15'), libelle: 'Pièce', estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false };
  const ecrRan = { tenantId: 't', exerciceId: 'n1', date: j('2027-01-01'), libelle: 'Report à-nouveau', estANouveauProvisoire: false, estGenereeParCloture: true, estSoldeDesComptesDeGestion: false };
  const ligneDe = (id: string, debit: number, credit: number, libelle: string, ecriture: Rangee, x: Rangee = {}) => ({
    id,
    compteId: '411',
    compte,
    debit,
    credit,
    dateEcheance: null,
    deviseId: null,
    montantDevise: null,
    libelle,
    lettrageId: null as string | null,
    lettre: null as string | null,
    ecriture,
    ...x,
  });

  function base(lignes: Rangee[], groupes: Rangee[]) {
    const vue = (g: Rangee) => ({ ...g, compte, lignes: lignes.filter((x) => x.lettrageId === g.id) });
    return {
      exercice: { findMany: jest.fn(async (a: { where: Rangee }) => [N, N1].filter((e) => correspond(e, a.where))) },
      lettrage: {
        findMany: jest.fn(async (a: { where: Rangee; select?: Rangee; take?: number; cursor?: { id: string }; skip?: number }) =>
          pagine(groupes.map(vue).filter((g) => correspond(g, a.where)) as unknown as Array<Rangee & { id: string }>, a).map((g) => projeter(g, a.select)),
        ),
      },
      ligneEcriture: {
        findMany: jest.fn(async (a: { where: Rangee; select?: Rangee; take?: number; cursor?: { id: string }; skip?: number }) =>
          pagine(
            lignes.map((x) => ({ ...x, lettrage: x.lettrageId ? { code: groupes.find((g) => g.id === x.lettrageId)?.code, lettrageReconduitId: groupes.find((g) => g.id === x.lettrageId)?.lettrageReconduitId ?? null } : null })).filter((x) => correspond(x, a.where)) as unknown as Array<Rangee & { id: string }>,
            a,
          ).map((x) => projeter(x, a.select)),
        ),
      },
    };
  }
  const groupe = (id: string, code: string, x: Rangee = {}) => ({ id, tenantId: 't', code, statut: 'PARTIEL', compteId: '411', ecartChange: null, lettrageReconduitId: null, ...x });

  it('lignes d’à-nouveau libres · À RECONDUIRE, avec ses lignes d’accueil', async () => {
    const lignes = [
      ligneDe('F', 34_800_000, 0, 'Facture F1', ecrN, { lettrageId: 'G' }),
      ligneDe('A', 0, 20_000_000, 'Acompte', ecrN, { lettrageId: 'G' }),
      ligneDe('xF', 34_800_000, 0, 'RAN détail 41110000 · Facture F1', ecrRan),
      ligneDe('xA', 0, 20_000_000, 'RAN détail 41110000 · Acompte', ecrRan),
    ];
    const r = await groupesNonReconduits(base(lignes, [groupe('G', 'A')]), { tenantId: 't' });
    expect(r.total).toBe(1);
    expect(r.groupes[0]).toMatchObject({ lettrageId: 'G', code: 'a', reste: 14_800_000, etat: 'A_RECONDUIRE', accueil: ['xF', 'xA'] });
    expect(detailNonReconduit(r.groupes[0])).toMatch(/Reconduire/);
  });

  it('la facture d’à-nouveau déjà réglée en entier ailleurs · LETTRÉES AILLEURS, nommé, rien délettré', async () => {
    const lignes = [
      ligneDe('F', 34_800_000, 0, 'Facture F1', ecrN, { lettrageId: 'G' }),
      ligneDe('A', 0, 20_000_000, 'Acompte', ecrN, { lettrageId: 'G' }),
      ligneDe('xF', 34_800_000, 0, 'RAN détail 41110000 · Facture F1', ecrRan, { lettrageId: 'S', lettre: 'B' }),
      ligneDe('xA', 0, 20_000_000, 'RAN détail 41110000 · Acompte', ecrRan),
      ligneDe('P', 0, 34_800_000, 'Règlement', { ...ecrRan, estGenereeParCloture: false, date: j('2027-02-10') }, { lettrageId: 'S', lettre: 'B' }),
    ];
    const r = await groupesNonReconduits(base(lignes, [groupe('G', 'A'), groupe('S', 'B', { statut: 'SOLDE' })]), { tenantId: 't' });
    expect(r.groupes[0]).toMatchObject({ etat: 'LETTREES_AILLEURS', lettresAilleurs: ['B'] });
    expect(detailNonReconduit(r.groupes[0])).toMatch(/déjà lettrées ailleurs \(B\)/);
  });

  it('déjà reconduit (lien), ou relettré à la main dans UN groupe · rien n’est nommé', async () => {
    const lignes = [
      ligneDe('F', 1_000, 0, 'Facture', ecrN, { lettrageId: 'G' }),
      ligneDe('A', 0, 400, 'Acompte', ecrN, { lettrageId: 'G' }),
      ligneDe('xF', 1_000, 0, 'RAN détail 41110000 · Facture', ecrRan, { lettrageId: 'M' }),
      ligneDe('xA', 0, 400, 'RAN détail 41110000 · Acompte', ecrRan, { lettrageId: 'M' }),
    ];
    expect((await groupesNonReconduits(base(lignes, [groupe('G', 'A'), groupe('M', 'C')]), { tenantId: 't' })).total).toBe(0);
    expect((await groupesNonReconduits(base(lignes, [groupe('G', 'A'), groupe('R', 'D', { lettrageReconduitId: 'G' })]), { tenantId: 't' })).total).toBe(0);
  });

  // SECOND TOUR · UNE LIGNE D'À-NOUVEAU N'ACCUEILLE QU'UN GROUPE. Deux
  // groupes de N aux lignes semblables, une seule paire de lignes au report ·
  // appariés chacun de leur côté, tous deux se disaient « à reconduire ».
  it('deux groupes rivaux pour la même paire de lignes · le premier À RECONDUIRE, le second INTROUVABLE et nommé', async () => {
    const lignes = [
      ligneDe('F1', 1_000, 0, 'Facture', ecrN, { lettrageId: 'G1' }),
      ligneDe('A1', 0, 400, 'Acompte', ecrN, { lettrageId: 'G1' }),
      ligneDe('F2', 1_000, 0, 'Facture', ecrN, { lettrageId: 'G2' }),
      ligneDe('A2', 0, 400, 'Acompte', ecrN, { lettrageId: 'G2' }),
      ligneDe('xF', 1_000, 0, 'Ouverture', ecrRan),
      ligneDe('xA', 0, 400, 'Ouverture', ecrRan),
    ];
    const r = await groupesNonReconduits(base(lignes, [groupe('G1', 'A'), groupe('G2', 'B')]), { tenantId: 't' });
    expect(r.total).toBe(2);
    expect(r.groupes.map((g) => [g.lettrageId, g.etat, g.accueil])).toEqual([
      ['G1', 'A_RECONDUIRE', ['xF', 'xA']],
      ['G2', 'INTROUVABLES', [null, null]],
    ]);
  });

  it('le premier reconduit, le second n’est PAS « relettré de fait » sur ses lignes · INTROUVABLE, nommé', async () => {
    const lignes = [
      ligneDe('F1', 1_000, 0, 'Facture', ecrN, { lettrageId: 'G1' }),
      ligneDe('A1', 0, 400, 'Acompte', ecrN, { lettrageId: 'G1' }),
      ligneDe('F2', 1_000, 0, 'Facture', ecrN, { lettrageId: 'G2' }),
      ligneDe('A2', 0, 400, 'Acompte', ecrN, { lettrageId: 'G2' }),
      ligneDe('xF', 1_000, 0, 'Ouverture', ecrRan, { lettrageId: 'R1' }),
      ligneDe('xA', 0, 400, 'Ouverture', ecrRan, { lettrageId: 'R1' }),
    ];
    const r = await groupesNonReconduits(
      base(lignes, [groupe('G1', 'A'), groupe('G2', 'B'), groupe('R1', 'C', { lettrageReconduitId: 'G1' })]),
      { tenantId: 't' },
    );
    expect(r.total).toBe(1);
    expect(r.groupes[0]).toMatchObject({ lettrageId: 'G2', etat: 'INTROUVABLES' });
  });

  it('une ligne sans équivalent sûr au report · INTROUVABLES', async () => {
    const lignes = [ligneDe('F', 1_000, 0, 'Facture', ecrN, { lettrageId: 'G' }), ligneDe('A', 0, 400, 'Acompte', ecrN, { lettrageId: 'G' })];
    const r = await groupesNonReconduits(base(lignes, [groupe('G', 'A')]), { tenantId: 't' });
    expect(r.groupes[0].etat).toBe('INTROUVABLES');
  });

  // Relecture TypeScript, M3 · la clôture apparie aussi les lignes de
  // l'OUVERTURE DÉJÀ PASSÉE (bilan importé en OD au premier jour) · la
  // lecture de ce qui reste à relettrer prend les mêmes candidates.
  it('une ouverture importée en OD au premier jour · ses lignes libres se lisent, le groupe est À RECONDUIRE', async () => {
    const ecrOd = { ...ecrRan, estGenereeParCloture: false, journal: { type: 'GENERAL' }, corrigeEcriture: null, dateValeur: null, lignes: [] };
    const lignes = [
      ligneDe('F', 1_000, 0, 'Facture', ecrN, { lettrageId: 'G' }),
      ligneDe('A', 0, 400, 'Acompte', ecrN, { lettrageId: 'G' }),
      ligneDe('oF', 1_000, 0, 'Bilan importé', ecrOd),
      ligneDe('oA', 0, 400, 'Bilan importé', ecrOd),
    ];
    const r = await groupesNonReconduits(base(lignes, [groupe('G', 'A')]), { tenantId: 't' });
    expect(r.groupes[0]).toMatchObject({ etat: 'A_RECONDUIRE', accueil: ['oF', 'oA'] });
  });

  // Paquet 1, A8 · la contre-passation d'une réévaluation, passée au premier
  // jour en OD, n'est pas une position d'ouverture · ses lignes sur le compte
  // du tiers ne sont pas des lignes d'accueil d'un groupe à reconduire.
  it('A8 · la contre-passation d’une réévaluation au premier jour n’offre aucune ligne d’accueil', async () => {
    const ecrOd = { ...ecrRan, estGenereeParCloture: false, journal: { type: 'GENERAL' }, corrigeEcriture: null, dateValeur: null, lignes: [] };
    const extourne = { ...ecrOd, reevaluationExtourne: { id: 'r26' } };
    const lignes = [
      ligneDe('F', 1_000, 0, 'Facture', ecrN, { lettrageId: 'G' }),
      ligneDe('A', 0, 400, 'Acompte', ecrN, { lettrageId: 'G' }),
      ligneDe('xF', 1_000, 0, 'Contre-passation des écarts de conversion', extourne),
      ligneDe('xA', 0, 400, 'Contre-passation des écarts de conversion', extourne),
    ];
    const r = await groupesNonReconduits(base(lignes, [groupe('G', 'A')]), { tenantId: 't' });
    expect(r.groupes[0].etat).toBe('INTROUVABLES');
    // Liée à rien (une OD ordinaire au premier jour), les mêmes lignes accueillent.
    const r2 = await groupesNonReconduits(base(lignes.map((l) => (l.ecriture === extourne ? { ...l, ecriture: ecrOd } : l)), [groupe('G', 'A')]), { tenantId: 't' });
    expect(r2.groupes[0]).toMatchObject({ etat: 'A_RECONDUIRE', accueil: ['xF', 'xA'] });
  });

  // Majeur 2 · la date d'origine des lignes d'un groupe reconduit, par son lien.
  it('datesDOrigine · chaque ligne d’à-nouveau d’un groupe reconduit reçoit la date de la pièce qu’elle reporte', async () => {
    const lignes = [
      ligneDe('F', 1_000, 0, 'Facture', { ...ecrN, date: j('2026-03-10') }, { lettrageId: 'G' }),
      ligneDe('A', 0, 400, 'Acompte', { ...ecrN, date: j('2026-05-02') }, { lettrageId: 'G' }),
      ligneDe('xF', 1_000, 0, 'RAN détail 41110000 · Facture', ecrRan, { lettrageId: 'R' }),
      ligneDe('xA', 0, 400, 'RAN détail 41110000 · Acompte', ecrRan, { lettrageId: 'R' }),
    ];
    const db = base(lignes, [groupe('G', 'A'), groupe('R', 'B', { lettrageReconduitId: 'G' })]);
    const reconduit = {
      id: 'R',
      lettrageReconduitId: 'G',
      compte: { numero: '41110000' },
      lignes: lignes.filter((x) => x.lettrageId === 'R') as never,
    };
    const dates = await datesDOrigine(db, 't', [reconduit]);
    expect(dates.get('xF')).toEqual(j('2026-03-10'));
    expect(dates.get('xA')).toEqual(j('2026-05-02'));
  });

  it('un exercice encore OUVERT ne se lit pas · c’est sa clôture qui reconduira', async () => {
    const lignes = [ligneDe('F', 1_000, 0, 'Facture', { ...ecrN, exerciceId: 'n1' }, { lettrageId: 'G' })];
    const r = await groupesNonReconduits(base(lignes, [groupe('G', 'A')]), { tenantId: 't' });
    expect(r.total).toBe(0);
  });

  /**
   * LE GESTE · « Reconduire » au pré-lettrage. La lecture se REJOUE au
   * serveur (la proposition ne se croit pas), et seul un groupe dont toutes
   * les lignes d'à-nouveau sont libres se reconduit.
   */
  function service(lignes: Rangee[], groupes: Rangee[]) {
    const lecture = base(lignes, groupes);
    let n = 0;
    const prisma: Record<string, unknown> = {
      ...lecture,
      $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
      compte: { findFirst: jest.fn(async ({ where }: { where: Rangee }) => (where.id === '411' && where.tenantId === 't' ? { ...compte, tenantId: 't', lettrable: true } : null)) },
      lettrage: {
        ...lecture.lettrage,
        findFirst: jest.fn(async ({ where }: { where: Rangee }) => (groupes.find((g) => correspond(g, where)) ?? null)),
        create: jest.fn(async ({ data }: { data: Rangee }) => {
          const g = { id: `R${++n}`, ...data };
          groupes.push(g);
          return g;
        }),
      },
      ligneEcriture: {
        findMany: jest.fn(async (a: { where: Rangee; select?: Rangee; take?: number; cursor?: { id: string }; skip?: number }) =>
          pagine(lignes.filter((x) => correspond({ ...x, lettrage: null }, a.where)) as unknown as Array<Rangee & { id: string }>, a).map((x) => projeter(x, a.select)),
        ),
        updateMany: jest.fn(async ({ where, data }: { where: Rangee; data: Rangee }) => {
          const visees = lignes.filter((x) => correspond(x, where));
          for (const x of visees) Object.assign(x, data);
          return { count: visees.length };
        }),
      },
    };
    return { s: new LettrageService(prisma as unknown as PrismaService), groupes, lignes };
  }

  it('reconduire · un groupe partiel, origine CLÔTURE, lié au groupe de N, posé sur ses lignes d’à-nouveau', async () => {
    const lignes = [
      ligneDe('F', 34_800_000, 0, 'Facture F1', ecrN, { lettrageId: 'G' }),
      ligneDe('A', 0, 20_000_000, 'Acompte', ecrN, { lettrageId: 'G' }),
      ligneDe('xF', 34_800_000, 0, 'RAN détail 41110000 · Facture F1', ecrRan),
      ligneDe('xA', 0, 20_000_000, 'RAN détail 41110000 · Acompte', ecrRan),
    ];
    const { s, groupes } = service(lignes, [groupe('G', 'A')]);
    const r = await s.reconduire('t', '411', 'G', 'u');
    expect(r).toEqual({ lettre: 'b', reconduitDe: 'a', reste: 14_800_000 });
    expect(groupes.find((g) => g.lettrageReconduitId === 'G')).toMatchObject({ origine: 'CLOTURE', statut: 'PARTIEL', solde: 14_800_000, code: 'B' });
    expect(lignes.filter((x) => x.lettrageId === 'R1').map((x) => x.id).sort()).toEqual(['xA', 'xF']);
    // Rejouée, la lecture ne le nomme plus · la reconduction ne se pose qu'une fois.
    await expect(s.reconduire('t', '411', 'G', 'u')).rejects.toThrow(/n'est pas à reconduire/);
  });

  it('reconduire · refusé, nommé, quand une ligne d’à-nouveau est déjà lettrée ailleurs · rien n’est délettré', async () => {
    const lignes = [
      ligneDe('F', 34_800_000, 0, 'Facture F1', ecrN, { lettrageId: 'G' }),
      ligneDe('A', 0, 20_000_000, 'Acompte', ecrN, { lettrageId: 'G' }),
      ligneDe('xF', 34_800_000, 0, 'RAN détail 41110000 · Facture F1', ecrRan, { lettrageId: 'S', lettre: 'B' }),
      ligneDe('xA', 0, 20_000_000, 'RAN détail 41110000 · Acompte', ecrRan),
    ];
    const { s } = service(lignes, [groupe('G', 'A'), groupe('S', 'B', { statut: 'SOLDE' })]);
    await expect(s.reconduire('t', '411', 'G', 'u')).rejects.toThrow(/ne se reconduit pas d'office.*déjà lettrées ailleurs \(B\)/);
    expect(lignes.find((x) => x.id === 'xF')!.lettrageId).toBe('S');
  });
});

describe('le contrôle LETTRAGE_PARTIEL_NON_RECONDUIT', () => {
  // Le bloc du contrôle, découpé entre son repère et le suivant · ce qui se
  // gèle est ce qu'il FAIT (sa lecture, sa borne, sa gravité).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const source = (require('fs') as typeof import('fs')).readFileSync(require.resolve('../controles/controles.service.ts'), 'utf-8');
  const debut = source.indexOf('// --- 35 bis.');
  const bloc = source.slice(debut, source.indexOf('// --- 36.', debut));

  it("lit l'exercice OUVERT dès que celui qui le précède est clôturé, et n'informe que", () => {
    // Relectures du 2026-10-08, mineur 7 et M3 · plus aucun report de
    // clôture exigé dans l'exercice · une ouverture ressaisie le taisait.
    expect(bloc).toContain('ex.statut !== StatutExercice.CLOTURE');
    expect(bloc).toContain('statut: StatutExercice.CLOTURE');
    expect(bloc).toContain('groupesNonReconduits(this.prisma, { tenantId, exerciceSuivantId: exerciceId })');
    expect(bloc).toContain("code: 'LETTRAGE_PARTIEL_NON_RECONDUIT'");
    expect(bloc).toContain("gravite: 'INFORMATION'");
    // Une liste bornée dit son total.
    expect(bloc).toContain('nonReconduits.tronque');
  });
});

describe('relectures du 2026-10-08 · bornes et refus nommés', () => {
  // Mineur 10 et m2 · une ligne prise entre la lecture et l'écriture · 409 nommé, jamais une Error nue.
  it('poserGroupeReconduit · une ligne lettrée entre-temps est un 409 nommé', async () => {
    const tx = {
      ligneEcriture: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', debit: 1_000, credit: 0 },
          { id: 'b', debit: 0, credit: 400 },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      lettrage: { create: jest.fn().mockResolvedValue({ id: 'R', statut: 'PARTIEL' }) },
    };
    await expect(
      poserGroupeReconduit(tx as never, {
        tenantId: 't',
        groupe: { id: 'G', code: 'A', compteId: '411', ecartChange: null },
        accueil: ['a', 'b'],
        userId: 'u',
        code: 'B',
      }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/lettrée entre la lecture et l'écriture/) });
  });

  // Relecture TypeScript, M2 · le délai de la transaction de clôture suit le nombre de partiels.
  it('le volume annoncé à la clôture croît avec les lettrages partiels', () => {
    expect(operationsDeLaCloture(0)).toBe(40);
    expect(operationsDeLaCloture(500)).toBe(40 + 500 * 8);
  });

  // Mineurs 6 et m7 · une ouverture déjà passée · l'annonce ne promet pas la reconduction.
  it('l’annonce dit l’appariement quand une ouverture est déjà passée', () => {
    const r = { total: 1, groupes: [{ code: 'a', compte: '41110000', reste: 600 }] };
    expect(annonceDeReconduction(r)).toMatch(/seront reconduits par la clôture sur leurs lignes d'à-nouveau définitif/);
    expect(annonceDeReconduction(r, { ouvertureDejaPassee: true })).toMatch(/s'apparient sûrement.*sinon nommés à la clôture/);
  });
});
