"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGLE_PIECES_IMMOBILISATION = void 0;
async function lireBienDesPieces(db, tenantId, immobilisationId) {
    const b = await db.immobilisation.findFirst({
        where: { id: immobilisationId, tenantId },
        select: { designation: true, numeroInventaire: true },
    });
    if (!b)
        return null;
    return {
        description: b.numeroInventaire ? `${b.numeroInventaire} · ${b.designation}` : b.designation,
        motifRefusDepot: null,
        motifRefusRetrait: null,
    };
}
exports.REGLE_PIECES_IMMOBILISATION = {
    objet: 'IMMOBILISATION',
    designation: 'cette immobilisation',
    lireObjet: lireBienDesPieces,
};
//# sourceMappingURL=pieces-jointes-immobilisation.js.map