"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plafondRepriseDepreciation = plafondRepriseDepreciation;
exports.motifRefusRepriseDepreciation = motifRefusRepriseDepreciation;
const EPSILON = 0.005;
const arrondir = (x) => Math.round(x * 100) / 100;
function plafondRepriseDepreciation(o) {
    const ecart = Math.max(0, o.valeurSansDepreciation - o.valeurNette);
    return arrondir(Math.max(0, Math.min(o.cumulDepreciation, ecart)));
}
function motifRefusRepriseDepreciation(o) {
    if (o.montant > o.cumulDepreciation + EPSILON) {
        return `La reprise ne peut pas dépasser la dépréciation encore inscrite (${o.cumulDepreciation.toFixed(2)})`;
    }
    const plafond = plafondRepriseDepreciation(o);
    if (o.montant > plafond + EPSILON) {
        return (`La reprise est plafonnée à ${plafond.toFixed(2)} · après reprise, la valeur nette ne peut pas dépasser ` +
            `celle qu'aurait le bien sans dépréciation, plan d'origine rejoué (${arrondir(o.valeurSansDepreciation).toFixed(2)} ; ` +
            `valeur nette en fin d'exercice ${arrondir(o.valeurNette).toFixed(2)}). Au-delà, la reprise réévaluerait le bien ` +
            '(AUDCIF Titre VIII ch. 12 § 2.4.2).');
    }
    return null;
}
//# sourceMappingURL=plafond-reprise-depreciation.js.map