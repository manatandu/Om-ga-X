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
describe('garantie de valeur résiduelle (§ 2.1.2)', () => {
    it('entre dans la dette à sa valeur actualisée au terme · « paiements estimés à la fin du contrat » (§ 2.1.3)', () => {
        const sans = (0, echeancier_location_acquisition_1.construireEcheancier)(EXEMPLE);
        const avec = (0, echeancier_location_acquisition_1.construireEcheancier)({ ...EXEMPLE, garantieValeurResiduelle: 50000 });
        expect(avec.dette).toBeCloseTo(sans.dette + 50000 / Math.pow(1.0786, 8), 1);
        const derniere = avec.lignes[avec.lignes.length - 1];
        expect(derniere.garantie).toBe(true);
        expect(derniere.date.toISOString().slice(0, 10)).toBe('2034-01-01');
        expect(derniere.restant).toBe(0);
        expect(avec.lignes.filter((l) => l.garantie)).toHaveLength(1);
    });
    it('elle entre aussi dans le taux implicite tiré de la valeur du contrat', () => {
        const c = { ...EXEMPLE, tauxAnnuel: null, valeurContrat: 550000, garantieValeurResiduelle: 50000 };
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)(c);
        expect((0, echeancier_location_acquisition_1.valeurActualisee)(c, e.tauxPeriodique)).toBeCloseTo(550000, 2);
    });
    it('jamais négative', () => {
        expect((0, echeancier_location_acquisition_1.motifRefusContrat)({ ...EXEMPLE, garantieValeurResiduelle: -1 })).toContain('garantie');
    });
    const exo = { dateDebut: new Date('2034-01-01T00:00:00Z'), dateFin: new Date('2034-12-31T00:00:00Z') };
    it('à l’échéance, la clôture exige la déclaration de son appel, comme l’option', () => {
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)({ ...EXEMPLE, garantieValeurResiduelle: 50000 });
        const v = (0, cloture_location_acquisition_1.ventilerExercice)(e.lignes, EXEMPLE.datePriseEffet, e.dette, e.tauxPeriodique, exo, null, null);
        expect(v.garantieNonDeclaree).toBe(true);
        expect(v.loyers).toBe(90000);
    });
    it('appelée, elle se vire au 17 avec la dernière échéance ; non appelée, jamais, et sa part de dette se dit', () => {
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)({ ...EXEMPLE, garantieValeurResiduelle: 50000 });
        const appelee = (0, cloture_location_acquisition_1.ventilerExercice)(e.lignes, EXEMPLE.datePriseEffet, e.dette, e.tauxPeriodique, exo, null, true);
        expect(appelee.loyers).toBe(140000);
        expect(appelee.garantieNonDeclaree).toBe(false);
        const non = (0, cloture_location_acquisition_1.ventilerExercice)(e.lignes, EXEMPLE.datePriseEffet, e.dette, e.tauxPeriodique, exo, null, false);
        expect(non.loyers).toBe(90000);
        expect(non.garantieNonAppelee).toBeCloseTo(50000, 0);
    });
    it('sans garantie, rien ne change · aucune ligne, aucune déclaration réclamée', () => {
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)(EXEMPLE);
        expect(e.lignes.some((l) => l.garantie)).toBe(false);
        const v = (0, cloture_location_acquisition_1.ventilerExercice)(e.lignes, EXEMPLE.datePriseEffet, e.dette, e.tauxPeriodique, exo);
        expect(v.garantieNonDeclaree).toBe(false);
        expect(v.garantieNonAppelee).toBe(0);
    });
});
describe('loyers indexés (§ 2.1.2)', () => {
    it('l’indice et sa valeur au commencement se déclarent ; le loyer saisi est celui qu’elle donne, la dette inchangée', () => {
        const indexe = { ...EXEMPLE, loyerIndexe: true, indiceLoyer: 'Indice des prix à la consommation', valeurIndiceCommencement: 112.4 };
        expect((0, echeancier_location_acquisition_1.motifRefusContrat)(indexe)).toBeNull();
        expect((0, echeancier_location_acquisition_1.construireEcheancier)(indexe).dette).toBe((0, echeancier_location_acquisition_1.construireEcheancier)(EXEMPLE).dette);
    });
    it('refus nommés · indice absent, valeur absente, indice sans loyer indexé', () => {
        expect((0, echeancier_location_acquisition_1.motifRefusComplements)({ loyerIndexe: true, indiceLoyer: ' ', valeurIndiceCommencement: 100 })).toContain("Nommez l'indice");
        expect((0, echeancier_location_acquisition_1.motifRefusComplements)({ loyerIndexe: true, indiceLoyer: 'IPC', valeurIndiceCommencement: null })).toContain('valeur de l');
        expect((0, echeancier_location_acquisition_1.motifRefusComplements)({ loyerIndexe: false, indiceLoyer: 'IPC' })).toContain('loyer indexé');
        expect((0, echeancier_location_acquisition_1.motifRefusComplements)({})).toBeNull();
    });
});
//# sourceMappingURL=complements-credit-bail.spec.js.map