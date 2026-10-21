"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFS_DE_SOLDE = exports.LIBELLES_CALCULES = exports.ORDRE_AFFICHAGE = exports.TOTAUX = exports.COMPTES_TRESORERIE_PROJET = exports.POSTES_CHARGES = exports.POSTES_IMMOBILISATIONS = exports.POSTES_RESSOURCES = void 0;
exports.POSTES_RESSOURCES = [
    {
        ref: 'FA',
        libelle: 'Fonds reçus, Bailleurs',
        section: 'RESSOURCES',
        sens: 'CREDIT',
        comptes: ['161', '162', '462'],
        fondement: "Guide d'application, Application 21 : « Balance mouvement crédit : comptes 161, 162, 462 (si plusieurs bailleurs, créer des sous-comptes de 161, 162, 462 pour remplir FB) ».",
    },
    {
        ref: 'FC',
        libelle: 'Fonds contrepartie État',
        section: 'RESSOURCES',
        sens: 'CREDIT',
        comptes: ['163', '463'],
        fondement: "Guide d'application, Application 21 : « Balance mouvement crédit : comptes 163, 463 ».",
    },
    {
        ref: 'FD',
        libelle: 'Autres fonds reçus',
        section: 'RESSOURCES',
        sens: 'CREDIT',
        comptes: ['164', '464', '707', '77'],
        fondement: "Guide d'application, Application 21 : « Balance mouvement crédit : comptes 164, 464, 707 (1), 77 ». Renvoi (1) : « Produits d'exploitation à recevoir en cas de vente de cahier de charges, location de voiture, sous-location de bureau, etc. »",
    },
];
const DEDUCTION_DETTES_INVESTISSEMENT = {
    comptes: ['481'],
    exclusions: ['4813'],
    operation: 'AJOUTER_VARIATION',
    renvoi: "Renvoi (2) : « Déduire la variation des dettes fournisseurs d'investissements (+ solde créditeur N-1 du compte 481 concerné sauf 4813 − solde créditeur N du compte 481 concerné sauf 4813). »",
};
function virementEnCours(comptes, exclusions) {
    return {
        comptes,
        exclusions,
        operation: 'RETRANCHER_MOUVEMENT',
        renvoi: "Renvoi (2), seconde phrase : « En sus, ne pas tenir compte des virements de compte à compte qui ne traduisent pas une acquisition d'immobilisation incorporelle et corporelle décaissée. » Mouvement crédit de l'en-cours achevé, retranché.",
    };
}
exports.POSTES_IMMOBILISATIONS = [
    {
        ref: 'FE',
        libelle: 'Immobilisations incorporelles',
        section: 'IMMOBILISATIONS',
        sens: 'DEBIT',
        comptes: ['21'],
        deductions: [DEDUCTION_DETTES_INVESTISSEMENT, virementEnCours(['219'])],
        fondement: "Application 21 : « Balance mouvement débit : compte 21 (2) ».",
    },
    {
        ref: 'FF',
        libelle: 'Terrains',
        section: 'IMMOBILISATIONS',
        sens: 'DEBIT',
        comptes: ['22'],
        deductions: [DEDUCTION_DETTES_INVESTISSEMENT, virementEnCours(['229'])],
        fondement: "Application 21 : « Balance mouvement débit : compte 22 (2) ».",
    },
    {
        ref: 'FG',
        libelle: 'Bâtiments',
        section: 'IMMOBILISATIONS',
        sens: 'DEBIT',
        comptes: ['231', '232', '233', '2391', '2392', '2393', '2396'],
        deductions: [DEDUCTION_DETTES_INVESTISSEMENT, virementEnCours(['2391', '2392', '2393', '2396'])],
        fondement: "Application 21 : « comptes 231, 232, 233, 2391, 2392, 2393, 2396 (2) ».",
    },
    {
        ref: 'FH',
        libelle: 'Aménagements, agencements et installations',
        section: 'IMMOBILISATIONS',
        sens: 'DEBIT',
        comptes: ['234', '235', '238', '2394', '2395', '2398'],
        deductions: [DEDUCTION_DETTES_INVESTISSEMENT, virementEnCours(['2394', '2395', '2398'])],
        fondement: "Application 21 : « comptes 234, 235, 238, 2394, 2395, 2398 (2) ».",
    },
    {
        ref: 'FI',
        libelle: 'Matériel, mobilier et actifs biologiques',
        section: 'IMMOBILISATIONS',
        sens: 'DEBIT',
        comptes: ['24'],
        exclusions: ['245', '2495'],
        deductions: [DEDUCTION_DETTES_INVESTISSEMENT, virementEnCours(['249'], ['2495'])],
        fondement: "Application 21 : « comptes 24 (sauf 245 et 2495) (2) ».",
    },
    {
        ref: 'FJ',
        libelle: 'Matériel de transport',
        section: 'IMMOBILISATIONS',
        sens: 'DEBIT',
        comptes: ['245', '2495'],
        deductions: [DEDUCTION_DETTES_INVESTISSEMENT, virementEnCours(['2495'])],
        fondement: "Application 21 : « comptes 245 et 2495 (2) ».",
    },
    {
        ref: 'FK',
        libelle: 'Avances et acomptes sur immobilisations',
        section: 'IMMOBILISATIONS',
        sens: 'DEBIT',
        comptes: ['25'],
        fondement: "Application 21 : « Balance mouvement débit : comptes 25 ».",
    },
    {
        ref: 'FL',
        libelle: 'Immobilisations financières',
        section: 'IMMOBILISATIONS',
        sens: 'DEBIT',
        comptes: ['26', '27'],
        exclusions: ['276'],
        deductions: [
            {
                comptes: ['4813'],
                operation: 'AJOUTER_VARIATION',
                renvoi: "Renvoi (3) : « Déduire la variation des dettes rattachées aux versements restant à effectuer sur titres de participation et titres immobilisés non libérés » (compte 4813). Voir l'anomalie signalée en tête de fichier sur le sens débiteur/créditeur.",
            },
        ],
        fondement: "Application 21 : « Balance mouvement débit : comptes 26, 27 (3) ».",
    },
];
const DEDUCTION_DETTES_EXPLOITATION = {
    comptes: ['401'],
    operation: 'AJOUTER_VARIATION',
    renvoi: "Renvoi (4) : « Déduire la variation des dettes fournisseurs d'exploitation. En sus, ne pas tenir compte de la variation des stocks (compte 603) figurant dans le compte 60 Achats, ni des comptes 60 Achats et dettes équivalentes transférés en immobilisations (livraison à soi-même). »",
};
exports.POSTES_CHARGES = [
    {
        ref: 'FM',
        libelle: 'Achats de biens et services',
        section: 'CHARGES',
        sens: 'DEBIT',
        comptes: ['60'],
        exclusions: ['603'],
        deductions: [DEDUCTION_DETTES_EXPLOITATION],
        fondement: "Application 21 : « Balance mouvement débit : compte 60 (4) ».",
    },
    {
        ref: 'FN',
        libelle: 'Transports',
        section: 'CHARGES',
        sens: 'DEBIT',
        comptes: ['61'],
        deductions: [DEDUCTION_DETTES_EXPLOITATION],
        fondement: "Application 21 : « Balance mouvement débit : compte 61 (4) ».",
    },
    {
        ref: 'FO',
        libelle: 'Services extérieurs',
        section: 'CHARGES',
        sens: 'DEBIT',
        comptes: ['62', '63'],
        deductions: [DEDUCTION_DETTES_EXPLOITATION],
        fondement: "Application 21 : « Balance mouvement débit : comptes 62, 63 (4) ».",
    },
    {
        ref: 'FP',
        libelle: 'Impôts et taxes',
        section: 'CHARGES',
        sens: 'DEBIT',
        comptes: ['64'],
        deductions: [
            {
                comptes: ['44'],
                operation: 'AJOUTER_VARIATION',
                renvoi: "Renvoi (5) : « Déduire la variation des dettes fiscales » (compte 44).",
            },
        ],
        fondement: "Application 21 : « Balance mouvement débit : compte 64 (5) ».",
    },
    {
        ref: 'FQ',
        libelle: 'Autres charges',
        section: 'CHARGES',
        sens: 'DEBIT',
        comptes: ['65'],
        exclusions: ['659'],
        deductions: [
            {
                comptes: ['47'],
                operation: 'AJOUTER_VARIATION',
                renvoi: "Renvoi (6) : « Déduire la variation des dettes rattachées au compte 65 Autres charges. En sus, ne pas tenir compte des comptes Autres charges transférés en immobilisations ni des dépréciations et provisions à court terme (comptes 49). » Le guide ne nomme pas le compte de tiers concerné (« le compte de tiers concerné ») : le 47 Débiteurs et créditeurs divers est retenu, c'est celui que la Partie 2 associe aux autres charges.",
            },
        ],
        fondement: "Application 21 : « Balance mouvement débit : compte 65 (6) ».",
    },
    {
        ref: 'FR',
        libelle: 'Charges de personnel',
        section: 'CHARGES',
        sens: 'DEBIT',
        comptes: ['66'],
        deductions: [
            {
                comptes: ['42', '43'],
                operation: 'AJOUTER_VARIATION',
                renvoi: "Renvoi (7) : « Déduire la variation des dettes rattachées aux charges de personnel » (comptes 42 et 43).",
            },
        ],
        fondement: "Application 21 : « Balance mouvement débit : compte 66 (7) ».",
    },
    {
        ref: 'FS',
        libelle: 'Charges financières',
        section: 'CHARGES',
        sens: 'DEBIT',
        comptes: ['67'],
        exclusions: ['679'],
        deductions: [
            {
                comptes: ['186'],
                operation: 'RETRANCHER_MOUVEMENT',
                renvoi: "Renvoi (8) : « Déduire le mouvement crédit du compte 166. » Le plan SYCEBNL n'ouvre pas de 166 ; les intérêts courus y sont au 186 (fiche du compte 18), lu ici. Seule déduction du guide qui porte sur un MOUVEMENT et non sur une variation de solde · elle est traitée comme telle.",
            },
        ],
        fondement: "Application 21 : « Balance mouvement débit : compte 67 (8) ».",
    },
    {
        ref: 'FT',
        libelle: 'Avances sur charges (à justifier)',
        section: 'CHARGES',
        sens: 'DEBIT',
        comptes: ['4091', '4093'],
        lectureSolde: 'DEBITEUR_CLOTURE',
        fondement: "Application 21 : « Balance solde débiteur : comptes 4091, 4093 ».",
    },
];
exports.COMPTES_TRESORERIE_PROJET = ['51', '52', '53', '55', '57'];
exports.TOTAUX = [
    { ref: 'GR', libelle: 'I. RESSOURCES', deRefs: ['FA', 'FB', 'FC', 'FD'] },
    { ref: 'GS', libelle: 'A- TOTAL DES IMMOBILISATIONS', deRefs: ['FE', 'FF', 'FG', 'FH', 'FI', 'FJ', 'FK', 'FL'] },
    { ref: 'GT', libelle: 'B- TOTAL DES CHARGES DE FONCTIONNEMENT', deRefs: ['FM', 'FN', 'FO', 'FP', 'FQ', 'FR', 'FS', 'FT'] },
    { ref: 'GU', libelle: 'II. EMPLOIS (A+B)', deRefs: ['GS', 'GT'] },
    { ref: 'GW', libelle: 'IV. FONDS DISPONIBLE EN DEBUT EXERCICE', deRefs: ['FU', 'FV', 'FW'] },
    { ref: 'GY', libelle: 'VI. FONDS DISPONIBLE EN FIN EXERCICE', deRefs: ['FX', 'FY', 'FZ'] },
];
exports.ORDRE_AFFICHAGE = [
    'FA', 'FB', 'FC', 'FD', 'GR',
    'FE', 'FF', 'FG', 'FH', 'FI', 'FJ', 'FK', 'FL', 'GS',
    'FM', 'FN', 'FO', 'FP', 'FQ', 'FR', 'FS', 'FT', 'GT',
    'GU', 'GV',
    'FU', 'FV', 'FW', 'GW', 'GX',
    'FX', 'FY', 'FZ', 'GY', 'GZ',
];
exports.LIBELLES_CALCULES = {
    GV: 'III. EXCEDENT / DEFICIT DES FONDS RECUS SUR LES EMPLOIS (I-II)',
    GX: "V. MONTANT NET DE L'ENCAISSE DISPONIBLE (III+IV)",
    GZ: 'VII. CONTRÔLE : TOTAL V = TOTAL VI',
    FB: 'Fonds reçus, Bailleurs',
    FU: 'Fonds Bailleur en début exercice N',
    FV: 'Fonds de contrepartie État en début exercice N',
    FW: 'Autres fonds en début exercice N',
    FX: 'Fonds Bailleur en fin exercice N',
    FY: 'Fonds de contrepartie État en fin exercice N',
    FZ: 'Autres fonds en fin exercice N',
};
exports.REFS_DE_SOLDE = ['FU', 'FV', 'FW', 'GW', 'GX', 'FX', 'FY', 'FZ', 'GY', 'GZ'];
//# sourceMappingURL=correspondance-projet-emplois-ressources.js.map