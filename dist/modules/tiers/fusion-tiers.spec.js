"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fusion_tiers_1 = require("./fusion-tiers");
const fiche = (id, extra = {}) => ({
    id,
    code: id.toUpperCase(),
    type: 'FOURNISSEUR',
    adresse: null,
    boitePostale: null,
    ville: null,
    pays: null,
    telephone: null,
    email: null,
    numeroImpot: null,
    contact: null,
    ...extra,
});
describe('Fusion de tiers', () => {
    it('refuse de fusionner un tiers avec lui-même, ou deux types différents', () => {
        expect((0, fusion_tiers_1.motifRefusFusionTiers)(fiche('a'), fiche('a'))).toMatch(/lui-même/);
        expect((0, fusion_tiers_1.motifRefusFusionTiers)(fiche('a'), fiche('b', { type: 'CLIENT' }))).toMatch(/pas du même type/);
        expect((0, fusion_tiers_1.motifRefusFusionTiers)(fiche('a'), fiche('b'))).toBeNull();
    });
    it('le doublon comble les vides, il n’écrase jamais une coordonnée de la fiche conservée', () => {
        const r = (0, fusion_tiers_1.coordonneesAComblement)(fiche('a', { adresse: 'Av. du doublon', numeroImpot: 'A123' }), fiche('b', { adresse: 'Av. conservée' }));
        expect(r).toEqual({ numeroImpot: 'A123' });
    });
    it('un modèle d’impression du doublon ne vient que là où la fiche conservée n’en a pas (fonction 27)', () => {
        const r = (0, fusion_tiers_1.coordonneesAComblement)(fiche('a', { modeleImpressionRappelId: 'rappel-doublon', modeleImpressionExtraitId: 'extrait-doublon' }), fiche('b', { modeleImpressionRappelId: 'rappel-conserve' }));
        expect(r).toEqual({ modeleImpressionExtraitId: 'extrait-doublon' });
    });
});
//# sourceMappingURL=fusion-tiers.spec.js.map