"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPORTEMENTS_DES_PRODUITS = exports.COMPORTEMENTS_DES_CHARGES = void 0;
exports.motifRefusComportement = motifRefusComportement;
exports.partageFixeVariable = partageFixeVariable;
exports.COMPORTEMENTS_DES_CHARGES = [
    'CHARGE_FIXE',
    'CHARGE_VARIABLE',
    'CHARGE_SEMI_VARIABLE',
    'HORS_CALCUL',
];
exports.COMPORTEMENTS_DES_PRODUITS = ['PRODUIT_ACTIVITE', 'HORS_CALCUL'];
function motifRefusComportement(params) {
    const { numero, classe, comportement, partVariablePct } = params;
    if (classe !== '6' && classe !== '7') {
        return `Le compte ${numero} n'est ni une charge ni un produit des activités ordinaires (classes 6 et 7) · il n'a pas de comportement face à l'activité.`;
    }
    if (comportement === null) {
        if (partVariablePct !== null)
            return `Compte ${numero} · une part variable ne se déclare qu'avec une charge semi-variable.`;
        return null;
    }
    const admis = classe === '6' ? exports.COMPORTEMENTS_DES_CHARGES : exports.COMPORTEMENTS_DES_PRODUITS;
    if (!admis.includes(comportement)) {
        return classe === '6'
            ? `Le compte ${numero} est une charge · fixe, variable, semi-variable ou hors calcul.`
            : `Le compte ${numero} est un produit · produit d'activité ou hors calcul.`;
    }
    if (comportement === 'CHARGE_SEMI_VARIABLE') {
        if (partVariablePct === null || !Number.isFinite(partVariablePct) || partVariablePct <= 0 || partVariablePct >= 100) {
            return `Compte ${numero} · la part variable d'une charge semi-variable est un pourcentage strictement entre 0 et 100 (à 0 ou 100, déclarez-la fixe ou variable).`;
        }
    }
    else if (partVariablePct !== null) {
        return `Compte ${numero} · une part variable ne se déclare qu'avec une charge semi-variable.`;
    }
    return null;
}
function partageFixeVariable(montant, comportement, partVariablePct) {
    const c = Math.round(montant * 100);
    if (comportement === 'CHARGE_FIXE')
        return { fixe: c / 100, variable: 0 };
    if (comportement === 'CHARGE_VARIABLE')
        return { fixe: 0, variable: c / 100 };
    const v = Math.round((c * (partVariablePct ?? 0)) / 100);
    return { fixe: (c - v) / 100, variable: v / 100 };
}
//# sourceMappingURL=comportement-gestion.js.map