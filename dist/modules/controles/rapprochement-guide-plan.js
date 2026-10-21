"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTES_ABOLIS_PAR_LA_REVISION = exports.COMPTES_HORS_PLAN = void 0;
exports.racinePlan = racinePlan;
exports.COMPTES_HORS_PLAN = {
    '06': 'SYSCOHADA App. 107 · Exploitation en société en participation, charges · compte ouvert par le gérant, hors plan',
    '07': 'SYSCOHADA App. 107 · Exploitation en société en participation, produits · compte ouvert par le gérant, hors plan',
};
exports.COMPTES_ABOLIS_PAR_LA_REVISION = {
    '2011': 'Frais de constitution · charges immobilisées, supprimées par la révision (SYSCOHADA App. 123)',
    '206': 'Primes de remboursement des obligations · supprimées par la révision (SYSCOHADA App. 123)',
    '6811': 'Dotations aux amortissements des charges immobilisées · sans objet depuis la révision (SYSCOHADA App. 123)',
};
function racinePlan(numeroGuide, numerosDuPlan) {
    if (numeroGuide in exports.COMPTES_ABOLIS_PAR_LA_REVISION)
        return null;
    for (let longueur = numeroGuide.length; longueur >= 2; longueur--) {
        const essai = numeroGuide.slice(0, longueur);
        if (numerosDuPlan.some((n) => n.startsWith(essai)))
            return essai;
    }
    return null;
}
//# sourceMappingURL=rapprochement-guide-plan.js.map