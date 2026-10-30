import { MOTIF_DEJA_DOTE_EN_N1, MOTIF_MOIS_DIFFERENTS, moisDeLExercice, planDuReportBudgetsComptes } from './budget-compte';

/**
 * Ligne restes-immos-budgets, point 1 · ce qui casserait en silence dans le
 * report des budgets des comptes · un budget de N+1 déjà décidé écrasé, un
 * annuel complété par des mois qui n'en font plus la somme, un budget
 * proratisé entre deux exercices de durées différentes, et un compte en
 * sommeil ou subdivisé doté sans un mot.
 */
const douze = moisDeLExercice(new Date('2026-01-01'), new Date('2026-12-31'));
const comptes = new Map([
  ['c1', { id: 'c1', numero: '60100000', intitule: 'Achats' }],
  ['c2', { id: 'c2', numero: '62200000', intitule: 'Locations' }],
  ['c3', { id: 'c3', numero: '70100000', intitule: 'Ventes' }],
]);
const budgets = [
  { compteId: 'c1', mois: null, montant: 1200 },
  ...douze.map((m) => ({ compteId: 'c1', mois: m, montant: 100 })),
  { compteId: 'c2', mois: null, montant: 600 },
  { compteId: 'c3', mois: null, montant: 5000 },
];

describe('report des budgets des comptes sur l’exercice suivant', () => {
  it('recopie annuel et mois tels quels, et nomme ce qui ne passe pas', () => {
    const plan = planDuReportBudgetsComptes({
      moisSource: douze,
      moisDestination: douze,
      budgets,
      comptes,
      dejaDotes: new Set(['c2']),
      horsSaisie: new Map([['c3', 'Le compte 70100000 est en sommeil.']]),
    });
    expect(plan.motifRefus).toBeNull();
    expect(plan.repris.map((r) => r.numero)).toEqual(['60100000']);
    expect(plan.repris[0].annuel).toBe(1200);
    expect(plan.repris[0].lignes).toHaveLength(13);
    expect(plan.repris[0].lignes.filter((l) => l.mois !== null).reduce((t, l) => t + l.montant, 0)).toBe(1200);
    expect(plan.nonRepris).toEqual([
      { compteId: 'c2', numero: '62200000', intitule: 'Locations', motif: MOTIF_DEJA_DOTE_EN_N1 },
      { compteId: 'c3', numero: '70100000', intitule: 'Ventes', motif: 'Le compte 70100000 est en sommeil.' },
    ]);
  });

  it('un compte déjà doté en N+1 n’est jamais complété ni écrasé, même pour un seul mois', () => {
    const plan = planDuReportBudgetsComptes({
      moisSource: douze,
      moisDestination: douze,
      budgets,
      comptes,
      dejaDotes: new Set(['c1']),
      horsSaisie: new Map(),
    });
    expect(plan.repris.find((r) => r.compteId === 'c1')).toBeUndefined();
    expect(plan.nonRepris.find((r) => r.compteId === 'c1')?.motif).toBe(MOTIF_DEJA_DOTE_EN_N1);
  });

  it('deux exercices de mois différents ne se reportent pas · rien n’est proratisé', () => {
    const six = moisDeLExercice(new Date('2026-07-01'), new Date('2026-12-31'));
    const plan = planDuReportBudgetsComptes({
      moisSource: six,
      moisDestination: douze,
      budgets,
      comptes,
      dejaDotes: new Set(),
      horsSaisie: new Map(),
    });
    expect(plan.motifRefus).toBe(MOTIF_MOIS_DIFFERENTS);
    expect(plan.repris).toEqual([]);
  });
});
