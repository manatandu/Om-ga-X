import {
  apparierTenues,
  budgetsAReporter,
  CompteRan,
  LigneTenue,
  lignesReportANouveau,
  rectificationDeLOuverture,
  resultatDesComptesDeGestion,
} from './report-a-nouveau';

const l = (debit: number, credit: number, lettre: string | null = null) => ({
  debit,
  credit,
  lettre,
  libelle: 'L',
  dateEcheance: null,
});
const comptes: CompteRan[] = [
  { id: '601', numero: '601', intitule: 'Achats', modeReportANouveau: 'AUCUN', lignes: [l(1000, 0)] },
  { id: '701', numero: '701', intitule: 'Ventes', modeReportANouveau: 'AUCUN', lignes: [l(0, 1500)] },
  { id: '521', numero: '521', intitule: 'Banque', modeReportANouveau: 'SOLDE', lignes: [l(1500, 0), l(0, 1000)] },
  { id: '131', numero: '131', intitule: 'Excédent', modeReportANouveau: 'SOLDE', lignes: [] },
  { id: '411', numero: '411', intitule: 'Clients', modeReportANouveau: 'DETAIL', lignes: [l(300, 0), l(200, 0, 'AA')] },
  { id: '401', numero: '401', intitule: 'Fournisseurs', modeReportANouveau: 'DETAIL', lignes: [l(0, 300)] },
];

describe('Report à-nouveau · un seul calcul pour la clôture et le provisoire', () => {
  it('le résultat est lu sur les comptes de gestion · négatif = excédent', () => {
    expect(resultatDesComptesDeGestion(comptes)).toBe(-500);
  });

  it('reporte les soldes, le détail non lettré, et le résultat sur son compte · le report s’équilibre', () => {
    const r = lignesReportANouveau(comptes, { compteId: '131', montant: -500 });
    expect(r.find((x) => x.compteId === '521')).toMatchObject({ debit: 500, credit: 0 });
    expect(r.find((x) => x.compteId === '131')).toMatchObject({ debit: 0, credit: 500 });
    expect(r.filter((x) => x.compteId === '411')).toHaveLength(1); // la ligne lettrée ne passe pas
    expect(r.some((x) => x.compteId === '601' || x.compteId === '701')).toBe(false);
    const d = r.reduce((s, x) => s + x.debit, 0);
    const c = r.reduce((s, x) => s + x.credit, 0);
    expect(d).toBe(c);
  });

  it("reporte un budget sans jamais écraser celui déjà saisi, ni doter une convention close", () => {
    const r = budgetsAReporter(
      [
        { sectionId: 'a', mois: null, montant: 100 },
        { sectionId: 'b', mois: null, montant: 200 },
        { sectionId: 'c', mois: 3, montant: 30 },
      ],
      [{ sectionId: 'a', mois: null }],
      new Set(['b']),
    );
    expect(r).toEqual([{ sectionId: 'c', mois: 3, montant: 30 }]);
  });
});

/**
 * AU2 · le bilan d'ouverture ne s'écrit qu'une fois (AUDCIF art. 34 ; SYCEBNL
 * art. 16, 4)) · un import déjà passé n'est corrigé que là où il diffère, par
 * inscription en négatif puis l'enregistrement exact (AUDCIF art. 20, al. 2).
 */
describe('AU2 · rectificationDeLOuverture', () => {
  const passee = (compteId: string, debit: number, credit: number) => ({
    compteId, debit, credit, libelle: 'Import', dateEcheance: null, deviseId: null, montantDevise: null, coursApplique: null,
  });
  const report = lignesReportANouveau(comptes, { compteId: '131', montant: -500 });

  it('un import égal au report, compte par compte · rien à passer', () => {
    const r = rectificationDeLOuverture(report, [passee('521', 500, 0), passee('411', 300, 0), passee('401', 0, 300), passee('131', 0, 500)]);
    expect(r).toEqual({ lignes: [], comptesRectifies: [] });
  });

  it('un import faux · négatif de ses lignes PUIS report exact, compte par compte, l’ensemble équilibré', () => {
    const r = rectificationDeLOuverture(report, [passee('521', 500, 0), passee('411', 450, 0), passee('401', 0, 300), passee('131', 0, 650)]);
    expect(r.comptesRectifies).toEqual(['131', '411']);
    expect(r.lignes.map((x) => [x.compteId, x.debit, x.credit])).toEqual([
      ['131', -0, -650],
      ['131', 0, 500],
      ['411', -450, -0],
      ['411', 300, 0],
    ]);
    expect(r.lignes.reduce((t, x) => t + x.debit - x.credit, 0)).toBe(0);
  });

  it('un compte absent de l’import est passé entier ; un compte importé que la clôture laisse à zéro est inscrit en négatif', () => {
    const r = rectificationDeLOuverture(report, [passee('521', 500, 0), passee('411', 300, 0), passee('131', 0, 500), passee('471', 0, 300)]);
    expect(r.comptesRectifies.sort()).toEqual(['401', '471']);
    expect(r.lignes.find((x) => x.compteId === '471')).toMatchObject({ debit: -0, credit: -300 });
    expect(r.lignes.find((x) => x.compteId === '401')).toMatchObject({ debit: 0, credit: 300 });
  });
});

/**
 * AU1 · ce qui était lettré ou pointé sur le report PROVISOIRE passe sur la
 * ligne du définitif qui le remplace · même compte, mêmes montants.
 */
describe('AU1 · apparierTenues', () => {
  const tenue = (compteId: string, debit: number, credit: number, extra: Partial<LigneTenue> = {}): LigneTenue => ({
    compteId, debit, credit, dateEcheance: null, deviseId: null, montantDevise: null, lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null, ...extra,
  });
  const candidate = (id: string, compteId: string, debit: number, credit: number, extra: Record<string, unknown> = {}) => ({
    id, compteId, debit, credit, dateEcheance: null, deviseId: null, montantDevise: null, ...extra,
  });

  it('chaque candidate sert une fois, l’appariement exact (échéance) passe avant le seul montant', () => {
    const e1 = new Date('2027-02-01');
    const r = apparierTenues(
      [tenue('411', 300, 0), tenue('411', 300, 0, { dateEcheance: e1 })],
      [candidate('a', '411', 300, 0), candidate('b', '411', 300, 0, { dateEcheance: e1 })],
    );
    expect(r).toEqual(['a', 'b']);
  });

  it('ni le compte ni le montant ne se devinent · sans équivalent, null', () => {
    expect(apparierTenues([tenue('411', 300, 0)], [candidate('a', '401', 300, 0), candidate('b', '411', 299, 0)])).toEqual([null]);
    expect(apparierTenues([tenue('411', 300, 0), tenue('411', 300, 0)], [candidate('a', '411', 300, 0)])).toEqual(['a', null]);
  });
});
