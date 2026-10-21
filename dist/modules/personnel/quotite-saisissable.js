"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_FACULTE_DE_DEFALCATION = exports.RESERVE_CONTINUITE_DES_TEXTES = exports.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES = exports.RESERVE_LOGEMENT = exports.RESERVE_CATEGORIE = exports.RESERVE_ASSIETTE_AUPSRVE = exports.RESERVE_CUMUL = exports.JOURS_DU_MOIS = exports.FRACTION_OBLIGATION_ALIMENTAIRE = exports.FRACTION_AU_DESSUS_DU_SEUIL = exports.FRACTION_SOUS_LE_SEUIL = exports.MULTIPLE_DU_MINIMUM_CATEGORIEL = exports.DIVISEUR_EVALUATION_FORFAITAIRE_LOGEMENT = void 0;
exports.mensuelMinimumDeLaClasse = mensuelMinimumDeLaClasse;
exports.quotiteSaisissable = quotiteSaisissable;
const bareme_smig_1 = require("./bareme-smig");
exports.DIVISEUR_EVALUATION_FORFAITAIRE_LOGEMENT = 5;
exports.MULTIPLE_DU_MINIMUM_CATEGORIEL = 5;
exports.FRACTION_SOUS_LE_SEUIL = { numerateur: 1, denominateur: 5 };
exports.FRACTION_AU_DESSUS_DU_SEUIL = { numerateur: 1, denominateur: 3 };
exports.FRACTION_OBLIGATION_ALIMENTAIRE = { numerateur: 2, denominateur: 5 };
exports.JOURS_DU_MOIS = bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS;
exports.RESERVE_CUMUL = "ALINÉA 3 · le cumul de la quotité ordinaire et de la quotité alimentaire est AUTORISÉ par le texte, " +
    "qui ne lui fixe AUCUN PLAFOND. OmegaX rend donc la somme telle quelle et ne la ramène pas d'office à " +
    "une fraction moindre. Ce cumul est le seuil que l'AUPSRVE, art. 177, al. 3 laisse à chaque État · « le " +
    "total des sommes saisies ou volontairement cédées ne peut, EN AUCUN CAS, fût-ce pour dettes alimentaires, " +
    "excéder un seuil fixé par chaque État partie ». Le montant effectivement retenu relève du titre exécutoire " +
    "et du juge, pas du logiciel.";
exports.RESERVE_ASSIETTE_AUPSRVE = "ACTE UNIFORME · l'AUPSRVE, art. 177, al. 2 fixe lui-même l'assiette de la partie saisissable · « le " +
    "traitement ou salaire brut global avec tous les accessoires », moins les prélèvements légaux retenus à la " +
    "source, les indemnités représentatives de frais, les suppléments pour charge de famille et les indemnités " +
    "déclarées insaisissables par la loi de l'État · et il s'applique à l'exclusion de toute autre règle " +
    "(art. 336). Ce calcul part de la rémunération de l'art. 7 h du Code du travail, qui retire d'office " +
    "l'indemnité de logement, et retranche le forfait logement de l'art. 114, al. 4, que la liste de l'Acte ne " +
    "nomme pas. Le mode de calcul notifié dans l'acte de saisie (art. 184, 3°), ou vérifié par la juridiction " +
    "pour une cession (art. 206), PRIME ce chiffre. Vaut pour les voies engagées depuis l'entrée en vigueur de " +
    "l'Acte (art. 337).";
exports.RESERVE_CATEGORIE = "« SA CATÉGORIE » · les annexes du décret n° 25/22 portent sept catégories et dix-sept classes, et une " +
    "catégorie couvre plusieurs échelons à des taux différents. OmegaX prend le taux de la CLASSE, qui est la " +
    "détermination la plus fine du décret. Prendre le premier échelon de la catégorie abaisserait le seuil et " +
    "augmenterait la part saisissable · l'article 114 protège le travailleur, il ne se tranche pas contre lui.";
exports.RESERVE_LOGEMENT = "ARTICLE 139 · l'arrêté qui fixe l'évaluation forfaitaire du logement est l'ARRÊTÉ MINISTÉRIEL " +
    "n° 12/CAB.MIN/TPS/110/2005 DU 26 OCTOBRE 2005, et son article 10 la donne comme une FORMULE, pas comme un " +
    "montant : « il peut défalquer de la rémunération du travailleur 1/5 DU TAUX JOURNALIER DES ALLOCATIONS " +
    "FAMILIALES quelle que soit la catégorie professionnelle ». Son opérande est la colonne 19 des annexes du " +
    "décret n° 25/22, et la colonne 20 du même décret EN EST LE RÉSULTAT · les deux textes disent la même chose. " +
    "DEUX CHOSES RESTENT DISTINCTES · l'INDEMNITÉ de logement de l'article 138, HORS rémunération par " +
    "l'article 7 litera h, qui ne se déduit pas puisqu'elle n'est jamais entrée ; et la défalcation du décret " +
    "n° 25/21 article 15, qui porte la même grandeur mais se prend sur l'INDEMNITÉ et POUR CAUSE DE MUTATION seulement.";
exports.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES = "ARTICLE 138 · fournir le logement EN NATURE et verser une INDEMNITÉ DE LOGEMENT sont deux façons " +
    "ALTERNATIVES de satisfaire la même obligation · la jurisprudence congolaise recensée par R. Lukoo Musubao " +
    "(2006, p. 141) retient que « l'employeur s'acquitte de l'obligation de fournir un logement à un employé " +
    "lorsqu'il verse à ce dernier une indemnité de logement ». Les deux sont ici déclarés ENSEMBLE : la " +
    "défalcation de l'article 10 est appliquée telle quelle, mais le cumul mérite d'être vérifié au contrat. " +
    "C'EST UNE DOCTRINE, PAS UNE SOURCE · OmegaX le signale, il ne le tranche pas.";
exports.RESERVE_CONTINUITE_DES_TEXTES = "CONTINUITÉ · la contre-valeur du logement est portée par une SUITE de textes de fixation du SMIG qui " +
    "gardent le même intitulé et la même mécanique de colonnes : ordonnance n° 08/040 du 30 avril 2008, décret " +
    "n° 18/017 du 22 mai 2018, décret n° 25/22 du 30 mai 2025. L'arrêté n° 12/CAB.MIN/TPS/110/2005 pose la " +
    "formule, ces textes chiffrent l'opérande. L'ordonnance de 2008 N'EST PAS au corpus d'OmegaX, et elle n'y " +
    "manque que pour un exercice antérieur à mai 2018.";
exports.RESERVE_FACULTE_DE_DEFALCATION = "ARTICLE 10 DE L'ARRÊTÉ · l'employeur « PEUT » défalquer, il n'y est pas tenu. OmegaX déduit l'évaluation " +
    "forfaitaire de la base de l'article 114 parce que son alinéa 4 l'ordonne pour le CALCUL DE LA QUOTITÉ, " +
    "que l'employeur ait ou non exercé sa faculté sur la paie. Déclarer que la défalcation a DÉJÀ été opérée " +
    "empêche de la compter deux fois.";
function mensuelMinimumDeLaClasse(moisDePaie, classeProfessionnelle, annexesDossier = []) {
    const a = (0, bareme_smig_1.annexeApplicable)(moisDePaie, annexesDossier);
    if (!a.valeur)
        return null;
    if (!Number.isInteger(classeProfessionnelle))
        return null;
    if (classeProfessionnelle < 1 || classeProfessionnelle > a.valeur.tauxParClasse.length)
        return null;
    const journalier = a.valeur.tauxParClasse[classeProfessionnelle - 1];
    return {
        montantFc: journalier * exports.JOURS_DU_MOIS,
        annexe: a.valeur,
        colonne: (0, bareme_smig_1.colonneDeLaClasse)(classeProfessionnelle),
    };
}
const ABSTENU = {
    baseFc: null,
    evaluationForfaitaireLogementFc: null,
    seuilFc: null,
    mensuelMinimumFc: null,
    quotiteOrdinaireFc: null,
    quotiteAlimentaireFc: null,
    quotiteCumuleeFc: null,
    partInsaisissableFc: null,
};
function quotiteSaisissable(entree) {
    const abstentions = [];
    const reserves = [exports.RESERVE_ASSIETTE_AUPSRVE, exports.RESERVE_CATEGORIE, exports.RESERVE_LOGEMENT];
    if (entree.logementFourniEnNature) {
        reserves.push(exports.RESERVE_FACULTE_DE_DEFALCATION, exports.RESERVE_CONTINUITE_DES_TEXTES);
        if (entree.indemniteDeLogementVersee)
            reserves.push(exports.RESERVE_EQUIVALENCE_DES_DEUX_BRANCHES);
    }
    const classe = entree.classeProfessionnelle;
    if (classe === undefined || classe === null) {
        abstentions.push({
            motif: 'CLASSE_PROFESSIONNELLE_ABSENTE',
            explication: "ALINÉA 1er · le seuil est « cinq fois le salaire mensuel minimum interprofessionnel de sa catégorie ». " +
                "La classe de la tension salariale du décret n° 25/22 n'est pas renseignée au registre du personnel, et " +
                "sans elle le décret ne porte aucun montant pour ce travailleur.",
        });
    }
    const minimum = classe === undefined || classe === null ? null : mensuelMinimumDeLaClasse(entree.moisDePaie, classe, entree.annexesSmig);
    if (classe !== undefined && classe !== null && !minimum) {
        abstentions.push({
            motif: 'MOIS_HORS_ANNEXE',
            explication: `Aucune annexe du décret n° 25/22 ne couvre le mois de paie ${entree.moisDePaie}, ou la classe ` +
                `${classe} n'est pas une des dix-sept classes de la tension salariale. Le seuil de l'alinéa 1er ne se place pas.`,
        });
    }
    if (entree.retenuesFiscalesFc === null) {
        abstentions.push({
            motif: 'IMPOT_NON_CHIFFRE',
            explication: "ALINÉA 4 · la base se prend « déduction faite des retenues fiscales ». La retenue de l'article 119 n'est pas " +
                "chiffrée pour ce mois · la lire comme zéro gonflerait la part saisissable.",
        });
    }
    if (entree.retenuesSocialesFc === null) {
        abstentions.push({
            motif: 'COTISATION_NON_CHIFFREE',
            explication: "ALINÉA 4 · la base se prend « déduction faite des retenues […] sociales ». La quote-part ouvrière de la CNSS " +
                "n'est pas chiffrée pour ce mois · la lire comme zéro gonflerait la part saisissable.",
        });
    }
    if (abstentions.length > 0 || !minimum) {
        return {
            ...ABSTENU,
            abstentions,
            reserves,
            annexe: minimum ? minimum.annexe : null,
            colonne: minimum ? minimum.colonne : null,
        };
    }
    let evaluationForfaitaireLogementFc = 0;
    if (entree.logementFourniEnNature && !entree.logementEnNatureDejaDefalque) {
        const alloc = (0, bareme_smig_1.allocationFamilialeJournaliere)(entree.moisDePaie, 1, entree.annexesSmig);
        if (alloc.valeur) {
            evaluationForfaitaireLogementFc =
                (alloc.valeur.parEnfantFc / exports.DIVISEUR_EVALUATION_FORFAITAIRE_LOGEMENT) * exports.JOURS_DU_MOIS;
        }
    }
    const baseFc = Math.max(0, entree.remunerationFc -
        Math.max(0, entree.retenuesFiscalesFc ?? 0) -
        Math.max(0, entree.retenuesSocialesFc ?? 0) -
        evaluationForfaitaireLogementFc);
    const seuilFc = minimum.montantFc * exports.MULTIPLE_DU_MINIMUM_CATEGORIEL;
    const partBasse = Math.min(baseFc, seuilFc);
    const partHaute = Math.max(0, baseFc - seuilFc);
    const quotiteOrdinaireFc = (partBasse * exports.FRACTION_SOUS_LE_SEUIL.numerateur) / exports.FRACTION_SOUS_LE_SEUIL.denominateur +
        (partHaute * exports.FRACTION_AU_DESSUS_DU_SEUIL.numerateur) / exports.FRACTION_AU_DESSUS_DU_SEUIL.denominateur;
    const quotiteAlimentaireFc = entree.obligationAlimentaireLegale
        ? (baseFc * exports.FRACTION_OBLIGATION_ALIMENTAIRE.numerateur) /
            exports.FRACTION_OBLIGATION_ALIMENTAIRE.denominateur
        : 0;
    const quotiteCumuleeFc = quotiteOrdinaireFc + quotiteAlimentaireFc;
    if (entree.obligationAlimentaireLegale)
        reserves.push(exports.RESERVE_CUMUL);
    return {
        baseFc,
        evaluationForfaitaireLogementFc,
        seuilFc,
        mensuelMinimumFc: minimum.montantFc,
        quotiteOrdinaireFc,
        quotiteAlimentaireFc,
        quotiteCumuleeFc,
        partInsaisissableFc: Math.max(0, baseFc - quotiteCumuleeFc),
        abstentions,
        reserves,
        annexe: minimum.annexe,
        colonne: minimum.colonne,
    };
}
//# sourceMappingURL=quotite-saisissable.js.map