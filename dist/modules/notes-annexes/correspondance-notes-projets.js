"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTES_PROJETS = void 0;
const effectifs_seize_colonnes_1 = require("./effectifs-seize-colonnes");
const COLONNES_STANDARD = [
    { type: 'EXERCICE_N', libelle: 'Année N' },
    { type: 'EXERCICE_N1', libelle: 'Année N-1' },
    { type: 'VARIATION_VALEUR', libelle: 'Variation en valeur' },
    { type: 'VARIATION_POURCENT', libelle: 'Variation en %' },
];
const COLONNES_AVEC_ECHEANCES_CREANCES = [
    ...COLONNES_STANDARD,
    { type: 'ECHEANCE_1AN', libelle: 'Créances à un an au plus' },
    { type: 'ECHEANCE_2ANS', libelle: "Créances à plus d'un an et à deux ans au plus" },
    { type: 'ECHEANCE_PLUS_2ANS', libelle: 'Créances à plus de deux ans' },
];
const COLONNES_AVEC_ECHEANCES_DETTES = [
    ...COLONNES_STANDARD,
    { type: 'ECHEANCE_1AN', libelle: 'Dettes à un an au plus' },
    { type: 'ECHEANCE_2ANS', libelle: "Dettes à plus d'un an et à deux ans au plus" },
    { type: 'ECHEANCE_PLUS_2ANS', libelle: 'Dettes à plus de deux ans' },
];
const COLONNES_MOUVEMENTS = [
    { type: 'OUVERTURE', libelle: "A · Montant brut à l'ouverture de l'exercice" },
    { type: 'AUGMENTATIONS', libelle: 'AUGMENTATIONS B' },
    { type: 'DIMINUTIONS', libelle: 'DIMINUTIONS C' },
    { type: 'CLOTURE', libelle: "D = A + B - C (Montant brut à la clôture de l'exercice)" },
];
const COLONNES_MOUVEMENTS_DETAILLEES = [
    { type: 'OUVERTURE', libelle: "A · Montant brut à l'ouverture de l'exercice" },
    { type: 'AUGMENTATIONS', libelle: 'B · Acquisitions/Apports/Créations' },
    { type: 'VIREMENTS_AUGMENTATION', libelle: 'B · Virements de poste à poste' },
    { type: 'REEVALUATION', libelle: "B · Suite à une réévaluation pratiquée au cours de l'exercice" },
    { type: 'DIMINUTIONS', libelle: 'C · Cessions/Scissions Hors service' },
    { type: 'VIREMENTS_DIMINUTION', libelle: 'C · Virements de poste à poste' },
    { type: 'CLOTURE', libelle: "D = A + B - C (Montant brut à la clôture de l'exercice)" },
];
function enAttente(cle, libelle, attendu) {
    return { cle, libelle, subdivisionAttendue: attendu };
}
exports.NOTES_PROJETS = [
    {
        code: '1',
        titre: 'INFORMATIONS OBLIGATOIRES',
        horsBalance: true,
        applicableDOffice: 'SYCEBNL Partie 4 ch. 1, section 6 · les Notes annexes « doivent comporter obligatoirement une ' +
            'déclaration explicite de conformité », portée par la rubrique B de cette note.',
        colonnes: [{ type: 'LIBRE', libelle: 'Informations' }],
        rubriques: [
            { cle: 'a-identite-organisation', libelle: 'A - IDENTITE, ORGANISATION', saisie: true },
            {
                cle: 'b-declaration-de-conformite-au-systeme-comptable', libelle: 'B - DECLARATION DE CONFORMITE AU SYSTEME COMPTABLE DES ENTITES A BUT NON LUCRATIF ET FAITS ' +
                    "MARQUANTS DE L'EXERCICE",
                saisie: true,
            },
            { cle: 'c-regles-methodes-comptables-et-derogation-aux-p', libelle: 'C - REGLES, METHODES COMPTABLES ET DEROGATION AUX PRINCIPES COMPTABLES', saisie: true },
            { cle: 'd-informations-complementaires-relatives-au-bila', libelle: "D - INFORMATIONS COMPLEMENTAIRES RELATIVES AU BILAN ET AU COMPTE D'EXPLOITATION", saisie: true },
        ],
        commentaire: 'ne mentionner que les éléments ayant une incidence comptable significative ou nuisant à la ' +
            'comparabilité des exercices ; décrire les règles et méthodes utilisées pour l’établissement des états ' +
            'financiers.',
    },
    {
        code: '2',
        titre: 'INFORMATIONS SPECIFIQUES',
        horsBalance: true,
        colonnes: [{ type: 'LIBRE', libelle: 'Informations' }],
        rubriques: [
            { cle: 'a-tableau-emplois-ressources', libelle: 'A - TABLEAU EMPLOIS RESSOURCES', saisie: true },
            { cle: 'b-tableau-d-execution-budgetaire', libelle: "B - TABLEAU D'EXECUTION BUDGÉTAIRE", saisie: true },
            { cle: 'c-tableau-de-reconciliation-de-tresorerie', libelle: 'C - TABLEAU DE RECONCILIATION DE TRESORERIE', saisie: true },
        ],
        commentaire: "indiquer les faits marquants pour chaque état financier ; expliquer les écarts significatifs entre " +
            "budget et réalisation du tableau d'exécution budgétaire.",
    },
    {
        code: '3A',
        titre: 'IMMOBILISATIONS BRUTES',
        colonnes: COLONNES_MOUVEMENTS_DETAILLEES,
        renvoyeeDepuis: ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH'],
        rubriques: [
            { libelle: 'Brevets, licences, logiciels et droits similaires', comptes: ['212', '213'] },
            { libelle: 'Avances et acomptes sur immobilisations incorporelles', comptes: ['251'] },
            { libelle: 'Autres immobilisations incorporelles', comptes: ['214', '218', '219'] },
            { libelle: 'Terrains hors immeuble de placement', comptes: ['22'], exclusions: ['2281'] },
            { libelle: 'Terrains - immeuble de placement', comptes: ['2281'] },
            {
                libelle: 'Bâtiments hors immeuble de placement',
                comptes: ['231', '232', '233', '2391', '2392', '2393'],
                exclusions: ['2315', '2325'],
            },
            { libelle: 'Bâtiments - immeuble de placement', comptes: ['2315', '2325', '2396'] },
            { libelle: 'Aménagements, agencements et installations', comptes: ['234', '235', '238', '2394', '2395', '2398'] },
            {
                libelle: 'Matériel, mobilier et actifs biologiques',
                comptes: ['241', '242', '243', '244', '246', '247', '248', '249'],
                exclusions: ['2495'],
            },
            { libelle: 'Matériel de transport', comptes: ['245', '2495'] },
            { libelle: 'Avances et acomptes sur immobilisations corporelles', comptes: ['252'] },
            { libelle: 'Dépôts et cautionnement', comptes: ['275'] },
            { libelle: 'Autres immobilisations financières', comptes: ['26', '27'], exclusions: ['275'] },
            {
                libelle: 'TOTAL GENERAL',
                totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            },
        ],
        commentaire: "toute variation significative doit être commentée ; joindre l'inventaire physique des immobilisations.",
    },
    {
        code: '3B',
        titre: 'BIENS PRIS EN LOCATION-ACQUISITION',
        colonnes: [
            { type: 'LIBRE', libelle: 'Nature du contrat (I ; M ; A)', saisieSurLigneChiffree: true },
            ...COLONNES_MOUVEMENTS,
        ],
        rubriques: [
            { cle: 'location-acquisition-terrains', libelle: 'Terrains', comptes: ['2286'] },
            { cle: 'location-acquisition-batiments', libelle: 'Bâtiments', comptes: ['2316', '2326'] },
            {
                cle: 'location-acquisition-materiel-mobilier',
                libelle: 'Matériel, mobilier',
                comptes: ['2416', '2426', '2446'],
            },
            { cle: 'location-acquisition-materiel-transport', libelle: 'Matériel de transport', comptes: ['2456'] },
            { libelle: 'TOTAL IMMOBILISATIONS EN LOCATION-ACQUISITION', totalDeRubriques: [0, 1, 2, 3] },
        ],
        renvoiOfficiel: 'I : Crédit-bail immobilier ; M : Crédit-bail mobilier ; A : Autres contrats ' +
            '(dédoubler le poste si montant significatif).',
        commentaire: "indiquer la nature du bien, le nom du bailleur et la durée du bail ; joindre l'inventaire physique des " +
            'immobilisations.',
    },
    {
        code: '4',
        sousTableau: 'ACTIF CIRCULANT HAO',
        titre: 'ACTIF CIRCULANT HAO',
        precisionEditeur: 'La ligne des autres créances HAO lit aussi le compte 488, que le poste BA du bilan ne prend pas (il ne lit que le 485) : le montant de la note peut dépasser celui du poste.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['BA'],
        rubriques: [
            { libelle: "Créances sur cessions d'immobilisations", comptes: ['485'] },
            { libelle: 'Autres créances hors activités ordinaires', comptes: ['488'], sens: 'DEBITEUR' },
            { libelle: 'TOTAL BRUT', totalDeRubriques: [0, 1] },
            { libelle: 'Dépréciations des créances HAO', comptes: ['498'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DEPRECIATIONS', totalDeRubriques: [2, 3] },
        ],
        commentaire: 'commenter toute variation significative ; dépréciations : indiquer les événements et circonstances ; ' +
            "indiquer la date et la nature de l'immobilisation achetée et/ou cédée.",
    },
    {
        code: '4',
        sousTableau: 'DETTES CIRCULANTES HAO',
        titre: 'DETTES CIRCULANTES HAO',
        precisionEditeur: 'Le poste DE du bilan comprend aussi le compte 4998 (provisions pour risques et charges à court terme H.A.O.), auquel le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['DE'],
        rubriques: [
            { libelle: "Fournisseurs d'investissements", comptes: ['481'], sens: 'CREDITEUR' },
            { libelle: 'Autres dettes hors activités ordinaires', comptes: ['484'], sens: 'CREDITEUR' },
            { libelle: 'TOTAL', totalDeRubriques: [0, 1] },
        ],
    },
    {
        code: '5',
        titre: 'STOCKS ET ENCOURS',
        precisionEditeur: 'Le poste BB du bilan comprend aussi les comptes 34 (dons en nature) et 363 (actifs biologiques), auxquels le modèle de cette note ne donne aucune ligne.',
        renvoyeeDepuis: ['BB', 'TC'],
        colonnes: [
            { type: 'EXERCICE_N', libelle: 'Année N' },
            { type: 'EXERCICE_N1', libelle: 'Année N-1' },
            { type: 'VARIATION_VALEUR', libelle: 'Variation (Valeur)' },
            { type: 'VARIATION_POURCENT', libelle: 'Variation (%)' },
        ],
        rubriques: [
            { libelle: "Biens liés à l'activité", comptes: ['31'] },
            { libelle: 'Marchandises', comptes: ['321', '322'] },
            { libelle: 'Matières premières et fournitures liées', comptes: ['323', '324', '325'] },
            { libelle: 'Autres approvisionnements', comptes: ['33'] },
            enAttente('produits-en-cours', 'Produits en cours', 'Le compte 35 « Produits finis et services en cours » ne distingue pas les produits en cours des ' +
                'services en cours : subdiviser 35 et rattacher ici le sous-compte des produits en cours.'),
            enAttente('services-en-cours', 'Services en cours', 'Même situation que « Produits en cours » : subdiviser le compte 35 et rattacher ici le sous-compte ' +
                'des services en cours.'),
            { libelle: 'Produits finis', comptes: ['361', '362'] },
            { libelle: 'Produits intermédiaires', comptes: ['367'] },
            { libelle: 'Stocks HAO', comptes: ['38'] },
            { libelle: 'Stocks en cours de route, en consignation ou en dépôt', comptes: ['37'] },
            {
                libelle: 'TOTAL STOCKS ET ENCOURS',
                totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            },
            { libelle: 'Dépréciations des stocks', comptes: ['39'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DEPRECIATIONS', totalDeRubriques: [10, 11] },
        ],
        commentaire: 'commenter toute variation significative des stocks.',
    },
    {
        code: '6',
        titre: 'CLIENTS-USAGERS ET AUTRES CREANCES',
        colonnes: COLONNES_AVEC_ECHEANCES_CREANCES,
        renvoyeeDepuis: ['BC', 'BD', 'BE'],
        rubriques: [
            { libelle: 'Fournisseurs, débiteurs', comptes: ['409'] },
            { libelle: 'Clients-usagers', comptes: ['41'], exclusions: ['411', '419'] },
            { libelle: 'Personnel', comptes: ['42'], sens: 'DEBITEUR' },
            { libelle: 'Organismes sociaux', comptes: ['43'], sens: 'DEBITEUR' },
            { libelle: 'Etat et Collectivités publiques', comptes: ['44'], sens: 'DEBITEUR' },
            { libelle: 'Autres débiteurs divers', comptes: ['47'], exclusions: ['478'], sens: 'DEBITEUR' },
            { libelle: 'TOTAL BRUT', totalDeRubriques: [0, 1, 2, 3, 4, 5] },
            {
                libelle: 'Dépréciations des créances',
                comptes: ['490', '491', '492', '493', '494', '497'],
                presenterEnNegatif: true,
            },
            { libelle: 'TOTAL NET DE DEPRECIATIONS', totalDeRubriques: [6, 7] },
        ],
        commentaire: 'justifier toute variation significative ; détailler les créances dont le montant est significatif ; ' +
            'justifier les créances anciennes ; indiquer les événements et circonstances motivant la dépréciation ' +
            'et la reprise.',
    },
    {
        code: '7',
        titre: 'DISPONIBILITES',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['BV', 'BW'],
        rubriques: [
            { libelle: 'Chèques à encaisser', comptes: ['513'] },
            { libelle: "Chèques à l'encaissement", comptes: ['514'] },
            { libelle: 'Cartes de crédit à encaisser', comptes: ['515'] },
            { libelle: 'Autres valeurs à encaisser', comptes: ['518'] },
            { libelle: 'TOTAL VALEURS A ENCAISSER', totalDeRubriques: [0, 1, 2, 3] },
            { libelle: 'Banques locales', comptes: ['521'], sens: 'DEBITEUR' },
            { libelle: 'Banques autres états région', comptes: ['522'], sens: 'DEBITEUR' },
            { libelle: 'Banques, dépôt à terme et assimilés', comptes: ['525'], sens: 'DEBITEUR' },
            { libelle: 'Autres Banques', comptes: ['523', '524'], sens: 'DEBITEUR' },
            { libelle: 'Banques intérêts courus', comptes: ['526'], sens: 'DEBITEUR' },
            { libelle: 'Banques postales', comptes: ['531'], sens: 'DEBITEUR' },
            { libelle: 'Autres établissement financiers', comptes: ['532', '533', '538'], sens: 'DEBITEUR' },
            { libelle: 'Etablissement financiers intérêts courus', comptes: ['536'], sens: 'DEBITEUR' },
            { libelle: 'Instruments de monnaie électronique', comptes: ['55'], sens: 'DEBITEUR' },
            { libelle: 'Caisse', comptes: ['57'] },
            {
                libelle: 'TOTAL BANQUES ET CAISSES',
                totalDeRubriques: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
            },
            { libelle: 'Dépréciations', comptes: ['592', '593', '595'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DEPRECIATIONS', totalDeRubriques: [4, 15, 16] },
        ],
        renvoiOfficiel: 'NB : Banques et intérêts courus et Etablissement financiers intérêts courus figurent dans cette ' +
            'rubrique en négatif si le compte principal attaché est débiteur. Voir anomalie n° 1 en tête de fichier.',
        commentaire: 'indiquer la date de rapprochement des comptes bancaires ; indiquer la date d’inventaire de la caisse et ' +
            'des instruments de monnaie électronique ; justifier toute variation significative ; détailler les ' +
            'instruments de monnaie électronique si le montant est significatif ; indiquer les événements et ' +
            'circonstances motivant la dépréciation et la reprise.',
    },
    {
        code: '8',
        titre: 'ECARTS DE CONVERSION',
        colonnes: [
            { type: 'LIBRE', libelle: 'Devises' },
            { type: 'LIBRE', libelle: 'Montant en devises' },
            { type: 'LIBRE', libelle: 'Cours UML Année acquisition' },
            { type: 'LIBRE', libelle: 'Cours UML 31/12' },
            { type: 'EXERCICE_N', libelle: 'Variation en valeur' },
            { type: 'LIBRE', libelle: 'Variation en %' },
        ],
        renvoyeeDepuis: ['BY', 'DY'],
        rubriques: [
            { libelle: 'Ecarts de conversion-actif', comptes: ['478'], sens: 'DEBITEUR' },
            { libelle: 'Ecart de conversion-passif', comptes: ['479'], sens: 'CREDITEUR' },
        ],
        renvoiOfficiel: 'UML : Unités Monétaires légales.',
        commentaire: 'faire un commentaire.',
    },
    {
        code: '9',
        titre: 'FONDS DU BAILLEUR',
        renvoyeeDepuis: ['CA', 'DF', 'RA'],
        horsBalance: true,
        applicableDOffice: "Tableau servi par l'état « Note 9 · Fonds du bailleur », que le moteur des notes ne lit pas.",
        colonnes: [{ type: 'LIBRE', libelle: 'Fonds du bailleur' }],
        rubriques: [
            {
                cle: 'cette-note-a-des-colonnes-dynamiques-une-par-bai', libelle: 'Tableau servi par l\'état « Note 9 · Fonds du bailleur », une colonne par bailleur, cumulé depuis ' +
                    "l'origine du projet.",
                saisie: true,
            },
        ],
        renvoiOfficiel: '(1) Le nombre de colonnes est fonction du nombre de bailleurs et/ou sous-projets. (2) Le montant ' +
            'consommé au titre d’un exercice représente le solde du compte 702 Quote-part de fonds d’administration ' +
            'transférés qu’il convient de subdiviser par nature de projet.',
        commentaire: "indiquer pour chaque projet le niveau d'utilisation des fonds affectés en pourcentage par catégorie de " +
            "fonds (fonds d'investissement et fonds d'administration) et de façon globale ; expliquer les motifs " +
            "liés aux éventuels retards dans le cadre de l'exécution des projets.",
    },
    {
        code: '10',
        titre: 'SUBVENTIONS',
        colonnes: [...COLONNES_STANDARD, { type: 'LIBRE', libelle: 'Echéances', saisieSurLigneChiffree: true }],
        renvoyeeDepuis: ['CD'],
        rubriques: [
            { cle: 'subventions-etat', libelle: 'État', comptes: ['1411'], natureCreditrice: true },
            { cle: 'subventions-region', libelle: 'Région', comptes: ['1412'], natureCreditrice: true },
            { cle: 'subventions-departement', libelle: 'Département', comptes: ['1413'], natureCreditrice: true },
            {
                cle: 'subventions-communes',
                libelle: 'Communes et collectivités publiques décentralisées',
                comptes: ['1414'],
                natureCreditrice: true,
            },
            {
                cle: 'subventions-entites-publiques-ou-mixtes',
                libelle: 'Entités publiques ou mixtes',
                comptes: ['1415'],
                natureCreditrice: true,
            },
            {
                cle: 'subventions-entites-privees',
                libelle: 'Entités et organismes privés',
                comptes: ['1416'],
                natureCreditrice: true,
            },
            {
                cle: 'subventions-organismes-internationaux',
                libelle: 'Organismes internationaux',
                comptes: ['1417'],
                natureCreditrice: true,
            },
            { cle: 'subventions-autres', libelle: 'Autres', comptes: ['1418', '148'], natureCreditrice: true },
            { libelle: 'TOTAL SUBVENTIONS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7] },
        ],
    },
    {
        code: '11',
        titre: 'DETTES FINANCIERES ET RESSOURCES ASSIMILEES',
        precisionEditeur: 'Le poste DA du bilan comprend aussi le compte 181 (emprunts obligataires) et le poste DB le compte 192 (provisions pour charges sur donations et legs), auxquels le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_AVEC_ECHEANCES_DETTES,
        renvoyeeDepuis: ['DA', 'DB'],
        rubriques: [
            { libelle: 'Emprunts et dettes auprès des établissements de crédit', comptes: ['182'], natureCreditrice: true },
            { libelle: "Avances reçues de l'Etat", comptes: ['183'], natureCreditrice: true },
            { libelle: 'Dépôts et cautionnements reçus', comptes: ['185'], natureCreditrice: true },
            { libelle: 'Intérêts courus', comptes: ['186'], natureCreditrice: true },
            { libelle: 'Autres emprunts et dettes', comptes: ['188'], natureCreditrice: true },
            { libelle: 'TOTAL EMPRUNTS ET DETTES FINANCIERES', totalDeRubriques: [0, 1, 2, 3, 4] },
            { libelle: 'Crédit-bail immobilier', comptes: ['1871'], natureCreditrice: true },
            { libelle: 'Crédit-bail mobilier', comptes: ['1872'], natureCreditrice: true },
            { libelle: 'Location-vente', comptes: ['1873'], natureCreditrice: true },
            { libelle: 'Intérêts courus', comptes: ['1876'], natureCreditrice: true },
            {
                libelle: 'Autres dettes de location-acquisition',
                comptes: ['187'],
                exclusions: ['1871', '1872', '1873', '1876'],
                natureCreditrice: true,
            },
            { libelle: 'TOTAL DETTES DE LOCATION-ACQUISITION', totalDeRubriques: [6, 7, 8, 9, 10] },
            { libelle: 'Provisions pour litiges', comptes: ['191'], natureCreditrice: true },
            { libelle: 'Provisions pour pertes de change', comptes: ['194'], natureCreditrice: true },
            { libelle: 'Provisions pour pensions et obligations assimilées', comptes: ['196'], natureCreditrice: true },
            { libelle: 'Provisions pour amendes et pénalités', comptes: ['1981'], natureCreditrice: true },
            { libelle: 'Autres provisions', comptes: ['198'], exclusions: ['1981'], natureCreditrice: true },
            {
                libelle: 'TOTAL PROVISIONS FINANCIERES POUR RISQUES ET CHARGES',
                totalDeRubriques: [12, 13, 14, 15, 16],
            },
        ],
        commentaire: "pour chaque emprunt et dette de location-acquisition, mentionner la date d'octroi, le nom de " +
            "l'organisme financier, le montant initial, la durée du crédit, les garanties données par la société ; " +
            'indiquer les événements et circonstances motivant la provision et la reprise ; pour les pensions et ' +
            "obligations de retraite, indiquer la méthode d'évaluation retenue, le nom de la compagnie d'assurance " +
            'ou du fonds de pension, le descriptif de la convention, la périodicité des versements, le montant et ' +
            'la durée de la convention pour les actifs du régime.',
    },
    {
        code: '12',
        titre: 'DETTES FOURNISSEURS ET ASSIMILEES, FISCALES ET SOCIALES',
        precisionEditeur: 'Le poste DH du bilan comprend aussi les soldes créditeurs des comptes 47 (hors 478 et 479), ainsi que des comptes 421, 4287 et 4387, auxquels le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_AVEC_ECHEANCES_DETTES,
        renvoyeeDepuis: ['DG', 'DH'],
        rubriques: [
            { libelle: 'Fournisseurs', comptes: ['40'], exclusions: ['409'], sens: 'CREDITEUR' },
            { libelle: 'Clients-usagers créditeurs', comptes: ['419'], sens: 'CREDITEUR' },
            { libelle: 'DETTES FOURNISSEURS ET ASSIMILEES', totalDeRubriques: [0, 1] },
            { libelle: 'Personnel, rémunérations dues', comptes: ['422'], sens: 'CREDITEUR' },
            { libelle: 'Personnel, congés à payer', comptes: ['4281'], sens: 'CREDITEUR' },
            { libelle: 'Charges sociales sur congés à payer', comptes: ['4382'], sens: 'CREDITEUR' },
            { libelle: 'Autres personnel', comptes: ['423', '424', '425', '427', '4286'], sens: 'CREDITEUR' },
            { libelle: 'Caisse de sécurité sociale', comptes: ['431'], sens: 'CREDITEUR' },
            { libelle: 'Caisse de retraite', comptes: ['432'], sens: 'CREDITEUR' },
            { libelle: 'Mutuelle de santé', comptes: ['4331'], sens: 'CREDITEUR' },
            { libelle: 'Assurance Retraite', comptes: ['4332'], sens: 'CREDITEUR' },
            { libelle: 'Autres charges sociales à payer', comptes: ['4381', '4386'], sens: 'CREDITEUR' },
            { libelle: 'Autres cotisations et organismes sociaux', comptes: ['433'], exclusions: ['4331', '4332'], sens: 'CREDITEUR' },
            { libelle: 'TOTAL DETTES SOCIALES', totalDeRubriques: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
            enAttente('etat-impots-benefices', 'Etat, impôts sur les bénéfices', "Le plan SYCEBNL ne comporte aucun compte d'« impôt sur les bénéfices » (sa classe 44 commence au " +
                "compte 442, sans équivalent du 441 SYSCOHADA) : créer un sous-compte dédié sous la classe 44 si " +
                "cet impôt s'applique au projet, et le rattacher ici."),
            { libelle: 'Etat, autres impôts et taxes', comptes: ['442'], sens: 'CREDITEUR' },
            { libelle: 'Etat, TVA', comptes: ['443', '444', '445', '446'], sens: 'CREDITEUR' },
            { libelle: 'Etat, impôts retenus à la source', comptes: ['447'], sens: 'CREDITEUR' },
            { libelle: 'Autres dettes Etat', comptes: ['448', '449'], sens: 'CREDITEUR' },
            { libelle: 'TOTAL DETTES FISCALES', totalDeRubriques: [14, 15, 16, 17, 18] },
            {
                libelle: 'TOTAL DETTES FOURNISSEURS ET ASSIMILEES, DETTES FISCALES ET SOCIALES',
                totalDeRubriques: [2, 13, 19],
            },
        ],
        commentaire: 'commenter toute variation significative ; commenter les dettes anciennes.',
    },
    {
        code: '13',
        titre: "BANQUES, CREDIT D'ESCOMPTE ET DE TRESORERIE",
        precisionEditeur: 'La ligne « Autres Banques » comprend aussi les comptes 53 (établissements financiers et assimilés) à ' +
            'solde créditeur : la correspondance du bilan les porte en DW, et le modèle de cette note ne leur donne ' +
            'aucune ligne. La ligne est un choix d’OmegaX, pour que la note recoupe DW.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['DW'],
        rubriques: [
            enAttente('escomptes-credit-campagne', 'Escomptes de crédit de campagne', "Le plan SYCEBNL n'a pas de compte distinct pour l'escompte de crédit de campagne (seul le compte " +
                '565 « Escompte de crédits ordinaires » existe) : créer un sous-compte dédié et le rattacher ici.'),
            { libelle: 'Escomptes de crédit ordinaires', comptes: ['565'], natureCreditrice: true },
            { libelle: "TOTAL : BANQUES, CREDITS D'ESCOMPTE ET DE TRESORERIE", totalDeRubriques: [0, 1] },
            { libelle: 'Banques locales', comptes: ['521'], sens: 'CREDITEUR' },
            { libelle: 'Banques autres états région', comptes: ['522'], sens: 'CREDITEUR' },
            { libelle: 'Autres Banques', comptes: ['523', '524', '525', '53'], sens: 'CREDITEUR' },
            { libelle: 'Banques, intérêts courus', comptes: ['526'], sens: 'CREDITEUR' },
            { libelle: 'Crédit de trésorerie', comptes: ['56'], exclusions: ['565'], natureCreditrice: true },
            { libelle: 'TOTAL : BANQUES, CREDITS DE TRESORERIE', totalDeRubriques: [3, 4, 5, 6, 7] },
            { libelle: 'TOTAL GENERAL', totalDeRubriques: [2, 8] },
        ],
        renvoiOfficiel: '« Banques et intérêts courus » figure dans cette rubrique si le compte principal attaché est ' +
            'créditeur.',
        commentaire: "commenter toute variation significative ; indiquer le nom de l'organisme, les conditions de crédit, " +
            "le taux d'intérêt, la durée du crédit.",
    },
    {
        code: '14',
        titre: 'REVENUS ET AUTRES PRODUITS',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['RB', 'RC', 'RD'],
        rubriques: [
            { libelle: 'Ventes de marchandises', comptes: ['7051'], natureCreditrice: true },
            {
                ...enAttente('ventes-produits-fabriques', 'Ventes de produits fabriqués', 'Le plan subdivise 705 (7052 Services vendus, 7053 Ventes de produits finis, 7054 Ventes de ' +
                    'produits intermédiaires, 7055 Ventes de produits résiduels) sans sous-compte nommé « produits ' +
                    'fabriqués » : rattacher ici ceux qui en relèvent.'),
                natureCreditrice: true,
            },
            {
                ...enAttente('ventes-travaux-services', 'Ventes de travaux et services', 'Le plan subdivise 705 (7052 Services vendus, 7053 à 7055 ventes de produits) sans sous-compte ' +
                    'nommé « travaux » : rattacher ici ceux qui relèvent des travaux et services, 7052 compris.'),
                natureCreditrice: true,
            },
            { libelle: 'Produits accessoires', comptes: ['707'], natureCreditrice: true },
            { libelle: 'Production immobilisée', comptes: ['72'], natureCreditrice: true },
            { libelle: "Subventions d'exploitation", comptes: ['71'], natureCreditrice: true },
            {
                libelle: "Autres produits et transferts de charges d'exploitation",
                comptes: ['73', '75', '77', '78'],
                natureCreditrice: true,
            },
            { libelle: 'TOTAL : AUTRES PRODUITS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6] },
        ],
        commentaire: 'justifier toute variation significative ; détailler produits intermédiaires, produits résiduels, ' +
            'produits accessoires, autres produits si significatifs.',
    },
    {
        code: '15',
        titre: 'ACHATS',
        precisionEditeur: 'Le poste TB du compte d\'exploitation comprend aussi le compte 606 (achats autres activités), auquel le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['TA', 'TB'],
        rubriques: [
            { libelle: "Achats de biens et services liés à l'activité", comptes: ['601'] },
            enAttente('achats-marchandises', 'Achats de marchandises', 'Le compte 602 combine marchandises, matières premières et fournitures liées : subdiviser 602 et ' +
                'rattacher ici le sous-compte des achats de marchandises.'),
            enAttente('achats-matieres-fournitures', 'Achats de matières premières et fournitures liées', 'Même situation que « Achats de marchandises » : subdiviser le compte 602 et rattacher ici le ' +
                'sous-compte des matières premières et fournitures liées.'),
            { libelle: 'Matières consommables', comptes: ['6041'] },
            { libelle: 'Matières combustibles', comptes: ['6042'] },
            { libelle: "Produits d'entretien", comptes: ['6043'] },
            enAttente('fournitures-atelier', "Fournitures d'atelier, d'usine et de magasin", "Le plan n'ouvre que 6046 « Fournitures de magasin », qui ne couvre ni l'atelier ni l'usine : " +
                'rattacher ici les sous-comptes qui en relèvent.'),
            { libelle: 'Eau', comptes: ['6051'] },
            { libelle: 'Electricité', comptes: ['6052'] },
            { libelle: 'Autres énergies', comptes: ['6053'] },
            { libelle: "Fourniture d'entretien", comptes: ['6054'] },
            enAttente('fourniture-bureau', 'Fourniture de bureau', 'Le plan ouvre deux sous-comptes, 6047 « Fournitures de bureau » (stockées) et 6055 « Fournitures ' +
                'de bureau non stockables » : rattacher ici ceux que le projet mouvemente.'),
            { libelle: 'Petit matériel et outillages', comptes: ['6056'] },
            enAttente('achats-etudes', 'Achats études, prestations de services, de travaux matériels et équipements', "Le plan ouvre 6057 « Achats d'études et prestations de service » et 6058 « Achats de travaux, " +
                'matériels et équipements » : rattacher ici ceux que le projet mouvemente.'),
            { libelle: "Achats d'emballages", comptes: ['608'] },
            enAttente('frais-sur-achats', 'Frais sur achats', 'Les frais sur achats sont aux 6015, 6025, 6045 et 6085 (Partie 2 ch. 3, compte 60). 6015 et 6085 ' +
                'sont déjà dans « Achats de biens et services liés à l\'activité » (601) et « Achats d\'emballages » ' +
                '(608) : les rattacher ici les compterait deux fois. Rattacher ici 6025 et 6045.'),
            enAttente('rabais-remises-ristournes', 'Remises rabais, et ristournes obtenus', 'Les rabais obtenus sur achats sont aux 6029, 6049 et 6059 : les rattacher ici. 6019 et 6089 sont ' +
                'déjà dans « Achats de biens et services liés à l\'activité » (601) et « Achats d\'emballages » ' +
                '(608) : les rattacher ici les compterait deux fois.'),
            { libelle: 'TOTAL ACHATS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
        ],
        commentaire: 'commenter toute variation significative.',
    },
    {
        code: '16',
        titre: 'TRANSPORTS',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['TD'],
        rubriques: [
            { libelle: 'Transports sur ventes', comptes: ['612'] },
            { libelle: 'Transports pour le compte de tiers', comptes: ['613'] },
            { libelle: 'Transport du personnel', comptes: ['614'] },
            { libelle: 'Transports de plis', comptes: ['616'] },
            { libelle: 'Voyages et déplacements', comptes: ['6181'] },
            { libelle: 'Transports administratifs', comptes: ['6183'] },
            { libelle: 'TOTAL', totalDeRubriques: [0, 1, 2, 3, 4, 5] },
        ],
        commentaire: 'commenter toute variation significative.',
    },
    {
        code: '17',
        titre: 'SERVICES EXTERIEURS',
        precisionEditeur: 'Le poste TG du compte d\'exploitation comprend aussi le compte 636 (frais de recherche de fonds), auquel le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['TG'],
        rubriques: [
            { libelle: 'Sous-traitance générale', comptes: ['621'] },
            { libelle: 'Locations et charges locatives', comptes: ['622'] },
            { libelle: 'Redevances de location-acquisition', comptes: ['623'] },
            { libelle: 'Entretien, réparations et maintenance', comptes: ['624'] },
            { libelle: "Primes d'assurance", comptes: ['625'] },
            { libelle: 'Etudes, recherches et documentation', comptes: ['626'] },
            { libelle: 'Publicité, publications, relations publiques', comptes: ['627'] },
            { libelle: 'Frais de télécommunications', comptes: ['628'] },
            { libelle: 'Frais bancaires', comptes: ['631'] },
            { libelle: "Rémunérations d'intermédiaires et de conseils", comptes: ['632'] },
            { libelle: 'Frais de formation du personnel', comptes: ['633'] },
            { libelle: 'Redevances pour brevets, licences, logiciels, concessions et droits similaires', comptes: ['634'] },
            { libelle: 'Cotisations', comptes: ['635'] },
            { libelle: "Rémunérations de personnel extérieur à l'entité", comptes: ['637'] },
            { libelle: 'Autres charges externes', comptes: ['638'] },
            { libelle: 'TOTAL', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
        ],
        commentaire: 'commenter toute variation significative.',
    },
    {
        code: '18',
        titre: 'IMPOTS ET TAXES',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['TH'],
        rubriques: [
            { libelle: 'Impôts et taxes directs', comptes: ['641'] },
            { libelle: 'Impôts et taxes indirects', comptes: ['645'] },
            { libelle: "Droits d'enregistrement", comptes: ['646'] },
            { libelle: 'Pénalités et amendes fiscales', comptes: ['647'] },
            { libelle: 'Autres impôts et taxes', comptes: ['648'] },
            {
                libelle: 'Dégrèvements et annulations des impôts et taxes',
                comptes: ['649'],
                presenterEnNegatif: true,
                renvoi: "(1) Ce compte a un solde créditeur, son montant doit être précédé d'un signe (-).",
            },
            { libelle: 'TOTAL', totalDeRubriques: [0, 1, 2, 3, 4, 5] },
        ],
        commentaire: 'commenter toute variation significative ; détailler les pénalités, les amendes et indiquer la cause.',
    },
    {
        code: '19',
        titre: 'AUTRES CHARGES',
        precisionEditeur: 'Le poste TI du compte d\'exploitation comprend aussi les comptes 6512 (pertes sur créances adhérents) et 652 (subventions accordées par l\'entité), auxquels le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['TI'],
        rubriques: [
            { libelle: 'Pertes sur créances', comptes: ['6511'] },
            { libelle: 'Pertes sur autres débiteurs', comptes: ['6515'] },
            enAttente('perte-change-creances', 'Perte de change sur créances', "Le plan SYCEBNL n'ouvre aucun compte de perte de change sous le 65 (autres charges). Le 676 " +
                '« Pertes de change financières » relève des frais financiers (poste TK) et est déjà détaillé en ' +
                'note 21 : ne pas le rattacher ici. Rattacher ici, le cas échéant, le sous-compte propre du dossier.'),
            { libelle: 'Pénalités et amendes pénales', comptes: ['657'] },
            { libelle: 'Dons et mécénat', comptes: ['654'] },
            { libelle: 'Autres charges diverses', comptes: ['658'] },
            { libelle: "Charges pour provisions pour risques à court terme d'exploitation", comptes: ['659'] },
            { libelle: 'TOTAL', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6] },
        ],
        commentaire: 'commenter toute variation significative ; indiquer les organismes bénéficiaires des dons.',
    },
    {
        code: '20A',
        titre: 'CHARGES DE PERSONNEL',
        precisionEditeur: 'Le poste TJ du compte d\'exploitation comprend aussi le compte 665 (habillement et équipement du personnel), auquel le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['TJ'],
        rubriques: [
            { libelle: 'Rémunérations directes versées au personnel national', comptes: ['661'] },
            { libelle: 'Rémunérations directes versées au personnel non national', comptes: ['662'] },
            { libelle: 'Indemnités forfaitaires versées au personnel', comptes: ['663'] },
            { libelle: 'Charges sociales (personnel national)', comptes: ['6641'] },
            { libelle: 'Charges sociales (personnel non national)', comptes: ['6642'] },
            { libelle: 'Rémunération transférée de personnel extérieur', comptes: ['667'] },
            { libelle: 'Autres charges sociales', comptes: ['668'] },
            {
                libelle: 'Dégrèvements et annulations des charges sociales',
                comptes: ['669'],
                presenterEnNegatif: true,
                renvoi: "(1) Ce compte a un solde créditeur, son montant doit être précédé d'un signe (-).",
            },
            { libelle: 'TOTAL', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7] },
        ],
        commentaire: 'commenter toute variation significative ; indiquer la nature et la durée du contrat du personnel ' +
            'extérieur.',
    },
    {
        code: '20B',
        sousTableau: 'PERSONNEL PROPRE',
        titre: 'EFFECTIFS, MASSE SALARIALE ET PERSONNEL · 1. Personnel propre',
        horsBalance: true,
        colonnes: (0, effectifs_seize_colonnes_1.colonnesEffectifsSycebnl)(),
        rubriques: [
            { cle: 'ya-1-cadres-superieurs', libelle: 'YA. 1. Cadres supérieurs', saisie: true },
            { cle: 'yb-2-techniciens-superieurs-et-cadres-moyens', libelle: 'YB. 2. Techniciens supérieurs et cadres moyens', saisie: true },
            { cle: 'yc-3-techniciens-agents-de-maitrise-et-ouvriers', libelle: 'YC. 3. Techniciens, agents de maîtrise et ouvriers qualifiés', saisie: true },
            { cle: 'yd-4-employes-man-uvres-ouvriers-et-apprentis', libelle: 'YD. 4. Employés, manœuvres, ouvriers et apprentis', saisie: true },
            { cle: 'ye-total-1', libelle: 'YE. TOTAL (1)', saisie: true },
            { cle: 'yf-permanents', libelle: 'YF. Permanents', saisie: true },
            { cle: 'yg-saisonniers', libelle: 'YG. Saisonniers', saisie: true },
        ],
        renvoiOfficiel: 'M : Masculin ; F : Féminin.',
        commentaire: 'faire un commentaire si nécessaire en cas de mouvement significatif du personnel.',
    },
    {
        code: '20B',
        sousTableau: 'PERSONNEL EXTERIEUR ET BENEVOLE',
        titre: 'EFFECTIFS, MASSE SALARIALE ET PERSONNEL · 2. Personnel extérieur et bénévole',
        horsBalance: true,
        colonnes: [{ type: 'LIBRE', libelle: "Facturation à l'entité" }],
        rubriques: [
            { cle: 'yh-1-cadres-superieurs', libelle: 'YH. 1. Cadres supérieurs', saisie: true },
            { cle: 'yi-2-techniciens-superieurs-et-cadres-moyens', libelle: 'YI. 2. Techniciens supérieurs et cadres moyens', saisie: true },
            { cle: 'yj-3-techniciens-agents-de-maitrise-et-ouvriers', libelle: 'YJ. 3. Techniciens, agents de maîtrise et ouvriers qualifiés', saisie: true },
            { cle: 'yk-4-employes-man-uvres-ouvriers-et-apprentis', libelle: 'YK. 4. Employés, manœuvres, ouvriers et apprentis', saisie: true },
            { cle: 'yl-total-2', libelle: 'YL. TOTAL (2)', saisie: true },
            { cle: 'ym-permanents', libelle: 'YM. Permanents', saisie: true },
            { cle: 'yn-saisonniers', libelle: 'YN. Saisonniers', saisie: true },
            { cle: 'yo-total-1-2', libelle: 'YO. TOTAL (1 + 2)', saisie: true },
        ],
    },
    {
        code: '21',
        titre: 'CHARGES ET REVENUS FINANCIERS',
        precisionEditeur: 'Le poste TK du compte d\'exploitation comprend aussi le compte 678 (pertes et charges sur risques financiers), auquel le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['TK'],
        rubriques: [
            { libelle: 'Intérêts des emprunts', comptes: ['671'] },
            { libelle: 'Intérêts dans loyers de location-acquisition', comptes: ['672'] },
            { libelle: 'Escomptes accordés', comptes: ['673'] },
            { libelle: 'Autres intérêts', comptes: ['674'] },
            { libelle: 'Pertes de change financières', comptes: ['676'] },
            { libelle: 'Pertes sur cessions de titres de placement', comptes: ['677'] },
            { libelle: 'Charges pour provisions à court terme à caractère financier', comptes: ['679'] },
            { libelle: 'TOTAL : FRAIS FINANCIERS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6] },
            { libelle: 'Intérêts de prêts et créances diverses', comptes: ['771'], natureCreditrice: true },
            {
                libelle: 'Revenus de participations et autres titres immobilisés',
                comptes: ['772'],
                natureCreditrice: true,
            },
            { libelle: 'Escomptes obtenus', comptes: ['773'], natureCreditrice: true },
            { libelle: 'Revenus de placement', comptes: ['774'], natureCreditrice: true },
            { libelle: 'Gains de change financiers', comptes: ['776'], natureCreditrice: true },
            { libelle: 'Gains sur cessions de titres de placement', comptes: ['777'], natureCreditrice: true },
            { libelle: 'Transferts de charges financières', comptes: ['787'], natureCreditrice: true },
            {
                libelle: 'Reprises de charges pour provisions à court terme à caractère financier',
                comptes: ['779'],
                natureCreditrice: true,
            },
            {
                libelle: 'TOTAL : REVENUS FINANCIERS',
                totalDeRubriques: [8, 9, 10, 11, 12, 13, 14, 15],
            },
            { libelle: 'TOTAL', totalDeRubriques: [16], moinsRubriques: [7] },
        ],
        commentaire: 'commenter toute variation significative.',
    },
    {
        code: '22',
        titre: 'DOTATIONS ET CHARGES POUR PROVISIONS',
        renvoyeeDepuis: ['RE', 'TJ'],
        horsBalance: true,
        colonnes: [{ type: 'LIBRE', libelle: '[texte officiel] Colonnes non données par la source' }],
        rubriques: [
            {
                cle: 'texte-officiel-le-referentiel-ne-donne-ni-colonn', libelle: '[texte officiel] Le référentiel ne donne ni colonnes ni rubriques pour cette note · seulement le ' +
                    'commentaire ci-dessous. Non comblé depuis la note 30 du jeu associations, qui traite le même ' +
                    'sujet mais reste un jeu distinct (règle §2.6). Le compte 69 « Dotations aux provisions » est déjà ' +
                    'rattaché au poste TJ du compte d’exploitation ; seul le détail par nature manque ici.',
                saisie: true,
            },
        ],
        commentaire: 'indiquer les événements et circonstances qui ont conduit à la constitution et à la reprise de la ' +
            'provision.',
    },
    {
        code: '23',
        titre: 'AUTRES CHARGES ET PRODUITS HAO',
        precisionEditeur: 'Le poste TL du compte d\'exploitation comprend aussi les comptes 81, 838, 85 et 87, et le poste Produits H.A.O. (TK) les comptes 82 et 846, auxquels le modèle de cette note ne donne aucune ligne.',
        colonnes: COLONNES_STANDARD,
        renvoyeeDepuis: ['TK', 'TL'],
        rubriques: [
            { libelle: 'Charges H.A.O. constatées (compte 831)', comptes: ['831'], exclusions: ['8311', '8315'] },
            {
                libelle: 'Dons en nature (compte 832) à détailler : non affectés / affectés',
                comptes: ['832', '8311', '8315'],
                renvoi: '(1) à détailler : non affectés / affectés',
            },
            { libelle: 'Pertes sur créances HAO', comptes: ['834'] },
            { libelle: 'Abandons de créances consentis', comptes: ['836'] },
            { libelle: 'Charges pour provisions pour risques à court terme HAO', comptes: ['839'] },
            { libelle: 'TOTAL : AUTRES CHARGES HAO', totalDeRubriques: [0, 1, 2, 3, 4] },
            {
                libelle: 'Produits H.A.O. constatés (compte 841)',
                comptes: ['841'],
                exclusions: ['8411', '8412', '8415'],
                natureCreditrice: true,
            },
            {
                libelle: 'Contributions volontaires en nature (compte 842) à détailler : Dons en nature non affectés / ' +
                    'Prestations de services en nature / Dons en nature affectés',
                comptes: ['842', '8411', '8412', '8415'],
                natureCreditrice: true,
                renvoi: '(1) à détailler : Dons en nature non affectés / Prestations de services en nature / Dons en ' +
                    'nature affectés',
            },
            { libelle: 'Contributions volontaires en numéraire', comptes: ['843'], natureCreditrice: true },
            { libelle: 'Transferts de charges HAO', comptes: ['848'], natureCreditrice: true },
            {
                libelle: 'Reprises des charges pour provisions à court terme HAO',
                comptes: ['849'],
                natureCreditrice: true,
            },
            { libelle: 'Reprises de provisions H.A.O', comptes: ['86'], natureCreditrice: true },
            { libelle: "Subventions d'équilibre", comptes: ['88'], natureCreditrice: true },
            { libelle: 'TOTAL : AUTRES PRODUITS HAO', totalDeRubriques: [6, 7, 8, 9, 10, 11, 12] },
            { libelle: 'TOTAL', totalDeRubriques: [13], moinsRubriques: [5] },
        ],
        commentaire: 'commenter toute variation significative.',
    },
    {
        code: '24',
        titre: "TABLEAU D'EXECUTION BUDGETAIRE",
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: 'Code' },
            { type: 'LIBRE', libelle: 'Libellé' },
            { type: 'LIBRE', libelle: "Budget de l'exercice (1)" },
            { type: 'LIBRE', libelle: 'Décaissement (2)' },
            { type: 'LIBRE', libelle: 'Engagement (3)' },
            { type: 'LIBRE', libelle: 'Réalisation (4 = 2 + 3)' },
            { type: 'LIBRE', libelle: 'Crédit Disponible (5 = 1 - 4)' },
            { type: 'LIBRE', libelle: 'Exécution budget (%) (4/1)' },
        ],
        rubriques: [
            { cle: 'lignes-de-la-nomenclature-budgetaire-du-projet', libelle: 'Lignes de la nomenclature budgétaire du projet', saisie: true },
            { cle: 'total', libelle: 'TOTAL', saisie: true },
        ],
        renvoiOfficiel: 'Remplir, code et libellé, suivant la nomenclature budgétaire du projet.',
    },
];
//# sourceMappingURL=correspondance-notes-projets.js.map