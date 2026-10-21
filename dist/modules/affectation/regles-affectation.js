"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGLES = void 0;
exports.destinationsDuSens = destinationsDuSens;
exports.regimeReserveLegale = regimeReserveLegale;
exports.racineCapital = racineCapital;
exports.dotationReserveLegale = dotationReserveLegale;
exports.avertissementLigneCapital = avertissementLigneCapital;
const client_1 = require("@prisma/client");
exports.REGLES = {
    [client_1.Referentiel.SYSCOHADA]: {
        destinationsBenefice: {
            racines: ['101', '103', '11', '12', '465'],
            source: 'AUDCIF, Titre VII, compte 13 · « par le crédit des comptes 12 (Report à nouveau), 11 (Réserves), ' +
                '101 (Capital social), 103 (Capital personnel) ou 465 (Associés, dividendes à payer) »',
        },
        destinationsPerte: {
            racines: ['101', '103', '105', '11', '12'],
            source: 'AUDCIF, Titre VII, compte 13 · « par le débit des comptes 12 (Report à nouveau), 11 (Réserves), ' +
                '101 (Capital social) ou 103 (Capital personnel) » ; compte 105 · débité « en cas d’absorption de ' +
                'pertes, par le crédit du 12 (Report à nouveau) ou du 139 (Résultat net : Pertes) »',
        },
        interdits: [
            {
                racine: '106',
                motif: "Le compte 106 « Écarts de réévaluation » n'est PAS une destination du résultat, dans aucun des deux " +
                    "sens. Un écart de réévaluation naît d'une réévaluation de l'actif immobilisé, jamais d'une " +
                    "délibération d'affectation : l'AUDCIF, art. 65, pose que « l'écart de réévaluation ne peut être " +
                    "incorporé au résultat de l'exercice de réévaluation », et la loi n° 23/053, art. 133, alinéa 4, " +
                    "ajoute pour l'écart des éléments AMORTISSABLES qu'« il n'est pas distribuable et il ne peut pas être " +
                    "utilisé à la compensation des pertes ». Imputer une perte sur ce compte est exactement cette " +
                    "compensation. RÉSERVE · l'alinéa 4 vise littéralement les éléments amortissables, et le plan ne " +
                    "sépare pas l'écart selon ce critère ; le refus porte donc sur toute la racine 106, ce qui est le " +
                    "sens le plus strict et le seul qui ne fasse passer aucune écriture interdite. La seule destination " +
                    "que les deux textes ouvrent à l'écart est le CAPITAL, « en tout ou partie » (art. 133, alinéa 5 · " +
                    "AUDCIF art. 65), et elle se passe par une écriture d'incorporation, pas par l'affectation du résultat.",
            },
        ],
        reserveLegale: '111',
        reportANouveau: '12',
    },
    [client_1.Referentiel.SYCEBNL]: {
        destinationsBenefice: {
            racines: ['10', '11', '12'],
            source: 'SYCEBNL, Partie 2 ch. 3, compte 13 · « par le crédit des comptes 12 – Report à nouveau, 11 – ' +
                'Réserves, 10 – Dotation »',
        },
        destinationsPerte: {
            racines: ['10', '11', '12'],
            source: 'SYCEBNL, Partie 2 ch. 3, compte 13 · « par le débit des comptes 12 – Report à nouveau, ou 11 – ' +
                'Réserves » ; compte 10 · débité « par le crédit du compte 12 – Report à nouveau ou 139 déficit de ' +
                'l’exercice (absorption des déficits antérieurs reportés ou de l’exercice) »',
        },
        interdits: [
            {
                racine: '106',
                motif: "Le compte 106 « Écarts de réévaluation » n'est PAS une destination du résultat, dans aucun des deux " +
                    "sens. Un écart de réévaluation naît d'une réévaluation de l'actif immobilisé, jamais d'une " +
                    "délibération d'affectation : l'AUDCIF, art. 65, pose que « l'écart de réévaluation ne peut être " +
                    "incorporé au résultat de l'exercice de réévaluation », et la loi n° 23/053, art. 133, alinéa 4, " +
                    "ajoute pour l'écart des éléments AMORTISSABLES qu'« il n'est pas distribuable et il ne peut pas être " +
                    "utilisé à la compensation des pertes ». Imputer une perte sur ce compte est exactement cette " +
                    "compensation. RÉSERVE · l'alinéa 4 vise littéralement les éléments amortissables, et le plan ne " +
                    "sépare pas l'écart selon ce critère ; le refus porte donc sur toute la racine 106, ce qui est le " +
                    "sens le plus strict et le seul qui ne fasse passer aucune écriture interdite. La seule destination " +
                    "que les deux textes ouvrent à l'écart est le CAPITAL, « en tout ou partie » (art. 133, alinéa 5 · " +
                    "AUDCIF art. 65), et elle se passe par une écriture d'incorporation, pas par l'affectation du résultat.",
            },
            {
                racine: '465',
                motif: "Le compte 465 « Associés, dividendes à payer » n'existe pas dans le plan SYCEBNL : une entité à but " +
                    'non lucratif « poursuit un but désintéressé » et ses ressources « servent au fonctionnement et à la ' +
                    'réalisation de son objet social » · c’est ce qui la définit (SYCEBNL, art. 2).',
            },
        ],
        reportANouveau: '12',
    },
};
function destinationsDuSens(regles, estBenefice) {
    return estBenefice ? regles.destinationsBenefice : regles.destinationsPerte;
}
function regimeReserveLegale(forme) {
    if (forme === null) {
        return {
            exigee: false,
            capital: null,
            source: 'AUSCGIE, art. 346 (SARL) et art. 546, 2° (SA)',
            motif: "La forme juridique du dossier n'est pas renseignée : la dotation à la réserve légale n'a pas pu être " +
                "contrôlée. Elle n'est imposée qu'à la SARL (AUSCGIE, art. 346) et à la SA (art. 546, 2°) · renseignez la " +
                'forme dans les paramètres du dossier pour que le contrôle s’applique. Elle se lit dans les statuts, elle ' +
                'ne se devine pas · le logiciel ne présume pas une SARL.',
        };
    }
    switch (forme) {
        case client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
            return {
                exigee: true,
                source: 'AUSCGIE, art. 346 (société à responsabilité limitée)',
                capital: '101',
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME:
            return {
                exigee: true,
                source: 'AUSCGIE, art. 546, 2° (société anonyme)',
                capital: '101',
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE:
            return {
                exigee: false,
                capital: '101',
                source: 'AUSCGIE, art. 853-3',
                motif: "Aucune dotation obligatoire lue pour la société par actions simplifiée : l'article 853-3 rend " +
                    'applicables les règles de la société anonyme « à l’exception des articles 387 alinéa 1er, 414 à 561, 690, ' +
                    '751 à 753 ci-dessus », ' +
                    "et l'article 546, 2°, qui porte la dotation d'un dixième, tombe dans cette exception ; le livre de la " +
                    'SAS (art. 853-1 à 853-23) ne la rétablit pas. La dotation reste possible et se règle alors aux statuts ' +
                    '(art. 853-1 : « les statuts prévoient librement l’organisation et le fonctionnement de la société »).',
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF:
            return {
                exigee: false,
                capital: '101',
                source: 'AUSCGIE, livre 1 (art. 270 et suivants)',
                motif: "Aucune dotation obligatoire lue pour la société en nom collectif : le livre qui la régit ne porte pas " +
                    "de réserve légale, et les deux articles qui l'imposent visent la SARL (art. 346) et la SA " +
                    '(art. 546, 2°). L’article 142 fait constituer « les dotations NÉCESSAIRES à la réserve légale » · ' +
                    'la nécessité vient d’un autre texte, et il n’y en a pas ici. Les statuts peuvent en prévoir une.',
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE:
            return {
                exigee: false,
                capital: '101',
                source: 'AUSCGIE, art. 293-1',
                motif: "Aucune dotation obligatoire lue pour la société en commandite simple : « Les dispositions relatives aux " +
                    'sociétés en nom collectif sont applicables aux sociétés en commandite simple » (art. 293-1), et la SNC ' +
                    "n'est tenue à aucune réserve légale. Les statuts peuvent en prévoir une.",
            };
        case client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE:
            return {
                exigee: false,
                capital: null,
                source: 'AUSCGIE, art. 869 al. 3 et art. 870',
                motif: "Aucune dotation obligatoire pour le groupement d'intérêt économique : « Il peut être constitué sans " +
                    'capital » (art. 869 al. 3), de sorte que le plafond du cinquième du capital social n’a pas d’assiette, ' +
                    'et le groupement « ne donne pas lieu par lui-même à réalisation et à partage des bénéfices » ' +
                    '(art. 870). Les articles 346 et 546, 2° ne le visent pas · c’est le contrat constitutif qui règle ' +
                    "l'affectation (art. 876).",
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE:
            return {
                exigee: false,
                capital: '101',
                source: 'AUSCOOP, art. 113 à 116',
                motif: "La société coopérative relève de l'AUSCOOP, « nonobstant les dispositions des articles 1er et 6 de " +
                    "l'Acte uniforme relatif au droit des sociétés commerciales » (AUSCOOP, art. 1 al. 3) : la réserve " +
                    "légale de l'AUSCGIE ne lui est PAS applicable, et le logiciel ne l'exige donc pas. Sa cascade est " +
                    'propre et le logiciel ne la contrôle pas : « Les statuts prévoient, avant toute autre affectation, la ' +
                    "constitution d'une réserve générale par prélèvements annuels sur les excédents nets d'exploitation », " +
                    "ainsi qu'une réserve « destinée à la formation, à l'éducation et à la sensibilisation aux principes " +
                    "coopératifs », et « tant que chacune de ces réserves légales n'atteint pas le montant du capital fixé " +
                    'par les statuts, les prélèvements opérés au titre de chaque réserve ne peuvent être inférieurs à vingt ' +
                    "pour cent des excédents nets d'exploitation » (art. 114). Vérifiez ces deux dotations sur vos statuts " +
                    "avant d'enregistrer · le logiciel ne dispose ni des excédents nets d'exploitation au sens de ce texte, " +
                    'ni du capital fixé par les statuts. Les réserves facultatives que les statuts prévoient ne peuvent ' +
                    "dépasser « vingt pour cent des excédents nets » (art. 115) et « ne peuvent pas être réparties entre les " +
                    "coopérateurs », et les coopérateurs démissionnaires ou exclus « ne peuvent prétendre à aucun droit sur " +
                    "les sommes affectées à la réserve générale et à la réserve de formation » (art. 116).",
            };
        case client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE:
            return {
                exigee: false,
                capital: '103',
                source: 'AUDCG, art. 2 et 13 · AUSCGIE, art. 346 et 546, 2° a contrario',
                motif: "Aucune dotation obligatoire pour une entreprise individuelle : le commerçant personne physique " +
                    "(AUDCG, art. 2 et 13) n'est pas une société, il n'a ni assemblée générale ni capital social, et les " +
                    'deux articles qui imposent la réserve légale visent la SARL (art. 346) et la SA (art. 546, 2°). Son ' +
                    'capital figure au compte 103 « Capital personnel » (AUDCIF, Titre VII).',
            };
        case client_1.FormeJuridiqueSyscohada.ENTREPRENANT:
            return {
                exigee: false,
                capital: '103',
                source: 'AUDCG, art. 30 · AUSCGIE, art. 346 et 546, 2° a contrario',
                motif: "Aucune dotation obligatoire pour un entreprenant : l'AUDCG (art. 30) en fait un entrepreneur " +
                    "individuel, dispensé d'immatriculation au registre du commerce et du crédit mobilier · ni société, ni " +
                    'assemblée, ni capital social. Son capital figure au compte 103 « Capital personnel » (AUDCIF, ' +
                    'Titre VII).',
            };
        case client_1.FormeJuridiqueSyscohada.SUCCURSALE:
            return {
                exigee: false,
                capital: null,
                source: 'AUSCGIE, art. 117',
                motif: "Aucune dotation obligatoire pour une succursale : elle « n'a pas de personnalité juridique autonome, " +
                    "distincte de celle de la société ou de la personne physique propriétaire » (art. 117), et ses droits " +
                    'et obligations « sont compris dans le patrimoine » de celle-ci. Elle n’a pas de capital propre, et ' +
                    'l’affectation du résultat se décide chez le propriétaire, selon la forme de CELUI-CI.',
            };
        case client_1.FormeJuridiqueSyscohada.ENTITE_PUBLIQUE:
            return {
                exigee: false,
                capital: '102',
                source: 'AUDCIF, art. 2 et COMPTE 102 · AUSCGIE, art. 346 et 546, 2° a contrario',
                motif: "Aucune dotation à la réserve légale de l'AUSCGIE n'a été lue pour une entité publique : les articles " +
                    '346 et 546, 2° visent la SARL et la SA. Son capital est un capital PAR DOTATION, au compte 102, qui ' +
                    '« ne peut être utilisé que dans les entités publiques » (AUDCIF, Titre VII). Les textes propres à ' +
                    "l'entité (statuts, loi ou règlement qui la crée) peuvent prévoir leurs propres prélèvements.",
            };
        case client_1.FormeJuridiqueSyscohada.AUTRE:
            return {
                exigee: false,
                capital: null,
                source: 'AUSCGIE, art. 346 (SARL) et art. 546, 2° (SA)',
                motif: 'La forme du dossier est enregistrée comme « Autre » : aucun texte ne peut lui être rattaché avec ' +
                    "certitude, et le logiciel n'exige donc pas la dotation. Elle n'est imposée qu'à la SARL (AUSCGIE, " +
                    'art. 346) et à la SA (art. 546, 2°) : si le dossier est l’une des deux, corrigez sa forme dans les ' +
                    'paramètres pour que le contrôle s’applique.',
            };
    }
}
function racineCapital(referentiel, forme) {
    if (referentiel !== client_1.Referentiel.SYSCOHADA)
        return null;
    return regimeReserveLegale(forme).capital;
}
function dotationReserveLegale(params) {
    const regles = exports.REGLES[params.referentiel];
    if (!regles.reserveLegale) {
        return {
            dotation: null,
            motif: "La réserve légale est une obligation du droit des sociétés commerciales (AUSCGIE) · elle ne s'applique " +
                'pas à une entité à but non lucratif.',
        };
    }
    const regime = regimeReserveLegale(params.forme);
    if (!regime.exigee) {
        return { dotation: null, motif: regime.motif };
    }
    const assiette = Math.round((params.benefice - params.pertesAnterieures) * 100) / 100;
    if (assiette <= 0) {
        return {
            dotation: null,
            motif: 'Aucune dotation obligatoire : le bénéfice de l’exercice, diminué des pertes antérieures, ne laisse rien ' +
                `à doter (${regime.source}).`,
        };
    }
    const plafond = Math.round((params.capitalSocial / 5) * 100) / 100;
    if (params.capitalSocial > 0 && params.reserveExistante >= plafond) {
        return {
            dotation: null,
            motif: `Aucune dotation obligatoire : la réserve légale (${params.reserveExistante.toFixed(2)}) atteint déjà le ` +
                `cinquième du capital social (${plafond.toFixed(2)}), seuil au-delà duquel la dotation cesse d'être ` +
                `obligatoire (${regime.source}).`,
        };
    }
    const dixieme = Math.round(assiette * 0.1 * 100) / 100;
    const manquant = params.capitalSocial > 0 ? Math.round((plafond - params.reserveExistante) * 100) / 100 : dixieme;
    const dotation = Math.min(dixieme, manquant);
    return {
        dotation,
        motif: `Un dixième au moins du bénéfice diminué des pertes antérieures (${assiette.toFixed(2)}), soit ` +
            `${dotation.toFixed(2)} · dotation obligatoire à peine de nullité de la délibération contraire ` +
            `(${regime.source}).`,
    };
}
function avertissementLigneCapital(forme, estBenefice) {
    switch (forme) {
        case client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME:
            return estBenefice
                ? 'Porter le bénéfice au capital social est une AUGMENTATION DE CAPITAL : l’assemblée générale ' +
                    'extraordinaire est seule compétente, sur le rapport du commissaire aux comptes (AUSCGIE art. 564), ' +
                    'statuant aux quorum et majorité de l’assemblée ordinaire pour une incorporation de bénéfices ' +
                    '(art. 565) ; l’augmentation est publiée (art. 618) et la délibération contraire est nulle (art. 618-1).'
                : 'Imputer la perte sur le capital social est une RÉDUCTION DE CAPITAL : elle est autorisée ou décidée ' +
                    'par l’assemblée générale extraordinaire (AUSCGIE art. 628), et « toute délibération prise à défaut du ' +
                    'rapport du commissaire aux comptes est nulle » (art. 630). Motivée par des pertes, elle ne peut pas ' +
                    'être frappée d’opposition par les créanciers (art. 632) ; elle est publiée (art. 638).';
        case client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE:
            return ((estBenefice ? 'Porter le bénéfice au capital social est une AUGMENTATION DE CAPITAL' : 'Imputer la perte sur le capital social est une RÉDUCTION DE CAPITAL') +
                ' : dans une SAS, cette attribution est « exercée collectivement par les associés », dans les conditions ' +
                'des statuts, et la décision prise en violation de cette règle est nulle (AUSCGIE art. 853-11, al. 2).');
        case client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
            return estBenefice
                ? 'Porter le bénéfice au capital social est une AUGMENTATION DE CAPITAL : elle est décidée par les ' +
                    'associés représentant au moins la moitié des parts sociales (AUSCGIE art. 360), et la délibération ' +
                    'contraire est nulle (art. 360-1).'
                : 'Imputer la perte sur le capital social est une RÉDUCTION DE CAPITAL : c’est une modification des ' +
                    'statuts, décidée par les associés représentant au moins les trois quarts du capital social (AUSCGIE ' +
                    'art. 358, nullité à l’art. 360-1) ; le projet est communiqué au commissaire aux comptes s’il en existe ' +
                    'un (art. 367), et le capital ne descend pas sous le minimum légal (art. 368).';
        default:
            return null;
    }
}
//# sourceMappingURL=regles-affectation.js.map