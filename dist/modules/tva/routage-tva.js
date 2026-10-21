"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTES_DE_TAXE_ROUTES_SYSCOHADA = void 0;
exports.compteTvaCollectee = compteTvaCollectee;
exports.compteTvaRecuperable = compteTvaRecuperable;
exports.compteTvaPourContrepartie = compteTvaPourContrepartie;
exports.estTauxZero = estTauxZero;
exports.COMPTES_DE_TAXE_ROUTES_SYSCOHADA = [
    '44310000',
    '44320000',
    '44330000',
    '44510000',
    '44520000',
    '44530000',
    '44540000',
];
function compteTvaCollectee(numeroProduit) {
    if (/^70[1234]/.test(numeroProduit) || /^707/.test(numeroProduit))
        return '44310000';
    if (/^706/.test(numeroProduit))
        return '44320000';
    if (/^705/.test(numeroProduit))
        return '44330000';
    return null;
}
function compteTvaRecuperable(numeroCharge) {
    if (/^2/.test(numeroCharge))
        return '44510000';
    if (/^60/.test(numeroCharge))
        return '44520000';
    if (/^61/.test(numeroCharge))
        return '44530000';
    if (/^6[23]/.test(numeroCharge))
        return '44540000';
    return null;
}
function compteTvaPourContrepartie(referentiel, sens, numeroContrepartie, numerosDuPlan) {
    if (referentiel !== 'SYSCOHADA')
        return null;
    const vise = sens === 'recette' ? compteTvaCollectee(numeroContrepartie) : compteTvaRecuperable(numeroContrepartie);
    if (!vise || !numerosDuPlan.has(vise))
        return null;
    return vise;
}
function estTauxZero(taux) {
    return Number(taux) <= 0.000001;
}
//# sourceMappingURL=routage-tva.js.map