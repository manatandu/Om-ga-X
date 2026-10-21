"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrondirImpotArt150 = arrondirImpotArt150;
function arrondirImpotArt150(montant) {
    if (!Number.isFinite(montant))
        return montant;
    const entier = Math.floor(montant);
    const premiereDecimale = Math.floor((montant - entier) * 10 + 1e-9);
    const unite = premiereDecimale >= 5 ? entier + 1 : entier;
    const tranche = ((unite % 100) + 100) % 100;
    return tranche >= 50 ? unite - tranche + 100 : unite - tranche;
}
//# sourceMappingURL=arrondi-article-150.js.map