"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nIemeJourOuvrableApres = nIemeJourOuvrableApres;
exports.entreeEnVigueurAuPlusTot = entreeEnVigueurAuPlusTot;
exports.finDuDelaiDeResiliation = finDuDelaiDeResiliation;
exports.priseDEffet = priseDEffet;
exports.motifDelaiArticle34 = motifDelaiArticle34;
const jour_ouvrable_1 = require("../retenues/jour-ouvrable");
const UN_JOUR_MS = 24 * 3600 * 1000;
function enDate(jour) {
    return new Date(`${jour}T00:00:00Z`);
}
function enJour(d) {
    return d.toISOString().slice(0, 10);
}
function estOuvrableProtecteur(d) {
    const j = d.getUTCDay();
    return j !== 0 && j !== 6 && (0, jour_ouvrable_1.jourFerie)(d) === null;
}
function nIemeJourOuvrableApres(jour, n) {
    let d = enDate(jour);
    let compte = 0;
    while (compte < n) {
        d = new Date(d.getTime() + UN_JOUR_MS);
        if (estOuvrableProtecteur(d))
            compte += 1;
    }
    return enJour(d);
}
function entreeEnVigueurAuPlusTot(communiqueeLe) {
    return enJour(new Date(enDate(nIemeJourOuvrableApres(communiqueeLe, 30)).getTime() + UN_JOUR_MS));
}
function finDuDelaiDeResiliation(enVigueurLe) {
    return nIemeJourOuvrableApres(enVigueurLe, 60);
}
function priseDEffet(enVigueurLe) {
    return enJour(new Date(enDate(finDuDelaiDeResiliation(enVigueurLe)).getTime() + UN_JOUR_MS));
}
function motifDelaiArticle34(v) {
    if (v.numero === 1)
        return v.communiqueeLe === null ? null : 'La première version est l’offre initiale · elle n’a pas de communication de l’art. 34.';
    if (v.communiqueeLe === null) {
        return `La version ${v.numero} modifie le contrat · la date de communication de son projet aux utilisateurs est exigée (Code du numérique, art. 34).`;
    }
    const auPlusTot = entreeEnVigueurAuPlusTot(v.communiqueeLe);
    if (v.enVigueurLe < auPlusTot) {
        return (`La version ${v.numero}, communiquée le ${v.communiqueeLe}, ne peut entrer en vigueur avant le ${auPlusTot} · ` +
            'trente jours ouvrables au moins (Code du numérique, art. 34).');
    }
    return null;
}
//# sourceMappingURL=delais-article-34.js.map