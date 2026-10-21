"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const report_a_nouveau_1 = require("./report-a-nouveau");
const l = (debit, credit, lettre = null) => ({
    debit,
    credit,
    lettre,
    libelle: 'L',
    dateEcheance: null,
});
const comptes = [
    { id: '601', numero: '601', intitule: 'Achats', modeReportANouveau: 'AUCUN', lignes: [l(1000, 0)] },
    { id: '701', numero: '701', intitule: 'Ventes', modeReportANouveau: 'AUCUN', lignes: [l(0, 1500)] },
    { id: '521', numero: '521', intitule: 'Banque', modeReportANouveau: 'SOLDE', lignes: [l(1500, 0), l(0, 1000)] },
    { id: '131', numero: '131', intitule: 'Excédent', modeReportANouveau: 'SOLDE', lignes: [] },
    { id: '411', numero: '411', intitule: 'Clients', modeReportANouveau: 'DETAIL', lignes: [l(300, 0), l(200, 0, 'AA')] },
    { id: '401', numero: '401', intitule: 'Fournisseurs', modeReportANouveau: 'DETAIL', lignes: [l(0, 300)] },
];
describe('Report à-nouveau · un seul calcul pour la clôture et le provisoire', () => {
    it('le résultat est lu sur les comptes de gestion · négatif = excédent', () => {
        expect((0, report_a_nouveau_1.resultatDesComptesDeGestion)(comptes)).toBe(-500);
    });
    it('reporte les soldes, le détail non lettré, et le résultat sur son compte · le report s’équilibre', () => {
        const r = (0, report_a_nouveau_1.lignesReportANouveau)(comptes, { compteId: '131', montant: -500 });
        expect(r.find((x) => x.compteId === '521')).toMatchObject({ debit: 500, credit: 0 });
        expect(r.find((x) => x.compteId === '131')).toMatchObject({ debit: 0, credit: 500 });
        expect(r.filter((x) => x.compteId === '411')).toHaveLength(1);
        expect(r.some((x) => x.compteId === '601' || x.compteId === '701')).toBe(false);
        const d = r.reduce((s, x) => s + x.debit, 0);
        const c = r.reduce((s, x) => s + x.credit, 0);
        expect(d).toBe(c);
    });
    it("reporte un budget sans jamais écraser celui déjà saisi, ni doter une convention close", () => {
        const r = (0, report_a_nouveau_1.budgetsAReporter)([
            { sectionId: 'a', mois: null, montant: 100 },
            { sectionId: 'b', mois: null, montant: 200 },
            { sectionId: 'c', mois: 3, montant: 30 },
        ], [{ sectionId: 'a', mois: null }], new Set(['b']));
        expect(r).toEqual([{ sectionId: 'c', mois: 3, montant: 30 }]);
    });
});
describe('AU2 · rectificationDeLOuverture', () => {
    const passee = (compteId, debit, credit) => ({
        compteId, debit, credit, libelle: 'Import', dateEcheance: null, deviseId: null, montantDevise: null, coursApplique: null,
    });
    const report = (0, report_a_nouveau_1.lignesReportANouveau)(comptes, { compteId: '131', montant: -500 });
    it('un import égal au report, compte par compte · rien à passer', () => {
        const r = (0, report_a_nouveau_1.rectificationDeLOuverture)(report, [passee('521', 500, 0), passee('411', 300, 0), passee('401', 0, 300), passee('131', 0, 500)]);
        expect(r).toEqual({ lignes: [], comptesRectifies: [], negatifs: [] });
    });
    it('un import faux · négatif de ses lignes PUIS report exact, compte par compte, l’ensemble équilibré', () => {
        const r = (0, report_a_nouveau_1.rectificationDeLOuverture)(report, [passee('521', 500, 0), passee('411', 450, 0), passee('401', 0, 300), passee('131', 0, 650)]);
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
        const r = (0, report_a_nouveau_1.rectificationDeLOuverture)(report, [passee('521', 500, 0), passee('411', 300, 0), passee('131', 0, 500), passee('471', 0, 300)]);
        expect(r.comptesRectifies.sort()).toEqual(['401', '471']);
        expect(r.lignes.find((x) => x.compteId === '471')).toMatchObject({ debit: -0, credit: -300 });
        expect(r.lignes.find((x) => x.compteId === '401')).toMatchObject({ debit: 0, credit: 300 });
    });
});
describe('AU1 · apparierTenues', () => {
    const tenue = (compteId, debit, credit, extra = {}) => ({
        compteId, debit, credit, dateEcheance: null, deviseId: null, montantDevise: null, lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null, ...extra,
    });
    const candidate = (id, compteId, debit, credit, extra = {}) => ({
        id, compteId, debit, credit, dateEcheance: null, deviseId: null, montantDevise: null, ...extra,
    });
    it('chaque candidate sert une fois, l’appariement exact (échéance) passe avant le seul montant', () => {
        const e1 = new Date('2027-02-01');
        const r = (0, report_a_nouveau_1.apparierTenues)([tenue('411', 300, 0), tenue('411', 300, 0, { dateEcheance: e1 })], [candidate('a', '411', 300, 0), candidate('b', '411', 300, 0, { dateEcheance: e1 })]);
        expect(r).toEqual(['a', 'b']);
    });
    it('ni le compte ni le montant ne se devinent · sans équivalent, null', () => {
        expect((0, report_a_nouveau_1.apparierTenues)([tenue('411', 300, 0)], [candidate('a', '401', 300, 0), candidate('b', '411', 299, 0)])).toEqual([null]);
        expect((0, report_a_nouveau_1.apparierTenues)([tenue('411', 300, 0), tenue('411', 300, 0)], [candidate('a', '411', 300, 0)])).toEqual(['a', null]);
    });
});
describe('AU2 second tour · par compte ET par devise (R2), sans devinette (R3)', () => {
    const passee = (compteId, debit, credit, deviseId = null, montantDevise = null) => ({
        compteId, debit, credit, libelle: 'Import', dateEcheance: null, deviseId, montantDevise, coursApplique: null,
    });
    const ran = (compteId, debit, credit, deviseId, montantDevise) => ({
        compteId, debit, credit, libelle: 'RAN', ...(deviseId ? { deviseId, montantDevise } : {}),
    });
    it('R2 · le report en dollars contre un import en francs seuls, mêmes francs · deux positions divergentes, jamais concordant', () => {
        const e = (0, report_a_nouveau_1.confrontationDeLOuverture)([ran('411', 3_600_000, 0, 'usd', 1500)], [passee('411', 3_600_000, 0)]);
        expect(e).toEqual([
            { compteId: '411', deviseId: 'usd', cloture: 3_600_000, ouverture: 0, clotureDevise: 1500, ouvertureDevise: 0 },
            { compteId: '411', deviseId: null, cloture: 0, ouverture: 3_600_000, clotureDevise: null, ouvertureDevise: null },
        ]);
    });
    it('R2 · mêmes francs, même devise, autre montant en devise · divergent', () => {
        expect((0, report_a_nouveau_1.confrontationDeLOuverture)([ran('411', 3_600_000, 0, 'usd', 1500)], [passee('411', 3_600_000, 0, 'usd', 1400)])).toHaveLength(1);
    });
    it('R10 · une ouverture annulée par son négatif est nulle', () => {
        expect((0, report_a_nouveau_1.ouvertureNulle)([passee('411', 600, 0), passee('411', -600, 0), passee('131', 0, 600), passee('131', 0, -600)])).toBe(true);
        expect((0, report_a_nouveau_1.ouvertureNulle)([passee('411', 600, 0), passee('131', 0, 600)])).toBe(false);
    });
    it('R3 · la devise ne se relâche jamais', () => {
        const t = { compteId: '411', debit: 300, credit: 0, dateEcheance: null, deviseId: 'usd', montantDevise: 1, lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null };
        expect((0, report_a_nouveau_1.apparierTenues)([t], [{ id: 'a', compteId: '411', debit: 300, credit: 0, dateEcheance: null, deviseId: null, montantDevise: null }])).toEqual([null]);
    });
});
//# sourceMappingURL=report-a-nouveau.spec.js.map