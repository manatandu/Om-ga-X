import { PLAN_COMPTES_SYSCOHADA } from '../comptes/compte-seed-syscohada';
import { PLAN_COMPTES_SYCEBNL } from '../comptes/compte-seed';
import {
  COMPTE_CHARGE_CONSTATEE_AVANCE,
  COMPTE_PRODUIT_CONSTATE_AVANCE,
  RACINES,
  avertissementOperation,
  contrePassation,
  coursEnVigueur,
  interetsCalcules,
  motifRefusCompte,
  motifRefusCours,
  motifRefusMiseEnPlace,
  motifRefusOperation,
  motifRefusRegularisation,
  pieceEcheance,
  pieceMiseEnPlace,
  regularisationALaCloture,
  type OperationSaisie,
} from './operations-tresorerie';

/**
 * LES RÈGLES PURES DES FINANCEMENTS ET PLACEMENTS (ligne sage-l3, fonction
 * 47, décision D16) · ce qui casserait en silence. (1) Chaque racine est
 * semée aux DEUX plans · un numéro absent ne lèverait rien et la liste des
 * comptes resterait vide. (2) Chaque pièce boucle, le net du financement est
 * ce qui reste du crédit. (3) Le dépôt bloqué plus d'un an va au 2784, jamais
 * au 525. (4) La régularisation rattache la part COURUE (post-comptés) ou NON
 * COURUE (précomptés), et sa contre-passation est l'inverse exact.
 */
const base = (o: Partial<OperationSaisie> = {}): OperationSaisie => ({
  type: 'FINANCEMENT',
  reference: 'CT-2026-01',
  dateMiseEnPlace: '2026-10-01',
  dateEcheance: '2027-03-31',
  montant: 10_000_000,
  tauxFixe: 12,
  baseCalcul: 360,
  modeInterets: 'POST_COMPTES',
  frais: 50_000,
  referenceConvention: 'Convention 12/2026',
  dateConvention: '2026-09-20',
  ...o,
});

const somme = (lignes: { debit: number; credit: number }[]) => Math.round(lignes.reduce((s, l) => s + (l.debit - l.credit) * 100, 0));

describe('operations-tresorerie · les comptes des fiches, semés aux deux plans', () => {
  for (const [nom, plan] of [
    ['SYSCOHADA', PLAN_COMPTES_SYSCOHADA],
    ['SYCEBNL', PLAN_COMPTES_SYCEBNL],
  ] as const) {
    it(`${nom} · chaque racine d'un rôle ouvre au moins un compte d'imputation`, () => {
      const numeros = plan.map((c) => c.numero);
      for (const type of ['FINANCEMENT', 'PLACEMENT'] as const) {
        for (const [role, racines] of Object.entries(RACINES[type])) {
          for (const r of racines) expect([type, role, r, numeros.some((n) => n.startsWith(r) && n.length === 8)]).toEqual([type, role, r, true]);
        }
      }
    });
    it(`${nom} · le 476 et le 477 sont semés à huit chiffres`, () => {
      const numeros = new Set(plan.map((c) => c.numero));
      expect(numeros.has(COMPTE_CHARGE_CONSTATEE_AVANCE)).toBe(true);
      expect(numeros.has(COMPTE_PRODUIT_CONSTATE_AVANCE)).toBe(true);
    });
  }

  it("les intérêts d'un financement vont au 6745, jamais au 631 (fiche du compte 67)", () => {
    expect(RACINES.FINANCEMENT.INTERETS).toEqual(['6745']);
    expect(motifRefusCompte('FINANCEMENT', 'INTERETS', '63100000')).toMatch(/6745/);
    expect(motifRefusCompte('FINANCEMENT', 'INTERETS', '67450000')).toBeNull();
  });
});

describe('operations-tresorerie · la déclaration', () => {
  it('admet un crédit de trésorerie complet', () => {
    expect(motifRefusOperation(base(), '56100000')).toBeNull();
  });
  it('refuse au-delà de deux ans (fiche du compte 56) et avertit au-delà d’un an', () => {
    expect(motifRefusOperation(base({ dateEcheance: '2028-10-02' }), '56100000')).toMatch(/deux ans au plus/);
    expect(motifRefusOperation(base({ dateEcheance: '2028-10-01' }), '56100000')).toBeNull();
    expect(avertissementOperation({ type: 'FINANCEMENT', dateMiseEnPlace: '2026-10-01', dateEcheance: '2027-10-02' })).toMatch(/plus d'un an/);
    expect(avertissementOperation({ type: 'FINANCEMENT', dateMiseEnPlace: '2026-10-01', dateEcheance: '2027-10-01' })).toBeNull();
  });
  it('exige un taux fixe OU un taux de référence, jamais les deux ni aucun', () => {
    expect(motifRefusOperation(base({ tauxFixe: null }), '56100000')).toMatch(/l'un des deux/);
    expect(motifRefusOperation(base({ tauxReferenceId: 'tr1' }), '56100000')).toMatch(/l'un des deux/);
    expect(motifRefusOperation(base({ tauxFixe: null, tauxReferenceId: 'tr1', marge: 2 }), '56100000')).toBeNull();
  });
  it('refuse un montant hors centime, une convention postérieure à la mise en place, une base autre que 360 ou 365', () => {
    expect(motifRefusOperation(base({ montant: 10.005 }), '56100000')).toMatch(/centime/);
    expect(motifRefusOperation(base({ dateConvention: '2026-10-02' }), '56100000')).toMatch(/convention précède/);
    expect(motifRefusOperation(base({ baseCalcul: 366 }), '56100000')).toMatch(/360 ou de 365/);
  });
  it('un dépôt bloqué plus d’un an va au 2784, un dépôt débloquable au 525 (fiche du compte 52)', () => {
    const depot = base({ type: 'PLACEMENT', dateEcheance: '2027-12-31', deblocableAToutMoment: false });
    expect(motifRefusOperation(depot, '52500000')).toMatch(/2784/);
    expect(motifRefusOperation(depot, '27840000')).toBeNull();
    expect(motifRefusOperation({ ...depot, deblocableAToutMoment: true }, '27840000')).toMatch(/525/);
    expect(motifRefusOperation({ ...depot, deblocableAToutMoment: true }, '52500000')).toBeNull();
    expect(motifRefusOperation({ ...depot, deblocableAToutMoment: undefined }, '52500000')).toMatch(/se débloque/);
  });
  it('les précomptés et les frais ne dépassent pas le crédit', () => {
    expect(motifRefusMiseEnPlace({ type: 'FINANCEMENT', montant: 100, modeInterets: 'PRECOMPTES', frais: 10 }, 90)).toMatch(/dépassent le crédit/);
    expect(motifRefusMiseEnPlace({ type: 'FINANCEMENT', montant: 100, modeInterets: 'PRECOMPTES', frais: 10 }, 89.99)).toBeNull();
  });
});

describe('operations-tresorerie · les cours de référence', () => {
  it('le cours en vigueur est le plus récent sans dépasser la date · jamais un cours postérieur', () => {
    const cours = [{ date: new Date('2026-01-01'), v: 1 }, { date: new Date('2026-06-01'), v: 2 }, { date: new Date('2026-12-01'), v: 3 }];
    expect(coursEnVigueur(cours, new Date('2026-07-15'))?.v).toBe(2);
    expect(coursEnVigueur(cours, new Date('2025-12-31'))).toBeNull();
  });
  it('un cours exige sa source', () => {
    expect(motifRefusCours({ date: '2026-01-01', valeur: 7.5, source: '' })).toMatch(/source/);
    expect(motifRefusCours({ date: '2026-01-01', valeur: 7.5, source: 'BCC, communiqué du 1er janvier' })).toBeNull();
  });
});

describe('operations-tresorerie · les pièces bouclent', () => {
  it('mise en place d’un financement à précomptés · D 52 net, D 6745, D 631 / C 561', () => {
    const l = pieceMiseEnPlace({ type: 'FINANCEMENT', montant: 10_000_000, modeInterets: 'PRECOMPTES', frais: 50_000 }, 300_000);
    expect(l).toEqual([
      { role: 'BANQUE', debit: 9_650_000, credit: 0 },
      { role: 'INTERETS', debit: 300_000, credit: 0 },
      { role: 'FRAIS', debit: 50_000, credit: 0 },
      { role: 'PRINCIPAL', debit: 0, credit: 10_000_000 },
    ]);
    expect(somme(l)).toBe(0);
  });
  it('mise en place et échéance d’un dépôt à post-comptés · D 525 / C 52, puis D 52 / C 525 / C 77', () => {
    const mise = pieceMiseEnPlace({ type: 'PLACEMENT', montant: 5_000_000, modeInterets: 'POST_COMPTES', frais: 0 }, 0);
    expect(mise).toEqual([
      { role: 'PRINCIPAL', debit: 5_000_000, credit: 0 },
      { role: 'BANQUE', debit: 0, credit: 5_000_000 },
    ]);
    const ech = pieceEcheance({ type: 'PLACEMENT', montant: 5_000_000, modeInterets: 'POST_COMPTES' }, 125_000);
    expect(ech).toEqual([
      { role: 'BANQUE', debit: 5_125_000, credit: 0 },
      { role: 'PRINCIPAL', debit: 0, credit: 5_000_000 },
      { role: 'INTERETS', debit: 0, credit: 125_000 },
    ]);
    expect(somme(ech)).toBe(0);
  });
  it('les intérêts que les conditions donnent · 10 000 000 à 12 % sur 90 jours, base 360', () => {
    expect(interetsCalcules(10_000_000, 12, 90, 360)).toBe(300_000);
  });
});

describe('operations-tresorerie · la clôture rattache l’intérêt à son exercice', () => {
  const o = { type: 'FINANCEMENT' as const, modeInterets: 'POST_COMPTES' as const, dateMiseEnPlace: new Date('2026-10-01'), dateEcheance: new Date('2027-03-30') };
  it('post-comptés · la part courue au 566 (D 6745 / C 566), au prorata des jours', () => {
    // 180 jours, 91 écoulés au 31 décembre · 540 000 × 91 / 180 = 273 000.
    const r = regularisationALaCloture(o, 540_000, new Date('2026-12-31'));
    expect(r).toEqual({ montant: 273_000, lignes: [{ role: 'INTERETS', debit: 273_000, credit: 0 }, { role: 'COURUS', debit: 0, credit: 273_000 }] });
  });
  it('précomptés · la part NON courue en avance (D 476 / C 6745)', () => {
    const r = regularisationALaCloture({ ...o, modeInterets: 'PRECOMPTES' }, 540_000, new Date('2026-12-31'));
    expect(r).toEqual({ montant: 267_000, lignes: [{ role: 'AVANCE', debit: 267_000, credit: 0 }, { role: 'INTERETS', debit: 0, credit: 267_000 }] });
  });
  it('rien à rattacher hors du chevauchement', () => {
    expect(regularisationALaCloture(o, 540_000, new Date('2027-03-30'))).toBeNull();
    expect(regularisationALaCloture(o, 540_000, new Date('2026-09-30'))).toBeNull();
  });
  it('la contre-passation est l’inverse exact, ligne à ligne', () => {
    const r = regularisationALaCloture(o, 540_000, new Date('2026-12-31'))!;
    expect(contrePassation(r.lignes)).toEqual([{ role: 'INTERETS', debit: 0, credit: 273_000 }, { role: 'COURUS', debit: 273_000, credit: 0 }]);
  });
  it('la part constatée d’avance ne dépasse pas les précomptés', () => {
    expect(motifRefusRegularisation(300_001, 'PRECOMPTES', 300_000)).toMatch(/ne dépasse pas/);
    expect(motifRefusRegularisation(300_000, 'PRECOMPTES', 300_000)).toBeNull();
    expect(motifRefusRegularisation(0, 'POST_COMPTES', 0)).toMatch(/strictement positif/);
  });
});
