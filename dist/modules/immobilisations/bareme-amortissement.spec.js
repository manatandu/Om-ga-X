"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bareme_amortissement_013_2025_1 = require("./bareme-amortissement-013-2025");
const bareme_fiscal_1 = require("./bareme-fiscal");
describe('barème fiscal d’amortissement (arrêté n° 013/2025, art. 2)', () => {
    it('porte les 131 lignes de l’article 2', () => {
        expect(bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025).toHaveLength(131);
    });
    it('chaque taux est 100 / durée tronqué à deux décimales', () => {
        for (const n of bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025) {
            const attendu = Math.trunc((100 / n.dureeAns) * 100 + 1e-9) / 100;
            expect({ cle: n.cle, taux: n.taux }).toEqual({ cle: n.cle, taux: attendu });
        }
    });
    it('le tronquage n’est pas un arrondi · trois ans font 33,33 et sept ans 14,28', () => {
        const sept = bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025.filter((n) => n.dureeAns === 7);
        expect(sept.length).toBeGreaterThan(0);
        for (const n of sept)
            expect(n.taux).toBe(14.28);
        const trois = bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025.filter((n) => n.dureeAns === 3);
        expect(trois.length).toBeGreaterThan(0);
        for (const n of trois)
            expect(n.taux).toBe(33.33);
    });
    it('les clés « section.rang » sont uniques et suivent la section', () => {
        const cles = bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025.map((n) => n.cle);
        expect(new Set(cles).size).toBe(cles.length);
        for (const n of bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025) {
            expect(n.cle.startsWith(`${n.section}.`)).toBe(true);
            expect(n.dureeAns).toBeGreaterThan(0);
            expect(n.designation.trim().length).toBeGreaterThan(0);
        }
    });
    it('natureDuBareme retrouve une ligne par sa clé, et seulement par elle', () => {
        expect((0, bareme_fiscal_1.natureDuBareme)('I.1')).toMatchObject({ designation: 'Brevets, licences et logiciels', dureeAns: 5, taux: 20 });
        expect((0, bareme_fiscal_1.natureDuBareme)('II.1')).toMatchObject({ dureeAns: 20, taux: 5 });
        expect((0, bareme_fiscal_1.natureDuBareme)('XX.99')).toBeUndefined();
        expect((0, bareme_fiscal_1.baremeFiscal)()).toBe(bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025);
    });
});
//# sourceMappingURL=bareme-amortissement.spec.js.map