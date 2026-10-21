"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const etats_financiers_syscohada_service_1 = require("../etats-financiers-syscohada/etats-financiers-syscohada.service");
const cumul_consolidation_1 = require("./cumul-consolidation");
const flux_capitaux_consolides_1 = require("./flux-capitaux-consolides");
const svc = new etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService(null, null);
const flux = (n, n1) => svc.resoudreFluxSurLignes(n, n1);
const b = (lignes) => lignes.map(([numero, solde, md, mc]) => ({ numero, intitule: numero, solde, mouvementDebit: md ?? 0, mouvementCredit: mc ?? 0 }));
const ent = (id, pct, balance, estConsolidante = false) => ({
    id,
    nom: id,
    estConsolidante,
    methode: 'IG',
    pctInteret: pct,
    balance,
});
const acq = (extra = {}) => ({
    detentriceId: 'M',
    detenueId: 'F',
    pctCapital: 80,
    coutAcquisition: 800,
    compteTitres: '26100000',
    dateEntree: new Date('2024-01-01'),
    capitauxPropresEntree: 1000,
    modeDureeEcart: 'NON_DETERMINABLE',
    dividendesExercice: 0,
    ...extra,
});
const EX25 = { dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') };
const EX26 = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const M25 = [['26100000', 800], ['24100000', 1000], ['28410000', -100], ['52100000', 600], ['10100000', -1000], ['11800000', -500], ['70100000', -1000], ['60100000', 200]];
const F25 = [['24500000', 1500], ['28450000', -300], ['31100000', 200], ['52100000', 400], ['40100000', -300], ['10100000', -1000], ['11800000', -300], ['70100000', -500], ['60100000', 300]];
const M26 = [
    ['26100000', 800],
    ['24100000', 1400, 400, 0],
    ['28410000', -200, 0, 100],
    ['52100000', 830, 1080, 850],
    ['10100000', -1000],
    ['11800000', -1150, 150, 0],
    ['46500000', 0, 150, 150],
    ['70100000', -1000, 0, 1000],
    ['60100000', 300, 300, 0],
    ['68130000', 100, 100, 0],
    ['77200000', -80, 0, 80],
];
const F26 = [
    ['24500000', 1500],
    ['28450000', -450, 0, 150],
    ['31100000', 250, 50, 0],
    ['52100000', 900, 1100, 600],
    ['40100000', -250, 400, 350],
    ['16200000', -400, 100, 500],
    ['10100000', -1000],
    ['11800000', -400, 100, 0],
    ['46500000', 0, 100, 100],
    ['70100000', -600, 0, 600],
    ['60100000', 350, 350, 0],
    ['68130000', 150, 150, 0],
    ['60310000', -50, 0, 50],
];
const lignesMere = (lignes) => lignes.map(([numero, solde, md = 0, mc = 0]) => {
    const report = solde - md + mc;
    return {
        compteId: numero,
        numero,
        intitule: numero,
        classe: `CLASSE_${numero[0]}`,
        typeCompte: 'DETAIL',
        totalDebit: Math.max(report, 0) + md,
        totalCredit: Math.max(-report, 0) + mc,
        reportDebit: Math.max(report, 0),
        reportCredit: Math.max(-report, 0),
        mouvementDebit: md,
        mouvementCredit: mc,
        solde,
    };
});
function groupe(opts = {}) {
    const cumulN1 = (0, cumul_consolidation_1.cumulerConsolidation)(EX25, [ent('M', 100, b(M25), true), ent('F', 80, b(F25))], [acq()], []);
    const cumulN = (0, cumul_consolidation_1.cumulerConsolidation)(EX26, [ent('M', 100, b(M26), true), ent('F', 80, b(opts.f26 ?? F26))], [
        acq({ dividendesExercice: 80, compteDividendes: '77200000', ...opts.acq26 }),
    ], []);
    return {
        cumulN,
        cumulN1,
        consolidanteN: lignesMere(M26),
        consolidanteN1: lignesMere(M25),
        variationsPerimetre: opts.variationsPerimetre ?? [],
    };
}
const net = (t, cle) => t.lignes.find((l) => l.cle === cle)?.net;
describe('tableau des flux consolidé · le cas chiffré', () => {
    const t = (0, flux_capitaux_consolides_1.construireTableauFluxConsolide)(groupe(), flux);
    it('A · trésorerie d’ouverture 1 000', () => {
        expect(net(t, 'TRESORERIE_OUVERTURE')).toBe(1000);
    });
    it('B · CAFG 1 000, besoin de financement −100', () => {
        expect(net(t, 'CAFG')).toBe(1000);
        expect(net(t, 'VARIATION_BF')).toBe(-100);
        expect(net(t, 'FLUX_OPERATIONNELS')).toBe(900);
    });
    it('C · acquisition de matériel −400', () => {
        expect(net(t, 'DECAISSEMENTS_CORPORELLES')).toBe(-400);
        expect(net(t, 'FLUX_INVESTISSEMENT')).toBe(-400);
    });
    it('D · dividendes de la mère −150 et des minoritaires −20, emprunt +500 et remboursement −100 présentés BRUTS', () => {
        expect(net(t, 'DIVIDENDES_CONSOLIDANTE')).toBe(-150);
        expect(net(t, 'DIVIDENDES_MINORITAIRES')).toBe(-20);
        expect(net(t, 'EMPRUNTS')).toBe(500);
        expect(net(t, 'REMBOURSEMENTS')).toBe(-100);
        expect(net(t, 'FLUX_FINANCEMENT')).toBe(230);
    });
    it('E et F · variation 730, trésorerie 1 730, et le contrôle par le bilan boucle', () => {
        expect(net(t, 'VARIATION_PERIODE')).toBe(730);
        expect(net(t, 'TRESORERIE_CLOTURE')).toBe(1730);
        expect(t.controle).toEqual({ tresorerieParLesFlux: 1730, tresorerieParLeBilan: 1730, ecart: 0, ok: true });
    });
    it('sans entité convertie, l’incidence des devises est nulle et le dit · H = E', () => {
        expect(net(t, 'INCIDENCE_DEVISES')).toBe(0);
        expect(t.lignes.find((l) => l.cle === 'INCIDENCE_DEVISES')?.lecture).toMatch(/Aucune entité du périmètre n’est convertie/);
        expect(net(t, 'VARIATION_HORS_DEVISES')).toBe(730);
    });
    it('une entité convertie refuse le tableau, son incidence (G) n’étant pas séparée', () => {
        const e = groupe();
        const cumulN = { ...e.cumulN, obstaclesFlux: ['« F » est convertie de USD en CDF · l’incidence des variations de cours des devises (G) n’est pas séparée.'] };
        expect((0, flux_capitaux_consolides_1.construireTableauFluxConsolide)({ ...e, cumulN }, flux).lignes).toBeNull();
    });
    it('un compte soldé à la clôture garde ses mouvements · le 465 de la mère', () => {
        const l = (0, flux_capitaux_consolides_1.lignesAvecMouvements)(groupe().cumulN).find((x) => x.numero === '46500000');
        expect(l).toMatchObject({ solde: 0, mouvementDebit: 250, mouvementCredit: 250 });
    });
});
describe('tranche 4a · l’écart d’évaluation d’un stock sorti ne se lit pas comme un encaissement', () => {
    it('la CAFG en est diminuée, comme de l’élimination des résultats internes', () => {
        const e = groupe();
        const t = (0, flux_capitaux_consolides_1.construireTableauFluxConsolide)({ ...e, cumulN: { ...e.cumulN, ecartsEvaluationStocksResultat: 50 } }, flux);
        expect(net(t, 'CAFG')).toBe(950);
        expect(t.lignes.find((l) => l.cle === 'CAFG')?.lecture).toMatch(/écarts d’évaluation des stocks sortis/);
    });
});
describe('tableau des flux consolidé · les refus, chacun nommé', () => {
    it('une filiale importée sans mouvements', () => {
        const t = (0, flux_capitaux_consolides_1.construireTableauFluxConsolide)(groupe({ f26: F26.map(([n, s]) => [n, s]) }), flux);
        expect(t.lignes).not.toBeNull();
        const sans = groupe();
        const ent26 = (0, cumul_consolidation_1.cumulerConsolidation)(EX26, [ent('M', 100, b(M26), true), ent('F', 80, F26.map(([numero, solde]) => ({ numero, intitule: numero, solde })))], [
            acq({ dividendesExercice: 80, compteDividendes: '77200000' }),
        ], []);
        const r = (0, flux_capitaux_consolides_1.construireTableauFluxConsolide)({ ...sans, cumulN: ent26 }, flux);
        expect(r.lignes).toBeNull();
        expect(r.obstacles.join(' ')).toMatch(/« F » ne porte pas les mouvements/);
    });
    it('un capital de filiale qui bouge', () => {
        const f = F26.map((l) => (l[0] === '10100000' ? ['10100000', -1000, 0, 0.01] : l));
        const r = (0, flux_capitaux_consolides_1.construireTableauFluxConsolide)(groupe({ f26: f }), flux);
        expect(r.obstacles.join(' ')).toMatch(/capital de « F » a bougé/);
    });
    it('des titres consolidés achetés ou cédés dans l’exercice', () => {
        const e = groupe();
        const m = M26.map((l) => (l[0] === '26100000' ? ['26100000', 800, 5, 5] : l));
        const cumulN = (0, cumul_consolidation_1.cumulerConsolidation)(EX26, [ent('M', 100, b(m), true), ent('F', 80, b(F26))], [
            acq({ dividendesExercice: 80, compteDividendes: '77200000' }),
        ], []);
        expect((0, flux_capitaux_consolides_1.construireTableauFluxConsolide)({ ...e, cumulN }, flux).obstacles.join(' ')).toMatch(/change le pourcentage/);
    });
    it('une variation de périmètre', () => {
        const r = (0, flux_capitaux_consolides_1.construireTableauFluxConsolide)(groupe({ variationsPerimetre: ['« G » est entrée dans le périmètre.'] }), flux);
        expect(r.lignes).toBeNull();
        expect(r.obstacles).toContain('« G » est entrée dans le périmètre.');
    });
});
describe('variation des capitaux propres consolidés', () => {
    const e = groupe();
    const v = (0, flux_capitaux_consolides_1.construireVariationCapitauxPropres)(e.cumulN, e.cumulN1, e.consolidanteN);
    const ligne = (cle) => v.lignes.find((l) => l.cle === cle).montants;
    it('clôture N-1 · capital 1 000, réserves 740, résultat 960, minoritaires 300', () => {
        expect(ligne('CLOTURE_N1')).toMatchObject({ capital: 1000, reserves: 740, resultat: 960, groupe: 2700, minoritaires: 300, total: 3000 });
    });
    it('mouvements · affectation, distribution de 150, résultat 720 et 30, et rien d’inexpliqué', () => {
        expect(ligne('AFFECTATION_N1')).toMatchObject({ reserves: 960, resultat: -960, total: 0 });
        expect(ligne('DISTRIBUTIONS_CONSOLIDANTE')).toMatchObject({ reserves: -150 });
        expect(ligne('RESULTAT_N')).toMatchObject({ resultat: 720, minoritaires: 30 });
        expect(ligne('AUTRES_RESERVES').reserves).toBe(0);
        expect(ligne('MINORITAIRES_DISTRIBUTIONS').minoritaires).toBe(-20);
    });
    it('clôture N · la somme des mouvements retombe sur la clôture, colonne par colonne', () => {
        const cloture = ligne('CLOTURE_N');
        expect(cloture).toMatchObject({ capital: 1000, reserves: 1550, resultat: 720, minoritaires: 310 });
        const cles = ['capital', 'primes', 'reserves', 'resultat', 'reevaluation', 'minoritaires', 'total'];
        const mouvements = v.lignes.filter((l) => l.cle !== 'CLOTURE_N');
        for (const k of cles) {
            expect(mouvements.reduce((s, l) => s + (l.montants[k] ?? 0), 0)).toBeCloseTo(cloture[k] ?? 0, 2);
        }
    });
    it('les écarts de conversion ont leur colonne · clôture N-1, variation, clôture N, et la part du groupe les compte', () => {
        const avec = (c, x) => ({ ...c, capitauxPropres: { ...c.capitauxPropres, ecartsConversion: x } });
        const w = (0, flux_capitaux_consolides_1.construireVariationCapitauxPropres)(avec(e.cumulN, 50), avec(e.cumulN1, 20), e.consolidanteN);
        const l = (cle) => w.lignes.find((x) => x.cle === cle).montants;
        expect(l('CLOTURE_N1')).toMatchObject({ conversion: 20, groupe: 2720 });
        expect(l('VARIATION_CONVERSION')).toMatchObject({ conversion: 30, groupe: 30 });
        expect(l('CLOTURE_N').conversion).toBe(50);
    });
});
//# sourceMappingURL=flux-capitaux-consolides.spec.js.map