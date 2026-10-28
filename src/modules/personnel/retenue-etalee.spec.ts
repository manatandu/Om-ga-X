import {
  echeancierAvance,
  ecartsAuPlan,
  motifRefusEtalement,
  retenueProposee,
  type PlanEtalement,
} from './avances-salaire';

/**
 * LIGNE MICROFINA-M3, IDÉE 6 · la retenue étalée (Code du travail, art. 112,
 * c) et f)). Ce qui casserait en silence · un centime perdu ou ajouté à la
 * dernière échéance, un mois sauté rattrapé en doublant une retenue, une
 * retenue proposée au-delà du solde, une saisie-arrêt étalée contre son acte.
 */
describe('Retenue étalée · le plan', () => {
  const avance = { type: 'AVANCE' as const, montantFc: 100_000, dateOctroi: '2026-11-20' };

  it("aucun plan déclaré n'est pas un refus", () => {
    expect(motifRefusEtalement(avance)).toBeNull();
  });

  it('la durée exige son premier mois', () => {
    expect(motifRefusEtalement({ ...avance, nombreEcheances: 3 })).toMatch(/premier mois/);
  });

  it('refuse la saisie-arrêt, que son acte règle (AUPSRVE, art. 184, 3°)', () => {
    expect(
      motifRefusEtalement({ ...avance, type: 'SAISIE_ARRET', premierMoisRetenue: '2026-12', nombreEcheances: 3 }),
    ).toMatch(/AUPSRVE, art\. 184, 3°/);
  });

  it("refuse un premier mois antérieur à l'octroi", () => {
    expect(motifRefusEtalement({ ...avance, premierMoisRetenue: '2026-10', nombreEcheances: 3 })).toMatch(/précède/);
  });

  it('exige la durée OU la retenue, jamais les deux ni aucune', () => {
    expect(motifRefusEtalement({ ...avance, premierMoisRetenue: '2026-12' })).toMatch(/l'une des deux/);
    expect(
      motifRefusEtalement({ ...avance, premierMoisRetenue: '2026-12', nombreEcheances: 3, retenueMensuelleFc: 40_000 }),
    ).toMatch(/OU la retenue/);
    expect(motifRefusEtalement({ ...avance, premierMoisRetenue: '2026-12', nombreEcheances: 3 })).toBeNull();
    expect(motifRefusEtalement({ ...avance, premierMoisRetenue: '2026-12', retenueMensuelleFc: 40_000 })).toBeNull();
  });

  it('borne la durée à cent vingt mois', () => {
    expect(motifRefusEtalement({ ...avance, premierMoisRetenue: '2026-12', nombreEcheances: 121 })).toMatch(/120/);
    expect(motifRefusEtalement({ ...avance, premierMoisRetenue: '2026-12', retenueMensuelleFc: 500 })).toMatch(/120/);
  });
});

describe("Retenue étalée · l'échéancier", () => {
  it('trois échéances de 100 000 · la dernière prend le reste, au centime', () => {
    const e = echeancierAvance({ montantFc: 100_000, premierMois: '2026-12', nombreEcheances: 3, retenueMensuelleFc: null });
    expect(e).toEqual([
      { mois: '2026-12', montantFc: 33_333.33 },
      { mois: '2027-01', montantFc: 33_333.33 },
      { mois: '2027-02', montantFc: 33_333.34 },
    ]);
    expect(Math.round(e.reduce((s, x) => s + x.montantFc * 100, 0))).toBe(10_000_000);
  });

  it('par la retenue mensuelle · 100 000 à 40 000 font trois mois, le dernier de 20 000', () => {
    expect(
      echeancierAvance({ montantFc: 100_000, premierMois: '2026-11', nombreEcheances: null, retenueMensuelleFc: 40_000 }).map((x) => x.montantFc),
    ).toEqual([40_000, 40_000, 20_000]);
  });
});

describe('Retenue étalée · la proposition du mois', () => {
  const plan: PlanEtalement = { montantFc: 100_000, premierMois: '2026-12', nombreEcheances: 3, retenueMensuelleFc: null };

  it('rien avant le premier mois, et jamais un zéro', () => {
    const p = retenueProposee(plan, '2026-11', 100_000);
    expect(p.montantFc).toBeNull();
  });

  it("l'échéance du rang, bornée par le solde", () => {
    expect(retenueProposee(plan, '2026-12', 100_000).montantFc).toBe(33_333.33);
    expect(retenueProposee(plan, '2027-02', 33_333.34).montantFc).toBe(33_333.34);
    expect(retenueProposee(plan, '2027-01', 10_000).montantFc).toBe(10_000);
  });

  it("un mois sauté n'est jamais rattrapé en doublant · au-delà du plan, l'échéance courante", () => {
    // Décembre sauté : en mars, au-delà des trois mois, il reste 33 333,33.
    const p = retenueProposee(plan, '2027-03', 33_333.33);
    expect(p.montantFc).toBe(33_333.33);
    expect(p.auDelaDuPlan).toBe(true);
    const q = retenueProposee(plan, '2027-04', 50_000);
    expect(q.montantFc).toBe(33_333.33);
  });

  it("le reliquat d'un centime à la dernière échéance est dit, avec l'issue", () => {
    // Un bulletin a retenu 33 333,32 au lieu de 33 333,33 · il reste 33 333,35 à la dernière.
    const p = retenueProposee(plan, '2027-02', 33_333.35);
    expect(p.montantFc).toBe(33_333.34);
    expect(p.motif).toMatch(/reliquat de 0\.01 FC restera dû/);
    expect(p.motif).toMatch(/solde entier \(33333\.35 FC\)/);
    expect(retenueProposee(plan, '2027-02', 33_333.34).motif).not.toMatch(/reliquat/);
  });

  it('soldée, rien à proposer', () => {
    expect(retenueProposee(plan, '2027-01', 0).montantFc).toBeNull();
  });

  it("l'écart au plan se dit, l'excédent ne se dit pas", () => {
    const proposees = [{ avanceId: 'a', libelle: 'Avance du 2026-11-20 · loyer', montantFc: 33_333.33 }];
    expect(ecartsAuPlan(proposees, [])).toHaveLength(1);
    expect(ecartsAuPlan(proposees, [{ avanceId: 'a', montantFc: 10_000 }])[0]).toMatch(/en retient 10000\.00/);
    expect(ecartsAuPlan(proposees, [{ avanceId: 'a', montantFc: 33_333.33 }])).toEqual([]);
  });
});
