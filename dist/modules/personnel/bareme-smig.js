"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MULTIPLICATEURS_ARTICLE_7 = exports.RESERVE_GRILLE_CABINET = exports.nomAnnexe = exports.DECIMALES_ANNEXE = exports.DIVISEUR_CONTRE_VALEUR_LOGEMENT = exports.DIVISEUR_ALLOCATION_FAMILIALE = exports.RESERVE_ANNEXE_18_017 = exports.ANNEXE_DECRET_18_017 = exports.ANNEXES = exports.colonneDeLaClasse = exports.COLONNE_CONTRE_VALEUR_LOGEMENT = exports.COLONNE_ALLOCATIONS_FAMILIALES = exports.TENSIONS = exports.CATEGORIES = exports.DECRET_MODALITES = exports.DECRET_SMIG = exports.SMIG_JOURNALIER_FC = void 0;
exports.annexeDuCabinet = annexeDuCabinet;
exports.annexeApplicable = annexeApplicable;
exports.tauxJournalierDeLaClasse = tauxJournalierDeLaClasse;
exports.allocationFamilialeJournaliere = allocationFamilialeJournaliere;
exports.contreValeurLogementJournaliere = contreValeurLogementJournaliere;
exports.valeurPeriodique = valeurPeriodique;
exports.SMIG_JOURNALIER_FC = 21_500;
exports.DECRET_SMIG = {
    reference: 'Décret n° 25/22 du 30 mai 2025',
    objet: 'portant fixation du salaire minimum interprofessionnel garanti, des allocations familiales minima et de la contre-valeur du logement',
    signeLe: '2025-05-30',
    entreEnVigueurLe: '2025-05-30',
    formuleEntreeEnVigueur: 'qui entre en vigueur à la date de sa signature',
    abroge: 'Décret n° 18/017 du 22 mai 2018',
    fondement: 'Code du travail, article 87',
    annexesArreteesLe: '2025-09-17',
    publieAu: "Journal officiel, première partie, numéro spécial du 28 octobre 2025",
};
exports.DECRET_MODALITES = {
    reference: 'Décret n° 25/21 du 30 mai 2025',
    objet: "déterminant les modalités de fixation et d'ajustement du salaire minimum interprofessionnel garanti, des allocations familiales minima et de la contre-valeur du logement",
    signeLe: '2025-05-30',
    entreEnVigueurLe: '2025-05-30',
    abroge: 'Décret n° 079/2002 du 3 juillet 2002',
    fondement: 'Code du travail, article 96',
    seuilAjustementIpcPourCent: 50,
    moisDAjustement: 'janvier',
    defalcationLogementEnNature: "art. 15, de l'indemnité de logement pour cause de mutation ; de la rémunération dès le logement en nature, arrêté n° 12/CAB.MIN/TPS/110/2005, art. 10",
};
exports.CATEGORIES = [
    { rang: 'I', libelle: 'Manœuvre', echelons: ['Ordinaire', 'Lourd'], classes: [1, 2] },
    { rang: 'II', libelle: 'Travailleur spécialisé', echelons: [null], classes: [3] },
    { rang: 'III', libelle: 'Travailleur semi qualifié', echelons: ['1', '2', '3'], classes: [4, 5, 6] },
    { rang: 'IV', libelle: 'Travailleur qualifié', echelons: ['1', '2'], classes: [7, 8] },
    { rang: 'V', libelle: 'Travailleur hautement qualifié', echelons: [null], classes: [9] },
    { rang: 'VI', libelle: 'Maîtrise', echelons: ['1', '2', '3', '4'], classes: [10, 11, 12, 13] },
    {
        rang: 'VII',
        libelle: 'Cadre de collaboration',
        echelons: ['1', '2', '3', '4'],
        classes: [14, 15, 16, 17],
    },
];
exports.TENSIONS = [
    100, 116, 133, 154, 178, 206, 237, 274, 317, 366, 422, 488, 564, 651, 752, 868, 1000,
];
exports.COLONNE_ALLOCATIONS_FAMILIALES = 19;
exports.COLONNE_CONTRE_VALEUR_LOGEMENT = 20;
const colonneDeLaClasse = (classe) => classe + 1;
exports.colonneDeLaClasse = colonneDeLaClasse;
exports.ANNEXES = [
    {
        numero: 1,
        duMoisDePaie: '2025-05',
        auMoisDePaie: '2025-12',
        smigJournalierFc: 14_500,
        tauxParClasse: [
            14_500, 16_820, 19_285, 22_330, 25_810, 29_870, 34_365, 39_730, 45_965, 53_070, 61_190,
            70_760, 81_780, 94_395, 109_040, 125_860, 145_000,
        ],
        allocationFamilialeJournaliereFc: 537.04,
        contreValeurLogementJournaliereFc: 107.41,
    },
    {
        numero: 2,
        duMoisDePaie: '2026-01',
        auMoisDePaie: null,
        smigJournalierFc: 21_500,
        tauxParClasse: [
            21_500, 24_940, 28_595, 33_110, 38_270, 44_290, 50_955, 58_910, 68_155, 78_690, 90_730,
            104_920, 121_260, 139_965, 161_680, 186_620, 215_000,
        ],
        allocationFamilialeJournaliereFc: 796.3,
        contreValeurLogementJournaliereFc: 159.26,
    },
];
exports.ANNEXE_DECRET_18_017 = {
    numero: null,
    decret18017: true,
    reference: 'Décret n° 18/017 du 22 mai 2018, annexe',
    duMoisDePaie: '2019-07',
    auMoisDePaie: '2025-04',
    smigJournalierFc: 7_075,
    tauxParClasse: [
        7_075, 8_207, 9_409.75, 10_895.5, 12_593.5, 14_574.5, 16_767.75, 19_385.5, 22_427.75, 25_894.5, 29_856.5,
        34_526, 39_903, 46_058.25, 53_204, 61_411, 70_750,
    ],
    allocationFamilialeJournaliereFc: 262.04,
    contreValeurLogementJournaliereFc: 52.41,
};
exports.RESERVE_ANNEXE_18_017 = "DÉCRET n° 18/017 · annexe à 7 075 FC, transcrite avec deux réserves de lecture : la classe 8 se lit 18 385,5 sur la reproduction et vaut 19 385,5 par l'arithmétique (274 × 70,75) ; la colonne 20 se lit 52,40 et vaut 52,41 par l'article 6. Son article 7 majore les taux « de 3 % au moins par année entière de service ininterrompu » dans la même entreprise.";
exports.DIVISEUR_ALLOCATION_FAMILIALE = 27;
exports.DIVISEUR_CONTRE_VALEUR_LOGEMENT = 5;
exports.DECIMALES_ANNEXE = 2;
const MOIS_VALIDE = /^\d{4}-(0[1-9]|1[0-2])$/;
function refusAnterieur(moisDePaie) {
    if (moisDePaie >= '2019-01') {
        return ("De janvier à juin 2019, le décret n° 18/017 fait payer 7 075 FC au manœuvre ordinaire, mais " +
            "5 306,25 FC dans les secteurs agro-industriel et pastoral (art. 3, al. 2) · OmegaX ne connaît pas " +
            "le secteur du dossier, et ne choisit pas entre les deux.");
    }
    if (moisDePaie >= '2018-01') {
        return ("En 2018, le décret n° 18/017 fait payer le SMIG par paliers (2 358,33 FC, puis 4 716,66 FC à " +
            "partir de juillet, art. 3) « suivant l'annexe », qui n'est publiée qu'à 7 075 FC · les taux des " +
            "classes à ces paliers ne sont pas au corpus, et les secteurs agro-industriel et pastoral ont leurs " +
            "propres paliers.");
    }
    return ("Ce mois de paie est antérieur au décret n° 18/017 du 22 mai 2018 et à ses paliers · le texte qu'il " +
        "remplace, l'ordonnance n° 08/040 du 30 avril 2008, n'est pas au corpus d'OmegaX.");
}
const estGrilleDuCabinet = (a) => a.numero === null && !a.decret18017;
const nomAnnexe = (a) => a.decret18017
    ? "l'annexe du décret n° 18/017"
    : a.numero === null
        ? `la grille saisie par le cabinet (${a.reference ?? 'texte non précisé'})`
        : `l'annexe ${a.numero} du décret n° 25/22`;
exports.nomAnnexe = nomAnnexe;
const arrondiAnnexe = (n) => Math.round(n * 10 ** exports.DECIMALES_ANNEXE) / 10 ** exports.DECIMALES_ANNEXE;
function annexeDuCabinet(v) {
    const smig = v.smigJournalierFc;
    const allocation = arrondiAnnexe(smig / exports.DIVISEUR_ALLOCATION_FAMILIALE);
    return {
        numero: null,
        reference: v.reference,
        duMoisDePaie: v.aPartirDu.slice(0, 7),
        auMoisDePaie: null,
        smigJournalierFc: smig,
        tauxParClasse: exports.TENSIONS.map((t) => arrondiAnnexe((t * smig) / 100)),
        allocationFamilialeJournaliereFc: allocation,
        contreValeurLogementJournaliereFc: arrondiAnnexe(allocation / exports.DIVISEUR_CONTRE_VALEUR_LOGEMENT),
    };
}
exports.RESERVE_GRILLE_CABINET = "GRILLE SAISIE PAR LE CABINET · OmegaX n'a pas lu ce texte. Le taux du manœuvre ordinaire est celui que le cabinet a déclaré ; les dix-sept classes en sont tirées par la tension salariale du décret n° 25/22 (décret n° 25/21, art. 6), l'allocation familiale et la contre-valeur du logement par les fractions de ses articles 5 et 6.";
function annexeApplicable(moisDePaie, annexesDossier = []) {
    if (!MOIS_VALIDE.test(moisDePaie)) {
        return {
            valeur: null,
            annexe: null,
            refus: 'MOIS_MAL_FORME',
            explication: 'Le mois de paie doit être écrit AAAA-MM.',
        };
    }
    const trouvee = [exports.ANNEXE_DECRET_18_017, ...exports.ANNEXES, ...annexesDossier]
        .filter((a) => moisDePaie >= a.duMoisDePaie && (a.auMoisDePaie === null || moisDePaie <= a.auMoisDePaie))
        .sort((a, b) => (a.duMoisDePaie < b.duMoisDePaie ? -1 : a.duMoisDePaie > b.duMoisDePaie ? 1 : 0))
        .pop();
    if (!trouvee) {
        return { valeur: null, annexe: null, refus: 'ANTERIEUR_AU_DECRET', explication: refusAnterieur(moisDePaie) };
    }
    const nom = (0, exports.nomAnnexe)(trouvee);
    return {
        valeur: trouvee,
        annexe: trouvee,
        refus: null,
        explication: `${nom.charAt(0).toUpperCase()}${nom.slice(1)}, applicable à la paie de ${trouvee.duMoisDePaie}` +
            `${trouvee.auMoisDePaie ? ` à ${trouvee.auMoisDePaie}` : ' et au-delà'}. Manœuvre ordinaire : ` +
            `${trouvee.smigJournalierFc} FC par jour.` +
            (estGrilleDuCabinet(trouvee) ? ` ${exports.RESERVE_GRILLE_CABINET}` : '') +
            (trouvee.decret18017 ? ` ${exports.RESERVE_ANNEXE_18_017}` : ''),
    };
}
function tauxJournalierDeLaClasse(classe, moisDePaie, annexesDossier = [], anneesServiceIninterrompu = null) {
    const a = annexeApplicable(moisDePaie, annexesDossier);
    if (!a.valeur)
        return { valeur: null, annexe: null, refus: a.refus, explication: a.explication };
    if (!Number.isInteger(classe) || classe < 1 || classe > exports.TENSIONS.length) {
        return {
            valeur: null,
            annexe: a.valeur,
            refus: 'CLASSE_HORS_BAREME',
            explication: `La tension salariale des annexes court de la classe 1 (manœuvre ordinaire) à la classe ` +
                `${exports.TENSIONS.length} (cadre de collaboration, 4e échelon). La classe ${classe} n'y figure pas · ` +
                'ce barème ne monte pas au-delà du cadre de collaboration, et rien ne se déduit au-dessus.',
        };
    }
    if (a.valeur.decret18017 && anneesServiceIninterrompu !== 0) {
        return {
            valeur: null,
            annexe: a.valeur,
            refus: 'MAJORATION_ANCIENNETE_NON_RENSEIGNEE',
            explication: `${a.explication} Le minimum de la classe est majoré selon l'ancienneté, et le texte ne dit pas ` +
                "si la majoration de 3 % se compose · le taux n'est rendu qu'à ancienneté nulle. La survie de " +
                "cette majoration après l'abrogation est une question posée au dossier.",
        };
    }
    const categorie = exports.CATEGORIES.find((c) => c.classes.includes(classe));
    return {
        valeur: {
            classe,
            tension: exports.TENSIONS[classe - 1],
            tauxFc: a.valeur.tauxParClasse[classe - 1],
            categorie,
            echelon: categorie.echelons[categorie.classes.indexOf(classe)],
            colonne: (0, exports.colonneDeLaClasse)(classe),
        },
        annexe: a.valeur,
        refus: null,
        explication: a.explication,
    };
}
function allocationFamilialeJournaliere(moisDePaie, nombreEnfants = 1, annexesDossier = []) {
    const a = annexeApplicable(moisDePaie, annexesDossier);
    if (!a.valeur)
        return { valeur: null, annexe: null, refus: a.refus, explication: a.explication };
    const parEnfant = a.valeur.allocationFamilialeJournaliereFc;
    return {
        valeur: {
            parEnfantFc: parEnfant,
            totalFc: parEnfant * nombreEnfants,
            colonne: exports.COLONNE_ALLOCATIONS_FAMILIALES,
        },
        annexe: a.valeur,
        refus: null,
        explication: `Colonne ${exports.COLONNE_ALLOCATIONS_FAMILIALES} de ${(0, exports.nomAnnexe)(a.valeur)} : ${parEnfant} FC ` +
            `par jour et PAR ENFANT à charge, soit 1/27e du taux du manœuvre ordinaire ` +
            `(${a.valeur.smigJournalierFc} FC) arrondi au centime. LES CONDITIONS DE SUSPENSION de ` +
            "l'allocation relèvent de l'arrêté ministériel n° 137/CAB/MINETAT/MTEPS/01/2018 que vise l'article 13 " +
            "du décret n° 25/21 · elles sont au corpus, articles 5, 6 et 8. CE MONTANT EST CELUI QUE L'EMPLOYEUR " +
            "DOIT, et il ne se confond pas avec les 8 100 FC par mois de l'article 3 du même arrêté, qui sont une " +
            "prestation SERVIE DIRECTEMENT PAR LA CAISSE (art. 4).",
    };
}
function contreValeurLogementJournaliere(moisDePaie, annexesDossier = []) {
    const a = annexeApplicable(moisDePaie, annexesDossier);
    if (!a.valeur)
        return { valeur: null, annexe: null, refus: a.refus, explication: a.explication };
    return {
        valeur: {
            montantFc: a.valeur.contreValeurLogementJournaliereFc,
            colonne: exports.COLONNE_CONTRE_VALEUR_LOGEMENT,
        },
        annexe: a.valeur,
        refus: null,
        explication: `Colonne ${exports.COLONNE_CONTRE_VALEUR_LOGEMENT} de ${(0, exports.nomAnnexe)(a.valeur)} : ` +
            `${a.valeur.contreValeurLogementJournaliereFc} FC par jour, soit 1/5e de l'allocation ` +
            "familiale journalière. C'est une DÉFALCATION · de la RÉMUNÉRATION dès que le logement est fourni " +
            "en nature (arrêté n° 12/CAB.MIN/TPS/110/2005, art. 10), de l'INDEMNITÉ DE LOGEMENT pour cause de " +
            "MUTATION (décret n° 25/21, art. 15).",
    };
}
exports.MULTIPLICATEURS_ARTICLE_7 = { SEMAINE: 6, MOIS: 26, ANNEE: 312 };
function valeurPeriodique(montantJournalierFc, periode) {
    return montantJournalierFc * exports.MULTIPLICATEURS_ARTICLE_7[periode];
}
//# sourceMappingURL=bareme-smig.js.map