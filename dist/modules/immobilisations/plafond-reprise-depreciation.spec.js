"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plafond_reprise_depreciation_1 = require("./plafond-reprise-depreciation");
describe('le plafond de reprise · le plus bas de deux bornes', () => {
    const texte = { cumulDepreciation: 4_000_000, valeurNette: 15_000_000, valeurSansDepreciation: 18_000_000 };
    it('l’écart avec la valeur sans dépréciation, quand il est sous le cumul du 29', () => {
        expect((0, plafond_reprise_depreciation_1.plafondRepriseDepreciation)(texte)).toBe(3_000_000);
    });
    it('le cumul du 29, quand l’écart le dépasse · le 29 ne devient jamais débiteur', () => {
        expect((0, plafond_reprise_depreciation_1.plafondRepriseDepreciation)({ ...texte, valeurNette: 10_000_000 })).toBe(4_000_000);
    });
    it('jamais négatif · une valeur nette déjà au-dessus ne rend rien', () => {
        expect((0, plafond_reprise_depreciation_1.plafondRepriseDepreciation)({ ...texte, valeurNette: 19_000_000 })).toBe(0);
    });
    it('refus nommés, le cumul d’abord, puis le § 2.4.2', () => {
        expect((0, plafond_reprise_depreciation_1.motifRefusRepriseDepreciation)({ ...texte, montant: 3_000_000 })).toBeNull();
        expect((0, plafond_reprise_depreciation_1.motifRefusRepriseDepreciation)({ ...texte, montant: 2_000_000 })).toBeNull();
        expect((0, plafond_reprise_depreciation_1.motifRefusRepriseDepreciation)({ ...texte, montant: 4_500_000 })).toMatch(/dépréciation encore inscrite/);
        expect((0, plafond_reprise_depreciation_1.motifRefusRepriseDepreciation)({ ...texte, montant: 3_500_000 })).toMatch(/plafonnée à 3000000\.00.*§ 2\.4\.2/);
    });
});
//# sourceMappingURL=plafond-reprise-depreciation.spec.js.map