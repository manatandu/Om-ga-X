"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusFusionTiers = motifRefusFusionTiers;
exports.coordonneesAComblement = coordonneesAComblement;
function motifRefusFusionTiers(source, cible) {
    if (source.id === cible.id)
        return 'Un tiers ne se fusionne pas avec lui-même.';
    if (source.type !== cible.type) {
        return (`${source.code} et ${cible.code} ne sont pas du même type (${source.type} et ${cible.type}) · ` +
            "un client et un fournisseur ne sont pas un doublon l'un de l'autre, leurs comptes ne se lisent pas au même sens.");
    }
    return null;
}
const COORDONNEES = [
    'adresse',
    'boitePostale',
    'ville',
    'pays',
    'telephone',
    'email',
    'numeroImpot',
    'contact',
    'qualite',
    'modeleImpressionExtraitId',
    'modeleImpressionReglementId',
    'modeleImpressionRappelId',
];
function coordonneesAComblement(source, cible) {
    const r = {};
    for (const c of COORDONNEES) {
        const v = source[c];
        if (!cible[c] && v)
            r[c] = v;
    }
    return r;
}
//# sourceMappingURL=fusion-tiers.js.map