"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.libelleLieuBien = libelleLieuBien;
function libelleLieuBien(lieu) {
    if (!lieu)
        return null;
    const code = lieu.code.trim();
    const intitule = lieu.intitule.trim();
    if (!code && !intitule)
        return null;
    if (!code)
        return intitule;
    if (!intitule)
        return code;
    return `${code} · ${intitule}`;
}
//# sourceMappingURL=lieu-sur-fiche.js.map