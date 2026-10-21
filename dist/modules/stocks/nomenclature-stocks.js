"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_PROVENANT_D_IMMOBILISATIONS = exports.STOCKS_HORS_VARIATION_AUTOMATIQUE = void 0;
exports.correspondancesDuReferentiel = correspondancesDuReferentiel;
exports.variationDuCompte = variationDuCompte;
exports.motifHorsVariation = motifHorsVariation;
const client_1 = require("@prisma/client");
const SYSCOHADA_CORRESPONDANCES = [
    {
        racine: '31',
        intitule: 'Marchandises',
        variation: '6031',
        intituleVariation: 'Variations des stocks de marchandises',
    },
    {
        racine: '32',
        intitule: 'Matières premières et fournitures liées',
        variation: '6032',
        intituleVariation: 'Variations des stocks de matières premières et fournitures liées',
    },
    {
        racine: '33',
        intitule: 'Autres approvisionnements',
        variation: '6033',
        intituleVariation: "Variations des stocks d'autres approvisionnements",
    },
    {
        racine: '341',
        intitule: 'Produits en cours',
        variation: '7341',
        intituleVariation: 'Variations des stocks de produits en cours',
    },
    {
        racine: '342',
        intitule: 'Travaux en cours',
        variation: '7342',
        intituleVariation: 'Variations des stocks de travaux en cours',
    },
    {
        racine: '351',
        intitule: 'Études en cours',
        variation: '7351',
        intituleVariation: 'Variations des en-cours d\u2019études',
    },
    {
        racine: '352',
        intitule: 'Prestations de services en cours',
        variation: '7352',
        intituleVariation: 'Variations des en-cours de prestations de services',
    },
    {
        racine: '36',
        intitule: 'Produits finis',
        variation: '736',
        intituleVariation: 'Variations des stocks de produits finis',
    },
    {
        racine: '381',
        intitule: 'Marchandises en cours de route',
        variation: '6031',
        intituleVariation: 'Variations des stocks de marchandises',
    },
    {
        racine: '382',
        intitule: 'Matières premières et fournitures liées en cours de route',
        variation: '6032',
        intituleVariation: 'Variations des stocks de matières premières et fournitures liées',
    },
    {
        racine: '383',
        intitule: 'Autres approvisionnements en cours de route',
        variation: '6033',
        intituleVariation: "Variations des stocks d'autres approvisionnements",
    },
    {
        racine: '371',
        intitule: 'Produits intermédiaires',
        variation: '7371',
        intituleVariation: 'Variations des stocks de produits intermédiaires',
    },
    {
        racine: '372',
        intitule: 'Produits résiduels',
        variation: '7372',
        intituleVariation: 'Variations des stocks de produits résiduels',
    },
];
const SYCEBNL_CORRESPONDANCES = [
    {
        racine: '31',
        intitule: "Biens liés à l'activité",
        variation: '6031',
        intituleVariation: "Variations des stocks de biens et services liés à l'activité",
    },
    {
        racine: '321',
        intitule: 'Marchandises A',
        variation: '6032',
        intituleVariation: 'Variations des stocks de marchandises',
    },
    {
        racine: '322',
        intitule: 'Marchandises B',
        variation: '6032',
        intituleVariation: 'Variations des stocks de marchandises',
    },
    {
        racine: '323',
        intitule: 'Matières A',
        variation: '6033',
        intituleVariation: 'Variations des stocks de matières premières et fournitures liées',
    },
    {
        racine: '324',
        intitule: 'Matières B',
        variation: '6033',
        intituleVariation: 'Variations des stocks de matières premières et fournitures liées',
    },
    {
        racine: '325',
        intitule: 'Fournitures liées',
        variation: '6033',
        intituleVariation: 'Variations des stocks de matières premières et fournitures liées',
    },
    {
        racine: '33',
        intitule: 'Autres approvisionnements',
        variation: '6034',
        intituleVariation: "Variations des stocks d'autres approvisionnements",
    },
    {
        racine: '35',
        intitule: 'Produits finis et services en cours',
        variation: '735',
        intituleVariation: 'Variations des en-cours de produits finis et services',
    },
    {
        racine: '36',
        intitule: 'Produits finis, produits intermédiaires et résiduels',
        variation: '736',
        intituleVariation: 'Variations des stocks de produits finis, produits intermédiaires et résiduels',
    },
];
exports.STOCKS_HORS_VARIATION_AUTOMATIQUE = [
    {
        racine: '34',
        referentiels: [client_1.Referentiel.SYCEBNL],
        intitule: 'Dons en nature',
        motif: "Le don en nature ne suit pas le schéma de la variation de stocks. Le texte constate le stock " +
            'final au débit du 34 par le crédit du 6035, PUIS crédite le 4713 « Créditeurs, dons en nature ' +
            "courants non consommés » par le débit du 754, et « les écritures de fin d'exercice doivent être " +
            "EXTOURNÉES au début de l'exercice suivant ». Il n'y a donc pas d'annulation du stock initial : " +
            "l'extourne l'a déjà fait. Passer ici la variation ordinaire compterait le stock deux fois.",
    },
    {
        racine: '38',
        referentiels: [client_1.Referentiel.SYCEBNL],
        intitule: 'Dons en nature H.A.O.',
        motif: "Même mécanisme que le 34, avec ses comptes propres · constatation par le crédit du 87, puis " +
            'crédit du 488 « Créditeurs, dons en nature H.A.O. non consommés » par le débit du 841, et ' +
            "extourne à l'ouverture. Le 87 est de surcroît un compte H.A.O., que le compte de résultat ne " +
            'lit pas au même endroit que les variations ordinaires.',
    },
    {
        racine: '386',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        intitule: 'Produits finis en cours de route',
        motif: "ANOMALIE DU TEXTE, signalée et non comblée. Le compte 38 répond aux stocks en cours de route par " +
            "« les sous-comptes 603 concernés » (AUDCIF Titre VII, compte 38), mais le 603 ne s'ouvre que sur les " +
            "biens ACHETÉS (6031 marchandises, 6032 matières premières, 6033 autres approvisionnements) et n'a " +
            "aucune subdivision de produits finis, dont la variation est au 736. OmegaX ne tranche pas entre les " +
            "deux : l'écriture se passe à la main.",
    },
    {
        racine: '387',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        intitule: 'Stock en consignation ou en dépôt',
        motif: "Le 387 porte un stock par sa SITUATION (en consignation, en dépôt), pas par sa nature · le sous-compte " +
            "603 concerné dépend de ce qui est consigné ou déposé, que le numéro ne dit pas. OmegaX ne le devine " +
            "pas : l'écriture se passe à la main, et le contrôle STOCK_EN_COURS_DE_ROUTE_SANS_VARIATION la " +
            "réclame quand elle manque.",
    },
    {
        racine: '388',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        intitule: 'Stock provenant d’immobilisations mises hors service ou au rebut',
        motif: "Ce n'est pas un stock en cours de route, bien qu'il soit rangé sous le 38, et il a son propre " +
            "mécanisme (AUDCIF Titre VIII, dépréciation des stocks, § 2.8) · les matières récupérées d'une " +
            "immobilisation y entrent EN COURS d'exercice, puis « en fin d'exercice, le compte 388 est SOLDÉ par " +
            "le débit du compte 603 Variations des stocks de biens achetés. Si des éléments de ce stock subsistent " +
            "à cette date, ils sont inscrits dans les comptes appropriés de la classe 3 par le crédit du compte " +
            "603 ». Le compte de classe 3 qui les reçoit dépend de leur nature, qu'OmegaX ne connaît pas · " +
            "l'écriture se passe à la main, et le contrôle STOCK_IMMOBILISATIONS_388_NON_SOLDE la réclame. " +
            "Le SYCEBNL porte le même objet sous le 378, sans cette règle de solde.",
    },
    {
        racine: '378',
        referentiels: [client_1.Referentiel.SYCEBNL],
        intitule: "Stock provenant d'immobilisations mises hors service ou au rebut",
        motif: "Ce n'est pas un stock en cours de route, bien qu'il soit rangé sous le 37 · le SYCEBNL le décrit " +
            "comme « les éléments récupérés ou démontés d'immobilisations corporelles. Ce compte est débité par le " +
            "crédit du compte d'immobilisation concerné » (Partie 2 ch. 3, compte 37). Le texte n'écrit aucune " +
            "règle de solde en fin d'exercice, là où l'AUDCIF solde son 388 par le 603 · OmegaX ne transpose pas " +
            "cette règle. L'écriture de variation, s'il y en a une, se passe à la main.",
    },
    {
        racine: '37',
        referentiels: [client_1.Referentiel.SYCEBNL],
        intitule: 'Stocks en cours de route, en consignation ou en dépôt',
        motif: "Le texte répond au stock en cours de route « par le crédit : des sous-comptes 603 concernés » " +
            "(Partie 2 ch. 3, compte 37), sans en nommer un, et son 372 réunit marchandises et matières, qui " +
            "répondent à deux comptes de variation distincts (6032 et 6033). OmegaX ne transpose pas ici la " +
            "correspondance du 38 de l'AUDCIF : l'écriture se passe à la main.",
    },
    {
        racine: '343',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        intitule: 'Produits intermédiaires en cours',
        motif: "ANOMALIE DU PLAN OFFICIEL, signalée et non comblée. Le compte 34 ouvre les subdivisions " +
            '« 343 Produits intermédiaires en cours », « 344 Produits résiduels en cours » et « 345 Stocks ' +
            "d'actifs biologiques en cours », mais le compte 734 qui leur répond n'en ouvre que DEUX : " +
            '« 7341 Produits en cours » et « 7342 Travaux en cours ». Il n\u2019existe donc aucun compte de ' +
            "variation imputable pour ces trois subdivisions. Les rattacher au 7341 leur prêterait une " +
            'nature qu\u2019elles n\u2019ont pas ; le 734 lui-même est un en-tête et ne reçoit pas d\u2019écriture. ' +
            "L'écriture se passe à la main, sur le sous-compte que le cabinet aura ouvert, et la Note " +
            'annexe doit en porter le détail.',
    },
    {
        racine: '344',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        intitule: 'Produits résiduels en cours',
        motif: 'Même anomalie du plan officiel que le 343 · le compte 734 n\u2019ouvre que 7341 et 7342, et ' +
            'aucun compte de variation imputable ne répond aux produits résiduels EN COURS. À ne pas ' +
            'confondre avec le 372 Produits résiduels, qui est un stock achevé et dispose bien de son 7372.',
    },
    {
        racine: '345',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        intitule: "Stocks d'actifs biologiques en cours",
        motif: 'Même anomalie du plan officiel que le 343 · le compte 734 n\u2019ouvre que 7341 et 7342.',
    },
    {
        racine: '373',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        intitule: "Stocks d'actifs biologiques",
        motif: "ANOMALIE DU PLAN OFFICIEL, signalée et non comblée. Le compte 37 ouvre « 373 Stocks d'actifs " +
            "biologiques (3731 Animaux, 3732 Végétaux, 3738 Autres stocks) », mais le compte 737 qui lui " +
            'répond n\u2019ouvre que « 7371 Produits intermédiaires » et « 7372 Produits résiduels ». Un actif ' +
            "biologique n'est ni l'un ni l'autre, et le 737 est un en-tête qui ne reçoit pas d'écriture.",
    },
    {
        racine: '39',
        referentiels: [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA],
        intitule: 'Dépréciations des stocks',
        motif: "Une dépréciation n'est pas une variation de stock. Elle se constate au crédit du 39 par le débit " +
            'du 6593 (ou du 839 en H.A.O.) et se reprend par le crédit du 7593 (ou du 849), sur la différence ' +
            'entre valeur nette comptable et valeur nette de réalisation. Le stock brut, lui, ne bouge pas.',
    },
];
exports.STOCK_PROVENANT_D_IMMOBILISATIONS = {
    [client_1.Referentiel.SYSCOHADA]: {
        racine: '388',
        intitule: 'Stock provenant d’immobilisations mises hors service ou au rebut',
        source: 'AUDCIF, Titre VII, fiche du compte 38 ; Titre VIII ch. 14 § 2.8',
    },
    [client_1.Referentiel.SYCEBNL]: {
        racine: '378',
        intitule: "Stock provenant d'immobilisations mises hors service ou au rebut",
        source: 'SYCEBNL, Partie 2 ch. 3, fiche du compte 37',
    },
};
function correspondancesDuReferentiel(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL
        ? SYCEBNL_CORRESPONDANCES
        : SYSCOHADA_CORRESPONDANCES;
}
function variationDuCompte(numero, referentiel) {
    const candidates = correspondancesDuReferentiel(referentiel).filter((c) => numero.startsWith(c.racine));
    if (candidates.length === 0)
        return null;
    return candidates.reduce((a, b) => (b.racine.length > a.racine.length ? b : a));
}
function motifHorsVariation(numero, referentiel) {
    const candidates = exports.STOCKS_HORS_VARIATION_AUTOMATIQUE.filter((h) => h.referentiels.includes(referentiel) && numero.startsWith(h.racine));
    if (candidates.length === 0)
        return null;
    return candidates.reduce((a, b) => (b.racine.length > a.racine.length ? b : a));
}
//# sourceMappingURL=nomenclature-stocks.js.map