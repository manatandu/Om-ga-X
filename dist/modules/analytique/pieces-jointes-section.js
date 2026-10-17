"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGLE_PIECES_SECTION = void 0;
async function lireSectionDesPieces(db, tenantId, sectionId) {
    const s = await db.sectionAnalytique.findFirst({
        where: { id: sectionId, tenantId },
        select: { code: true, intitule: true, plan: { select: { code: true } } },
    });
    if (!s)
        return null;
    return { description: `${s.plan.code} · ${s.code} ${s.intitule}`, motifRefusDepot: null, motifRefusRetrait: null };
}
exports.REGLE_PIECES_SECTION = {
    objet: 'SECTION',
    designation: 'cette section',
    lireObjet: lireSectionDesPieces,
};
//# sourceMappingURL=pieces-jointes-section.js.map