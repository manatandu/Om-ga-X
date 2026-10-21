"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIENS_MOBILIERS_LOCATION_ACQUISITION = exports.BIENS_IMMOBILIERS_LOCATION_ACQUISITION = exports.COMPTES_LOCATION_ACQUISITION = void 0;
exports.estCompteDeLocationAcquisition = estCompteDeLocationAcquisition;
exports.motifRefusNatureEtCompte = motifRefusNatureEtCompte;
const client_1 = require("@prisma/client");
exports.COMPTES_LOCATION_ACQUISITION = {
    [client_1.Referentiel.SYSCOHADA]: {
        CREDIT_BAIL_IMMOBILIER: { dette: '17200000', interetsCourus: '17620000', interets: '67220000', redevances: '62320000' },
        CREDIT_BAIL_MOBILIER: { dette: '17300000', interetsCourus: '17630000', interets: '67230000', redevances: '62330000' },
        LOCATION_VENTE: { dette: '17400000', interetsCourus: '17640000', interets: '67240000', redevances: '62340000' },
        AUTRE: { dette: '17800000', interetsCourus: '17680000', interets: '67280000', redevances: '62380000' },
    },
    [client_1.Referentiel.SYCEBNL]: {
        CREDIT_BAIL_IMMOBILIER: { dette: '18710000', interetsCourus: '18760000', interets: '67210000', redevances: '62320000' },
        CREDIT_BAIL_MOBILIER: { dette: '18720000', interetsCourus: '18760000', interets: '67220000', redevances: '62330000' },
        LOCATION_VENTE: { dette: '18730000', interetsCourus: '18760000', interets: '67230000', redevances: '62340000' },
    },
};
exports.BIENS_IMMOBILIERS_LOCATION_ACQUISITION = ['2286', '2316', '2326'];
exports.BIENS_MOBILIERS_LOCATION_ACQUISITION = ['2416', '2426', '2446', '2456'];
function estCompteDeLocationAcquisition(numero) {
    return [...exports.BIENS_IMMOBILIERS_LOCATION_ACQUISITION, ...exports.BIENS_MOBILIERS_LOCATION_ACQUISITION].some((r) => numero.startsWith(r));
}
function motifRefusNatureEtCompte(referentiel, nature, numeroBien) {
    if (!estCompteDeLocationAcquisition(numeroBien)) {
        return (`Le compte ${numeroBien} n'est pas un sous-compte « de location-acquisition » · le bien se porte au ` +
            '2286, 2316, 2326, 2416, 2426, 2446 ou 2456 selon sa nature (AUDCIF Titre VIII ch. 8 § 2.1.7 et § 2.4.1).');
    }
    if (!exports.COMPTES_LOCATION_ACQUISITION[referentiel][nature]) {
        return ('Le plan SYCEBNL n\'ouvre aucune dette pour une autre location-acquisition (compte 187 · 1871 crédit-bail ' +
            'immobilier, 1872 crédit-bail mobilier, 1873 location-vente, 1876 intérêts courus).');
    }
    const immobilier = exports.BIENS_IMMOBILIERS_LOCATION_ACQUISITION.some((r) => numeroBien.startsWith(r));
    if (nature === client_1.NatureLocationAcquisition.CREDIT_BAIL_IMMOBILIER && !immobilier) {
        return `Un crédit-bail immobilier porte un terrain ou un bâtiment (2286, 2316, 2326), pas le ${numeroBien}.`;
    }
    if (nature === client_1.NatureLocationAcquisition.CREDIT_BAIL_MOBILIER && immobilier) {
        return `Un crédit-bail mobilier porte un matériel (2416, 2426, 2446, 2456), pas le ${numeroBien}.`;
    }
    return null;
}
//# sourceMappingURL=nomenclature-location-acquisition.js.map