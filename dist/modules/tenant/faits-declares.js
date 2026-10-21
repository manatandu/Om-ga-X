"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.donneesAssujettissementTva = donneesAssujettissementTva;
exports.donneesVenteBiensServices = donneesVenteBiensServices;
exports.faitAssujettissementTva = faitAssujettissementTva;
function donneesAssujettissementTva(reponse, assujettiTva) {
    if (reponse === 'OUI')
        return { assujettiTva: true, assujettissementTvaRepondu: true };
    if (reponse === 'NON')
        return { assujettiTva: false, assujettissementTvaRepondu: true };
    if (reponse === 'PAS_ENCORE_DIT')
        return { assujettiTva: false, assujettissementTvaRepondu: false };
    if (assujettiTva !== undefined)
        return { assujettiTva, assujettissementTvaRepondu: true };
    return {};
}
function donneesVenteBiensServices(reponse) {
    if (reponse === undefined)
        return {};
    return { venteBiensServices: reponse === 'OUI' ? true : reponse === 'NON' ? false : null };
}
function faitAssujettissementTva(t) {
    return t.assujettissementTvaRepondu ? t.assujettiTva : null;
}
//# sourceMappingURL=faits-declares.js.map