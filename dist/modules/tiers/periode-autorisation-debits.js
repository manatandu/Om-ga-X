"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.situationAutorisationDebits = situationAutorisationDebits;
exports.motifRefusPeriodeAutorisationDebits = motifRefusPeriodeAutorisationDebits;
function situationAutorisationDebits(fiche, dateOperation) {
    if (!fiche.autoriseTvaDebits)
        return 'NON_AUTORISE';
    const revocation = fiche.dateRevocationAutorisationDebits ?? null;
    if (revocation && dateOperation.getTime() >= revocation.getTime())
        return 'REVOQUEE';
    const effet = fiche.dateEffetAutorisationDebits ?? null;
    if (!effet)
        return 'AUTORISE_NON_DATE';
    if (dateOperation.getTime() < effet.getTime())
        return 'AVANT_EFFET';
    return 'AUTORISE';
}
function motifRefusPeriodeAutorisationDebits(effet, revocation) {
    if (effet && revocation && revocation.getTime() <= effet.getTime()) {
        return ('La date de révocation de l’autorisation aux débits doit suivre sa date d’effet · le retour au droit commun ' +
            '(O.-L. n° 10/001, art. 26 al. 2 ; décret n° 011/42, art. 63) ne peut précéder la décision qui l’a accordée ' +
            '(décret art. 59).');
    }
    return null;
}
//# sourceMappingURL=periode-autorisation-debits.js.map