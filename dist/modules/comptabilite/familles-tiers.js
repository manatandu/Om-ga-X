"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAMILLES_TIERS = void 0;
exports.divisionnaireDeLaFamille = divisionnaireDeLaFamille;
exports.estFamilleTiers = estFamilleTiers;
exports.compteDeLaFamille = compteDeLaFamille;
exports.sousTitreFamille = sousTitreFamille;
const client_1 = require("@prisma/client");
exports.FAMILLES_TIERS = ['FOURNISSEURS', 'CLIENTS', 'SALARIES', 'AUTRES'];
const DIVISIONNAIRE = {
    FOURNISSEURS: '40',
    CLIENTS: '41',
    SALARIES: '42',
};
function divisionnaireDeLaFamille(famille) {
    return DIVISIONNAIRE[famille];
}
function estFamilleTiers(v) {
    return typeof v === 'string' && exports.FAMILLES_TIERS.includes(v);
}
function compteDeLaFamille(famille, numero, rattache) {
    if (famille !== 'AUTRES')
        return numero.startsWith(DIVISIONNAIRE[famille]);
    return numero.startsWith('4') && !Object.values(DIVISIONNAIRE).some((r) => numero.startsWith(r)) && rattache;
}
function sousTitreFamille(famille, referentiel) {
    switch (famille) {
        case 'FOURNISSEURS':
            return 'Fournisseur';
        case 'CLIENTS':
            return referentiel === client_1.Referentiel.SYCEBNL ? 'Adhérent et client-usager' : 'Client';
        case 'SALARIES':
            return 'Salarié';
        case 'AUTRES':
            return 'Autre';
    }
}
//# sourceMappingURL=familles-tiers.js.map