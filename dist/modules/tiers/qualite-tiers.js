"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUALITES_PROPOSEES = exports.LONGUEUR_QUALITE = void 0;
exports.normaliserQualite = normaliserQualite;
exports.LONGUEUR_QUALITE = 35;
exports.QUALITES_PROPOSEES = [
    'Société',
    'Entreprise individuelle',
    'Entreprenant',
    'Indépendant',
    'Association',
    'Organisation non gouvernementale',
    'Établissement public',
    'Administration',
    'Particulier',
];
function normaliserQualite(v) {
    if (v === undefined)
        return undefined;
    if (v === null)
        return null;
    const propre = v.replace(/\s+/g, ' ').trim();
    return propre === '' ? null : propre;
}
//# sourceMappingURL=qualite-tiers.js.map