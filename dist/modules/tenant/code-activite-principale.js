"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_CODE_ACTIVITE_FORMAT = exports.MOTIF_CODE_ACTIVITE_SYCEBNL = void 0;
exports.normaliserCodeActivite = normaliserCodeActivite;
exports.motifRefusCodeActivite = motifRefusCodeActivite;
exports.avertissementCodeActivite = avertissementCodeActivite;
const client_1 = require("@prisma/client");
const correspondance_notes_syscohada_3_1 = require("../etats-financiers-syscohada/correspondance-notes-syscohada-3");
exports.MOTIF_CODE_ACTIVITE_SYCEBNL = "Le code activité principale est celui de la NOTE 36 du SYSCOHADA (AUDCIF Titre IX ch. 6) · un dossier SYCEBNL n'en porte pas.";
exports.MOTIF_CODE_ACTIVITE_FORMAT = "Le code activité principale s'écrit sur six chiffres, groupe puis poste (AUDCIF Titre IX ch. 6, NOTE 36) · par exemple 031003.";
function normaliserCodeActivite(valeur) {
    if (valeur === undefined)
        return undefined;
    if (valeur === null)
        return null;
    const compact = valeur.replace(/\s+/g, '');
    return compact === '' ? null : compact;
}
function motifRefusCodeActivite(referentiel, code) {
    if (code === undefined || code === null)
        return null;
    if (referentiel !== client_1.Referentiel.SYSCOHADA)
        return exports.MOTIF_CODE_ACTIVITE_SYCEBNL;
    if (!/^\d{6}$/.test(code))
        return exports.MOTIF_CODE_ACTIVITE_FORMAT;
    return null;
}
function avertissementCodeActivite(code) {
    if (!code || !/^\d{6}$/.test(code))
        return null;
    const groupe = code.slice(0, 3);
    if (correspondance_notes_syscohada_3_1.GROUPES_ACTIVITES_SYSCOHADA.some((g) => g.code === groupe))
        return null;
    return (`Le groupe ${groupe} n'est pas l'un des 44 groupes de la NOTE 36 (001 à 044). ` +
        "Le code est enregistré tel quel · vérifiez-le avant qu'il ne s'imprime sur la Fiche 1 de la liasse.");
}
//# sourceMappingURL=code-activite-principale.js.map