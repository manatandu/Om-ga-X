"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lireAvant = lireAvant;
exports.pageDeNumeros = pageDeNumeros;
const common_1 = require("@nestjs/common");
function lireAvant(texte) {
    if (texte === undefined || texte === '')
        return undefined;
    const n = Number(texte);
    if (!Number.isInteger(n) || n < 1) {
        throw new common_1.BadRequestException("Le numéro à partir duquel lire les plus anciens est illisible · un entier positif est attendu.");
    }
    return n;
}
function pageDeNumeros(lus, taille) {
    const page = lus.slice(0, taille);
    return { page, plusAnciensAvant: lus.length > taille ? page[page.length - 1].numero : null };
}
//# sourceMappingURL=pagination-par-numero.js.map