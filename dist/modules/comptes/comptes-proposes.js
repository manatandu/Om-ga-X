"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTES_QUI_NE_SONT_PAS_DES_LISTES = exports.PARAMETRE_RETENUS = exports.LISTES_DE_COMPTES = exports.LIENS_QUI_NE_RETIENNENT_PAS = void 0;
exports.comptesUtilises = comptesUtilises;
exports.estPropose = estPropose;
exports.comptesProposes = comptesProposes;
exports.comptesNonPersonnalises = comptesNonPersonnalises;
exports.motifComptesNonPersonnalises = motifComptesNonPersonnalises;
const client_1 = require("@prisma/client");
const references_1 = require("../../common/suppression/references");
exports.LIENS_QUI_NE_RETIENNENT_PAS = [
    'Compte.collectifId',
    'RattachementNote.compteId',
    'FicheInventaire.compteId',
    'ProvisionRisqueCharge.compteId',
    'DemandeConfirmation.compteId',
    'ProcesVerbalComptageCaisse.compteId',
    'Relance.compteId',
    'OdAnalytique.compteId',
];
function comptesUtilises(prisma, tenantId, ids) {
    return (0, references_1.identifiantsUtilises)(prisma, 'Compte', ids, tenantId, exports.LIENS_QUI_NE_RETIENNENT_PAS);
}
function estPropose(c, utilises) {
    return c.estRetenu || utilises.has(c.id);
}
async function comptesProposes(prisma, tenantId, comptes) {
    const aVerifier = comptes.filter((c) => !c.estRetenu).map((c) => c.id);
    const utilises = await comptesUtilises(prisma, tenantId, aVerifier);
    const proposes = comptes.filter((c) => estPropose(c, utilises));
    return { proposes, ecartes: comptes.length - proposes.length };
}
async function comptesNonPersonnalises(prisma, tenantId, ids) {
    const uniques = [...new Set(ids)];
    if (uniques.length === 0)
        return [];
    const p = prisma;
    const comptes = await p.compte.findMany({
        where: { tenantId, id: { in: uniques }, estRetenu: false, typeCompte: client_1.TypeCompteDetailTotal.DETAIL },
        select: { id: true, numero: true, intitule: true, estRetenu: true, typeCompte: true },
        orderBy: { numero: 'asc' },
    });
    if (comptes.length === 0)
        return [];
    const utilises = await comptesUtilises(prisma, tenantId, comptes.map((c) => c.id));
    return comptes.filter((c) => !estPropose(c, utilises)).map(({ id, numero, intitule }) => ({ id, numero, intitule }));
}
function motifComptesNonPersonnalises(comptes, geste) {
    if (comptes.length === 0)
        return null;
    const noms = comptes.slice(0, 5).map((c) => `${c.numero} ${c.intitule}`).join(', ');
    const suite = comptes.length > 5 ? ` et ${comptes.length - 5} autre(s)` : '';
    return (`Compte non personnalisé : ${noms}${suite} · ${geste} ne se fait que sur un compte personnalisé du dossier. ` +
        'Personnalisez-le d\'abord dans Plan comptable (geste de l\'administrateur du dossier) · adoptez le compte du plan tel ' +
        'quel, ou ouvrez un sous-compte sous lui.');
}
var listes_de_comptes_1 = require("./listes-de-comptes");
Object.defineProperty(exports, "LISTES_DE_COMPTES", { enumerable: true, get: function () { return listes_de_comptes_1.LISTES_DE_COMPTES; } });
Object.defineProperty(exports, "PARAMETRE_RETENUS", { enumerable: true, get: function () { return listes_de_comptes_1.PARAMETRE_RETENUS; } });
Object.defineProperty(exports, "ROUTES_QUI_NE_SONT_PAS_DES_LISTES", { enumerable: true, get: function () { return listes_de_comptes_1.ROUTES_QUI_NE_SONT_PAS_DES_LISTES; } });
//# sourceMappingURL=comptes-proposes.js.map