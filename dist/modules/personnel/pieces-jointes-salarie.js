"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGLE_PIECES_SALARIE = void 0;
async function lireSalarieDesPieces(db, tenantId, salarieId) {
    const s = await db.salarie.findFirst({
        where: { id: salarieId, tenantId },
        select: { matricule: true, nom: true, postNom: true, prenoms: true },
    });
    if (!s)
        return null;
    const nom = [s.nom, s.postNom, s.prenoms].filter((x) => !!x).join(' ');
    return { description: s.matricule ? `${s.matricule} · ${nom}` : nom, motifRefusDepot: null, motifRefusRetrait: null };
}
exports.REGLE_PIECES_SALARIE = {
    objet: 'SALARIE',
    designation: 'ce salarié',
    lireObjet: lireSalarieDesPieces,
};
//# sourceMappingURL=pieces-jointes-salarie.js.map