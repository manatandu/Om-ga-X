"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTES_CHIFFRE_AFFAIRES_ART13 = exports.CLAUSE_EQUIVALENT_ART13 = exports.SEUILS_SMT_ART13_FCFA = exports.NB_JOURNAL_TRESORERIE_SMT_SYSCOHADA = exports.VENTILATION_DEPENSES_SMT_SYSCOHADA = exports.VENTILATION_RECETTES_SMT_SYSCOHADA = exports.JOURNAUX_DE_SUIVI_SMT_SYSCOHADA = exports.LIGNES_SYNTHESE_NOTE_2_SMT_SYSCOHADA = exports.NOTES_SMT_SYSCOHADA = exports.ORDRE_COMPTE_RESULTAT_SMT_SYSCOHADA = exports.TOTAUX_COMPTE_RESULTAT_SMT_SYSCOHADA = exports.LETTRES_D_E_SMT_SYSCOHADA = exports.COMPTES_DOTATIONS_SMT_SYSCOHADA = exports.RETRAITEMENTS_SMT_SYSCOHADA = exports.DEFINITION_VARIATION_SMT_SYSCOHADA = exports.POSTES_DEPENSES_SMT_SYSCOHADA = exports.POSTES_RECETTES_SMT_SYSCOHADA = exports.CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA = exports.EXCLUSIONS_CONTREPARTIES_RESULTAT_SMT_SYSCOHADA = exports.TIERS_HORS_EXPLOITATION_SMT_SYSCOHADA = exports.CONTREPARTIES_RESULTAT_SMT_SYSCOHADA = exports.COMPTES_DEPRECIATION_TRESORERIE_SMT_SYSCOHADA = exports.COMPTES_TRESORERIE_SMT_SYSCOHADA = exports.RENVOI_IMMOBILISATIONS_SMT_SYSCOHADA = exports.ORDRE_BILAN_PASSIF_SMT_SYSCOHADA = exports.ORDRE_BILAN_ACTIF_SMT_SYSCOHADA = exports.TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA = exports.TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA = exports.COMPTES_RESULTAT_SMT_SYSCOHADA = exports.LIBELLE_RESULTAT_SMT_SYSCOHADA = exports.REF_RESULTAT_SMT_SYSCOHADA = exports.POSTES_BILAN_PASSIF_SMT_SYSCOHADA = exports.POSTES_BILAN_ACTIF_SMT_SYSCOHADA = exports.AMORTISSEMENT_SMT = exports.INVENTAIRE_EXTRA_COMPTABLE_SMT = exports.DOCUMENTS_SMT_SYSCOHADA = void 0;
exports.trouvePosteBilanSmtSyscohada = trouvePosteBilanSmtSyscohada;
exports.dansPerimetreResultatSmt = dansPerimetreResultatSmt;
exports.estTiersHorsExploitationSmt = estTiersHorsExploitationSmt;
exports.calculerResultatSmt = calculerResultatSmt;
const resultat_de_l_exercice_1 = require("../etats-financiers/resultat-de-l-exercice");
const correspondance_compte_resultat_syscohada_1 = require("./correspondance-compte-resultat-syscohada");
const etats_financiers_communs_1 = require("../etats-financiers/etats-financiers.communs");
exports.DOCUMENTS_SMT_SYSCOHADA = ['BILAN', 'COMPTE_DE_RESULTAT', 'NOTES_ANNEXES'];
exports.INVENTAIRE_EXTRA_COMPTABLE_SMT = [
    "le montant des créances et des dettes d'exploitation, dans le cas où les ventes et les achats ne sont pas totalement réglés",
    'le montant des stocks (produits finis, matières premières, consommables...) et des travaux en cours',
    "le montant des immobilisations acquises ou cédées au cours de l'exercice",
    "le montant des emprunts souscrits ou remboursés au cours de l'exercice",
];
exports.AMORTISSEMENT_SMT = { mode: 'LINEAIRE', prorataTemporis: false };
exports.POSTES_BILAN_ACTIF_SMT_SYSCOHADA = [
    {
        ref: 'SA1',
        libelle: 'Immobilisations (1)',
        sens: 'ACTIF',
        note: '1',
        comptes: ['2'],
        fondement: "Classe 2 « Immobilisations » entière, amortissements (28) et dépréciations (29) compris : la maquette n'ouvre qu'une colonne de montant, le poste porte la valeur nette. Renvoi (1) : « À faire figurer à l'actif du bilan si elles correspondent à des montants significatifs. » La NOTE 1 (registre des immobilisations exigé au ch. 1) en donne le détail.",
    },
    {
        ref: 'SA2',
        libelle: 'Stocks',
        sens: 'ACTIF',
        note: '2',
        comptes: ['3'],
        fondement: "Classe 3 « Stocks » entière, dépréciations (39) comprises, donc en valeur nette. La NOTE 2 « État des stocks » en donne le détail et la ligne « Variation des stocks » du compte de résultat se déduit de ses valeurs finale et initiale (ch. 3).",
    },
    {
        ref: 'SA3',
        libelle: 'Clients et débiteurs divers',
        sens: 'ACTIF',
        note: '3',
        comptes: ['4'],
        exclusions: ['49'],
        sens_qualificatif: 'DEBITEUR',
        comptesSansFiltreDeSens: ['490', '491', '492', '493', '494', '495', '496', '497', '498', '50', '51', '590', '591'],
        fondement: "Classe 4 « Tiers », soldes débiteurs : le 41 s'intitule « Clients et comptes rattachés », le 47 « Débiteurs et créditeurs divers » (plan de comptes SYSCOHADA), et « débiteurs divers » étend le poste au reste de la classe qui n'a aucun autre poste d'accueil. En moins, les dépréciations 490 à 498 (« dépréciations subies par des comptes de tiers », Titre VII COMPTE 49) et 590, 591 (dépréciations des titres de placement et des valeurs à encaisser, COMPTE 59). Y sont joints les 50 « Titres de placement » et 51 « Valeurs à encaisser », qui ne sont ni caisse ni banque (anomalie n° 6). La NOTE 3 « État des créances et des dettes non échues » en donne le détail.",
    },
    {
        ref: 'SA4',
        libelle: 'Caisse',
        sens: 'ACTIF',
        note: null,
        comptes: ['57'],
        fondement: "Compte 57 « Caisse » (Titre VII COMPTE 57 : « opérations d'encaissement et de paiement effectuées en espèces »). Un solde créditeur « constitue une présomption d'irrégularité de la comptabilité » : il ressort en négatif, jamais filtré (anomalie n° 7).",
    },
    {
        ref: 'SA5',
        libelle: 'Banque (en + ou en –)',
        sens: 'ACTIF',
        note: null,
        comptes: ['52', '53', '54', '55', '56', '58', '592', '593', '594'],
        fondement: "52 « Banques », 53 « Établissements financiers et assimilés », 54 « Instruments de trésorerie », 55 « Instruments de monnaie électronique », 56 « Banques, crédits de trésorerie et d'escompte » (créditeur par nature, Titre VII COMPTE 56 : d'où le « en – »), 58 « Régies d'avances, accréditifs et virements internes » ; en moins, leurs dépréciations 592, 593, 594 (COMPTE 59). Le 57 est en Caisse, les 50 et 51 en Clients et débiteurs divers (anomalie n° 6), les 590, 591 et 599 suivent les comptes qu'ils couvrent.",
    },
];
exports.POSTES_BILAN_PASSIF_SMT_SYSCOHADA = [
    {
        ref: 'SP1',
        libelle: 'Compte exploitant',
        sens: 'PASSIF',
        note: '1',
        comptes: ['10', '11', '12', '14', '15'],
        fondement: "103 « Capital personnel » et 104 « Compte de l'exploitant » (Titre VII COMPTE 103 et 104 : apports définitifs et temporaires, prélèvements de l'exploitant individuel), élargis au reste des capitaux propres que la maquette ne loge nulle part ailleurs : 10 entier, 11 Réserves, 12 Report à nouveau, 14 Subventions d'investissement, 15 Provisions réglementées et fonds assimilés (anomalie n° 8). Un 109 ou un 129 débiteur ressort en négatif (COMPTE 109 et 12 : « en moins »).",
    },
    {
        ref: 'SP3',
        libelle: 'Emprunt',
        sens: 'PASSIF',
        note: null,
        comptes: ['16', '17', '18', '19'],
        fondement: "16 « Emprunts et dettes assimilées » (Titre VII COMPTE 16 : « ressources financières externes… remboursables à terme »), élargi à 17 « Dettes de location acquisition », 18 « Dettes liées à des participations et comptes de liaison » et 19 « Provisions pour risques et charges » (« passif externe (dette) », COMPTE 19), que la maquette ne loge nulle part ailleurs (anomalie n° 9). L'inventaire extra-comptable du ch. 1 vise « le montant des emprunts souscrits ou remboursés ».",
    },
    {
        ref: 'SP4',
        libelle: 'Fournisseurs et créditeurs divers',
        sens: 'PASSIF',
        note: '3',
        comptes: ['4'],
        exclusions: ['49'],
        sens_qualificatif: 'CREDITEUR',
        comptesSansFiltreDeSens: ['499', '599'],
        fondement: "Classe 4 « Tiers », soldes créditeurs · symétrique de SA3 : le 40 s'intitule « Fournisseurs et comptes rattachés », le 47 « Débiteurs et créditeurs divers ». S'y ajoutent le 499 « Provisions pour risques à court terme » (Titre VII COMPTE 49) et le 599 « Provisions pour risque à court terme à caractère financier » (COMPTE 59), passifs et non dépréciations d'actif. La NOTE 3 en donne le détail (« Nom du fournisseur »).",
    },
];
exports.REF_RESULTAT_SMT_SYSCOHADA = 'SP2';
exports.LIBELLE_RESULTAT_SMT_SYSCOHADA = 'Résultat exercice';
exports.COMPTES_RESULTAT_SMT_SYSCOHADA = [...resultat_de_l_exercice_1.COMPTES_RESULTAT_DE_L_EXERCICE, '130'];
exports.TOTAUX_BILAN_ACTIF_SMT_SYSCOHADA = [
    { ref: 'SAZ', libelle: 'Total actif', deRefs: ['SA1', 'SA2', 'SA3', 'SA4', 'SA5'] },
];
exports.TOTAUX_BILAN_PASSIF_SMT_SYSCOHADA = [
    { ref: 'SPZ', libelle: 'Total passif', deRefs: ['SP1', 'SP2', 'SP3', 'SP4'] },
];
exports.ORDRE_BILAN_ACTIF_SMT_SYSCOHADA = ['SA1', 'SA2', 'SA3', 'SA4', 'SA5', 'SAZ'];
exports.ORDRE_BILAN_PASSIF_SMT_SYSCOHADA = ['SP1', 'SP2', 'SP3', 'SP4', 'SPZ'];
exports.RENVOI_IMMOBILISATIONS_SMT_SYSCOHADA = "(1) À faire figurer à l'actif du bilan si elles correspondent à des montants significatifs.";
function trouvePosteBilanSmtSyscohada(ref) {
    return [...exports.POSTES_BILAN_ACTIF_SMT_SYSCOHADA, ...exports.POSTES_BILAN_PASSIF_SMT_SYSCOHADA].find((p) => p.ref === ref);
}
exports.COMPTES_TRESORERIE_SMT_SYSCOHADA = ['52', '53', '54', '55', '56', '57', '58'];
exports.COMPTES_DEPRECIATION_TRESORERIE_SMT_SYSCOHADA = ['592', '593', '594'];
const TOUTES_CLASSES_1_A_8 = ['1', '2', '3', '4', '5', '6', '7', '8'];
exports.CONTREPARTIES_RESULTAT_SMT_SYSCOHADA = ['3', '4', '50', '51', '590', '591', '599', '6', '7', '8'];
exports.TIERS_HORS_EXPLOITATION_SMT_SYSCOHADA = [
    { prefixe: '461', cle: 'financement' },
    { prefixe: '465', cle: 'financement' },
    { prefixe: '467', cle: 'financement' },
    { prefixe: '4493', cle: 'financement' },
    { prefixe: '4494', cle: 'financement' },
    { prefixe: '481', cle: 'investissement' },
    { prefixe: '482', cle: 'investissement' },
];
exports.EXCLUSIONS_CONTREPARTIES_RESULTAT_SMT_SYSCOHADA = exports.TIERS_HORS_EXPLOITATION_SMT_SYSCOHADA.map((t) => t.prefixe);
function dansPerimetreResultatSmt(numero) {
    return (0, etats_financiers_communs_1.correspond)(numero, exports.CONTREPARTIES_RESULTAT_SMT_SYSCOHADA, exports.EXCLUSIONS_CONTREPARTIES_RESULTAT_SMT_SYSCOHADA);
}
function estTiersHorsExploitationSmt(numero) {
    return (0, etats_financiers_communs_1.correspond)(numero, exports.EXCLUSIONS_CONTREPARTIES_RESULTAT_SMT_SYSCOHADA);
}
exports.CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA = [
    {
        cle: 'financement',
        comptes: ['1', ...exports.TIERS_HORS_EXPLOITATION_SMT_SYSCOHADA.filter((t) => t.cle === 'financement').map((t) => t.prefixe)],
        intitule: "Financement · apports et prélèvements de l'exploitant, emprunts",
        fondement: "Classe 1 : 103 « Capital personnel » et 104 « Compte de l'exploitant » (Titre VII COMPTE 103 et 104), 16 « Emprunts et dettes assimilées » (COMPTE 16), 14 « Subventions d'investissement », qui figurent « au passif du bilan, parmi les capitaux propres » et non en produit (COMPTE 14). Le Titre X ch. 1 § 1 range « le montant des emprunts souscrits ou remboursés » parmi les QUATRE éléments de l'inventaire extra-comptable, à côté des immobilisations et distinctement des recettes et des dépenses. Ces mouvements se lisent aux postes de bilan SP1 et SP3.",
    },
    {
        cle: 'investissement',
        comptes: ['2', ...exports.TIERS_HORS_EXPLOITATION_SMT_SYSCOHADA.filter((t) => t.cle === 'investissement').map((t) => t.prefixe)],
        intitule: 'Investissement · immobilisations acquises ou cédées',
        fondement: "Classe 2 : le Titre X ch. 1 § 1 range « le montant des immobilisations acquises ou cédées au cours de l'exercice » parmi les quatre éléments de l'inventaire extra-comptable et impose le registre des immobilisations (NOTE 1) avec son tableau d'amortissement ; l'usure du bien entre au compte de résultat par la ligne F « DOTATIONS AMORTISSEMENTS », jamais son prix d'achat. Ces mouvements se lisent au poste de bilan SA1 et à la NOTE 1.",
    },
];
exports.POSTES_RECETTES_SMT_SYSCOHADA = [
    {
        ref: 'SR1',
        libelle: 'Recettes sur ventes ou prestations de services',
        sens: 'RECETTE',
        note: '4',
        comptes: ['70', '411', '412', '413', '415', '416', '4181', '4191', '4192'],
        fondement: "Compte 70 « Ventes » : 701 marchandises, 702 à 704 produits, 705 travaux facturés, 706 services vendus, 707 produits accessoires (plan de comptes SYSCOHADA) · exactement « ventes ou prestations de services ». C'est la colonne « Ventes » de la ventilation des recettes de la NOTE 4.",
    },
    {
        ref: 'SR2',
        libelle: 'Autres recettes sur activités',
        sens: 'RECETTE',
        note: '4',
        comptes: exports.CONTREPARTIES_RESULTAT_SMT_SYSCOHADA,
        exclusions: ['70', '411', '412', '413', '415', '416', '4181', '4191', '4192', ...exports.EXCLUSIONS_CONTREPARTIES_RESULTAT_SMT_SYSCOHADA],
        fondement: "Toute autre contrepartie d'un encaissement qui entre en A : 71 Subventions d'exploitation, 75 Autres produits, 77 Revenus financiers, 82 Produits des cessions d'immobilisations (Titre VII COMPTE 82 : « crédité des produits de cession d'actif… par le débit d'un compte de trésorerie »), 84 Produits H.A.O., 88 Subventions d'équilibre (plan de comptes SYSCOHADA), et le recouvrement d'une créance (classe 4) ou l'encaissement d'un titre de placement (50, 51), que la variation SV2 corrige ensuite. Les produits calculés (78 Transferts de charges, 79 Reprises, 86 Reprises H.A.O., 849 Reprises de charges H.A.O.) restent dans les préfixes captés pour qu'une écriture aberrante ne disparaisse pas, mais ils n'ont par construction aucune contrepartie de trésorerie (Titre VII COMPTE 19, 29, 49, 59 : les reprises se font par le débit du compte de dépréciation, jamais par la caisse) : ils ne se présentent pas ici. Colonne « Autres » de la NOTE 4, dont le périmètre est plus large (anomalie n° 21).",
    },
];
exports.POSTES_DEPENSES_SMT_SYSCOHADA = [
    {
        ref: 'SD1',
        libelle: 'Dépenses sur achats',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['60'],
        fondement: "Compte 60 « Achats et variations de stocks » : 601 achats de marchandises, 602 achats de matières premières et fournitures liées, 604 achats stockés de matières et fournitures consommables, 605 autres achats, 608 achats d'emballages (plan de comptes SYSCOHADA, libellés exacts). Ce sont les colonnes « Achats marchandises » et « Achats matières et fournitures » de la NOTE 4, que ce poste regroupe : le 605 y est rangé par défaut d'une colonne plus fine, alors qu'il contient aussi 6057 « Achats d'études et prestations de services » et 6058 « Achats de travaux, matériels et équipements » (plan de comptes SYSCOHADA), qui ne sont pas au sens strict des « matières et fournitures » ; la maquette n'ouvrant que deux colonnes d'achats, c'est la plus proche des deux et le drill-down le montre compte par compte. Le 61 « Transports » n'est pas un achat : il reste en SD6.",
    },
    {
        ref: 'SD2',
        libelle: 'Dépenses sur loyers',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['622'],
        fondement: "Compte 622 « Locations, charges locatives » (Titre VII COMPTE 62, plan de comptes SYSCOHADA : 6221 locations de terrains, 6222 locations de bâtiments, 6223 locations de matériels et outillages, 6224 malis sur emballages, 6225 locations d'emballages, 6226 fermages et loyers du foncier, 6228 locations et charges locatives diverses). Le 623 « Redevances de location acquisition » en est écarté : c'est un mode d'acquisition d'immobilisation (COMPTE 17), pas un loyer. Le 6224 « Malis sur emballages » n'en est PAS écarté bien qu'il ne soit pas un loyer : le plan officiel le loge sous le 622 et la maquette n'ouvre pas de ligne où le mettre (anomalie n° 18). Colonne « Loyers » de la NOTE 4, de même périmètre.",
    },
    {
        ref: 'SD3',
        libelle: 'Dépenses sur salaires',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['66'],
        fondement: "Compte 66 « Charges de personnel » (Titre VII COMPTE 66), y compris le 666 « Rémunérations et charges sociales de l'exploitant individuel », que la fiche range expressément dans le 66. Colonne « Salaires » de la NOTE 4.",
    },
    {
        ref: 'SD4',
        libelle: 'Dépenses sur impôts et taxes',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['64', '89'],
        fondement: "Compte 64 « Impôts et taxes » (plan de comptes SYSCOHADA), et le 89 « Impôts sur le résultat » (Titre VII COMPTE 89) parce que la maquette n'a que cette ligne fiscale (anomalie n° 10). Colonne « Impôts et taxes » de la NOTE 4.",
    },
    {
        ref: 'SD5',
        libelle: "Charges d'intérêts",
        sens: 'DEPENSE',
        note: null,
        comptes: ['67'],
        fondement: "Compte 67 « Frais financiers et charges assimilées » (Titre VII COMPTE 67 : « l'ensemble des charges financières dues à différents tiers intervenant dans le financement de l'entité »). Les intérêts proprement dits sont 671 intérêts des emprunts, 672 intérêts dans loyers de location acquisition, 674 autres intérêts, 675 escomptes des effets de commerce (plan de comptes SYSCOHADA) ; le poste prend néanmoins le 67 ENTIER, donc aussi 673 Escomptes accordés, 676 Pertes de change financières, 677 Pertes sur titres de placement, 678 Pertes et charges sur risques financiers et 679 Charges pour dépréciations et provisions pour risques à court terme financières · la maquette n'ouvrant aucune autre ligne financière, la seule autre issue serait « Autres dépenses sur activités », moins parlante (anomalie n° 17). Le 679 n'a de toute façon pas de contrepartie de trésorerie (COMPTE 59 : il est débité par le crédit du 59) et ne se présente pas. Seule ligne du compte de résultat sans renvoi de note dans la maquette.",
    },
    {
        ref: 'SD6',
        libelle: 'Autres dépenses sur activités',
        sens: 'DEPENSE',
        note: '4',
        comptes: exports.CONTREPARTIES_RESULTAT_SMT_SYSCOHADA,
        exclusions: ['60', '622', '64', '66', '67', '89', ...exports.EXCLUSIONS_CONTREPARTIES_RESULTAT_SMT_SYSCOHADA],
        fondement: "Tout autre décaissement qui entre en B : 61 Transports, 62 hors 622, 63 Services extérieurs, 65 Autres charges, 83 Charges H.A.O., 87 Participation des travailleurs (plan de comptes SYSCOHADA), et le règlement d'une dette (classe 4) ou l'acquisition d'un titre de placement (50, 51), que la variation SV3 ou SV2 corrige ensuite. Le 81 « Valeurs comptables des cessions d'immobilisations » reste dans les préfixes captés mais ne se présente jamais : il est « débité… par le crédit du compte d'immobilisation concerné (classe 2) » (Titre VII COMPTE 81), sans contrepartie de trésorerie · d'où l'écart de l'anomalie n° 22. Le 70 y retombe aussi, du côté des dépenses seulement : un remboursement de vente est un décaissement, et la maquette n'ouvre aucune autre ligne pour le loger. Colonne « Autres » de la NOTE 4, dont le périmètre est plus large (anomalie n° 21).",
    },
];
exports.DEFINITION_VARIATION_SMT_SYSCOHADA = 'N1_MOINS_N';
exports.RETRAITEMENTS_SMT_SYSCOHADA = [
    {
        ref: 'SV1',
        libelle: '– Variation des stocks N / N-1',
        note: '2',
        signeOfficiel: -1,
        lettre: 'D',
        posteBilan: 'SA2',
        fondement: "Poste SA2 Stocks, valeur initiale moins valeur finale (NOTE 2 : « VALEUR DU STOCK FINAL », « VALEUR DU STOCK INITIAL » ; convention du compte 603, Titre VII COMPTE 603). Précédée de « – » dans la maquette : un stock qui augmente (variation négative) rend au résultat les achats décaissés non consommés.",
    },
    {
        ref: 'SV2',
        libelle: '– Variation des créances N / N-1',
        note: '3',
        signeOfficiel: -1,
        lettre: 'D',
        posteBilan: 'SA3',
        fondement: "Poste SA3 Clients et débiteurs divers, montant au 1er janvier moins montant au 31 décembre (NOTE 3, colonnes « Montant au 31 décembre » et « Montant au 1er janvier »). Précédée de « – » dans la maquette : une créance qui augmente (variation négative) rend au résultat les ventes non encaissées, absentes de A.",
    },
    {
        ref: 'SV3',
        libelle: "+ Variation des dettes d'exploitation N / N-1",
        note: '3',
        signeOfficiel: 1,
        lettre: 'E',
        posteBilan: 'SP4',
        fondement: "Poste SP4 Fournisseurs et créditeurs divers, montant au 1er janvier moins montant au 31 décembre (NOTE 3). Précédée de « + » dans la maquette : une dette qui augmente (variation négative) retranche du résultat les charges engagées non payées, absentes de B.",
    },
    {
        ref: 'SF',
        libelle: 'DOTATIONS AMORTISSEMENTS',
        note: null,
        signeOfficiel: -1,
        lettre: 'F',
        posteBilan: null,
        fondement: "Lettre F de la formule G = C – D + E – F. Comptes 68 « Dotations aux amortissements » (Titre VII COMPTE 68), 69 « Dotations aux provisions et aux dépréciations » (COMPTE 69) et 85 « Dotations hors activités ordinaires » (COMPTE 85) : charges calculées sans décaissement, absentes de B, retranchées ici. Amortissement « linéaire sans prorata temporis » (Titre X ch. 1 § 1). La maquette n'imprime pas d'opérateur devant la ligne, la formule en fait un « – F ».",
    },
];
exports.COMPTES_DOTATIONS_SMT_SYSCOHADA = ['68', '69', '85'];
exports.LETTRES_D_E_SMT_SYSCOHADA = {
    D: ['SV1', 'SV2'],
    E: ['SV3'],
};
exports.TOTAUX_COMPTE_RESULTAT_SMT_SYSCOHADA = [
    { ref: 'SRA', libelle: 'TOTAL DES RECETTES SUR PRODUITS', lettre: 'A', deRefs: ['SR1', 'SR2'] },
    { ref: 'SDB', libelle: 'TOTAL DÉPENSES SUR CHARGES', lettre: 'B', deRefs: ['SD1', 'SD2', 'SD3', 'SD4', 'SD5', 'SD6'] },
    {
        ref: 'SC',
        libelle: 'SOLDE : Excédent (+) ou insuffisance (–) de recettes (C = A – B)',
        lettre: 'C',
        deRefs: ['SRA', 'SDB'],
    },
    {
        ref: 'SG',
        libelle: 'RÉSULTAT EXERCICE (G = C – D + E – F)',
        lettre: 'G',
        deRefs: ['SC', 'SV1', 'SV2', 'SV3', 'SF'],
    },
];
exports.ORDRE_COMPTE_RESULTAT_SMT_SYSCOHADA = [
    'SR1', 'SR2', 'SRA',
    'SD1', 'SD2', 'SD3', 'SD4', 'SD5', 'SD6', 'SDB',
    'SC',
    'SV1', 'SV2', 'SV3',
    'SF',
    'SG',
];
function calculerResultatSmt(v) {
    const A = v.recettes;
    const B = v.depenses;
    const C = A - B;
    const lignes = {
        SV1: v.stocks.n1 - v.stocks.n,
        SV2: v.creances.n1 - v.creances.n,
        SV3: v.dettes.n1 - v.dettes.n,
        SF: v.dotations,
    };
    const D = exports.LETTRES_D_E_SMT_SYSCOHADA.D.reduce((s, ref) => s + lignes[ref], 0);
    const E = exports.LETTRES_D_E_SMT_SYSCOHADA.E.reduce((s, ref) => s + lignes[ref], 0);
    const F = lignes.SF;
    return { A, B, C, lignes, D, E, F, G: C - D + E - F };
}
exports.NOTES_SMT_SYSCOHADA = [
    {
        numero: 1,
        intitule: 'Tableau SMT de suivi du matériel, du mobilier et des cautions',
        partie: 'BILAN',
        colonnes: ['Date', 'Désignation', 'Montant', 'Date de sortie', 'Prix de cession'],
    },
    {
        numero: 2,
        intitule: 'État des stocks',
        partie: 'BILAN',
        colonnes: ['Référence', 'Désignation', 'Quantité', 'Prix unitaire', 'Montant'],
    },
    {
        numero: 3,
        intitule: 'État des créances et des dettes non échues',
        partie: 'BILAN',
        colonnes: null,
        sousTableaux: [
            {
                cle: 'creances',
                intitule: 'Créances',
                colonnes: ['Date', 'Nom du client', 'Montant au 31 décembre', 'Montant au 1er janvier', 'Variation %'],
                ligneTotal: 'TOTAL DES CRÉANCES',
            },
            {
                cle: 'dettes',
                intitule: 'Dettes',
                colonnes: ['Date', 'Nom du fournisseur', 'Montant au 31 décembre', 'Montant au 1er janvier', 'Variation %'],
                ligneTotal: 'TOTAL DES DETTES',
            },
        ],
    },
    {
        numero: 4,
        intitule: 'Journal de trésorerie SMT',
        partie: 'COMPTE_DE_RESULTAT',
        colonnes: ['Date', 'Libellés', 'Recettes', 'Dépenses', 'Solde'],
    },
];
exports.LIGNES_SYNTHESE_NOTE_2_SMT_SYSCOHADA = ['VALEUR DU STOCK FINAL', 'VALEUR DU STOCK INITIAL'];
exports.JOURNAUX_DE_SUIVI_SMT_SYSCOHADA = [
    {
        cle: 'creancesImpayees',
        intitule: 'Journal de suivi des créances impayées SMT',
        colonnes: ['Date', 'N° facture', 'Nom du client', 'Montant', 'Date paiement'],
    },
    {
        cle: 'dettesAPayer',
        intitule: 'Journal de suivi des dettes à payer SMT',
        colonnes: ['Date', 'N° facture', 'Nom du fournisseur', 'Montant', 'Date paiement'],
    },
];
exports.VENTILATION_RECETTES_SMT_SYSCOHADA = [
    { cle: 'ventes', libelle: 'Ventes', comptes: ['70'] },
    {
        cle: 'autres',
        libelle: 'Autres',
        comptes: TOUTES_CLASSES_1_A_8,
        exclusions: ['70', '82', '2', '103', '104'],
    },
    { cle: 'materielMobilier', libelle: 'Matériel et Mobilier', comptes: ['82', '2'] },
    { cle: 'compteExploitant', libelle: 'Compte exploitant', comptes: ['103', '104'], rajoutAutorise: true },
];
exports.VENTILATION_DEPENSES_SMT_SYSCOHADA = [
    { cle: 'achatsMarchandises', libelle: 'Achats marchandises', comptes: ['601'] },
    { cle: 'achatsMatieresFournitures', libelle: 'Achats matières et fournitures', comptes: ['60'], exclusions: ['601'] },
    { cle: 'loyers', libelle: 'Loyers', comptes: ['622'] },
    { cle: 'salaires', libelle: 'Salaires', comptes: ['66'] },
    { cle: 'impotsTaxes', libelle: 'Impôts et taxes', comptes: ['64', '89'] },
    {
        cle: 'autres',
        libelle: 'Autres',
        comptes: TOUTES_CLASSES_1_A_8,
        exclusions: ['60', '622', '66', '64', '89', '103', '104'],
    },
    { cle: 'compteExploitant', libelle: 'Compte exploitant', comptes: ['103', '104'], rajoutAutorise: true },
];
exports.NB_JOURNAL_TRESORERIE_SMT_SYSCOHADA = 'NB : prévoir un journal par banque et un journal pour la caisse. Les colonnes « ventilation recettes et dépenses » ' +
    'peuvent être complétées en cas de besoin par des rajouts notamment « compte exploitant ».';
exports.SEUILS_SMT_ART13_FCFA = [
    { cle: 'negoce', categorie: 'Entités de négoce', montantFcfa: 60_000_000 },
    { cle: 'artisanat', categorie: 'Entités artisanales et assimilées', montantFcfa: 40_000_000 },
    { cle: 'services', categorie: 'Entités de services', montantFcfa: 30_000_000 },
];
exports.CLAUSE_EQUIVALENT_ART13 = "ou l'équivalent dans l'unité monétaire ayant cours légal dans l'État partie";
exports.COMPTES_CHIFFRE_AFFAIRES_ART13 = correspondance_compte_resultat_syscohada_1.PREFIXES_CHIFFRE_AFFAIRES_SYSCOHADA;
//# sourceMappingURL=correspondance-smt-syscohada.js.map