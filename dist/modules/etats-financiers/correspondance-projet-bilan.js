"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDRE_AFFICHAGE_PASSIF = exports.ORDRE_AFFICHAGE_ACTIF = exports.TOTAUX_PASSIF = exports.TOTAUX_ACTIF = exports.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR = exports.POSTES_PASSIF = exports.POSTES_ACTIF = void 0;
exports.trouvePosteActif = trouvePosteActif;
exports.trouvePostePassif = trouvePostePassif;
exports.POSTES_ACTIF = [
    { ref: 'AA', libelle: 'Immobilisations incorporelles', sens: 'ACTIF', comptes: ['21'] },
    {
        ref: 'AB',
        libelle: 'Terrains et bâtiments',
        sens: 'ACTIF',
        comptes: ['22', '231', '232', '233', '2391', '2392', '2393', '2396'],
    },
    {
        ref: 'AC',
        libelle: 'Aménagements, agencements et installations',
        sens: 'ACTIF',
        comptes: ['234', '235', '238', '2394', '2395', '2398'],
    },
    {
        ref: 'AD',
        libelle: 'Matériel, mobilier et actifs biologiques',
        sens: 'ACTIF',
        comptes: ['24'],
        exclusions: ['245', '2495'],
    },
    { ref: 'AE', libelle: 'Matériel de transport', sens: 'ACTIF', comptes: ['245', '2495'] },
    { ref: 'AF', libelle: 'Avances et acomptes versés sur immobilisations', sens: 'ACTIF', comptes: ['25'] },
    { ref: 'AG', libelle: 'Dépôts et cautionnements', sens: 'ACTIF', comptes: ['275'] },
    {
        ref: 'AH',
        libelle: 'Autres immobilisations corporelles et financières',
        sens: 'ACTIF',
        comptes: ['26', '27'],
        exclusions: ['275'],
    },
    { ref: 'BA', libelle: 'Actif circulant H.A.O.', sens: 'ACTIF', comptes: ['485'] },
    { ref: 'BB', libelle: 'Stocks et encours', sens: 'ACTIF', comptes: ['31', '32', '33', '34', '36', '37', '38'] },
    { ref: 'BC', libelle: 'Fournisseurs débiteurs', sens: 'ACTIF', comptes: ['409'] },
    { ref: 'BD', libelle: 'Clients-usagers', sens: 'ACTIF', comptes: ['41'], exclusions: ['411', '419'] },
    {
        ref: 'BE',
        libelle: 'Autres créances',
        sens: 'ACTIF',
        comptes: ['42', '43', '44', '47'],
        exclusions: ['478'],
        sens_qualificatif: 'DEBITEUR',
    },
    { ref: 'BV', libelle: 'Valeurs à encaisser', sens: 'ACTIF', comptes: ['51'] },
    {
        ref: 'BW',
        libelle: 'Banques, établissements financiers, caisses et assimilés',
        sens: 'ACTIF',
        comptes: ['52', '53', '55', '57'],
        comptesTransferesSiCrediteur: ['52', '53'],
    },
    { ref: 'BY', libelle: 'Écart de conversion · Actif', sens: 'ACTIF', comptes: ['478'] },
];
exports.POSTES_PASSIF = [
    { ref: 'CA', libelle: 'Fonds affectés aux investissements', sens: 'PASSIF', comptes: ['16'] },
    { ref: 'CB', libelle: 'Report à nouveau (+ ou -)', sens: 'PASSIF', comptes: ['12'] },
    { ref: 'CD', libelle: "Subventions d'investissement", sens: 'PASSIF', comptes: ['14'] },
    { ref: 'DA', libelle: 'Emprunts et dettes assimilées', sens: 'PASSIF', comptes: ['18'] },
    { ref: 'DB', libelle: 'Provisions pour risques et charges', sens: 'PASSIF', comptes: ['19'] },
    { ref: 'DE', libelle: 'Dettes circulantes H.A.O.', sens: 'PASSIF', comptes: ['481', '484', '4998'] },
    { ref: 'DF', libelle: "Fonds d'administration", sens: 'PASSIF', comptes: ['46'] },
    { ref: 'DG', libelle: 'Fournisseurs', sens: 'PASSIF', comptes: ['40'], exclusions: ['409'] },
    {
        ref: 'DH',
        libelle: 'Autres dettes',
        sens: 'PASSIF',
        comptes: ['419', '42', '43', '44', '47'],
        exclusions: ['478', '479'],
        sens_qualificatif: 'CREDITEUR',
    },
    { ref: 'DI', libelle: 'Provisions pour risques et charges à court terme', sens: 'PASSIF', comptes: ['20'] },
    {
        ref: 'DW',
        libelle: 'Banques, établissements financiers et crédits de trésorerie',
        sens: 'PASSIF',
        comptes: ['56'],
    },
    { ref: 'DY', libelle: 'Écart de conversion · Passif', sens: 'PASSIF', comptes: ['479'] },
];
exports.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR = ['52', '53'];
function trouvePosteActif(ref) {
    return exports.POSTES_ACTIF.find((p) => p.ref === ref);
}
function trouvePostePassif(ref) {
    return exports.POSTES_PASSIF.find((p) => p.ref === ref);
}
exports.TOTAUX_ACTIF = [
    { ref: 'AZ', libelle: 'TOTAL ACTIF IMMOBILISE', deRefs: ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH'] },
    { ref: 'BF', libelle: 'TOTAL ACTIF CIRCULANT', deRefs: ['BA', 'BB', 'BC', 'BD', 'BE'] },
    { ref: 'BX', libelle: 'TOTAL TRESORERIE ACTIF', deRefs: ['BV', 'BW'] },
    { ref: 'BZ', libelle: 'TOTAL GENERAL', deRefs: ['AZ', 'BF', 'BX', 'BY'] },
];
exports.TOTAUX_PASSIF = [
    { ref: 'CZ', libelle: 'TOTAL RESSOURCES PROPRES ET ASSIMILEES', deRefs: ['CA', 'CB', 'CC', 'CD'] },
    { ref: 'DC', libelle: 'TOTAL DETTES FINANCIERES ET RESSOURCES ASSIMILEES', deRefs: ['DA', 'DB'] },
    { ref: 'DD', libelle: 'TOTAL RESSOURCES STABLES', deRefs: ['CZ', 'DC'] },
    { ref: 'DJ', libelle: 'TOTAL PASSIF CIRCULANT', deRefs: ['DE', 'DF', 'DG', 'DH', 'DI'] },
    { ref: 'DX', libelle: 'TOTAL TRESORERIE PASSIF', deRefs: ['DW'] },
    { ref: 'DZ', libelle: 'TOTAL GENERAL', deRefs: ['DD', 'DJ', 'DX', 'DY'] },
];
exports.ORDRE_AFFICHAGE_ACTIF = [
    'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AZ',
    'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BV', 'BW', 'BX', 'BY', 'BZ',
];
exports.ORDRE_AFFICHAGE_PASSIF = [
    'CA', 'CB', 'CC', 'CD', 'CZ',
    'DA', 'DB', 'DC', 'DD', 'DE', 'DF', 'DG', 'DH', 'DI', 'DJ', 'DW', 'DX', 'DY', 'DZ',
];
//# sourceMappingURL=correspondance-projet-bilan.js.map