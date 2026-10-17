"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRAT_A_COMPLETER = exports.MOTIF_MONNAIE_EXIGEE = exports.MONNAIE_DU_MINIMUM = exports.MOIS_CONFIRMATION_APTITUDE = exports.JOURS_DECLARATION_ARTICLE_217 = exports.JOURS_PAR_MOIS_ESSAI = exports.FORMULE_ARTICLE_41_ALINEAS_2_ET_3 = exports.EFFET_REQUALIFICATION_CDI = exports.JOURNEES_ARTICLE_40 = exports.ENONCIATIONS_ARTICLE_212 = void 0;
exports.mentionsManquantes = mentionsManquantes;
exports.journeesJourLeJourAvant = journeesJourLeJourAvant;
exports.joursEntre = joursEntre;
exports.requalificationsApprentissage = requalificationsApprentissage;
exports.requalifications = requalifications;
exports.verdictEssai = verdictEssai;
exports.declarationsDues = declarationsDues;
exports.aptitudeProvisoirePerimee = aptitudeProvisoirePerimee;
exports.motifMonnaieExigee = motifMonnaieExigee;
exports.verdictRemunerationMinimale = verdictRemunerationMinimale;
const ajouter_mois_1 = require("../../common/ajouter-mois");
const au_centime_1 = require("./au-centime");
const bareme_smig_1 = require("./bareme-smig");
exports.ENONCIATIONS_ARTICLE_212 = [
    {
        point: 'NOM_EMPLOYEUR',
        numero: 1,
        texte: "le nom de l'employeur ou la raison sociale de l'entreprise",
        ou: 'Structure > Paramètres du dossier > Identité',
    },
    {
        point: 'IMMATRICULATION_CNSS_EMPLOYEUR',
        numero: 2,
        texte: "le numéro d'immatriculation de l'employeur à l'Institut National de Sécurité Sociale",
        ou: 'Structure > Paramètres du dossier > Identité',
    },
    {
        point: 'IDENTITE_TRAVAILLEUR',
        numero: 3,
        texte: 'le nom, les prénoms et, le ou les post-noms et le sexe du travailleur',
        ou: 'Personnel > fiche du salarié',
    },
    {
        point: 'AFFILIATION_CNSS_TRAVAILLEUR',
        numero: 4,
        texte: "le numéro d'affiliation du travailleur à l'Institut National de Sécurité Sociale et, éventuellement, le numéro d'ordre qui lui est attribué par l'employeur",
        ou: 'Personnel > fiche du salarié',
    },
    {
        point: 'NAISSANCE_TRAVAILLEUR',
        numero: 5,
        texte: "la date de naissance du travailleur ou à défaut, le millésime de l'année présumée de celle-ci",
        ou: 'Personnel > fiche du salarié',
    },
    {
        point: 'LIEU_NAISSANCE_ET_NATIONALITE',
        numero: 6,
        texte: 'le lieu de naissance du travailleur et sa nationalité',
        ou: 'Personnel > fiche du salarié',
    },
    {
        point: 'SITUATION_FAMILIALE',
        numero: 7,
        texte: "la situation familiale du travailleur : nom, prénoms, ou post-noms du conjoint ; nom, prénoms ou post-noms et date de naissance de chaque enfant à charge",
        ou: 'Personnel > fiche du salarié > Situation de famille',
    },
    {
        point: 'NATURE_DU_TRAVAIL',
        numero: 8,
        texte: 'la nature et les modalités du travail à fournir',
        ou: 'Personnel > contrat',
    },
    {
        point: 'REMUNERATION_ET_AVANTAGES',
        numero: 9,
        texte: 'le montant de la rémunération et des autres avantages convenus',
        ou: 'Personnel > contrat',
    },
    {
        point: 'LIEUX_EXECUTION',
        numero: 10,
        texte: "le ou les lieux d'exécution du contrat",
        ou: 'Personnel > contrat',
    },
    {
        point: 'DUREE_ENGAGEMENT',
        numero: 11,
        texte: "la durée de l'engagement",
        ou: 'Personnel > contrat',
    },
    {
        point: 'DUREE_PREAVIS',
        numero: 12,
        texte: 'la durée du préavis de licenciement',
        ou: 'Personnel > contrat',
    },
    {
        point: 'DATE_ENTREE_EN_VIGUEUR',
        numero: 13,
        texte: "la date d'entrée en vigueur du contrat",
        ou: 'Personnel > contrat',
    },
    {
        point: 'LIEU_ET_DATE_CONCLUSION',
        numero: 14,
        texte: 'le lieu et la date de la conclusion du contrat',
        ou: 'Personnel > contrat',
    },
    {
        point: 'APTITUDE_AU_TRAVAIL',
        numero: 15,
        texte: "l'aptitude au travail dûment constatée par un médecin",
        ou: 'Personnel > fiche du salarié > Aptitude',
    },
];
const rempli = (v) => v !== null && v !== undefined && (typeof v !== 'string' || v.trim() !== '');
function estSatisfait(point, employeur, salarie, contrat) {
    switch (point) {
        case 'NOM_EMPLOYEUR':
            return rempli(employeur.nom);
        case 'IMMATRICULATION_CNSS_EMPLOYEUR':
            return rempli(employeur.numeroAffiliationCnssEmployeur);
        case 'IDENTITE_TRAVAILLEUR':
            return rempli(salarie.nom) && rempli(salarie.sexe);
        case 'AFFILIATION_CNSS_TRAVAILLEUR':
            return rempli(salarie.numeroAffiliationCnss);
        case 'NAISSANCE_TRAVAILLEUR':
            return rempli(salarie.dateNaissance) || rempli(salarie.millesimeNaissance);
        case 'LIEU_NAISSANCE_ET_NATIONALITE':
            return rempli(salarie.lieuNaissance) && rempli(salarie.nationalite);
        case 'SITUATION_FAMILIALE':
            return salarie.enfantsSansDateNaissance === 0;
        case 'NATURE_DU_TRAVAIL':
            return rempli(contrat.natureTravail);
        case 'REMUNERATION_ET_AVANTAGES':
            return rempli(contrat.remunerationBase);
        case 'LIEUX_EXECUTION':
            return rempli(contrat.lieuExecution);
        case 'DUREE_ENGAGEMENT':
            if (contrat.type === 'DUREE_INDETERMINEE')
                return true;
            if (contrat.type === 'JOUR_LE_JOUR')
                return true;
            return (rempli(contrat.dateFinPrevue) ||
                rempli(contrat.ouvrageDetermine) ||
                rempli(contrat.motifRemplacement));
        case 'DUREE_PREAVIS':
            return rempli(contrat.dureePreavisJours);
        case 'DATE_ENTREE_EN_VIGUEUR':
            return rempli(contrat.dateEntreeEnVigueur);
        case 'LIEU_ET_DATE_CONCLUSION':
            return rempli(contrat.dateConclusion) && rempli(contrat.lieuConclusion);
        case 'APTITUDE_AU_TRAVAIL':
            return rempli(salarie.aptitudeConstateeLe);
    }
}
function mentionsManquantes(employeur, salarie, contrat) {
    if (contrat.type === 'JOUR_LE_JOUR' && !contrat.constateParEcrit)
        return [];
    if (contrat.type === 'APPRENTISSAGE')
        return [];
    return exports.ENONCIATIONS_ARTICLE_212.filter((e) => !estSatisfait(e.point, employeur, salarie, contrat)).map((e) => ({
        ...e,
        motif: e.point === 'SITUATION_FAMILIALE'
            ? `${salarie.enfantsSansDateNaissance} enfant(s) à charge sont déclarés sans date de naissance, que le point 7 exige de chacun.`
            : `Le point ${e.numero} de l'article 212 n'est pas renseigné : « ${e.texte} ».`,
    }));
}
exports.JOURNEES_ARTICLE_40 = 22;
function journeesJourLeJourAvant(anterieurs, nouveau) {
    const debut = enDate(nouveau.dateEntreeEnVigueur);
    if (!debut)
        return null;
    const fenetre = (0, ajouter_mois_1.ajouterMois)(debut, -2);
    let journees = 0;
    for (const c of anterieurs) {
        if (c.type !== 'JOUR_LE_JOUR')
            continue;
        const entree = enDate(c.dateEntreeEnVigueur);
        if (!entree || entree.getTime() >= debut.getTime() || entree.getTime() < fenetre.getTime())
            continue;
        const fin = enDate(c.dateFin);
        if (!fin || fin.toISOString().slice(0, 10) !== entree.toISOString().slice(0, 10))
            return null;
        journees += 1;
    }
    return journees;
}
exports.EFFET_REQUALIFICATION_CDI = 'Requalifié en contrat à durée indéterminée';
const MS_PAR_JOUR = 86_400_000;
function enDate(v) {
    if (v === null || v === undefined)
        return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}
function joursEntre(debut, fin) {
    return Math.floor((fin.getTime() - debut.getTime()) / MS_PAR_JOUR);
}
exports.FORMULE_ARTICLE_41_ALINEAS_2_ET_3 = "Aucun travailleur ne peut conclure avec le même employeur ou avec la même entreprise plus de deux contrats à durée déterminée ni renouveler plus d'une fois un contrat à durée déterminée, sauf dans le cas d'exécution des travaux saisonniers, d'ouvrages bien définis et autres travaux déterminés par arrêté du Ministre ayant le Travail et la Prévoyance Sociale dans ses attributions, pris après avis du Conseil National du Travail. L'exécution de tout contrat conclu en violation des dispositions du présent article ou la continuation de service en dehors des cas prévus à l'alinéa précédent constituent de plein droit l'exécution d'un contrat de travail à durée indéterminée.";
function requalificationsApprentissage(contrat) {
    const sorties = [];
    const presomption = "Présumé exécuté en contrat de travail";
    if (!contrat.constateParEcrit) {
        sorties.push({
            motif: 'APPRENTISSAGE_SANS_ECRIT',
            article: 'art. 19 et 23',
            formule: "Tout contrat d'apprentissage doit être constaté par écrit et contenir les mentions énumérées à l'article 20 du présent Code. [...] En cas d'annulation ou de doute sur l'objet du contrat non écrit, les services de l'apprenti sont présumés avoir été prestés en exécution d'un contrat de travail.",
            explication: "Le contrat d'apprentissage n'est pas constaté par écrit.",
            effet: presomption,
            reserve: null,
        });
    }
    if (!contrat.viseParOnem) {
        sorties.push({
            motif: 'APPRENTISSAGE_NON_VISE',
            article: 'art. 21, alinéa 3',
            formule: "Tant que le contrat n'a pas été soumis au visa, ou lorsque le visa a été retiré, les services de l'apprenti sont présumés être prestés en exécution d'un contrat de travail respectivement à la date de la conclusion du contrat et du retrait du visa.",
            explication: "Le contrat n'est pas visé par l'Office national de l'emploi. La demande de visa incombe au maître (art. 21, al. 2), et le contrat non visé est annulable (art. 23).",
            effet: presomption,
            reserve: null,
        });
    }
    const debut = enDate(contrat.dateEntreeEnVigueur);
    const fin = enDate(contrat.dateFinPrevue);
    if (debut && fin) {
        const plafond = new Date(debut.getTime());
        plafond.setFullYear(plafond.getFullYear() + 4);
        if (fin.getTime() > plafond.getTime()) {
            sorties.push({
                motif: 'APPRENTISSAGE_TROP_LONG',
                article: 'art. 20, 4°',
                formule: "de la date du début et de la durée du contrat ; cette dernière est fixée conformément aux usages de la profession, mais ne peut excéder quatre ans",
                explication: `Le contrat court ${joursEntre(debut, fin)} jours, au-delà des quatre ans comptés de date à date.`,
                effet: 'Durée au-delà du maximum légal',
                reserve: "Le texte n'attache à ce dépassement aucune requalification · l'infraction à l'art. 20 est punie par l'art. 321.",
            });
        }
    }
    return sorties;
}
function requalifications(contrat, historique) {
    const sorties = [];
    if (contrat.type === 'APPRENTISSAGE')
        return requalificationsApprentissage(contrat);
    if (contrat.type === 'JOUR_LE_JOUR' &&
        historique.journeesJourLeJour !== undefined &&
        historique.journeesJourLeJour !== null &&
        historique.journeesJourLeJour >= exports.JOURNEES_ARTICLE_40) {
        sorties.push({
            motif: 'ENGAGEMENT_JOUR_LE_JOUR_REPETE',
            article: 'art. 40, alinéa 2',
            formule: "Néanmoins, dans le cas d'engagement au jour le jour, si le travailleur a déjà accompli vingt-deux journées de travail sur une période de deux mois, le nouvel engagement conclu, avant l'expiration des deux mois est, sous peine de pénalité, réputé conclu pour une durée indéterminée.",
            explication: `Le registre porte ${historique.journeesJourLeJour} journées d'engagement au jour le jour de ce travailleur dans les deux mois qui précèdent ce nouvel engagement.`,
            effet: exports.EFFET_REQUALIFICATION_CDI,
            reserve: null,
        });
    }
    if (!contrat.constateParEcrit && contrat.type !== 'JOUR_LE_JOUR') {
        sorties.push({
            motif: 'PAS_D_ECRIT',
            article: 'art. 44, alinéa 2',
            formule: "A défaut d'écrit, le contrat est présumé, jusqu'à preuve du contraire, avoir été conclu pour une durée indéterminée.",
            explication: "L'alinéa 3 excepte l'engagement au jour le jour, et lui seul. Cette présomption souffre la preuve contraire · c'est la seule de cette liste qui ne soit pas irréfragable.",
            effet: 'Présumé à durée indéterminée',
            reserve: null,
        });
    }
    if (contrat.type !== 'DUREE_DETERMINEE')
        return sorties;
    if (contrat.emploiPermanent) {
        sorties.push({
            motif: 'EMPLOI_PERMANENT',
            article: 'art. 42',
            formule: 'Tout contrat conclu pour une durée déterminée en violation du présent article est réputé conclu pour une durée indéterminée.',
            explication: "L'article impose le contrat à durée indéterminée dès lors que le travailleur est engagé pour occuper un EMPLOI PERMANENT. Le caractère permanent du poste est saisi au contrat · aucune colonne ne le déduit.",
            effet: exports.EFFET_REQUALIFICATION_CDI,
            reserve: null,
        });
    }
    const terme = rempli(contrat.dateFinPrevue) ||
        rempli(contrat.ouvrageDetermine) ||
        rempli(contrat.motifRemplacement);
    if (!terme) {
        sorties.push({
            motif: 'CDD_SANS_MENTION_DE_SON_TERME',
            article: 'art. 45',
            formule: "Le contrat constaté par écrit qui ne mentionne pas expressément qu'il a été conclu soit pour une durée déterminée, soit pour un ouvrage déterminé, soit pour le remplacement d'un travailleur temporairement indisponible […] est réputé avoir été conclu pour une durée indéterminée.",
            explication: "Les trois formes de l'article 40 sont alternatives : un terme, un ouvrage, ou un remplacement. Aucune des trois n'est renseignée.",
            effet: exports.EFFET_REQUALIFICATION_CDI,
            reserve: null,
        });
    }
    const debut = enDate(contrat.dateEntreeEnVigueur);
    const fin = enDate(contrat.dateFinPrevue);
    if (debut && fin) {
        const jours = joursEntre(debut, fin);
        const plafond = new Date(debut.getTime());
        plafond.setFullYear(plafond.getFullYear() + (contrat.separeDeSaFamille ? 1 : 2));
        if (fin.getTime() > plafond.getTime()) {
            sorties.push(contrat.separeDeSaFamille
                ? {
                    motif: 'CDD_TROP_LONG_SEPARE_DE_SA_FAMILLE',
                    article: 'art. 41, alinéa 1er',
                    formule: "Cette durée ne peut excéder un an, si le travailleur est marié et séparé de sa famille ou s'il est veuf, séparé de corps ou divorcé et séparé de ses enfants dont il doit assumer la garde.",
                    explication: `Le contrat court ${jours} jours, au-delà du plafond d'un an applicable à ce travailleur.`,
                    effet: exports.EFFET_REQUALIFICATION_CDI,
                    reserve: null,
                }
                : {
                    motif: 'CDD_TROP_LONG',
                    article: 'art. 41, alinéa 1er',
                    formule: 'Le contrat à durée déterminée ne peut excéder deux ans.',
                    explication: `Le contrat court ${jours} jours, au-delà du plafond de deux ans.`,
                    effet: exports.EFFET_REQUALIFICATION_CDI,
                    reserve: null,
                });
        }
    }
    const reserveExceptionArticle41 = rempli(contrat.ouvrageDetermine)
        ? "Le contrat porte un ouvrage déterminé · si c'est un ouvrage bien défini, ou un travail saisonnier, l'exception de l'alinéa 2 peut jouer. C'est au dossier de la qualifier."
        : null;
    if (historique.nombreCdd > 2) {
        sorties.push({
            motif: 'TROISIEME_CDD',
            article: 'art. 41, alinéas 2 et 3',
            formule: exports.FORMULE_ARTICLE_41_ALINEAS_2_ET_3,
            explication: `C'est le ${historique.nombreCdd}e contrat à durée déterminée conclu avec ce travailleur dans ce dossier. L'exception des travaux saisonniers et des ouvrages bien définis n'est pas déduite : c'est au dossier de l'invoquer.`,
            effet: reserveExceptionArticle41 ? `${exports.EFFET_REQUALIFICATION_CDI}, sous réserve de l'exception` : exports.EFFET_REQUALIFICATION_CDI,
            reserve: reserveExceptionArticle41,
        });
    }
    if (historique.nombreRenouvellements > 1) {
        sorties.push({
            motif: 'SECOND_RENOUVELLEMENT',
            article: 'art. 41, alinéas 2 et 3',
            formule: exports.FORMULE_ARTICLE_41_ALINEAS_2_ET_3,
            explication: `Ce contrat a été renouvelé ${historique.nombreRenouvellements} fois. L'exception n'est pas déduite : les travaux saisonniers et les ouvrages bien définis sont exceptés par la loi elle-même, seuls les « autres travaux » dépendent d'un arrêté du Ministre qui n'est pas au corpus, et c'est au dossier de l'invoquer.`,
            effet: reserveExceptionArticle41 ? `${exports.EFFET_REQUALIFICATION_CDI}, sous réserve de l'exception` : exports.EFFET_REQUALIFICATION_CDI,
            reserve: reserveExceptionArticle41,
        });
    }
    return sorties;
}
exports.JOURS_PAR_MOIS_ESSAI = 30;
function verdictEssai(contrat) {
    const plafondMois = contrat.manoeuvreSansSpecialite ? 1 : 6;
    const plafondJours = plafondMois * exports.JOURS_PAR_MOIS_ESSAI;
    if (!contrat.clauseEssai) {
        return {
            dureeOpposableJours: null,
            plafondJours,
            reduiteDePleinDroit: false,
            ecritManquant: false,
            reserve: null,
        };
    }
    const stipulee = contrat.essaiDureeJours ?? null;
    const reduite = stipulee !== null && stipulee > plafondJours;
    return {
        dureeOpposableJours: reduite ? plafondJours : stipulee,
        plafondJours,
        reduiteDePleinDroit: reduite,
        ecritManquant: !contrat.essaiConstateParEcrit,
        reserve: `Le plafond de l'article 43 est exprimé en MOIS (${plafondMois}), non en jours : ` +
            `OmegaX le convertit à ${exports.JOURS_PAR_MOIS_ESSAI} jours par mois, soit ${plafondJours} jours. ` +
            'La conversion est une convention du logiciel, pas une lecture du texte. ' +
            "La prolongation des services au-delà de la durée maximale « entraîne automatiquement la confirmation du contrat de travail » (art. 43, alinéa 4), et « les délais d'engagement et de route ne sont pas compris dans la durée maximale » (alinéa 5) : OmegaX ne les connaît pas et ne les retranche pas.",
    };
}
exports.JOURS_DECLARATION_ARTICLE_217 = 15;
function declarationsDues(entree, aujourdhui) {
    const dues = [];
    const destinataires = "au service compétent du ministère ayant l'emploi, le travail et la prévoyance sociale dans ses attributions ET à l'Office national de l'emploi";
    const poser = (objet, fait, faiteLe) => {
        if (!fait)
            return;
        const echeance = new Date(fait.getTime() + exports.JOURS_DECLARATION_ARTICLE_217 * MS_PAR_JOUR);
        dues.push({
            objet,
            faitLe: fait,
            echeance,
            faite: faiteLe !== null,
            enRetard: faiteLe === null && aujourdhui.getTime() > echeance.getTime(),
            destinataires,
            article: 'art. 217',
        });
    };
    poser('ENGAGEMENT', enDate(entree.dateEntreeEnVigueur), enDate(entree.declarationEngagementLe));
    poser('DEPART', enDate(entree.dateFin), enDate(entree.declarationDepartLe));
    return dues;
}
exports.MOIS_CONFIRMATION_APTITUDE = 3;
function aptitudeProvisoirePerimee(salarie, contrat, aujourdhui) {
    if (!salarie.aptitudeProvisoire)
        return false;
    const debut = enDate(contrat.dateEntreeEnVigueur);
    if (!debut)
        return false;
    const finDuDelai = (0, ajouter_mois_1.ajouterMois)(debut, exports.MOIS_CONFIRMATION_APTITUDE);
    return aujourdhui.getTime() >= finDuDelai.getTime() + MS_PAR_JOUR;
}
exports.MONNAIE_DU_MINIMUM = 'CDF';
exports.MOTIF_MONNAIE_EXIGEE = 'La rémunération convenue est renseignée sans sa monnaie · choisissez francs congolais (CDF) ou dollars américains (USD). ' +
    'OmegaX ne la suppose pas, et elle ne se change plus une fois déclarée.';
function motifMonnaieExigee(remunerationBase, deviseRemuneration) {
    const montantRenseigne = remunerationBase !== null && remunerationBase !== undefined;
    const monnaieDite = deviseRemuneration !== null && deviseRemuneration !== undefined && deviseRemuneration !== '';
    return montantRenseigne && !monnaieDite ? exports.MOTIF_MONNAIE_EXIGEE : null;
}
exports.CONTRAT_A_COMPLETER = {
    remunerationBase: { not: null },
    deviseRemuneration: null,
};
const MULTIPLICATEUR = {
    JOUR: 1,
    SEMAINE: bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.SEMAINE,
    MOIS: bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS,
    ANNEE: bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.ANNEE,
};
function verdictRemunerationMinimale(contrat, moisDeReference, annexesSmig = [], grillesNonLues = null) {
    const abstention = (motif, explication) => ({
        conforme: null,
        minimumFc: null,
        convenueFc: contrat.deviseRemuneration === exports.MONNAIE_DU_MINIMUM ? contrat.remunerationBase : null,
        manqueFc: null,
        abstention: motif,
        explication,
    });
    if (contrat.classeProfessionnelle === null) {
        return abstention('CLASSE_NON_RENSEIGNEE', `La classe de la tension salariale n'est pas renseignée. Les annexes du décret n° 25/22 en ` +
            `portent ${bareme_smig_1.TENSIONS.length}, du manœuvre ordinaire au cadre de collaboration · OmegaX ne la ` +
            "déduit ni de l'intitulé du poste, ni de la catégorie de la convention collective, qui est " +
            'une autre grille.');
    }
    if (contrat.periodiciteRemuneration === null) {
        return abstention('PERIODICITE_NON_RENSEIGNEE', "La périodicité de la rémunération convenue n'est pas renseignée. Le décret fixe un taux " +
            "JOURNALIER et l'article 7 donne les multiplicateurs vers la semaine (6), le mois (26) et " +
            "l'année (312) · sans l'unité, la comparaison n'a pas de sens, et la supposer mensuelle " +
            'ferait paraître un salaire journalier vingt-six fois trop bas.');
    }
    if (contrat.remunerationBase === null) {
        return abstention('REMUNERATION_NON_RENSEIGNEE', "La rémunération convenue n'est pas renseignée · c'est déjà le point 9 manquant de " +
            "l'article 212.");
    }
    if (contrat.deviseRemuneration === null) {
        return abstention('DEVISE_NON_RENSEIGNEE', "La monnaie de la rémunération convenue n'est pas déclarée. Le minimum du décret n° 25/22 est " +
            'un taux en francs congolais · OmegaX ne suppose pas que le montant du contrat en soit, un ' +
            'salaire stipulé en dollars lu comme des francs paraîtrait très en deçà du minimum.');
    }
    if (contrat.deviseRemuneration !== exports.MONNAIE_DU_MINIMUM) {
        return abstention('REMUNERATION_HORS_FRANC', `La rémunération convenue est stipulée en ${contrat.deviseRemuneration}. Le minimum du décret ` +
            'n° 25/22 est un taux en francs congolais (art. 2) · OmegaX ne compare pas deux montants de ' +
            "monnaies différentes, et le contrat ne porte aucun cours auquel les rapprocher. Code du " +
            "travail, art. 89 : « La rémunération doit être stipulée en monnaie ayant cours légal en " +
            'République Démocratique du Congo. »');
    }
    if (grillesNonLues !== null && moisDeReference >= grillesNonLues.du && moisDeReference < grillesNonLues.avant) {
        return abstention('GRILLES_SMIG_NON_LUES', `Le dossier porte plus de grilles SMIG que la confrontation n'en lit · celles de ${grillesNonLues.du} ` +
            `à ${grillesNonLues.avant} exclu n'ont pas été lues, et la grille applicable au mois de paie ` +
            `${moisDeReference} en fait partie. Le contrôle s'abstient plutôt que de juger ce contrat sur un ` +
            'minimum qui ne serait pas celui du mois.');
    }
    const taux = (0, bareme_smig_1.tauxJournalierDeLaClasse)(contrat.classeProfessionnelle, moisDeReference, annexesSmig);
    if (!taux.valeur)
        return abstention('HORS_BAREME', taux.explication);
    const minimum = (0, au_centime_1.auCentime)(taux.valeur.tauxFc * MULTIPLICATEUR[contrat.periodiciteRemuneration]);
    const manqueCentimes = (0, au_centime_1.enCentimes)(minimum) - (0, au_centime_1.enCentimes)(contrat.remunerationBase);
    const conforme = manqueCentimes <= 0;
    const unite = contrat.periodiciteRemuneration.toLowerCase();
    return {
        conforme,
        minimumFc: minimum,
        convenueFc: contrat.remunerationBase,
        manqueFc: conforme ? null : manqueCentimes / 100,
        abstention: null,
        explication: conforme
            ? `Classe ${taux.valeur.classe} (${taux.valeur.categorie.libelle}${taux.valeur.echelon ? `, échelon ${taux.valeur.echelon}` : ''}), tension ${taux.valeur.tension} : minimum de ${minimum} FC par ${unite} au mois de paie ` +
                `${moisDeReference}. La rémunération convenue l'atteint.`
            : `EN DEÇÀ DU MINIMUM LÉGAL. Classe ${taux.valeur.classe} (${taux.valeur.categorie.libelle}` +
                `${taux.valeur.echelon ? `, échelon ${taux.valeur.echelon}` : ''}), tension ` +
                `${taux.valeur.tension} : le minimum est de ${minimum} FC par ${unite} au mois de paie ` +
                `${moisDeReference}, et le contrat stipule ${contrat.remunerationBase} FC. ` +
                "Le SMIG est « la somme minimale fixée par le pouvoir public en deçà de laquelle aucun " +
                "travailleur ne peut être rémunéré sous peine de sanction » (décret n° 25/21, art. 3). Le Code " +
                "du travail, art. 88, al. 2 : « Est nulle de plein droit toute clause de contrat individuel ou " +
                'de convention collective fixant des rémunérations inférieures aux salaires minima ' +
                "interprofessionnels garantis déterminés conformément à l'article 87 » ; l'infraction au décret " +
                "de l'article 87 est punie par l'article 321, et l'article 37 frappe de nullité toute clause " +
                'moins favorable que le Code.',
    };
}
//# sourceMappingURL=regles-contrat-travail.js.map