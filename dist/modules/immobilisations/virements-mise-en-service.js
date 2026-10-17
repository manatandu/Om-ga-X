"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUCUN_VIREMENT = void 0;
exports.virementsDesLignes = virementsDesLignes;
exports.AUCUN_VIREMENT = new Map();
function virementsDesLignes(lignes, virements) {
    let debit = 0;
    let credit = 0;
    for (const l of lignes) {
        const v = virements.get(l.compteId);
        if (!v)
            continue;
        debit += v.debit;
        credit += v.credit;
    }
    return { debit, credit };
}
//# sourceMappingURL=virements-mise-en-service.js.map