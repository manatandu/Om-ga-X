"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const famille_immobilisation_seed_1 = require("./famille-immobilisation-seed");
describe('sortie d’immobilisation · compte de classe 8 selon la nature', () => {
    it('un logiciel ou un brevet sort en 811 / 821, pas en 812 / 822', () => {
        expect((0, immobilisation_service_1.natureImmobilisation)('21310000', client_1.Referentiel.SYSCOHADA)).toBe('INCORPORELLE');
        expect((0, immobilisation_service_1.natureImmobilisation)('21310000', client_1.Referentiel.SYCEBNL)).toBe('INCORPORELLE');
        expect(immobilisation_service_1.COMPTES_SORTIE.INCORPORELLE).toEqual({ valeurComptable: '81100000', produitCession: '82100000' });
    });
    it('un matériel, un bâtiment ou un véhicule sort en 812 / 822', () => {
        for (const numero of ['22000000', '23110000', '24410000', '24500000']) {
            expect((0, immobilisation_service_1.natureImmobilisation)(numero, client_1.Referentiel.SYSCOHADA)).toBe('CORPORELLE');
            expect((0, immobilisation_service_1.natureImmobilisation)(numero, client_1.Referentiel.SYCEBNL)).toBe('CORPORELLE');
        }
        expect(immobilisation_service_1.COMPTES_SORTIE.CORPORELLE).toEqual({ valeurComptable: '81200000', produitCession: '82200000' });
    });
    it('un titre de participation ou un prêt sort en 816 / 826', () => {
        expect((0, immobilisation_service_1.natureImmobilisation)('26100000', client_1.Referentiel.SYSCOHADA)).toBe('FINANCIERE');
        expect((0, immobilisation_service_1.natureImmobilisation)('27500000', client_1.Referentiel.SYSCOHADA)).toBe('FINANCIERE');
        expect(immobilisation_service_1.COMPTES_SORTIE.FINANCIERE).toEqual({ valeurComptable: '81600000', produitCession: '82600000' });
    });
    it('au SYCEBNL, la division 20 sort en 818 / 828, terrains et titres compris, l’usufruit (2011) excepté', () => {
        expect((0, immobilisation_service_1.natureImmobilisation)('20110000', client_1.Referentiel.SYCEBNL)).toBe('USUFRUIT');
        for (const numero of ['20120000', '20200000', '20300000', '20400000', '20500000']) {
            expect(`${numero} → ${(0, immobilisation_service_1.natureImmobilisation)(numero, client_1.Referentiel.SYCEBNL)}`).toBe(`${numero} → DONS_LEGS_VENTE`);
        }
        expect(immobilisation_service_1.COMPTES_SORTIE.DONS_LEGS_VENTE).toEqual({ valeurComptable: '81800000', produitCession: '82800000' });
    });
    it('et le SYSCOHADA n’atteint JAMAIS cette nature · son COMPTE 81 n’a pas de 818', () => {
        const vingt = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.numero.startsWith('20'));
        expect(vingt.map((c) => c.numero)).toEqual([]);
        for (const compte of compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.filter((c) => c.numero.startsWith('2'))) {
            expect((0, immobilisation_service_1.natureImmobilisation)(compte.numero, client_1.Referentiel.SYSCOHADA)).not.toBe('DONS_LEGS_VENTE');
        }
    });
    it('les huit comptes de sortie existent au plan SYCEBNL', () => {
        const numeros = new Set(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => c.numero));
        const attendus = Object.values(immobilisation_service_1.COMPTES_SORTIE).flatMap((c) => [c.valeurComptable, c.produitCession]);
        expect(attendus.filter((n) => !numeros.has(n))).toEqual([]);
    });
    it('les six comptes atteignables au SYSCOHADA existent à son plan, et 818 / 828 en sont bien absents', () => {
        const numeros = new Set(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => c.numero));
        const atteignables = ['INCORPORELLE', 'CORPORELLE', 'FINANCIERE'].flatMap((n) => [
            immobilisation_service_1.COMPTES_SORTIE[n].valeurComptable,
            immobilisation_service_1.COMPTES_SORTIE[n].produitCession,
        ]);
        expect(atteignables.filter((n) => !numeros.has(n))).toEqual([]);
        expect(['81800000', '82800000'].filter((n) => numeros.has(n))).toEqual([]);
    });
    it.each([
        ['SYCEBNL', client_1.Referentiel.SYCEBNL, compte_seed_1.PLAN_COMPTES_SYCEBNL],
        ['SYSCOHADA', client_1.Referentiel.SYSCOHADA, compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA],
    ])('les comptes de reprise de dépréciation existent au plan %s', (_, referentiel, plan) => {
        const numeros = new Set(plan.map((c) => c.numero));
        const attendus = [...Object.values(immobilisation_service_1.REPRISE_DEPRECIATION_SORTIE[referentiel]), immobilisation_service_1.REPRISE_DEPRECIATION_HAO];
        expect(attendus.filter((n) => !numeros.has(n))).toEqual([]);
    });
    it('chaque nature atteignable a son compte de reprise, dans les deux référentiels', () => {
        expect(Object.keys(immobilisation_service_1.REPRISE_DEPRECIATION_SORTIE[client_1.Referentiel.SYCEBNL]).sort()).toEqual(['CORPORELLE', 'DONS_LEGS_VENTE', 'FINANCIERE', 'INCORPORELLE', 'USUFRUIT']);
        expect(Object.keys(immobilisation_service_1.REPRISE_DEPRECIATION_SORTIE[client_1.Referentiel.SYSCOHADA]).sort()).toEqual(['CORPORELLE', 'FINANCIERE', 'INCORPORELLE']);
    });
    it('chaque famille semée résout vers un compte de sortie qui existe', () => {
        const numeros = new Set(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => c.numero));
        for (const f of famille_immobilisation_seed_1.FAMILLES_IMMOBILISATION_DEFAUT) {
            const compteImmo = f.compteImmobilisation;
            if (!compteImmo)
                continue;
            const nature = (0, immobilisation_service_1.natureImmobilisation)(compteImmo, client_1.Referentiel.SYSCOHADA);
            if (nature === 'USUFRUIT')
                throw new Error(`${compteImmo} rendu usufruit au SYSCOHADA`);
            const sortie = immobilisation_service_1.COMPTES_SORTIE[nature];
            expect({ famille: f.code, compte: sortie.valeurComptable, existe: numeros.has(sortie.valeurComptable) }).toEqual({
                famille: f.code,
                compte: sortie.valeurComptable,
                existe: true,
            });
        }
    });
});
//# sourceMappingURL=sortie-classe-8.spec.js.map