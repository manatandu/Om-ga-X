"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDRE_AFFICHAGE_PASSIF = exports.ORDRE_AFFICHAGE_ACTIF = exports.TOTAUX_PASSIF = exports.TOTAUX_ACTIF = exports.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR = exports.POSTES_PASSIF = exports.POSTES_ACTIF = void 0;
exports.trouvePosteActif = trouvePosteActif;
exports.trouvePostePassif = trouvePostePassif;
exports.POSTES_ACTIF = [
    { ref: 'AB', libelle: 'Immobilisations incorporelles', sens: 'ACTIF', comptes: ['201'], comptesAmortissement: ['280', '2901'] },
    {
        ref: 'AC',
        libelle: 'Immobilisations corporelles et financières',
        sens: 'ACTIF',
        comptes: ['202', '203', '204', '205'],
        comptesAmortissement: ['2902'],
    },
    {
        ref: 'AE',
        libelle: 'Brevets, licences, logiciels et droits similaires',
        sens: 'ACTIF',
        comptes: ['212', '213', '214', '2193'],
        comptesAmortissement: ['2812', '2813', '2814', '2912', '2913'],
    },
    {
        ref: 'AF',
        libelle: 'Autres immobilisations incorporelles',
        sens: 'ACTIF',
        comptes: ['218', '2198'],
        comptesAmortissement: ['2818', '2918', '2919'],
    },
    { ref: 'AG', libelle: 'Avances et acomptes versés sur immobilisations incorporelles', sens: 'ACTIF', comptes: ['251'] },
    { ref: 'AI', libelle: 'Terrains', sens: 'ACTIF', comptes: ['22'], comptesAmortissement: ['282', '292'] },
    {
        ref: 'AJ',
        libelle: 'Bâtiments',
        sens: 'ACTIF',
        comptes: ['231', '232', '233', '2391', '2392', '2393', '2396'],
        comptesAmortissement: ['2831', '2832', '2833', '2931', '2932', '2933'],
    },
    {
        ref: 'AK',
        libelle: 'Aménagements, agencements et installations',
        sens: 'ACTIF',
        comptes: ['234', '235', '238', '2394', '2395', '2398'],
        comptesAmortissement: ['2834', '2835', '2838', '2934', '2935', '2938', '2939'],
    },
    {
        ref: 'AL',
        libelle: 'Matériel, mobilier et actifs biologiques',
        sens: 'ACTIF',
        comptes: ['24'],
        exclusions: ['245', '2495'],
        comptesAmortissement: ['284', '294'],
        exclusionsAmortissement: ['2845', '2945'],
    },
    {
        ref: 'AM',
        libelle: 'Matériel de transport',
        sens: 'ACTIF',
        comptes: ['245', '2495'],
        comptesAmortissement: ['2845', '2945'],
    },
    { ref: 'AN', libelle: 'Avances et acomptes versés sur immobilisations corporelles', sens: 'ACTIF', comptes: ['252'], comptesAmortissement: ['2952'] },
    { ref: 'AX', libelle: 'Titres de participation', sens: 'ACTIF', comptes: ['26'], comptesAmortissement: ['296'] },
    { ref: 'AY', libelle: 'Autres immobilisations financières', sens: 'ACTIF', comptes: ['27'], comptesAmortissement: ['297'] },
    { ref: 'BA', libelle: 'Actif circulant H.A.O.', sens: 'ACTIF', comptes: ['485', '4865'], comptesAmortissement: ['498'] },
    {
        ref: 'BB',
        libelle: 'Stocks et encours',
        sens: 'ACTIF',
        comptes: ['31', '32', '33', '34', '36', '37', '38'],
        comptesAmortissement: ['39'],
    },
    { ref: 'BC', libelle: 'Fournisseurs débiteurs', sens: 'ACTIF', comptes: ['409'], comptesAmortissement: ['490'] },
    { ref: 'BD', libelle: 'Adhérents, Clients-usagers', sens: 'ACTIF', comptes: ['41'], exclusions: ['419'], comptesAmortissement: ['491'] },
    {
        ref: 'BE',
        libelle: 'Autres créances',
        sens: 'ACTIF',
        comptes: ['42', '43', '44', '45', '47'],
        exclusions: ['478'],
        comptesAmortissement: ['492', '493', '494', '497'],
        sens_qualificatif: 'DEBITEUR',
    },
    { ref: 'BU', libelle: 'Titres de placement', sens: 'ACTIF', comptes: ['50'], comptesAmortissement: ['590'] },
    { ref: 'BV', libelle: 'Valeurs à encaisser', sens: 'ACTIF', comptes: ['51'], comptesAmortissement: ['591'] },
    {
        ref: 'BW',
        libelle: 'Banques, établissements financiers, caisses et assimilés',
        sens: 'ACTIF',
        comptes: ['52', '53', '55', '57'],
        comptesAmortissement: ['592', '593', '595'],
        comptesTransferesSiCrediteur: ['52', '53'],
    },
    { ref: 'BY', libelle: 'Écart de conversion · Actif', sens: 'ACTIF', comptes: ['478'] },
];
exports.POSTES_PASSIF = [
    { ref: 'CA', libelle: 'Donation non consomptible sans droit de reprise', sens: 'PASSIF', comptes: ['101'] },
    { ref: 'CB', libelle: 'Donation non consomptible avec droit de reprise', sens: 'PASSIF', comptes: ['102'] },
    { ref: 'CC', libelle: "Droit d'entrée", sens: 'PASSIF', comptes: ['103'] },
    { ref: 'CD', libelle: 'Donation consomptible', sens: 'PASSIF', comptes: ['104'] },
    { ref: 'CE', libelle: 'Écarts de réévaluation', sens: 'PASSIF', comptes: ['106'] },
    { ref: 'CF', libelle: 'Réserves', sens: 'PASSIF', comptes: ['11'] },
    { ref: 'CG', libelle: 'Report à nouveau (+ ou -)', sens: 'PASSIF', comptes: ['12'] },
    { ref: 'CI', libelle: "Subventions d'investissement", sens: 'PASSIF', comptes: ['14'] },
    { ref: 'CJ', libelle: 'Provisions réglementées', sens: 'PASSIF', comptes: ['15'] },
    { ref: 'CW', libelle: 'Fonds affectés et provenant de dons et legs d’immobilisations', sens: 'PASSIF', comptes: ['16'] },
    { ref: 'CX', libelle: 'Fonds reportés', sens: 'PASSIF', comptes: ['17'] },
    { ref: 'DA', libelle: 'Emprunts et dettes financières', sens: 'PASSIF', comptes: ['181', '182', '183', '185', '186', '188'] },
    { ref: 'DB', libelle: 'Dettes de location-acquisition', sens: 'PASSIF', comptes: ['187'] },
    { ref: 'DC', libelle: 'Provisions pour risques et charges', sens: 'PASSIF', comptes: ['19'] },
    { ref: 'DF', libelle: 'Dettes circulantes H.A.O.', sens: 'PASSIF', comptes: ['481', '484', '4861', '488', '4998'] },
    { ref: 'DG', libelle: 'Adhérents, clients-usagers créditeurs', sens: 'PASSIF', comptes: ['419'] },
    { ref: 'DH', libelle: 'Fournisseurs', sens: 'PASSIF', comptes: ['40'], exclusions: ['409'] },
    {
        ref: 'DI',
        libelle: 'Autres dettes',
        sens: 'PASSIF',
        comptes: ['42', '43', '44', '45', '47', '499', '599'],
        exclusions: ['479', '4998'],
        sens_qualificatif: 'CREDITEUR',
    },
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
    { ref: 'AA', libelle: 'Immobilisations destinées à la vente provenant de dons et legs non encore reçues et usufruit temporaire', deRefs: ['AB', 'AC'] },
    { ref: 'AD', libelle: 'IMMOBILISATIONS INCORPORELLES', deRefs: ['AE', 'AF', 'AG'] },
    { ref: 'AH', libelle: 'IMMOBILISATIONS CORPORELLES', deRefs: ['AI', 'AJ', 'AK', 'AL', 'AM', 'AN'] },
    { ref: 'AO', libelle: 'IMMOBILISATIONS FINANCIERES', deRefs: ['AX', 'AY'] },
    { ref: 'AZ', libelle: 'TOTAL ACTIF IMMOBILISE', deRefs: ['AA', 'AD', 'AH', 'AO'] },
    { ref: 'BT', libelle: 'TOTAL ACTIF CIRCULANT', deRefs: ['BA', 'BB', 'BC', 'BD', 'BE'] },
    { ref: 'BX', libelle: 'TOTAL TRESORERIE ACTIF', deRefs: ['BU', 'BV', 'BW'] },
    { ref: 'BZ', libelle: 'TOTAL GENERAL', deRefs: ['AZ', 'BT', 'BX', 'BY'] },
];
exports.TOTAUX_PASSIF = [
    { ref: 'CK', libelle: 'TOTAL FONDS PROPRES ET ASSIMILES', deRefs: ['CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG', 'CH', 'CI', 'CJ'] },
    { ref: 'CY', libelle: 'TOTAL FONDS AFFECTES ET REPORTES', deRefs: ['CW', 'CX'] },
    { ref: 'CZ', libelle: 'TOTAL RESSOURCES PROPRES ET ASSIMILEES', deRefs: ['CK', 'CY'] },
    { ref: 'DD', libelle: 'TOTAL DETTES FINANCIERES ET RESSOURCES ASSIMILEES', deRefs: ['DA', 'DB', 'DC'] },
    { ref: 'DE', libelle: 'TOTAL RESSOURCES STABLES', deRefs: ['CZ', 'DD'] },
    { ref: 'DV', libelle: 'TOTAL PASSIF CIRCULANT', deRefs: ['DF', 'DG', 'DH', 'DI'] },
    { ref: 'DX', libelle: 'TOTAL TRESORERIE PASSIF', deRefs: ['DW'] },
    { ref: 'DZ', libelle: 'TOTAL GENERAL', deRefs: ['DE', 'DV', 'DX', 'DY'] },
];
exports.ORDRE_AFFICHAGE_ACTIF = [
    'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN',
    'AO', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ',
];
exports.ORDRE_AFFICHAGE_PASSIF = [
    'CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK',
    'CW', 'CX', 'CY', 'CZ', 'DA', 'DB', 'DC', 'DD', 'DE', 'DF', 'DG', 'DH', 'DI', 'DV', 'DW', 'DX', 'DY', 'DZ',
];
//# sourceMappingURL=correspondance-bilan.js.map