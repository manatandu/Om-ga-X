import {
  dernierJourDuMois,
  MOTIF_ORIGINE_INTROUVABLE,
  motifPartIllisible,
  propositionPaieDuMois,
  type BulletinAComptabiliser,
  type OrigineDuBulletin,
} from './comptabilisation-paie';

/**
 * P9 · LA PAIE DU MOIS EN UNE ÉCRITURE. Chaque test porte un défaut qui
 * laisserait l'écriture équilibrée et la balance bouclée.
 */

const bulletin = (numero: number, over: Partial<BulletinAComptabiliser> = {}, irppFc: number | null = 100_000): BulletinAComptabiliser => ({
  id: `b${numero}`,
  numero,
  nomComplet: `SALARIE ${numero}`,
  statut: 'EMIS',
  ecritureId: null,
  netAPayerFc: 1_250_000,
  entree: {
    elements: [
      { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
      { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
    ],
  },
  calcul: {
    cotisations: {
      lignes: [
        { cle: 'cnss-pf', charge: 'EMPLOYEUR', montantFc: 65_000 },
        { cle: 'cnss-pension-employeur', charge: 'EMPLOYEUR', montantFc: 50_000 },
        { cle: 'cnss-pension-travailleur', charge: 'TRAVAILLEUR', montantFc: 50_000 },
        { cle: 'cnss-rp', charge: 'EMPLOYEUR', montantFc: 15_000 },
        { cle: 'inpp', charge: 'EMPLOYEUR', montantFc: 35_000 },
        { cle: 'onem', charge: 'EMPLOYEUR', montantFc: 5_000 },
      ],
      abstentions: [],
    },
    retenue: irppFc === null ? null : { retenueFc: irppFc },
    net: { netAPayerFc: 1_250_000 },
  },
  ...over,
});

const ligne = (p: ReturnType<typeof propositionPaieDuMois>, bloc: string, compte: string, sens: string) =>
  p.lignes.filter((l) => l.bloc === bloc && l.compte === compte && l.sens === sens);

describe('une écriture pour tout le mois', () => {
  const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1), bulletin(2)]);

  it("additionne les bulletins par compte, et s'équilibre", () => {
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    // Deux fois (1 400 000 + 150 000 + 170 000)
    expect(p.totalDebitFc).toBe(3_440_000);
    expect(p.totalCreditFc).toBe(3_440_000);
    expect(ligne(p, 'BRUT', '66110000', 'DEBIT')[0].montantFc).toBe(2_000_000);
  });

  it('garde les trois temps du Guide, dans leur ordre, puis les impôts et taxes sur salaires', () => {
    expect([...new Set(p.lignes.map((l) => l.bloc))]).toEqual(['BRUT', 'RETENUES', 'PATRONALES', 'IMPOTS_ET_TAXES_SUR_SALAIRES']);
  });

  it("décision T1 · l'INPP et l'ONEM du mois au 6415 et au 6413, leur dette totale au 4428", () => {
    // Deux bulletins de 35 000 d'INPP et 5 000 d'ONEM chacun.
    expect(ligne(p, 'IMPOTS_ET_TAXES_SUR_SALAIRES', '64150000', 'DEBIT')[0].montantFc).toBe(70_000);
    expect(ligne(p, 'IMPOTS_ET_TAXES_SUR_SALAIRES', '64130000', 'DEBIT')[0].montantFc).toBe(10_000);
    expect(ligne(p, 'IMPOTS_ET_TAXES_SUR_SALAIRES', '44280000', 'CREDIT')[0].montantFc).toBe(80_000);
    // Le 6641 ne porte plus que la CNSS patronale.
    expect(ligne(p, 'PATRONALES', '66410000', 'DEBIT')[0].montantFc).toBe(260_000);
    expect(p.lignes.some((l) => l.compte.startsWith('433'))).toBe(false);
  });

  it('crédite le 422 du brut, le débite des retenues, et le solde est la somme des nets', () => {
    expect(ligne(p, 'BRUT', '42200000', 'CREDIT')[0].montantFc).toBe(2_800_000);
    expect(ligne(p, 'RETENUES', '42200000', 'DEBIT')[0].montantFc).toBe(300_000);
    expect(p.solde422Fc).toBe(2_500_000);
    expect(p.sommeDesNetsFc).toBe(2_500_000);
  });

  it("porte l'impôt retenu au 447, jamais en charge", () => {
    expect(ligne(p, 'RETENUES', '44720000', 'CREDIT')[0].montantFc).toBe(200_000);
    const charges = p.lignes.filter((l) => l.sens === 'DEBIT' && l.compte.startsWith('6'));
    expect(charges.reduce((n, l) => n + l.montantFc, 0)).toBe(2 * (1_400_000 + 170_000));
  });

  it('ne réunit pas la part ouvrière et la part patronale de la même caisse', () => {
    expect(ligne(p, 'RETENUES', '43130000', 'CREDIT')[0].montantFc).toBe(100_000);
    expect(ligne(p, 'PATRONALES', '43130000', 'CREDIT')[0].montantFc).toBe(100_000);
  });

  it('prend les numéros du référentiel du dossier', () => {
    const syc = propositionPaieDuMois('2026-03', 'SYCEBNL', [bulletin(1)]);
    expect(syc.lignes.some((l) => l.compte === '43210000')).toBe(true);
    expect(syc.lignes.some((l) => l.compte === '43130000')).toBe(false);
  });
});

describe('ce qui ne se passe pas, ou pas deux fois', () => {
  it('ne repasse jamais un bulletin déjà porté par une écriture', () => {
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1, { ecritureId: 'e1' }), bulletin(2)]);
    expect(p.aPasser.map((b) => b.numero)).toEqual([2]);
    expect(p.dejaPasses.map((b) => b.numero)).toEqual([1]);
    expect(p.totalDebitFc).toBe(1_720_000);
  });

  it('ignore un bulletin annulé, et signale celui annulé APRÈS avoir été passé', () => {
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [
      bulletin(1, { statut: 'ANNULE' }),
      bulletin(2, { statut: 'ANNULE', ecritureId: 'e9' }),
      bulletin(3),
    ]);
    expect(p.aPasser.map((b) => b.numero)).toEqual([3]);
    expect(p.annulesApresPassation.map((b) => b.numero)).toEqual([2]);
    expect(p.reserves.join(' ')).toContain('n° 2');
  });

  it('refuse le mois ENTIER quand un seul bulletin ne se passe pas, et le nomme', () => {
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1), bulletin(2, {}, null)]);
    expect(p.lignes).toEqual([]);
    expect(p.refus.map((r) => r.numero)).toEqual([2]);
    expect(p.refus[0].motifs.join(' ')).toContain('IMPOT_INDETERMINE');
  });

  it('passe un bulletin stipulé en dollars, sur les francs figés à la conversion (audit final F19)', () => {
    const enDollars = bulletin(2, {
      entree: {
        deviseStipulation: 'USD',
        elements: [
          { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantUsd: 400 },
          { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantUsd: 160 },
        ],
      },
    });
    (enDollars.calcul as Record<string, unknown>).conversion = {
      devise: 'USD',
      cours: 2500,
      elements: [
        { libelle: 'Salaire', montantUsd: 400, montantFc: 1_000_000 },
        { libelle: 'Logement', montantUsd: 160, montantFc: 400_000 },
      ],
    };
    const q = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1), enDollars]);
    // Les mêmes francs que deux bulletins en francs · rang pour rang.
    expect({ refus: q.refus, equilibree: q.equilibree, total: q.totalDebitFc, salaires: ligne(q, 'BRUT', '66110000', 'DEBIT')[0]?.montantFc }).toEqual({
      refus: [],
      equilibree: true,
      total: 3_440_000,
      salaires: 2_000_000,
    });
  });

  it('passe l’avantage en nature au 6617 par le 781, en quatrième temps (audit final F22)', () => {
    const avecVehicule = bulletin(2, {
      entree: {
        elements: [
          { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
          { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
          { nature: 'AVANTAGE_EN_NATURE', libelle: 'Véhicule', montantFc: 300_000 },
        ],
      },
    });
    const q = propositionPaieDuMois('2026-03', 'SYSCOHADA', [avecVehicule]);
    expect({
      refus: q.refus,
      equilibree: q.equilibree,
      solde422: q.solde422Fc,
      blocs: [...new Set(q.lignes.map((l) => l.bloc))],
      transfert: [ligne(q, 'AVANTAGES_EN_NATURE', '66170000', 'DEBIT')[0]?.montantFc, ligne(q, 'AVANTAGES_EN_NATURE', '78100000', 'CREDIT')[0]?.montantFc],
    }).toEqual({
      refus: [],
      equilibree: true,
      solde422: 1_250_000,
      blocs: ['BRUT', 'RETENUES', 'PATRONALES', 'IMPOTS_ET_TAXES_SUR_SALAIRES', 'AVANTAGES_EN_NATURE'],
      transfert: [300_000, 300_000],
    });
  });

  it('refuse un bulletin en dollars dont la conversion manque, au lieu d’additionner du vide', () => {
    const sansConversion = bulletin(2, {
      entree: { elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantUsd: 400 }] },
    });
    expect(propositionPaieDuMois('2026-03', 'SYSCOHADA', [sansConversion]).refus.map((r) => [r.numero, r.motifs[0]])).toEqual([
      [2, 'Bulletin illisible · ses éléments ou ses cotisations manquent.'],
    ]);
  });

  it('refuse un bulletin illisible au lieu de le compléter', () => {
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1, { entree: {} })]);
    expect(p.refus[0].motifs.join(' ')).toContain('illisible');
    expect(p.lignes).toEqual([]);
  });

  it('ne propose rien quand aucun bulletin n’est à passer', () => {
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', []);
    expect(p.lignes).toEqual([]);
    expect(p.refus).toEqual([]);
  });
});

describe('au centime', () => {
  it('reste équilibrée quand l’impôt porte des décimales, et montre l’écart', () => {
    // Un impôt mensuel de 130 560,333… FC, comme en rend le barème ÷ 12.
    const irpp = 130_560 + 1 / 3;
    const b = (n: number) => {
      const x = bulletin(n, { netAPayerFc: 1_219_439.67 }, irpp);
      // Le net figé dans le calcul est brut, la colonne le garde au centime.
      (x.calcul as { net: { netAPayerFc: number } }).net.netAPayerFc = 1_400_000 - 50_000 - irpp;
      return x;
    };
    // DEUX bulletins, pas trois · trois tiers retombent sur un entier, et le
    // test ne prouverait plus rien (vu à la réinjection).
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [b(1), b(2)]);
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    // Chaque montant est un nombre de centimes entier.
    for (const l of p.lignes) expect(Math.round(l.montantFc * 100)).toBe(l.montantFc * 100);
    expect(Math.abs(p.solde422Fc - p.sommeDesNetsFc)).toBeLessThanOrEqual(0.02);
  });

  it('refuse un écart qui n’est plus un arrondi', () => {
    const p = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1, { netAPayerFc: 1_000_000 })]);
    expect(p.lignes).toEqual([]);
    expect(p.reserves.join(' ')).toContain('défaut du moteur');
  });

  it('date par défaut au dernier jour du mois', () => {
    expect(dernierJourDuMois('2026-02')).toBe('2026-02-28');
    expect(dernierJourDuMois('2028-02')).toBe('2028-02-29');
    expect(dernierJourDuMois('2026-12')).toBe('2026-12-31');
  });
});

/**
 * C2 (cas chiffré P15) · LE BULLETIN ANNULÉ APRÈS PASSATION SE REPREND EN
 * NÉGATIF AVEC CELUI QUI LE REMPLACE. Décembre de B passé à 600 000, payé,
 * l'exercice clos, annulé en janvier puis réémis à 620 000 · seule la
 * différence doit peser sur l'exercice de la correction (AUDCIF art. 20 ;
 * art. 22, 4°). Avant, le réémis passait en entier · 600 000 de salaire et
 * 503 900 de net déjà payé comptés deux fois, sur une écriture qui bouclait.
 */
describe('C2 · reprise en négatif du bulletin annulé après passation', () => {
  const decembre = (numero: number, salaire: number, over: Partial<BulletinAComptabiliser> = {}): BulletinAComptabiliser => {
    const pc = (taux: number) => Math.round(salaire * taux * 100) / 100;
    const irpp = salaire === 600_000 ? 66_100 : 68_900;
    const net = salaire - pc(0.05) - irpp;
    return bulletin(numero, {
      netAPayerFc: net,
      entree: { elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: salaire }] },
      calcul: {
        cotisations: {
          lignes: [
            { cle: 'cnss-pf', charge: 'EMPLOYEUR', montantFc: pc(0.065) },
            { cle: 'cnss-pension-employeur', charge: 'EMPLOYEUR', montantFc: pc(0.05) },
            { cle: 'cnss-pension-travailleur', charge: 'TRAVAILLEUR', montantFc: pc(0.05) },
            { cle: 'cnss-rp', charge: 'EMPLOYEUR', montantFc: pc(0.015) },
            { cle: 'inpp', charge: 'EMPLOYEUR', montantFc: pc(0.035) },
            { cle: 'onem', charge: 'EMPLOYEUR', montantFc: pc(0.005) },
          ],
          abstentions: [],
        },
        retenue: { retenueFc: irpp },
        net: { netAPayerFc: net },
      },
      ...over,
    });
  };
  /** Une écriture de paie déjà passée, rendue telle que le journal la porte. */
  const origineDe = (ecritureId: string, lignes: ReturnType<typeof propositionPaieDuMois>['lignes'], numeroPiece = '12'): OrigineDuBulletin => ({
    ecritureId,
    numeroPiece,
    lignes: lignes.map((l) => ({
      compte: l.compte,
      intitule: l.intitule,
      debit: l.sens === 'DEBIT' ? l.montantFc : 0,
      credit: l.sens === 'CREDIT' ? l.montantFc : 0,
    })),
  });
  const passe = (bs: BulletinAComptabiliser[]) =>
    propositionPaieDuMois('2026-12', 'SYSCOHADA', bs.map((b) => ({ ...b, statut: 'EMIS' as const, ecritureId: null, ecritureNegatifId: null, origine: null }))).lignes;
  const ancienSeul = decembre(2, 600_000);
  // L'écriture de décembre qui a passé le bulletin n° 2, à la règle du jour.
  const ancien = decembre(2, 600_000, { statut: 'ANNULE', ecritureId: 'e-decembre', origine: origineDe('e-decembre', passe([ancienSeul])) });
  const reemis = decembre(3, 620_000);
  /** Mouvement net de chaque compte, débit positif. */
  const net = (p: ReturnType<typeof propositionPaieDuMois>) => {
    const m = new Map<string, number>();
    for (const l of p.lignes) m.set(l.compte, Math.round(((m.get(l.compte) ?? 0) + (l.sens === 'DEBIT' ? l.montantFc : -l.montantFc)) * 100) / 100);
    return Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));
  };

  it('ne fait peser que la DIFFÉRENCE · 6611 + 20 000, 6641 + 2 600, 6415 + 700, 6413 + 100, 422 − 16 200', () => {
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [ancien, reemis]);
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    expect(p.negatifsAPasser.map((b) => [b.numero, b.ecritureId])).toEqual([[2, 'e-decembre']]);
    expect(net(p)).toEqual({
      '42200000': -16_200,
      '43110000': -1_300,
      '43120000': -300,
      '43130000': -2_000,
      '44280000': -800,
      '44720000': -2_800,
      '64130000': 100,
      '64150000': 700,
      '66110000': 20_000,
      '66410000': 2_600,
    });
    expect(p.solde422Fc).toBe(16_200);
    expect(p.sommeDesNetsFc).toBe(16_200);
  });

  it('garde la reprise À PART des lignes du réémis · elle se lit dans l’écriture', () => {
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [ancien, reemis]);
    const salaires = p.lignes.filter((l) => l.compte === '66110000');
    expect(salaires.map((l) => [l.montantFc, l.negatif ?? false])).toEqual([
      [620_000, false],
      [-600_000, true],
    ]);
    expect(salaires[1].intitule).toContain('reprise en négatif');
    expect(p.reserves.join(' ')).toContain('REPRISE EN NÉGATIF · n° 2');
  });

  it('reprend seul un bulletin annulé sans remplaçant · le net déjà payé redevient une créance sur le salarié', () => {
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [ancien]);
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    expect(p.aPasser).toEqual([]);
    expect(net(p)['66110000']).toBe(-600_000);
    // Le 422 passe DÉBITEUR du net déjà versé · le salarié le doit.
    expect(p.solde422Fc).toBe(-503_900);
    expect(p.sommeDesNetsFc).toBe(-503_900);
  });

  it('ne reprend jamais deux fois · un bulletin déjà repris est dit, sans ligne', () => {
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [{ ...ancien, ecritureNegatifId: 'e-reprise' }, reemis]);
    expect(p.negatifsAPasser).toEqual([]);
    expect(p.annulesApresPassation).toEqual([{ numero: 2, nomComplet: 'SALARIE 2', ecritureId: 'e-decembre', ecritureNegatifId: 'e-reprise' }]);
    expect(net(p)['66110000']).toBe(620_000);
    expect(p.lignes.some((l) => l.negatif)).toBe(false);
  });

  it('refuse le mois quand l’écriture d’origine est introuvable, et le nomme avec son issue', () => {
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [{ ...ancien, origine: null }, reemis]);
    expect(p.lignes).toEqual([]);
    expect(p.refus.map((r) => r.numero)).toEqual([2]);
    expect(p.refus[0].motifs.join(' ')).toBe(MOTIF_ORIGINE_INTROUVABLE);
  });

  it('reprend un bulletin annulé illisible par les lignes de son écriture d’origine · aucun rejeu n’est nécessaire', () => {
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [{ ...ancien, entree: {} }, reemis]);
    expect(p.refus).toEqual([]);
    expect(net(p)['66110000']).toBe(20_000);
  });
});

/**
 * RELECTURE M3 (2026-10-07) · L'INSCRIPTION EN NÉGATIF ANNULE CE QUI A ÉTÉ
 * PASSÉ (AUDCIF art. 20, al. 2). Rejouée à la règle du jour, la reprise d'un
 * bulletin passé avant la décision T1 (INPP et ONEM au 6641, au 4334 et au
 * 4335) tombait au 6415, au 6413 et au 4428 · charges surévaluées, 6415
 * négatif.
 */
describe('M3 · la reprise en négatif recopie l’écriture d’origine', () => {
  const pc = (s: number, t: number) => Math.round(s * t * 100) / 100;
  const decembre = (numero: number, salaire: number, over: Partial<BulletinAComptabiliser> = {}): BulletinAComptabiliser => {
    const irpp = salaire === 600_000 ? 66_100 : 68_900;
    const net = salaire - pc(salaire, 0.05) - irpp;
    return bulletin(numero, {
      netAPayerFc: net,
      entree: { elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: salaire }] },
      calcul: {
        cotisations: {
          lignes: [
            { cle: 'cnss-pf', charge: 'EMPLOYEUR', montantFc: pc(salaire, 0.065) },
            { cle: 'cnss-pension-employeur', charge: 'EMPLOYEUR', montantFc: pc(salaire, 0.05) },
            { cle: 'cnss-pension-travailleur', charge: 'TRAVAILLEUR', montantFc: pc(salaire, 0.05) },
            { cle: 'cnss-rp', charge: 'EMPLOYEUR', montantFc: pc(salaire, 0.015) },
            { cle: 'inpp', charge: 'EMPLOYEUR', montantFc: pc(salaire, 0.035) },
            { cle: 'onem', charge: 'EMPLOYEUR', montantFc: pc(salaire, 0.005) },
          ],
          abstentions: [],
        },
        retenue: { retenueFc: irpp },
        net: { netAPayerFc: net },
      },
      ...over,
    });
  };
  const net = (p: ReturnType<typeof propositionPaieDuMois>) => {
    const m = new Map<string, number>();
    for (const l of p.lignes) m.set(l.compte, Math.round(((m.get(l.compte) ?? 0) + (l.sens === 'DEBIT' ? l.montantFc : -l.montantFc)) * 100) / 100);
    return Object.fromEntries(m);
  };
  const L = (compte: string, debit: number, credit: number) => ({ compte, intitule: `Compte ${compte}`, debit, credit });
  /** Décembre, passé AVANT la décision T1 · l'INPP (21 000) et l'ONEM (3 000) au 6641, dettes au 4334 et au 4335. */
  const AVANT_T1: OrigineDuBulletin = {
    ecritureId: 'e-avant-t1',
    numeroPiece: '7',
    lignes: [
      L('66110000', 600_000, 0),
      L('42200000', 0, 600_000),
      L('42200000', 96_100, 0),
      L('43130000', 0, 30_000),
      L('44720000', 0, 66_100),
      L('66410000', 102_000, 0),
      L('43110000', 0, 39_000),
      L('43130000', 0, 30_000),
      L('43120000', 0, 9_000),
      L('43340000', 0, 21_000),
      L('43350000', 0, 3_000),
    ],
  };
  const ancien = decembre(2, 600_000, { statut: 'ANNULE', ecritureId: 'e-avant-t1', origine: AVANT_T1 });
  const reemis = decembre(3, 620_000);

  it('bulletin passé au 6641, au 4334 et au 4335, annulé après T1 · repris sur ces mêmes comptes, jamais au 6415 ni au 4428', () => {
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [ancien, reemis]);
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    const reprise = p.lignes.filter((l) => l.bloc === 'REPRISE_EN_NEGATIF');
    expect(reprise.every((l) => l.negatif === true && l.montantFc < 0)).toBe(true);
    expect(reprise.map((l) => l.compte).sort()).toEqual(
      ['42200000', '42200000', '43110000', '43120000', '43130000', '43340000', '43350000', '44720000', '66110000', '66410000'].sort(),
    );
    expect(reprise.some((l) => ['64150000', '64130000', '44280000'].includes(l.compte))).toBe(false);
    const n = net(p);
    // Le réémis passe l'INPP (21 700) et l'ONEM (3 100) à la règle du jour ;
    // la reprise retire du 6641 les 102 000 passés, et éteint 4334 et 4335.
    expect(n['64150000']).toBe(21_700);
    expect(n['64130000']).toBe(3_100);
    expect(n['66410000']).toBe(80_600 - 102_000);
    expect(n['43340000']).toBe(21_000);
    expect(n['43350000']).toBe(3_000);
    expect(n['44280000']).toBe(-24_800);
    // Seule la différence pèse · 20 000 de salaire, 3 400 de charges.
    expect(n['66110000']).toBe(20_000);
    expect(n['66410000'] + n['64150000'] + n['64130000']).toBe(3_400);
    expect(p.solde422Fc).toBe(16_200);
  });

  it('écriture d’origine qui porte aussi un bulletin encore valide · rejouée à la règle du jour quand elle s’y reconstitue', () => {
    const autre = decembre(4, 600_000, { ecritureId: 'e-commune' });
    const lignes = propositionPaieDuMois('2026-12', 'SYSCOHADA', [decembre(2, 600_000), decembre(4, 600_000)]).lignes;
    const commune = {
      ecritureId: 'e-commune',
      numeroPiece: '9',
      lignes: lignes.map((l) => L(l.compte, l.sens === 'DEBIT' ? l.montantFc : 0, l.sens === 'CREDIT' ? l.montantFc : 0)),
    };
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [
      decembre(2, 600_000, { statut: 'ANNULE', ecritureId: 'e-commune', origine: commune }),
      autre,
      reemis,
    ]);
    expect(p.refus).toEqual([]);
    expect(net(p)['66110000']).toBe(20_000);
    expect(net(p)['64150000']).toBe(700);
  });

  it('écriture d’origine d’avant T1 qui porte aussi un bulletin encore valide · refus nommé, avec l’issue', () => {
    const lignes = [...AVANT_T1.lignes, ...AVANT_T1.lignes];
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [
      decembre(2, 600_000, { statut: 'ANNULE', ecritureId: 'e-avant-t1', origine: { ...AVANT_T1, lignes } }),
      decembre(4, 600_000, { ecritureId: 'e-avant-t1' }),
      reemis,
    ]);
    expect(p.lignes).toEqual([]);
    expect(p.refus.map((r) => r.numero)).toEqual([2]);
    expect(p.refus[0].motifs[0]).toBe(motifPartIllisible({ ...AVANT_T1, lignes }, [4]));
    expect(p.refus[0].motifs[0]).toContain('annulez aussi ce(s) bulletin(s) et réémettez-les');
  });

  it('second tour · le réémis annulé à son tour se reprend, l’écriture qui le passait portant la reprise recopiée de l’ancien', () => {
    // Janvier · e-x passe le réémis n° 3 et reprend l'ancien n° 2 ligne à
    // ligne. Le n° 3 est annulé à son tour, remplacé par le n° 5.
    const ex = propositionPaieDuMois('2026-12', 'SYSCOHADA', [ancien, reemis]);
    expect(ex.refus).toEqual([]);
    const origineEx = {
      ecritureId: 'e-x',
      numeroPiece: '13',
      lignes: ex.lignes.map((l) => L(l.compte, l.sens === 'DEBIT' ? l.montantFc : 0, l.sens === 'CREDIT' ? l.montantFc : 0)),
    };
    const p = propositionPaieDuMois('2026-12', 'SYSCOHADA', [
      { ...ancien, ecritureNegatifId: 'e-x' },
      decembre(3, 620_000, { statut: 'ANNULE', ecritureId: 'e-x', origine: origineEx }),
      decembre(5, 630_000),
    ]);
    expect(p.refus).toEqual([]);
    expect(p.equilibree).toBe(true);
    expect(net(p)['66110000']).toBe(10_000);
  });
});
