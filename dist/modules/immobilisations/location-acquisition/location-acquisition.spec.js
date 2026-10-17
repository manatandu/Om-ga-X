"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const compte_seed_1 = require("../../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../../comptes/compte-seed-syscohada");
const echeancier_location_acquisition_1 = require("./echeancier-location-acquisition");
const nomenclature_location_acquisition_1 = require("./nomenclature-location-acquisition");
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
describe('échéancier · l’exemple du § 2.1.4', () => {
    it('8 loyers annuels échus de 90 000 à 7,86 % · dette d’environ 520 000', () => {
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)(EXEMPLE);
        expect(e.dette).toBe(519956.68);
        expect(e.lignes).toHaveLength(8);
        expect(e.lignes[0].date.toISOString().slice(0, 10)).toBe('2027-01-01');
    });
    it('à la valeur du contrat (520 000), le premier loyer porte 40 872 d’intérêts et 49 128 de capital', () => {
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)({ ...EXEMPLE, tauxAnnuel: null, valeurContrat: 520000 });
        expect(e.dette).toBe(520000);
        expect(Math.round(e.tauxPeriodique * 10000) / 100).toBe(7.86);
        expect(e.lignes[0].interets).toBe(Math.round(520000 * e.tauxPeriodique * 100) / 100);
        expect(Math.abs(e.lignes[0].interets - 40872)).toBeLessThan(20);
        expect(e.lignes[0].capital).toBe(Math.round((90000 - e.lignes[0].interets) * 100) / 100);
    });
    it('la dette est soldée au centime par le dernier paiement, la somme du capital rend la dette', () => {
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)({ ...EXEMPLE, periodicite: 'MENSUELLE', loyer: 7500, prixOption: 1000 });
        const der = e.lignes[e.lignes.length - 1];
        expect(der.option).toBe(true);
        expect(der.restant).toBe(0);
        const capital = e.lignes.reduce((s, l) => s + l.capital, 0);
        expect(Math.round(capital * 100) / 100).toBe(e.dette);
        for (const l of e.lignes)
            expect(Math.round((l.interets + l.capital) * 100) / 100).toBe(l.paiement);
    });
    it('terme à échoir · le premier loyer tombe à la prise d’effet, sans intérêts', () => {
        const e = (0, echeancier_location_acquisition_1.construireEcheancier)({ ...EXEMPLE, termeAEchoir: true });
        expect(e.lignes[0].date.toISOString().slice(0, 10)).toBe('2026-01-01');
        expect(e.lignes[0].interets).toBe(0);
        expect(e.dette).toBeGreaterThan(519956.68);
    });
    it('taux équivalent, jamais proportionnel · douze mois rendent le taux annuel', () => {
        const m = (0, echeancier_location_acquisition_1.tauxPeriodiqueEquivalent)(0.12, 1);
        expect(Math.pow(1 + m, 12) - 1).toBeCloseTo(0.12, 12);
        expect(m).toBeLessThan(0.01);
    });
});
describe('qualification · § 1.5.2, la location simple est refusée en le disant', () => {
    it('douze mois ou moins, faible valeur, option hypothétique', () => {
        expect((0, echeancier_location_acquisition_1.motifLocationSimple)({ ...EXEMPLE, dureeMois: 12 })).toContain('douze mois ou moins');
        expect((0, echeancier_location_acquisition_1.motifLocationSimple)({ ...EXEMPLE, bienDeFaibleValeur: true })).toContain('faible valeur');
        expect((0, echeancier_location_acquisition_1.motifLocationSimple)({ ...EXEMPLE, optionRaisonnablementCertaine: false })).toContain('hypothétique');
        expect((0, echeancier_location_acquisition_1.motifLocationSimple)(EXEMPLE)).toBeNull();
    });
    it('la location-vente transfère la propriété sans option à lever', () => {
        expect((0, echeancier_location_acquisition_1.motifLocationSimple)({ ...EXEMPLE, nature: client_1.NatureLocationAcquisition.LOCATION_VENTE, optionRaisonnablementCertaine: false })).toBeNull();
    });
    it('le taux ou la valeur du contrat, l’un des deux', () => {
        expect((0, echeancier_location_acquisition_1.motifRefusContrat)({ ...EXEMPLE, valeurContrat: 520000 })).toContain('l’un des deux');
        expect((0, echeancier_location_acquisition_1.motifRefusContrat)({ ...EXEMPLE, tauxAnnuel: null })).toContain('l’un des deux');
        expect((0, echeancier_location_acquisition_1.motifRefusContrat)({ ...EXEMPLE, dureeMois: 100 })).toContain('nombre entier de périodes');
    });
    it('une valeur au-delà de la somme des paiements n’a aucun taux implicite', () => {
        expect(() => (0, echeancier_location_acquisition_1.construireEcheancier)({ ...EXEMPLE, tauxAnnuel: null, valeurContrat: 800000 })).toThrow('aucun taux implicite');
    });
});
const numeros = (plan) => plan.filter((c) => (c.typeCompte ?? client_1.TypeCompteDetailTotal.DETAIL) === client_1.TypeCompteDetailTotal.DETAIL).map((c) => c.numero);
const SEMIS = [
    [client_1.Referentiel.SYCEBNL, numeros(compte_seed_1.PLAN_COMPTES_SYCEBNL)],
    [client_1.Referentiel.SYSCOHADA, numeros(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA)],
];
describe('nomenclature · relue dans les deux semis', () => {
    it.each(SEMIS)('%s · chaque compte de la table est ouvert au plan', (ref, plan) => {
        for (const comptes of Object.values(nomenclature_location_acquisition_1.COMPTES_LOCATION_ACQUISITION[ref])) {
            if (!comptes)
                continue;
            for (const n of Object.values(comptes))
                expect({ ref, n, ouvert: plan.includes(n) }).toEqual({ ref, n, ouvert: true });
        }
    });
    it.each(SEMIS)('%s · chaque sous-compte « location-acquisition » est ouvert', (ref, plan) => {
        for (const r of [...nomenclature_location_acquisition_1.BIENS_IMMOBILIERS_LOCATION_ACQUISITION, ...nomenclature_location_acquisition_1.BIENS_MOBILIERS_LOCATION_ACQUISITION]) {
            expect({ ref, r, ouvert: plan.some((n) => n.startsWith(r)) }).toEqual({ ref, r, ouvert: true });
        }
    });
    it('un numéro, deux sens · la dette est au 17 au SYSCOHADA, au 187 au SYCEBNL', () => {
        const m = client_1.NatureLocationAcquisition.CREDIT_BAIL_MOBILIER;
        expect(nomenclature_location_acquisition_1.COMPTES_LOCATION_ACQUISITION[client_1.Referentiel.SYSCOHADA][m].dette).toBe('17300000');
        expect(nomenclature_location_acquisition_1.COMPTES_LOCATION_ACQUISITION[client_1.Referentiel.SYCEBNL][m].dette).toBe('18720000');
    });
    it('refus · compte ordinaire, autre location au SYCEBNL, immobilier contre mobilier', () => {
        expect((0, nomenclature_location_acquisition_1.motifRefusNatureEtCompte)(client_1.Referentiel.SYSCOHADA, client_1.NatureLocationAcquisition.CREDIT_BAIL_MOBILIER, '24510000')).toContain('location-acquisition');
        expect((0, nomenclature_location_acquisition_1.motifRefusNatureEtCompte)(client_1.Referentiel.SYCEBNL, client_1.NatureLocationAcquisition.AUTRE, '24560000')).toContain('SYCEBNL');
        expect((0, nomenclature_location_acquisition_1.motifRefusNatureEtCompte)(client_1.Referentiel.SYSCOHADA, client_1.NatureLocationAcquisition.CREDIT_BAIL_IMMOBILIER, '24560000')).toContain('immobilier');
        expect((0, nomenclature_location_acquisition_1.motifRefusNatureEtCompte)(client_1.Referentiel.SYSCOHADA, client_1.NatureLocationAcquisition.CREDIT_BAIL_MOBILIER, '23160000')).toContain('mobilier');
        expect((0, nomenclature_location_acquisition_1.motifRefusNatureEtCompte)(client_1.Referentiel.SYSCOHADA, client_1.NatureLocationAcquisition.CREDIT_BAIL_MOBILIER, '24560000')).toBeNull();
    });
});
//# sourceMappingURL=location-acquisition.spec.js.map