"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDRE_AFFICHAGE_PASSIF_SYSCOHADA = exports.ORDRE_AFFICHAGE_ACTIF_SYSCOHADA = exports.TOTAUX_PASSIF_SYSCOHADA = exports.TOTAUX_ACTIF_SYSCOHADA = exports.COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE = exports.COMPTES_BILAN_SANS_POSTE_JUSTIFIES = exports.COMPTES_RESULTAT_SYSCOHADA = exports.LIBELLE_RESULTAT_SYSCOHADA = exports.REF_RESULTAT_SYSCOHADA = exports.REF_TRESORERIE_PASSIF_SYSCOHADA = exports.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA = exports.POSTES_PASSIF_SYSCOHADA = exports.POSTES_ACTIF_SYSCOHADA = void 0;
exports.trouvePosteActifSyscohada = trouvePosteActifSyscohada;
exports.trouvePostePassifSyscohada = trouvePostePassifSyscohada;
const resultat_de_l_exercice_1 = require("../etats-financiers/resultat-de-l-exercice");
exports.POSTES_ACTIF_SYSCOHADA = [
    {
        ref: 'AE',
        libelle: 'Frais de développement et de prospection',
        sens: 'ACTIF',
        comptes: ['211', '2181', '2191'],
        comptesAmortissement: ['2811', '2911'],
    },
    {
        ref: 'AF',
        libelle: 'Brevets, licences, logiciels et droits similaires',
        sens: 'ACTIF',
        comptes: ['212', '213', '214', '2193'],
        comptesAmortissement: ['2812', '2813', '2814', '2912', '2913', '2914'],
    },
    {
        ref: 'AG',
        libelle: 'Fonds commercial et droit au bail',
        sens: 'ACTIF',
        comptes: ['215', '216'],
        comptesAmortissement: ['2815', '2816', '2915', '2916'],
    },
    {
        ref: 'AH',
        libelle: 'Autres immobilisations incorporelles',
        sens: 'ACTIF',
        comptes: ['217', '218', '2198'],
        exclusions: ['2181'],
        comptesAmortissement: ['2817', '2818', '2917', '2918', '2919'],
    },
    {
        ref: 'AJ',
        libelle: 'Terrains',
        sens: 'ACTIF',
        renvoi: 'dont Placement en Net',
        comptes: ['22'],
        comptesAmortissement: ['282', '292'],
    },
    {
        ref: 'AK',
        libelle: 'Bâtiments',
        sens: 'ACTIF',
        renvoi: 'dont Placement en Net',
        comptes: ['231', '232', '233', '237', '2391'],
        comptesAmortissement: ['2831', '2832', '2833', '2837', '2931', '2932', '2933', '2937'],
    },
    {
        ref: 'AL',
        libelle: 'Aménagements, agencements et installations',
        sens: 'ACTIF',
        comptes: ['234', '235', '238', '2392', '2393', '2394', '2395', '2398'],
        comptesAmortissement: ['2834', '2835', '2838', '2934', '2935', '2938', '2939'],
    },
    {
        ref: 'AM',
        libelle: 'Matériel, mobilier et actifs biologiques',
        sens: 'ACTIF',
        comptes: ['24'],
        exclusions: ['245', '2495'],
        comptesAmortissement: ['284', '294'],
        exclusionsAmortissement: ['2845', '2945'],
    },
    {
        ref: 'AN',
        libelle: 'Matériel de transport',
        sens: 'ACTIF',
        comptes: ['245', '2495'],
        comptesAmortissement: ['2845', '2945'],
    },
    {
        ref: 'AP',
        libelle: 'AVANCES ET ACOMPTES VERSÉS SUR IMMOBILISATIONS',
        sens: 'ACTIF',
        note: '3',
        comptes: ['251', '252'],
        comptesAmortissement: ['2951', '2952'],
    },
    { ref: 'AR', libelle: 'Titres de participation', sens: 'ACTIF', comptes: ['26'], comptesAmortissement: ['296'] },
    { ref: 'AS', libelle: 'Autres immobilisations financières', sens: 'ACTIF', comptes: ['27'], comptesAmortissement: ['297'] },
    {
        ref: 'BA',
        libelle: 'ACTIF CIRCULANT HAO',
        sens: 'ACTIF',
        note: '5',
        comptes: ['485', '488'],
        comptesAmortissement: ['498'],
    },
    {
        ref: 'BB',
        libelle: 'STOCKS ET ENCOURS',
        sens: 'ACTIF',
        note: '6',
        comptes: ['31', '32', '33', '34', '35', '36', '37', '38'],
        comptesAmortissement: ['39'],
    },
    { ref: 'BH', libelle: 'Fournisseurs avances versées', sens: 'ACTIF', note: '17', comptes: ['409'], comptesAmortissement: ['490'] },
    { ref: 'BI', libelle: 'Clients', sens: 'ACTIF', note: '7', comptes: ['41'], exclusions: ['419'], comptesAmortissement: ['491'] },
    {
        ref: 'BJ',
        libelle: 'Autres créances',
        sens: 'ACTIF',
        note: '8',
        comptes: ['185', '42', '43', '44', '45', '46', '47'],
        exclusions: ['478', '479'],
        comptesAmortissement: ['492', '493', '494', '495', '496', '497'],
        sens_qualificatif: 'DEBITEUR',
    },
    { ref: 'BQ', libelle: 'Titres de placement', sens: 'ACTIF', note: '9', comptes: ['50'], comptesAmortissement: ['590'] },
    { ref: 'BR', libelle: 'Valeurs à encaisser', sens: 'ACTIF', note: '10', comptes: ['51'], comptesAmortissement: ['591'] },
    {
        ref: 'BS',
        libelle: 'Banques, chèques postaux, caisse et assimilés',
        sens: 'ACTIF',
        note: '11',
        comptes: ['52', '53', '54', '55', '57', '581', '582'],
        comptesAmortissement: ['592', '593', '594'],
        comptesTransferesSiCrediteur: ['52', '53'],
    },
    { ref: 'BU', libelle: 'Écart de conversion-Actif', sens: 'ACTIF', note: '12', comptes: ['478'] },
];
exports.POSTES_PASSIF_SYSCOHADA = [
    { ref: 'CA', libelle: 'Capital', sens: 'PASSIF', note: '13', comptes: ['101', '102', '103', '104'] },
    { ref: 'CB', libelle: 'Apporteurs capital non appelé (-)', sens: 'PASSIF', note: '13', comptes: ['109'] },
    { ref: 'CD', libelle: 'Primes liées au capital social', sens: 'PASSIF', note: '14', comptes: ['105'] },
    { ref: 'CE', libelle: 'Écarts de réévaluation', sens: 'PASSIF', note: '3e', comptes: ['106'] },
    { ref: 'CF', libelle: 'Réserves indisponibles', sens: 'PASSIF', note: '14', comptes: ['111', '112', '113'] },
    { ref: 'CG', libelle: 'Réserves libres', sens: 'PASSIF', note: '14', comptes: ['118'] },
    { ref: 'CH', libelle: 'Report à nouveau (+ ou -)', sens: 'PASSIF', note: '14', comptes: ['12'] },
    { ref: 'CL', libelle: "Subventions d'investissement", sens: 'PASSIF', note: '15', comptes: ['14'] },
    { ref: 'CM', libelle: 'Provisions réglementées', sens: 'PASSIF', note: '15', comptes: ['15'] },
    {
        ref: 'DA',
        libelle: 'Emprunts et dettes financières diverses',
        sens: 'PASSIF',
        note: '16',
        comptes: ['16', '181', '182', '183', '184'],
    },
    { ref: 'DB', libelle: 'Dettes de location acquisition', sens: 'PASSIF', note: '16', comptes: ['17'] },
    { ref: 'DC', libelle: 'Provisions pour risques et charges', sens: 'PASSIF', note: '16', comptes: ['19'] },
    { ref: 'DH', libelle: 'Dettes circulantes HAO', sens: 'PASSIF', note: '5', comptes: ['481', '482', '484', '4998'] },
    { ref: 'DI', libelle: 'Clients, avances reçues', sens: 'PASSIF', note: '7', comptes: ['419'] },
    { ref: 'DJ', libelle: "Fournisseurs d'exploitation", sens: 'PASSIF', note: '17', comptes: ['40'], exclusions: ['409'] },
    {
        ref: 'DK',
        libelle: 'Dettes fiscales et sociales',
        sens: 'PASSIF',
        note: '18',
        comptes: ['42', '43', '44'],
        sens_qualificatif: 'CREDITEUR',
    },
    {
        ref: 'DM',
        libelle: 'Autres dettes',
        sens: 'PASSIF',
        note: '19',
        comptes: ['185', '45', '46', '47'],
        exclusions: ['478', '479'],
        sens_qualificatif: 'CREDITEUR',
    },
    {
        ref: 'DN',
        libelle: 'Provisions pour risques à court terme',
        sens: 'PASSIF',
        note: '19',
        comptes: ['499', '599'],
        exclusions: ['4998'],
    },
    { ref: 'DQ', libelle: "Banques, crédits d'escompte", sens: 'PASSIF', note: '20', comptes: ['564', '565'] },
    {
        ref: 'DR',
        libelle: 'Banques, établissements financiers et crédits de trésorerie',
        sens: 'PASSIF',
        note: '20',
        comptes: ['561', '566'],
    },
    { ref: 'DV', libelle: 'Écart de conversion-Passif', sens: 'PASSIF', note: '12', comptes: ['479'] },
];
exports.COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA = ['52', '53'];
exports.REF_TRESORERIE_PASSIF_SYSCOHADA = 'DR';
exports.REF_RESULTAT_SYSCOHADA = 'CJ';
exports.LIBELLE_RESULTAT_SYSCOHADA = "Résultat net de l'exercice (bénéfice + ou perte -)";
exports.COMPTES_RESULTAT_SYSCOHADA = [...resultat_de_l_exercice_1.COMPTES_RESULTAT_DE_L_EXERCICE, '130'];
exports.COMPTES_BILAN_SANS_POSTE_JUSTIFIES = [
    { prefixe: '186', anomalie: 5, motif: 'Compte de liaison charges siège/établissements, neutralisé dans la comptabilité fusionnée (Titre VII COMPTE 18)' },
    { prefixe: '187', anomalie: 5, motif: 'Compte de liaison produits siège/établissements, neutralisé dans la comptabilité fusionnée (Titre VII COMPTE 18)' },
    { prefixe: '188', anomalie: 5, motif: 'Compte de liaison des sociétés en participation : aucun poste au ch. 7 ; le Titre VII COMPTE 18 le range avec 181 à 183 (opérations financières entre entités liées) sans lui donner de poste' },
    { prefixe: '585', anomalie: 4, motif: 'Virements de fonds, à solder à la clôture (Titre VII COMPTE 58) ; un résidu est une erreur d’inventaire' },
    { prefixe: '588', anomalie: 4, motif: 'Autres virements internes, à solder à la clôture (Titre VII COMPTE 58) ; un résidu est une erreur d’inventaire' },
];
exports.COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE = [
    { prefixe: '104', anomalie: 10, source: 'Titre VII COMPTE 104 : « systématiquement soldé à la clôture de l’exercice » par le 103' },
    { prefixe: '130', anomalie: 7, source: 'Titre VII COMPTE 13 : le résultat N-1 non affecté est viré au report à nouveau en fin d’exercice' },
    { prefixe: '585', anomalie: 4, source: 'Titre VII COMPTE 58 : « soldés à la fin de l’exercice »' },
    { prefixe: '588', anomalie: 4, source: 'Titre VII COMPTE 58 : « soldés à la fin de l’exercice »' },
];
function trouvePosteActifSyscohada(ref) {
    return exports.POSTES_ACTIF_SYSCOHADA.find((p) => p.ref === ref);
}
function trouvePostePassifSyscohada(ref) {
    return exports.POSTES_PASSIF_SYSCOHADA.find((p) => p.ref === ref);
}
exports.TOTAUX_ACTIF_SYSCOHADA = [
    { ref: 'AD', libelle: 'IMMOBILISATIONS INCORPORELLES', note: '3', deRefs: ['AE', 'AF', 'AG', 'AH'] },
    { ref: 'AI', libelle: 'IMMOBILISATIONS CORPORELLES', note: '3', deRefs: ['AJ', 'AK', 'AL', 'AM', 'AN'] },
    { ref: 'AQ', libelle: 'IMMOBILISATIONS FINANCIÈRES', note: '4', deRefs: ['AR', 'AS'] },
    { ref: 'AZ', libelle: 'TOTAL ACTIF IMMOBILISÉ', deRefs: ['AD', 'AI', 'AP', 'AQ'] },
    { ref: 'BG', libelle: 'CRÉANCES ET EMPLOIS ASSIMILÉS', deRefs: ['BH', 'BI', 'BJ'] },
    { ref: 'BK', libelle: 'TOTAL ACTIF CIRCULANT', deRefs: ['BA', 'BB', 'BG'] },
    { ref: 'BT', libelle: 'TOTAL TRÉSORERIE-ACTIF', deRefs: ['BQ', 'BR', 'BS'] },
    { ref: 'BZ', libelle: 'TOTAL GÉNÉRAL', deRefs: ['AZ', 'BK', 'BT', 'BU'] },
];
exports.TOTAUX_PASSIF_SYSCOHADA = [
    {
        ref: 'CP',
        libelle: 'TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES',
        deRefs: ['CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CJ', 'CL', 'CM'],
    },
    { ref: 'DD', libelle: 'TOTAL DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES', deRefs: ['DA', 'DB', 'DC'] },
    { ref: 'DF', libelle: 'TOTAL RESSOURCES STABLES', deRefs: ['CP', 'DD'] },
    { ref: 'DP', libelle: 'TOTAL PASSIF CIRCULANT', deRefs: ['DH', 'DI', 'DJ', 'DK', 'DM', 'DN'] },
    { ref: 'DT', libelle: 'TOTAL TRÉSORERIE-PASSIF', deRefs: ['DQ', 'DR'] },
    { ref: 'DZ', libelle: 'TOTAL GÉNÉRAL', deRefs: ['DF', 'DP', 'DT', 'DV'] },
];
exports.ORDRE_AFFICHAGE_ACTIF_SYSCOHADA = [
    'AD', 'AE', 'AF', 'AG', 'AH',
    'AI', 'AJ', 'AK', 'AL', 'AM', 'AN',
    'AP',
    'AQ', 'AR', 'AS',
    'AZ',
    'BA', 'BB',
    'BG', 'BH', 'BI', 'BJ',
    'BK',
    'BQ', 'BR', 'BS',
    'BT',
    'BU',
    'BZ',
];
exports.ORDRE_AFFICHAGE_PASSIF_SYSCOHADA = [
    'CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CJ', 'CL', 'CM',
    'CP',
    'DA', 'DB', 'DC',
    'DD',
    'DF',
    'DH', 'DI', 'DJ', 'DK', 'DM', 'DN',
    'DP',
    'DQ', 'DR',
    'DT',
    'DV',
    'DZ',
];
//# sourceMappingURL=correspondance-bilan-syscohada.js.map