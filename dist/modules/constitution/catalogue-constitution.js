"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifHorsParcours = motifHorsParcours;
exports.parcoursConstitution = parcoursConstitution;
exports.champsIdentificationDeLaForme = champsIdentificationDeLaForme;
exports.piecesDuParcours = piecesDuParcours;
const client_1 = require("@prisma/client");
const ETAPE_AVIS_TUTELLE = {
    cle: 'avis-tutelle',
    libelle: 'Avis favorable du ministère de tutelle',
    destinataire: 'Ministère ayant dans ses attributions le secteur d’activités visé · pour une ASBL enregistrée en province, ' +
        'l’autorisation provisoire est accordée par le gouverneur de province (art. 5 al. 2)',
    source: 'Loi n° 004/2001, art. 3 et 5 · guide pratique Kahasha, section 1 § 1',
    produit: 'Avis favorable. Il vaut autorisation provisoire de fonctionnement (art. 5 al. 1), accordée par le gouverneur ' +
        'de province pour une ASBL enregistrée en province (art. 5 al. 2), et valable six mois (art. 5 al. 3).',
    pieces: [
        {
            cle: 'demande-ecrite',
            libelle: 'Demande écrite adressée au Ministre concerné',
            fondement: 'LOI',
            source: 'Loi n° 004/2001, art. 3 (avis exigé) et art. 4 (requête sous couvert du ministre du secteur) · rattachée ' +
                'à l’art. 5 al. 1 par le guide Kahasha',
            reserve: 'La loi ne détermine ni la forme de la requête, ni les formalités, ni les frais · « chaque Ministère ' +
                'les fixe librement » (guide Kahasha). Se renseigner auprès du ministère visé : OmegaX ne peut pas ' +
                'lister ce qu’aucun texte n’écrit.',
        },
    ],
};
const PIECES_ARTICLE_4 = [
    {
        cle: 'liste-membres',
        libelle: 'Liste des membres effectifs (noms, post-noms, prénoms, domicile ou résidence), signée par ceux chargés ' +
            'de l’administration ou de la direction',
        fondement: 'LOI',
        source: 'Loi n° 004/2001, art. 4, a)',
    },
    {
        cle: 'declaration-dirigeants',
        libelle: 'Déclaration signée par la majorité des membres effectifs indiquant les noms, professions et domiciles ' +
            'de ceux chargés de l’administration ou de la direction',
        fondement: 'LOI',
        source: 'Loi n° 004/2001, art. 4, b)',
    },
    {
        cle: 'statuts-notaries',
        libelle: 'Statuts NOTARIÉS, préalablement signés par tous les membres effectifs chargés de l’administration ou ' +
            'de la direction',
        fondement: 'LOI',
        source: 'Loi n° 004/2001, art. 4, c)',
    },
    {
        cle: 'bonne-conduite',
        libelle: 'Certificats de bonne conduite, vie et mœurs de tous les membres effectifs chargés de l’administration ' +
            'ou de la direction',
        fondement: 'LOI',
        source: 'Loi n° 004/2001, art. 4, d)',
    },
    {
        cle: 'declaration-ressources',
        libelle: 'Déclaration relative aux ressources prévues pour réaliser l’objet de l’association',
        fondement: 'LOI',
        source: 'Loi n° 004/2001, art. 4, e)',
        reserve: 'Cette déclaration DOIT ÊTRE RENOUVELÉE à la fin ou au début de chaque semestre · c’est la seule pièce ' +
            'de la constitution qui se répète, et l’oublier expose l’association aux suites de l’art. 19.',
    },
];
const PIECE_DOCTRINE = {
    cle: 'dossier-doctrine',
    libelle: 'Dossier des principes fondamentaux et des lignes maîtresses de l’enseignement religieux à dispenser, ' +
        'traduisant clairement la doctrine de l’association',
    fondement: 'LOI',
    source: 'Loi n° 004/2001, art. 52, 1°',
};
function etapePersonnalite(confessionnelle) {
    return {
        cle: 'personnalite-juridique',
        libelle: 'Octroi de la personnalité juridique',
        destinataire: 'Ministre de la Justice, sous couvert du ministère du secteur d’activités visé',
        source: 'Loi n° 004/2001, art. 4 · requête en DOUBLE exemplaire, contre récépissé' +
            (confessionnelle ? ' · art. 52 pour une association confessionnelle' : ''),
        produit: 'Arrêté du Ministre de la Justice accordant la personnalité juridique. Passé les six mois de ' +
            'l’autorisation provisoire, la personnalité juridique est censée être octroyée, et le Ministre de la ' +
            'Justice est tenu de délivrer l’arrêté dans le mois qui suit (art. 5 al. 3).',
        pieces: confessionnelle ? [...PIECES_ARTICLE_4, PIECE_DOCTRINE] : PIECES_ARTICLE_4,
    };
}
function etapeEnregistrementPlan(acte) {
    return {
        cle: 'enregistrement-plan',
        libelle: 'Enregistrement au Ministère du Plan',
        destinataire: 'Ministre ayant le Plan dans ses attributions, ou Secrétaire Général au Plan, copie au Directeur de la ' +
            'Coordination des Ressources Extérieures',
        source: 'Note circulaire n° 003/CAB/MIN/PL.SMRM/COFAF/2013 du 24 janvier 2013, section A',
        produit: 'Certificat d’enregistrement · c’est la pièce que les trois dossiers de facilités exigent ensuite « en cours ' +
            'de validité » (fenêtre Exonérations).',
        pieces: [
            {
                cle: 'lettre-demande',
                libelle: 'Lettre de demande d’enregistrement',
                fondement: 'PRATIQUE_ADMINISTRATIVE',
                source: 'Note circulaire n° 003/2013, section A, point 1',
            },
            {
                cle: 'statuts-reglement',
                libelle: 'Statuts notariés (1 exemplaire) et règlement intérieur',
                fondement: 'PRATIQUE_ADMINISTRATIVE',
                source: 'Note circulaire n° 003/2013, section A, point 2',
            },
            {
                cle: 'acte-personnalite',
                libelle: acte.libelle,
                fondement: 'LOI',
                source: acte.source,
            },
            {
                cle: 'reconnaissance-provinciale',
                libelle: 'Acte de reconnaissance de l’autorité politico-administrative provinciale',
                fondement: 'USAGE_SANS_BASE_LEGALE',
                source: 'Note circulaire n° 003/2013, section A, point 4',
                reserve: 'CETTE EXIGENCE NE DÉCOULE D’AUCUN TEXTE LÉGAL EN VIGUEUR. Le guide Kahasha (§ 6) : « cette procédure ' +
                    'informelle, non réglementée par un texte, peut se révéler dangereuse pour l’ONG et ne lui fournit aucune ' +
                    'garantie, vu qu’elle est tributaire de la personne contactée ». Elle reste réclamée en pratique : la ' +
                    'fournir, en le sachant.',
            },
            {
                cle: 'autorisation-fonctionnement',
                libelle: 'Autorisation de fonctionnement du ministère du secteur d’activités',
                fondement: 'PRATIQUE_ADMINISTRATIVE',
                source: 'Note circulaire n° 003/2013, section A, point 5',
            },
            {
                cle: 'plan-actions',
                libelle: 'Plan d’actions sur trois années',
                fondement: 'PRATIQUE_ADMINISTRATIVE',
                source: 'Note circulaire n° 003/2013, section A, point 6',
            },
            {
                cle: 'rapport-activites',
                libelle: 'Rapport d’activités le plus récent',
                fondement: 'PRATIQUE_ADMINISTRATIVE',
                source: 'Note circulaire n° 003/2013, section A, point 7',
            },
            {
                cle: 'copies-projets',
                libelle: 'Copies des projets en cours ou à réaliser',
                fondement: 'PRATIQUE_ADMINISTRATIVE',
                source: 'Note circulaire n° 003/2013, section A, point 8',
            },
            {
                cle: 'rapport-visite',
                libelle: 'Rapport de visite sur terrain établi par les services du Ministère du Plan du ressort provincial',
                fondement: 'PRATIQUE_ADMINISTRATIVE',
                source: 'Note circulaire n° 003/2013, section A, point 9',
            },
            {
                cle: 'frais-dgrad',
                libelle: 'Frais DGRAD',
                fondement: 'PRATIQUE_ADMINISTRATIVE',
                source: 'Note circulaire n° 003/2013, section A, point 10',
                reserve: 'AUCUN MONTANT N’EST DONNÉ ICI, ET C’EST VOULU. Le texte imprimé porte 50 USD (ASBL congolaise) et ' +
                    '100 USD (internationale), mais ces deux montants sont BARRÉS À LA MAIN sur le scan et remplacés par une ' +
                    'annotation manuscrite dont la lecture reste incertaine. Une annotation en marge n’a pas la valeur ' +
                    'probante du texte imprimé · vérifier le barème en vigueur auprès de la DGRAD avant tout chiffrage.',
            },
        ],
    };
}
const ETAPE_ONG_ETRANGERE = {
    cle: 'conditions-ong-etrangere',
    libelle: 'Conditions propres à l’ONG de droit étranger (art. 37)',
    destinataire: 'Ministère du Plan, et Ambassade ou Consulat pour les attestations',
    source: 'Loi n° 004/2001, art. 37 · quatre conditions cumulatives',
    produit: 'Accord-cadre signé, représentation établie, attestations produites et part de main-d’œuvre locale ' +
        'atteinte. Ces quatre-là se tiennent dans la fenêtre Accord-cadre (Ministère du Plan), pas ici.',
    pieces: [],
};
const ETAPE_DECLARATION_EUP = {
    cle: 'declaration-eup',
    libelle: 'Déclaration du fondateur et autorisation provisoire',
    destinataire: 'Ministre ayant dans ses attributions le secteur des activités visé',
    source: 'Loi n° 004/2001, art. 60 à 62',
    produit: 'Autorisation provisoire de fonctionnement du ministre du secteur (art. 61). Sauf volonté contraire du ' +
        'fondateur, les droits de l’établissement naissent ce jour-là (art. 63 al. 2).',
    pieces: [
        {
            cle: 'declaration-authentique',
            libelle: 'Déclaration du fondateur faite en forme authentique, aux fins d’approbation',
            fondement: 'LOI',
            source: 'Loi n° 004/2001, art. 60 al. 1',
            reserve: 'Si le fondateur décède avant de la communiquer, ou s’il n’a pas d’exécuteur testamentaire, ses héritiers ' +
                'ou ayants cause communiquent l’acte authentique ou les dispositions testamentaires (art. 60 al. 2).',
        },
        {
            cle: 'statuts-eup',
            libelle: 'Statuts annexés à la déclaration · objet, dénomination et siège, identité et nationalité des ' +
                'administrateurs (la moitié au moins de nationalité congolaise), destination des biens en cas de dissolution',
            fondement: 'LOI',
            source: 'Loi n° 004/2001, art. 61 et 62',
        },
    ],
};
const ETAPE_PERSONNALITE_EUP = {
    cle: 'personnalite-juridique',
    libelle: 'Octroi de la personnalité juridique',
    destinataire: 'Ministre de la Justice, après avis favorable du ministre du secteur d’activités visé',
    source: 'Loi n° 004/2001, art. 63',
    produit: 'Arrêté du Ministre de la Justice, dans les douze mois de l’autorisation provisoire. Passé ce délai, ' +
        'l’établissement peut ester en justice ou poser tout autre acte au même titre que celui doté de la ' +
        'personnalité juridique (art. 63 al. 1).',
    pieces: [
        {
            cle: 'cession-biens-eup',
            libelle: 'Déclaration de cession des biens, signée par le cédant et le bénéficiaire, notariée',
            fondement: 'PRATIQUE_ADMINISTRATIVE',
            source: 'Liste de la 2e Direction du Ministère de la Justice (guide Kahasha, annexe I), point 7',
        },
        {
            cle: 'designation-administrateurs-eup',
            libelle: 'Déclaration de désignation des administrateurs, signée par le fondateur ou le promoteur',
            fondement: 'PRATIQUE_ADMINISTRATIVE',
            source: 'Liste de la 2e Direction du Ministère de la Justice (guide Kahasha, annexe I), point 9',
        },
        {
            cle: 'dispositions-testamentaires-eup',
            libelle: 'Dispositions testamentaires',
            fondement: 'PRATIQUE_ADMINISTRATIVE',
            source: 'Liste de la 2e Direction du Ministère de la Justice (guide Kahasha, annexe I), point 11',
            reserve: 'Quand la création de l’établissement résulte d’un acte de dernière volonté (art. 60 al. 4).',
        },
    ],
};
const ETAPE_AVIS_ENREGISTREMENT_ETRANGERE = {
    cle: 'avis-enregistrement-secteur',
    libelle: 'Avis et enregistrement au ministère du secteur',
    destinataire: 'Ministère ayant dans ses attributions le secteur d’activités visé',
    source: 'Loi n° 004/2001, art. 31 al. 1',
    produit: 'Avis favorable et enregistrement, préalables à la demande d’autorisation (art. 31 al. 2). Les art. 29 à 34 ' +
        'ne prévoient aucune autorisation provisoire de fonctionnement.',
    pieces: [],
};
const ACTE_ETRANGER = 'Décret du Président de la République, sur proposition du Ministre de la Justice, autorisant l’association à ' +
    'exercer ses activités en RDC (art. 30)';
const RESERVE_ORDONNANCE = 'Pour une ONG, la table de l’art. 2 de l’arrêté n° 007/2025 et le guide Kahasha nomment une « ordonnance ' +
    'présidentielle » là où la loi parle d’un décret · OmegaX ne tranche pas entre les deux désignations.';
function etapeAutorisationEtrangere(confessionnelle, ong) {
    const renvoi = confessionnelle ? ' · par l’art. 52' : ' · par le renvoi de l’art. 31 al. 3';
    return {
        cle: 'personnalite-juridique',
        libelle: 'Autorisation d’exercer en RDC',
        destinataire: confessionnelle
            ? 'Ministre de la Justice (art. 32)'
            : 'Ministre de la Justice, après avis favorable du ministère du secteur d’activités visé (art. 31 al. 2)',
        source: confessionnelle ? 'Loi n° 004/2001, art. 30, 32 et 52' : 'Loi n° 004/2001, art. 30 et 31',
        produit: `${ACTE_ETRANGER}. Autorisée, l’association a la capacité juridique que lui reconnaît la loi de son siège, ` +
            'sans plus de droits qu’une association de droit congolais (art. 34).' +
            (ong ? ` ${RESERVE_ORDONNANCE}` : ''),
        pieces: [
            ...PIECES_ARTICLE_4.map((p) => ({ ...p, source: p.source + renvoi })),
            ...(confessionnelle ? [PIECE_DOCTRINE] : []),
        ],
    };
}
function motifHorsParcours(formeJuridique) {
    switch (formeJuridique) {
        case client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET:
            return 'Ce dossier n’est pas concerné par la loi n° 004/2001 · une unité de gestion de projet ne se constitue pas selon cette loi.';
        case client_1.FormeJuridiqueEbnl.AUTRE:
            return 'Forme juridique non précisée · la procédure diffère selon que l’entité est une association sans but lucratif (Titre I) ou un établissement d’utilité publique (Titre II). Précisez la forme dans les paramètres du dossier.';
        default:
            return null;
    }
}
function parcoursConstitution(formeJuridique, droitEtranger) {
    if (motifHorsParcours(formeJuridique) !== null)
        return [];
    if (formeJuridique === client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE) {
        return [
            ETAPE_DECLARATION_EUP,
            ETAPE_PERSONNALITE_EUP,
            etapeEnregistrementPlan({
                libelle: 'Arrêté du Ministre de la Justice accordant la personnalité juridique',
                source: 'Loi n° 004/2001, art. 63 · repris au point 3 de la section A',
            }),
        ];
    }
    const confessionnelle = formeJuridique === client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE;
    const ong = formeJuridique === client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE;
    if (droitEtranger) {
        return [
            ...(confessionnelle ? [] : [ETAPE_AVIS_ENREGISTREMENT_ETRANGERE]),
            etapeAutorisationEtrangere(confessionnelle, ong),
            etapeEnregistrementPlan({
                libelle: 'Décret d’autorisation d’exercer en RDC',
                source: 'Loi n° 004/2001, art. 30 · repris au point 3 de la section A',
            }),
            ...(ong ? [ETAPE_ONG_ETRANGERE] : []),
        ];
    }
    return [
        ETAPE_AVIS_TUTELLE,
        etapePersonnalite(confessionnelle),
        etapeEnregistrementPlan({
            libelle: 'Acte accordant la personnalité juridique',
            source: 'Loi n° 004/2001, art. 3 · repris au point 3 de la section A',
        }),
    ];
}
function champsIdentificationDeLaForme(formeJuridique, droitEtranger) {
    const ong = formeJuridique === client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE;
    return {
        enregistrementSecteur: ong || (droitEtranger && formeJuridique === client_1.FormeJuridiqueEbnl.ASSOCIATION),
        certificatPlan: ong ||
            formeJuridique === client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE ||
            formeJuridique === client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET,
    };
}
function piecesDuParcours(formeJuridique, droitEtranger) {
    return parcoursConstitution(formeJuridique, droitEtranger).flatMap((e) => e.pieces);
}
//# sourceMappingURL=catalogue-constitution.js.map