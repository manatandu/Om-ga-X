"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualifierExemptionIs = qualifierExemptionIs;
const client_1 = require("@prisma/client");
const conditions_ong_etrangere_1 = require("../accord-cadre/conditions-ong-etrangere");
const renseigne = (v) => typeof v === 'string' && v.trim().length > 0;
const QUATRE_CONDITIONS = "Arrêté n° 007/2025, art. 3 : « L'exemption n'est effectivement acquise que si quatre conditions cumulatives sont " +
    "réunies : 1. activités exercées dans un but non lucratif ; 2. gestion désintéressée (voir art. 4) ; 3. en cas " +
    "d'activités lucratives, le produit doit être réinvesti dans le programme d'activités à caractère philanthropique, " +
    "scientifique, culturel, artistique, pédagogique, éducatif ou sportif faisant l'objet de la structure ; 4. la vente " +
    "éventuelle des produits issus de ces activités lucratives ne doit pas entraîner de distorsion de concurrence · " +
    "condition limitée au public et à l'espace visés par l'objet de la structure. » " +
    "AUCUNE DES QUATRE NE SE LIT DANS UNE COMPTABILITÉ · un compte de produits porte un montant, jamais le but " +
    "poursuivi, l'affectation du surplus ni l'effet des ventes sur la concurrence. OmegaX ne les vérifie pas et " +
    "ne prétend pas les vérifier : c'est à vous de les constater, exercice par exercice, l'attestation une fois " +
    "délivrée ne figeant pas l'exemption.";
const GESTION_DESINTERESSEE = "Arrêté n° 007/2025, art. 4 : la gestion est désintéressée lorsqu'elle est assurée à titre bénévole, sans « aucune " +
    "distribution directe ou indirecte de gains générés, sous quelque forme que ce soit ». Les statuts peuvent " +
    "toutefois prévoir des rémunérations de dirigeants « à condition qu'elles soient comparables à celles versées pour " +
    "des responsabilités similaires » : c'est le NIVEAU de la rémunération, pas son existence, qui distingue la " +
    "rémunération légitime de la distribution déguisée. Le comparable ne figure dans aucune balance · le logiciel ne " +
    "peut donc pas trancher, seulement rappeler la règle.";
const SANCTION_ART_5 = "Arrêté n° 007/2025, art. 5 : « En cas de non-respect des conditions des articles 3 et 4, l'impôt sur les sociétés " +
    "est dû au titre de l'exercice concerné. » Si un manquement est constaté, l'impôt de CET exercice devient exigible. " +
    "OmegaX ne le liquide pas : la détermination du résultat fiscal lit une balance SYSCOHADA (comptes de produits 701 " +
    "à 707, catalogue de retraitements de la loi n° 23/053) et un dossier SYCEBNL n'en a pas. Le chiffrage se fait hors " +
    "logiciel. Le texte est par ailleurs muet sur une remise en cause au-delà de l'exercice visé : silence à signaler, " +
    "pas à trancher.";
const SANCTION_ART_5_CONDITIONNELLE = "Si la forme de ce dossier se révèle être celle d'un établissement d'utilité publique ou d'une ONG, l'arrêté " +
    "n° 007/2025 s'applique (art. 1er) et son art. 5 avec lui : « En cas de non-respect des conditions des articles 3 " +
    "et 4, l'impôt sur les sociétés est dû au titre de l'exercice concerné. » Cette sanction ne vaut que dans ce cas · " +
    "l'arrêté ne vise aucune autre entité.";
const CONCOURS_ONG = "QUALIFICATION À ARBITRER, le logiciel ne la tranche pas. Deux lectures se disputent l'exemption d'une ONG et " +
    "toutes deux tiennent du texte. Point 3 de l'art. 5 : une ONG de droit congolais est une ASBL, puisque la loi " +
    "n° 004/2001 la range à son art. 2 parmi les trois natures d'ASBL et la définit à son art. 35 comme « l'association " +
    "sans but lucratif dotée de la personnalité juridique dont l'objet concourt au développement social, culturel et " +
    "économique des communautés locales » · l'exemption serait alors acquise sans attestation. Point 5 du même " +
    "article : il nomme les « Organisations non gouvernementales » et les renvoie « aux conditions définies par voie " +
    "réglementaire », et l'arrêté n° 007/2025 est pris pour elles (art. 1er) · l'attestation et les quatre conditions " +
    "s'appliqueraient. Tant que l'arbitrage n'est pas fait, les avertissements ci-dessous sont servis par prudence.";
const POINT_4_MANIFESTATIONS = "Loi n° 23/053, art. 5, point 4 : sont exemptés « les profits qu'elles réalisent à l'occasion de l'organisation, " +
    "avec le concours des Entités Territoriales Décentralisées ou des organismes publics locaux, des foires, des " +
    "expositions, des réunions sportives et autres manifestations publiques correspondant à l'objet défini par leurs " +
    "statuts ». Ce point n'exempte pas l'entité mais CES PROFITS-LÀ, et il ne reprend pas la condition « constituées " +
    "conformément à la Loi » du point 3. Il peut donc rester ouvert alors même que le point 3 ne l'est pas. Le concours " +
    "d'une ETD ou d'un organisme public local est un fait qui ne figure dans aucune écriture : à établir par la " +
    "convention de la manifestation.";
const attestationDite = (connue, pieces, dateConnue = false) => connue
    ? "Arrêté n° 007/2025, art. 2 : « Le bénéfice de l'exemption n'est pas automatique : il passe par une attestation " +
        "d'exemption, délivrée par l'Administration des Impôts sur demande de la structure concernée, dont elle définit " +
        "le modèle. » Une référence d'attestation est enregistrée dans ce dossier. Le logiciel ne la vérifie pas : " +
        (dateConnue
            ? "sa date de délivrance est enregistrée, mais il n'a ni son modèle, "
            : "il n'a ni sa date de délivrance, ni son modèle, ") +
        "ni le moyen de savoir si la Direction Générale des Impôts l'a depuis retirée. AUCUNE ÉCHÉANCE N'EST SUIVIE, " +
        "et ce n'est pas un manque : les six articles de l'arrêté ne fixent aucune durée de validité, aucun " +
        "renouvellement, aucun délai. Le risque que porte l'art. 5 n'est d'ailleurs pas la péremption de la pièce mais " +
        "le non-respect des art. 3 et 4. Conserver l'original au dossier permanent, c'est la première pièce demandée " +
        "au contrôle."
    : "Arrêté n° 007/2025, art. 2 : « Le bénéfice de l'exemption n'est pas automatique : il passe par une attestation " +
        "d'exemption, délivrée par l'Administration des Impôts sur demande de la structure concernée, dont elle définit " +
        "le modèle. La demande est adressée au Directeur Général des Impôts. » AUCUNE ATTESTATION N'EST ENREGISTRÉE " +
        "dans ce dossier (paramètres du dossier, « Attestation d'exemption »). Tant qu'elle manque, l'exemption ne peut " +
        `pas être présentée comme acquise. Pièces à joindre à la demande : ${pieces}`;
const PIECES_EUP = "arrêté du Ministre ayant la Justice dans ses attributions, accordant la personnalité juridique.";
const PIECES_EUP_ETRANGER = "non fixées par l'arrêté pour un établissement de droit étranger (voir ci-dessous).";
const PIECES_ONG_CONGOLAISE = "arrêté du Ministre de la Justice accordant la personnalité juridique ET acte d'enregistrement auprès du Ministère " +
    "du secteur d'activité visé.";
const PIECES_ONG_ETRANGERE = "ordonnance présidentielle accordant la personnalité juridique, justification d'une représentation en RDC, et " +
    "accord-cadre conclu avec le Ministère du Plan.";
const ONG_ETRANGERE = "DOSSIER DÉCLARÉ DE DROIT ÉTRANGER. La loi n° 004/2001, art. 37, impose à l'organisation étrangère d'« avoir une " +
    "représentation en République Démocratique du Congo » et de « conclure un accord-cadre avec le Ministère ayant le " +
    "plan dans ses attributions ». L'arrêté n° 007/2025 range la justification d'une représentation en RDC et " +
    "l'accord-cadre conclu avec le Ministère du Plan parmi les pièces que l'ONG étrangère joint à sa demande " +
    "d'attestation (art. 2). Il s'ensuit qu'une ONG étrangère à qui l'une de ces deux pièces manque ne peut pas " +
    "constituer sa demande, même personnalité juridique acquise à l'étranger. " +
    "L'accord-cadre se tient désormais dans la fenêtre Accord-cadre (Ministère du Plan) · il ne se confond pas avec " +
    "le certificat d'enregistrement du Ministère du Plan, qui est une autre pièce, ni avec l'arrêté interministériel " +
    "de l'art. 39, qui ouvre les exonérations et non l'existence de l'ONG. Ce module ne LIT pas l'accord : il rappelle " +
    "la condition, et c'est le contrôle ACCORD_CADRE_PLAN_ABSENT qui constate son absence.";
const EUP_ETRANGER = "DOSSIER DÉCLARÉ DE DROIT ÉTRANGER. La table de l'art. 2 de l'arrêté n° 007/2025 ne prévoit de pièces que pour " +
    "l'établissement d'utilité publique « de droit national » (arrêté du Ministre ayant la Justice dans ses " +
    "attributions, accordant la personnalité juridique). L'arrêté ne règle pas le cas d'un établissement d'utilité " +
    "publique de droit étranger · les pièces de sa demande d'attestation sont à établir auprès de la Direction " +
    "Générale des Impôts, à qui la demande est adressée.";
const ACTE_MANQUANT = "L'art. 5, point 3 de la loi n° 23/053 n'exempte que les ASBL « constituées conformément à la Loi ». La " +
    "personnalité juridique est « accordée par le Ministre de la Justice après avis favorable du Ministre ayant dans " +
    "ses attributions le secteur d'activités visé » (loi n° 004/2001, art. 3), l'avis favorable valant « autorisation " +
    "provisoire de fonctionnement » de six mois (art. 5). L'ACTE DE PERSONNALITÉ JURIDIQUE N'EST PAS RENSEIGNÉ dans ce " +
    "dossier. Le champ étant facultatif, son absence ne prouve rien : elle empêche seulement le logiciel d'affirmer " +
    "que la condition du point 3 est remplie.";
const acteManquantEtranger = (ong, confessionnelle) => "DOSSIER DÉCLARÉ DE DROIT ÉTRANGER. Une association sans but lucratif qui a son siège à l'étranger (loi " +
    "n° 004/2001, art. 29) ne relève pas des art. 3 et 5 de cette loi mais de sa Section II : « Aucune association " +
    "étrangère ne peut exercer ses activités en République Démocratique du Congo sans une autorisation du Président " +
    "de la République donnée par décret sur proposition du Ministre de la Justice » (art. 30), " +
    (confessionnelle
        ? "la demande d'enregistrement et d'autorisation d'une association confessionnelle étant adressée au Ministre de " +
            "la Justice (art. 32) ; "
        : "après avis et enregistrement auprès du Ministère du secteur d'activités visé (art. 31) ; ") +
    "autorisée, elle a la capacité que lui reconnaît la loi de son siège, sans plus de droits qu'une association de " +
    "droit congolais (art. 34). Cette section ne prévoit aucune autorisation provisoire de fonctionnement. " +
    (ong
        ? "Pour une ONG, la table de l'art. 2 de l'arrêté n° 007/2025 nomme une « ordonnance présidentielle accordant la " +
            "personnalité juridique » là où la loi parle d'un décret · le logiciel ne tranche pas entre les deux " +
            "désignations. "
        : '') +
    "L'ACTE D'AUTORISATION N'EST PAS RENSEIGNÉ dans ce dossier. Le champ étant facultatif, son absence ne prouve " +
    "rien : elle empêche seulement le logiciel d'affirmer que l'entité est constituée conformément à la Loi.";
function qualifierExemptionIs(entree) {
    const attestationConnue = renseigne(entree.attestationExemptionIs);
    const dateAttestationConnue = attestationConnue && entree.dateAttestationExemptionIs != null;
    const acteConnu = renseigne(entree.actePersonnaliteJuridique);
    const etranger = entree.droitEtranger === true;
    const avertissements = [];
    switch (entree.formeJuridique) {
        case client_1.FormeJuridiqueEbnl.ASSOCIATION:
        case client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE: {
            if (!acteConnu) {
                avertissements.push(etranger
                    ? acteManquantEtranger(false, entree.formeJuridique === client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE)
                    : ACTE_MANQUANT, POINT_4_MANIFESTATIONS);
            }
            return {
                fondement: 'ART_5_POINT_3',
                enonce: acteConnu
                    ? "Une association sans but lucratif constituée conformément à la Loi est exemptée d'impôt sur les sociétés " +
                        "(loi n° 23/053, art. 5, point 3) · ce point ne renvoie à aucun texte d'application, l'arrêté n° 007/2025 " +
                        "ne visant que les établissements d'utilité publique et les ONG."
                    : "L'exemption de l'art. 5, point 3 de la loi n° 23/053 vise les associations « constituées conformément à " +
                        "la Loi » · l'acte de personnalité juridique n'étant pas renseigné dans ce dossier, le logiciel ne " +
                        "l'affirme pas.",
                attestationRequise: false,
                attestationConnue,
                dateAttestationConnue,
                exemptionAffirmable: acteConnu,
                avertissements,
            };
        }
        case client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE: {
            avertissements.push(CONCOURS_ONG);
            avertissements.push(attestationDite(attestationConnue, etranger ? PIECES_ONG_ETRANGERE : PIECES_ONG_CONGOLAISE));
            if ((0, conditions_ong_etrangere_1.articleTrenteSeptApplicable)(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, etranger)) {
                avertissements.push(ONG_ETRANGERE);
            }
            avertissements.push(QUATRE_CONDITIONS, GESTION_DESINTERESSEE, SANCTION_ART_5);
            if (!acteConnu) {
                avertissements.push(etranger ? acteManquantEtranger(true, false) : ACTE_MANQUANT, POINT_4_MANIFESTATIONS);
            }
            return {
                fondement: 'ART_5_POINT_3_OU_POINT_5',
                enonce: "L'exemption d'une organisation non gouvernementale n'est pas acquise du seul fait du référentiel " +
                    "comptable · l'art. 5, point 5 de la loi n° 23/053 la renvoie aux « conditions définies par voie " +
                    "réglementaire », et l'arrêté n° 007/2025 y met une attestation du Directeur Général des Impôts (art. 2) " +
                    "et quatre conditions de fond vérifiées en continu (art. 3).",
                attestationRequise: true,
                attestationConnue,
                dateAttestationConnue,
                exemptionAffirmable: false,
                avertissements,
            };
        }
        case client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE: {
            avertissements.push(attestationDite(attestationConnue, etranger ? PIECES_EUP_ETRANGER : PIECES_EUP));
            if (etranger)
                avertissements.push(EUP_ETRANGER);
            avertissements.push(QUATRE_CONDITIONS, GESTION_DESINTERESSEE, SANCTION_ART_5);
            return {
                fondement: 'ART_5_POINT_5',
                enonce: "L'exemption d'un établissement d'utilité publique relève du seul point 5 de l'art. 5 de la loi n° 23/053, " +
                    "« dans les conditions définies par voie réglementaire » · un établissement d'utilité publique n'est pas " +
                    "une association sans but lucratif (loi n° 004/2001, Titre II, art. 58), les points 3 et 4 ne lui sont donc " +
                    "pas ouverts. L'attestation de l'arrêté n° 007/2025 (art. 2) et ses quatre conditions (art. 3) commandent.",
                attestationRequise: true,
                attestationConnue,
                dateAttestationConnue,
                exemptionAffirmable: false,
                avertissements,
            };
        }
        case client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET: {
            avertissements.push("Une unité de gestion de projet n'est pas une personne morale de la loi n° 004/2001 : elle n'est ni une " +
                "association sans but lucratif (art. 2) ni un établissement d'utilité publique (art. 58). Aucun des points " +
                "3, 4 et 5 de l'art. 5 de la loi n° 23/053 ne découle donc de sa forme. Si une exemption existe, elle vient " +
                "d'un autre instrument · convention de financement, accord de siège, texte propre au bailleur, qu'OmegaX ne " +
                "détient pas. À établir pièce en main avant toute conclusion.");
            return {
                fondement: 'HORS_LOI_004_2001',
                enonce: "La forme « unité de gestion de projet » est hors du champ de la loi n° 004/2001 · aucun des points 3, 4 " +
                    "et 5 de l'art. 5 de la loi n° 23/053 ne se déduit d'elle, et le logiciel n'affirme aucune exemption.",
                attestationRequise: null,
                attestationConnue,
                dateAttestationConnue,
                exemptionAffirmable: false,
                avertissements,
            };
        }
        default: {
            avertissements.push("La forme juridique de ce dossier n'est pas qualifiée au regard de la loi n° 004/2001 (« AUTRE », ou champ " +
                "non renseigné). Les points 3, 4 et 5 de l'art. 5 de la loi n° 23/053 ne visent pas les mêmes entités et " +
                "n'ont pas le même régime : renseigner la forme dans les paramètres du dossier est le préalable à toute " +
                "qualification.", SANCTION_ART_5_CONDITIONNELLE);
            return {
                fondement: 'INDETERMINE',
                enonce: "La forme juridique de ce dossier ne permet pas de qualifier le fondement de l'exemption (loi n° 23/053, " +
                    "art. 5, points 3, 4 ou 5) · le logiciel n'en affirme aucune.",
                attestationRequise: null,
                attestationConnue,
                dateAttestationConnue,
                exemptionAffirmable: false,
                avertissements,
            };
        }
    }
}
//# sourceMappingURL=exemption-is-ebnl.js.map