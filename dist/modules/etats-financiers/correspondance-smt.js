"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORIES_RESSOURCES_ART6 = exports.SEUIL_SMT_FCFA = exports.NOTES_SMT = exports.SOUS_COMPTES_APPORTEURS = exports.COMPTES_CAUTIONS_NOTE_1 = exports.NB_JOURNAL_TRESORERIE = exports.VENTILATION_DEPENSES = exports.VENTILATION_RECETTES = exports.DETTES_HORS_EXPLOITATION = exports.COMPTES_DOTATIONS_AMORTISSEMENTS = exports.RETRAITEMENTS = exports.POSTES_DEPENSES = exports.POSTES_RECETTES = exports.RENVOI_IMMOBILISATIONS = exports.ORDRE_BILAN_PASSIF = exports.ORDRE_BILAN_ACTIF = exports.TOTAUX_BILAN_PASSIF = exports.TOTAUX_BILAN_ACTIF = exports.POSTES_BILAN_PASSIF = exports.POSTES_BILAN_ACTIF = exports.DEPRECIATIONS_DES_TIERS = void 0;
const resultat_de_l_exercice_1 = require("./resultat-de-l-exercice");
exports.DEPRECIATIONS_DES_TIERS = ['490', '491', '492', '493', '494', '497', '498'];
exports.POSTES_BILAN_ACTIF = [
    {
        ref: 'GA',
        libelle: 'Immobilisations (1)',
        sens: 'ACTIF',
        note: '1',
        comptes: ['2'],
        fondement: "Classe 2 « Immobilisations » (Partie 2, ch. 1). Valeur nette : la maquette n'ouvre qu'une colonne de montant, et la Note 1 suit les immobilisations avec leur durée d'utilité. Renvoi (1) du texte : « A faire figurer sur l'état de situation si elles correspondent à des montants significatifs. »",
    },
    {
        ref: 'GB',
        libelle: 'Stocks',
        sens: 'ACTIF',
        note: '2',
        comptes: ['3'],
        fondement: 'Classe 3 « Stocks » (Partie 2, ch. 1), dépréciations 39 comprises, donc en valeur nette.',
    },
    {
        ref: 'GC',
        libelle: 'Adhérents, clients-usagers et autres débiteurs',
        sens: 'ACTIF',
        note: '3',
        comptes: ['4'],
        exclusions: exports.DEPRECIATIONS_DES_TIERS,
        sens_qualificatif: 'DEBITEUR',
        comptesSansFiltreDeSens: exports.DEPRECIATIONS_DES_TIERS,
        fondement: "Classe 4 « Tiers », soldes débiteurs. Le compte 41 s'intitule précisément « Adhérents, clients-usagers et comptes rattachés » (Partie 2, ch. 3) ; « et autres débiteurs » étend le poste au reste de la classe, qui n'a aucun autre poste d'accueil dans cette maquette à cinq lignes d'actif. Net des dépréciations 490 à 498, reprises en déduction quel que soit leur signe : la fiche du COMPTE 49 (Partie 2, ch. 3) les porte « à l'actif du bilan, en déduction de la valeur des postes qu'elles concernent », comme la table officielle du jeu associations (Partie 4, ch. 2, BA, BC, BD et BE).",
    },
    {
        ref: 'GD',
        libelle: 'Caisse',
        sens: 'ACTIF',
        note: '4',
        comptes: ['57'],
        fondement: 'Compte 57 « Caisse » (Partie 2, ch. 3, COMPTE 57).',
    },
    {
        ref: 'GE',
        libelle: 'Banque (en + ou en -)',
        sens: 'ACTIF',
        note: '4',
        comptes: ['5'],
        exclusions: ['57'],
        fondement: "Reste de la classe 5 « Trésorerie » : 52 Banques, 53 Établissements financiers, 55 Instruments de monnaie électronique, 56 Banques crédits de trésorerie et d'escompte, plus 50, 51, 58 et 59 qui n'ont aucun autre poste d'accueil. Le « (en + ou en -) » de la maquette autorise le solde négatif : le découvert reste à l'actif en négatif, faute de poste de trésorerie-passif dans ce jeu.",
    },
];
exports.POSTES_BILAN_PASSIF = [
    {
        ref: 'HA',
        libelle: 'Dotations',
        sens: 'PASSIF',
        note: '5',
        comptes: ['10'],
        fondement: "Compte 10 « Dotation » (Partie 2, ch. 3, COMPTE 10), 106 « Écarts de réévaluation » compris, que le plan range sous le 10 (Partie 2, ch. 2). La Note 5 détaille les 101 à 104 dans ses trois rubriques « Dotation non consomptible / Droit d'entrée / Dotation consomptible » ; elle n'en ouvre aucune pour le 106, qu'elle rappelle hors rubriques pour se rapprocher du poste.",
    },
    {
        ref: 'HC',
        libelle: 'Autres fonds propres',
        sens: 'PASSIF',
        note: null,
        comptes: ['1'],
        exclusions: ['10', ...resultat_de_l_exercice_1.COMPTES_RESULTAT_DE_L_EXERCICE],
        fondement: "Reste de la classe 1, hors le compte 10 (HA) et les comptes 131 à 139 que HB lit comme résultat de l'exercice. Un résultat en instance d'affectation y figure donc, au 128 du plan SYCEBNL comme sur un 130 ouvert par le cabinet. RÉSERVE À CONNAÎTRE : la classe 1 contient aussi le compte 18 « Emprunts et dettes assimilées » et le compte 19 « Provisions pour risques et charges », qui ne sont pas des fonds propres. La maquette du SMT n'ouvre que quatre lignes de passif et aucune ne peut les recevoir ; les laisser dehors déséquilibrerait le bilan d'un montant égal à l'emprunt. Ils sont donc rattachés ici, et le drill-down du poste les montre nommément. Une entité du SMT qui porterait un emprunt significatif dépasse en pratique les seuils de l'article 6 et relève du Système normal.",
    },
    {
        ref: 'HD',
        libelle: 'Fournisseurs et autres créditeurs',
        sens: 'PASSIF',
        note: '3',
        comptes: ['4'],
        exclusions: exports.DEPRECIATIONS_DES_TIERS,
        sens_qualificatif: 'CREDITEUR',
        fondement: "Classe 4 « Tiers », soldes créditeurs · symétrique de GC. Le compte 40 s'intitule « Fournisseurs et comptes rattachés » (Partie 2, ch. 3), et la Note 3 nomme la colonne « NOM DES FOURNISSEURS ET AUTRES CRÉDITEURS ». Hors les dépréciations 490 à 498, qui se déduisent des créances (GC) ; le 499 y reste, la fiche du COMPTE 49 en faisant « une dette probable à moins d'un an ».",
    },
];
exports.TOTAUX_BILAN_ACTIF = [
    { ref: 'GZ', libelle: 'Total actif', deRefs: ['GA', 'GB', 'GC', 'GD', 'GE'] },
];
exports.TOTAUX_BILAN_PASSIF = [
    { ref: 'HZ', libelle: 'Total passif', deRefs: ['HA', 'HB', 'HC', 'HD'] },
];
exports.ORDRE_BILAN_ACTIF = ['GA', 'GB', 'GC', 'GD', 'GE', 'GZ'];
exports.ORDRE_BILAN_PASSIF = ['HA', 'HB', 'HC', 'HD', 'HZ'];
exports.RENVOI_IMMOBILISATIONS = "(1) A faire figurer sur l'état de situation si elles correspondent à des montants significatifs.";
exports.POSTES_RECETTES = [
    {
        ref: 'KA',
        libelle: 'Revenus encaissés',
        sens: 'RECETTE',
        note: '4',
        comptes: ['70', '411', '412', '413', '416', '4181', '4182', '4191', '4192'],
        fondement: "Compte 70 « Revenus » (Partie 2, ch. 3, COMPTE 70), subdivisions 701 à 708 : cotisations, générosité du public, ventes, manifestations. Et le recouvrement des créances d'adhérents et de clients-usagers (411 à 416, 4181, 4182, 4191, 4192), revenu encaissé au sens de la comptabilité de trésorerie (Partie 4 ch. 1, section 4 : « Cotisations des adhérents encaissées en N = Cotisations des adhérents de l'exercice N + Créances adhérents de N-1 - Créances adhérents de N »). Les subventions d'exploitation en sont exclues par la fiche du compte, qui les renvoie au 71, donc en KB. La ventilation des recettes de la Note 4 découpe autrement : sa colonne « Cotisations » ne lit que le 701, sa colonne « Subventions » les 71 et 88 · les deux découpages ne se recoupent pas.",
    },
    {
        ref: 'KB',
        libelle: 'Autres recettes sur activités',
        sens: 'RECETTE',
        note: '4',
        comptes: ['3', '4', '6', '7', '8'],
        exclusions: ['70', '411', '412', '413', '416', '4181', '4182', '4191', '4192', '481'],
        fondement: "Toute autre contrepartie d'un encaissement sur activités : subventions (71), autres produits (75, 77, 78), produits H.A.O. (82, 84, 88), et le recouvrement d'une créance (classe 4). Ni un apport (classe 1), ni une immobilisation (classe 2), ni le 481 · le résultat se mesure « hors nouveaux apports et retraits d'apports » (fiche du COMPTE 13), et ces flux sont présentés à part.",
    },
];
exports.POSTES_DEPENSES = [
    {
        ref: 'JA',
        libelle: 'Dépenses sur achats',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['60', '61'],
        fondement: "Compte 60 « Achats » et compte 61 « Transports » (Partie 2, ch. 3). La Note 4 ventile d'ailleurs les dépenses en « Achats de biens liés à l'activité », « Autres achats » et « Transport », trois colonnes que ce poste regroupe.",
    },
    {
        ref: 'JB',
        libelle: 'Dépenses sur loyers',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['622'],
        fondement: "Compte 622 « Locations, charges locatives » (Partie 2, ch. 3, COMPTE 62), qui contient les 6221 à 6228 dont les fermages et loyers du foncier. Le 623 « Redevances de location acquisition » (crédit-bail) en est écarté : c'est un mode d'acquisition, pas un loyer.",
    },
    {
        ref: 'JC',
        libelle: 'Dépenses sur salaires',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['66'],
        fondement: 'Compte 66 « Charges de personnel » (Partie 2, ch. 3, COMPTE 66).',
    },
    {
        ref: 'JD',
        libelle: 'Dépenses sur impôts et taxes',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['64'],
        fondement: 'Compte 64 « Impôts et taxes » (Partie 2, ch. 3, COMPTE 64).',
    },
    {
        ref: 'JE',
        libelle: "Charges d'intérêts",
        sens: 'DEPENSE',
        note: '4',
        comptes: ['67'],
        fondement: "Compte 67 « Frais financiers et charges assimilées » (Partie 2, ch. 3, COMPTE 67). Le NB de la Note 4 cite nommément « Charges d'intérêts » comme colonne de ventilation à rajouter au besoin.",
    },
    {
        ref: 'JF',
        libelle: 'Autres dépenses sur activités',
        sens: 'DEPENSE',
        note: '4',
        comptes: ['3', '4', '6', '7', '8'],
        exclusions: ['60', '61', '622', '64', '66', '67', '481'],
        fondement: "Tout autre décaissement sur activités : services extérieurs hors loyers (62 restant, 63), autres charges (65), charges H.A.O. (83), et le règlement d'une dette d'exploitation (classe 4). Ni un retrait d'apport ou un remboursement (classe 1), ni une acquisition d'immobilisation (classe 2) ou son règlement (481) · l'usure du bien entre par JG « DOTATIONS AUX AMORTISSEMENTS », et ces flux sont présentés à part.",
    },
];
exports.RETRAITEMENTS = [
    {
        ref: 'VA',
        libelle: '+ Variations des stocks sur les achats [N - (N-1)]',
        signe: 1,
        fondement: "Poste GB du bilan, clôture moins OUVERTURE de l'exercice (report à nouveau). Un stock qui augmente correspond à des achats décaissés mais non consommés : la dépense de caisse est retranchée du résultat, la variation la rend.",
    },
    {
        ref: 'VB',
        libelle: '+ Variation des créances [N - (N-1)]',
        signe: 1,
        fondement: "Poste GC du bilan, clôture moins OUVERTURE de l'exercice (report à nouveau). Une créance qui augmente correspond à un revenu acquis non encaissé : absent de A, la variation le rend.",
    },
    {
        ref: 'VC',
        libelle: "- Variation des dettes d'exploitation [N - (N-1)]",
        signe: -1,
        fondement: "Poste HD du bilan hors le 481 « Fournisseurs d'investissements », clôture moins OUVERTURE de l'exercice (report à nouveau). Une dette qui augmente correspond à une charge engagée non payée : absente de B, la variation la retranche. L'opérateur « - » est celui du texte officiel. Le 481 est écarté parce que la maquette dit « dettes d'EXPLOITATION » et que le SYCEBNL range les fournisseurs d'immobilisations hors de l'exploitation (fiche du COMPTE 40, Exclusions : « utiliser le compte ci-après : 481 » ; fiche du COMPTE 48 : dettes « n'ayant pas de lien direct avec l'activité ordinaire ») : sa contrepartie est une immobilisation, pas une charge. Son règlement est donc un flux hors exploitation.",
    },
    {
        ref: 'JG',
        libelle: 'DOTATIONS AUX AMORTISSEMENTS',
        signe: -1,
        fondement: "Compte 68 « Dotations aux amortissements » (Partie 2, ch. 3, COMPTE 68). Charge sans décaissement, donc absente de B : retranchée ici. La maquette n'imprime pas d'opérateur devant cette ligne, mais elle vient après le solde de caisse et ne peut que le diminuer.",
    },
];
exports.COMPTES_DOTATIONS_AMORTISSEMENTS = ['68'];
exports.DETTES_HORS_EXPLOITATION = ['481'];
exports.VENTILATION_RECETTES = [
    { cle: 'cotisations', libelle: 'Cotisations', comptes: ['701'] },
    { cle: 'subventions', libelle: 'Subventions', comptes: ['71', '88'] },
    {
        cle: 'autres',
        libelle: 'Autres',
        comptes: ['1', '3', '4', '6', '7', '8'],
        exclusions: ['701', '71', '82', '88'],
    },
    { cle: 'materiel', libelle: 'Matériel, mobilier et autres', comptes: ['82', '2'] },
];
exports.VENTILATION_DEPENSES = [
    { cle: 'achatsActivite', libelle: "Achats de biens liés à l'activité", comptes: ['601'] },
    { cle: 'autresAchats', libelle: 'Autres achats', comptes: ['60'], exclusions: ['601'] },
    { cle: 'transport', libelle: 'Transport', comptes: ['61'] },
    { cle: 'servicesExterieurs', libelle: 'Services extérieurs', comptes: ['62', '63'] },
    { cle: 'salaires', libelle: 'Salaires', comptes: ['66'] },
    {
        cle: 'autres',
        libelle: 'Autres',
        comptes: ['1', '2', '3', '4', '6', '7', '8'],
        exclusions: ['60', '61', '62', '63', '66'],
    },
];
exports.NB_JOURNAL_TRESORERIE = "NB : Prévoir un journal par banque et un journal pour la caisse. Les colonnes « ventilation recettes et dépenses » " +
    "peuvent être complétées en cas de besoin par des rajouts notamment « Charges d'intérêts ». Il est possible si " +
    'nécessaire, de regrouper les opérations mensuellement dans un seul journal de trésorerie.';
exports.COMPTES_CAUTIONS_NOTE_1 = ['275'];
exports.SOUS_COMPTES_APPORTEURS = [
    '4511',
    '4512',
    '4521',
    '4522',
    '4531',
    '4532',
    '4541',
    '4542',
    '4551',
    '4552',
];
exports.NOTES_SMT = [
    { numero: 1, intitule: "Tableau d'acquisition et de suivi du matériel, du mobilier et des cautions", partie: 'BILAN' },
    { numero: 2, intitule: 'Etat des stocks', partie: 'BILAN' },
    { numero: 3, intitule: 'Etat des créances et des dettes non échues', partie: 'BILAN' },
    { numero: 5, intitule: 'Dotations', partie: 'BILAN' },
    { numero: 4, intitule: 'Journal unique de trésorerie', partie: 'COMPTE_DE_RESULTAT' },
];
exports.SEUIL_SMT_FCFA = 30_000_000;
exports.CATEGORIES_RESSOURCES_ART6 = [
    { cle: 'subventions', libelle: 'Subventions', comptes: ['71', '88'] },
    { cle: 'cotisationsRevenus', libelle: 'Cotisations et autres revenus', comptes: ['70'], exclusions: ['702', '704'] },
    { cle: 'donsLegs', libelle: 'Dons et legs', comptes: ['704'] },
    { cle: 'ressourcesProjet', libelle: 'Ressources du projet de développement', comptes: ['702'] },
    { cle: 'autresRessources', libelle: 'Autres ressources', comptes: ['7', '84'], exclusions: ['70', '71'] },
];
//# sourceMappingURL=correspondance-smt.js.map