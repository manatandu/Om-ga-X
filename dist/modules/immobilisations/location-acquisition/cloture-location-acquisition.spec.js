"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const echeancier_location_acquisition_1 = require("./echeancier-location-acquisition");
const cloture_location_acquisition_1 = require("./cloture-location-acquisition");
const EXEMPLE = {
    nature: client_1.NatureLocationAcquisition.CREDIT_BAIL_MOBILIER,
    datePriseEffet: new Date('2026-01-01T00:00:00Z'),
    dureeMois: 96,
    periodicite: 'ANNUELLE',
    termeAEchoir: false,
    loyer: 90000,
    prixOption: 0,
    optionRaisonnablementCertaine: true,
    bienDeFaibleValeur: false,
    tauxAnnuel: 0.0786,
};
const ex = (an) => ({ dateDebut: new Date(`${an}-01-01T00:00:00Z`), dateFin: new Date(`${an}-12-31T00:00:00Z`) });
const ventiler = (c, an) => {
    const e = (0, echeancier_location_acquisition_1.construireEcheancier)(c);
    return (0, cloture_location_acquisition_1.ventilerExercice)(e.lignes, c.datePriseEffet, e.dette, e.tauxPeriodique, ex(an));
};
describe('clôture · loyers échus et intérêts courus', () => {
    it('loyers échus au 31/12 · le 623 se vire en entier, 17 + 672 = loyer', () => {
        const c = { ...EXEMPLE, datePriseEffet: new Date('2025-12-31T00:00:00Z') };
        const v = ventiler(c, 2026);
        expect(v.rangs).toEqual([1]);
        expect(v.loyers).toBe(90000);
        expect(v.capital + v.interets).toBe(90000);
        expect(v.interets).toBeCloseTo(519956.68 * 0.0786, 0);
        expect(v.interetsCourus).toBe(0);
    });
    it('premier loyer en N+1 · rien à virer, une année entière d’intérêts court', () => {
        const v = ventiler(EXEMPLE, 2026);
        expect(v.loyers).toBe(0);
        expect(v.interetsCourus).toBeCloseTo(519956.68 * 0.0786, 0);
    });
    it('l’année suivante, le loyer échu porte les intérêts de l’année passée · d’où l’extourne', () => {
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)(EXEMPLE);
        const v2027 = ventiler(EXEMPLE, 2027);
        expect(v2027.rangs).toEqual([1]);
        expect(v2027.interets).toBe(e.lignes[0].interets);
        expect(ventiler(EXEMPLE, 2026).interetsCourus).toBeCloseTo(e.lignes[0].interets, 0);
    });
    it('loyers mensuels · douze échéances, une fraction de mois court', () => {
        const c = { ...EXEMPLE, datePriseEffet: new Date('2026-01-15T00:00:00Z'), periodicite: 'MENSUELLE', loyer: 7000 };
        const v = ventiler(c, 2026);
        expect(v.rangs).toHaveLength(11);
        expect(v.loyers).toBe(77000);
        expect(v.interetsCourus).toBeGreaterThan(0);
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)(c);
        expect(v.interetsCourus).toBeLessThan(e.lignes[11].interets);
    });
    it('l’option n’est pas un loyer · sa ligne reste à la levée', () => {
        const c = { ...EXEMPLE, datePriseEffet: new Date('2018-12-31T00:00:00Z'), prixOption: 5000 };
        const v = ventiler(c, 2026);
        expect(v.rangs).toEqual([8]);
        expect(v.loyers).toBe(90000);
    });
    it('option levée · le prix entre avec la dernière échéance ; non levée · jamais, et rien ne court vers lui', () => {
        const c = { ...EXEMPLE, datePriseEffet: new Date('2018-12-31T00:00:00Z'), prixOption: 5000 };
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)(c);
        const v = (levee, an) => (0, cloture_location_acquisition_1.ventilerExercice)(e.lignes, c.datePriseEffet, e.dette, e.tauxPeriodique, ex(an), levee);
        expect(v(true, 2026)).toMatchObject({ rangs: [8, 9], loyers: 95000, optionNonDeclaree: false });
        expect(v(false, 2026)).toMatchObject({ rangs: [8], loyers: 90000, optionNonDeclaree: false });
        expect(v(null, 2026).optionNonDeclaree).toBe(true);
        const d = { ...c, termeAEchoir: true, datePriseEffet: new Date('2019-01-01T00:00:00Z') };
        const f = (0, echeancier_location_acquisition_1.construireEcheancier)(d);
        const w = (levee) => (0, cloture_location_acquisition_1.ventilerExercice)(f.lignes, d.datePriseEffet, f.dette, f.tauxPeriodique, ex(2026), levee);
        expect(w(null).interetsCourus).toBeGreaterThan(0);
        expect(w(false).interetsCourus).toBe(0);
    });
});
//# sourceMappingURL=cloture-location-acquisition.spec.js.map