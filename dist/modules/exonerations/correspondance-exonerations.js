"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVERTISSEMENT_FRANCHISE = exports.JOURS_ALERTE_RENOUVELLEMENT = exports.FRANCHISES_DOUANIERES_EBNL = exports.MODELES_DEMANDE = void 0;
exports.MODELES_DEMANDE = [
    {
        type: 'PONCTUEL',
        libelle: 'Arrêté interministériel ponctuel',
        objet: "Exonération pour UNE opération d'importation isolée : un conteneur, un lot de matériel, un don précis. " +
            "Le dossier se rattache à une lettre de transport (BL ou LTA) identifiée.",
        baseLegale: "Note circulaire n° 003/CAB/MIN/PL.SMRM/COFAF/2013 du 24 janvier 2013, section B.I ; loi n° 004/2001, art. 39.",
        validiteMois: null,
        pieces: [
            { cle: 'requete', libelle: 'Requête au Ministre du Plan, signée par le promoteur ou son délégué mandaté' },
            { cle: 'statuts', libelle: 'Statuts notariés (1 exemplaire)' },
            { cle: 'personnaliteJuridique', libelle: "Ordonnance, décret ou arrêté d'octroi de la personnalité juridique" },
            { cle: 'listeBiens', libelle: "Liste QUANTIFIÉE des biens à importer, en relation avec l'objet de l'ONG" },
            { cle: 'attestationDon', libelle: "Attestation de don ou factures d'achat" },
            { cle: 'lettreTransport', libelle: 'Lettre de transport (BL ou LTA) pour les biens importés' },
            { cle: 'projetUtilisation', libelle: "Projet d'utilisation des biens à exonérer" },
            { cle: 'certificatEnregistrement', libelle: "Certificat d'enregistrement en cours de validité (Ministère du Plan)" },
            { cle: 'numeroImpot', libelle: 'Numéro Impôt' },
            { cle: 'avisMinistereSectoriel', libelle: "Avis du Ministère ayant le secteur d'activités dans ses attributions" },
            { cle: 'rapportAnnuel', libelle: "Rapport annuel d'activités le plus récent" },
            {
                cle: 'autorisationSante',
                libelle: "Autorisation d'importation du Ministère de la Santé",
                conditionnelle: 'Produits pharmaceutiques uniquement',
            },
            {
                cle: 'accordCadre',
                libelle: 'Accord-cadre conclu avec le Ministère du Plan',
                conditionnelle: 'ONG internationales uniquement',
            },
        ],
    },
    {
        type: 'PREVISIONNEL',
        libelle: 'Arrêté interministériel prévisionnel',
        objet: "Exonération à validité prévisionnelle, pour un flux d'importations RÉCURRENT lié à l'objet de l'ONG. " +
            'Valable deux ans, renouvelable.',
        baseLegale: "Note circulaire n° 003/CAB/MIN/PL.SMRM/COFAF/2013, section B.II ; loi n° 004/2001, art. 39.",
        validiteMois: 24,
        pieces: [
            { cle: 'requete', libelle: 'Requête au Ministre du Plan, signée par le promoteur ou son délégué mandaté' },
            { cle: 'statuts', libelle: 'Statuts notariés (1 exemplaire)' },
            { cle: 'personnaliteJuridique', libelle: "Ordonnance, décret ou arrêté d'octroi de la personnalité juridique" },
            { cle: 'listeBiens', libelle: "Liste QUANTIFIÉE des biens à importer, en relation avec l'objet de l'ONG" },
            { cle: 'attestationDon', libelle: "Attestation de don ou factures d'achat" },
            { cle: 'lettreTransport', libelle: 'Lettre de transport (BL ou LTA) pour les biens importés' },
            { cle: 'projetUtilisation', libelle: "Projet d'utilisation des biens à exonérer" },
            { cle: 'certificatEnregistrement', libelle: "Certificat d'enregistrement en cours de validité (Ministère du Plan)" },
            {
                cle: 'rapportAnnuel',
                libelle: "Rapport annuel d'activités le plus récent",
                conditionnelle: 'ONG déjà opérationnelle uniquement',
            },
            {
                cle: 'accordCadre',
                libelle: 'Accord-cadre conclu avec le Ministère du Plan',
                conditionnelle: 'ONG internationales uniquement',
            },
            {
                cle: 'rapportCommissionAdHoc',
                libelle: "Rapport d'évaluation de la Commission ad hoc sur les activités de l'ONG sur le terrain (impact sur les " +
                    'communautés locales)',
            },
        ],
    },
    {
        type: 'RENOUVELLEMENT',
        libelle: "Renouvellement de l'arrêté prévisionnel",
        objet: "Reconduction d'un arrêté prévisionnel arrivé à échéance. Le dossier est court : quatre pièces seulement, " +
            "mais il doit être déposé AVANT l'expiration · un arrêté périmé se découvre d'ordinaire au port.",
        baseLegale: "Note circulaire n° 003/CAB/MIN/PL.SMRM/COFAF/2013, section B.III.",
        validiteMois: 24,
        pieces: [
            { cle: 'requete', libelle: 'Requête au Ministre du Plan, signée par le promoteur ou son délégué mandaté' },
            { cle: 'ancienArrete', libelle: "Copie de l'ancien arrêté d'exonération" },
            { cle: 'rapportTerrain', libelle: "Rapport d'évaluation sur terrain" },
            { cle: 'listeBiens', libelle: "Liste QUANTIFIÉE des biens à importer, en relation avec l'objet de l'ONG" },
        ],
    },
];
exports.FRANCHISES_DOUANIERES_EBNL = [
    {
        lettre: 'e',
        libelle: 'Dons distribués gratuitement par un organisme charitable agréé',
        texte: 'Denrées alimentaires, médicaments, vêtements et couvertures constituant des dons adressés à des organismes ' +
            'charitables ou philanthropiques AGRÉÉS, destinés à être distribués gratuitement par ces organismes ou sous ' +
            'leur contrôle à des personnes nécessiteuses.',
    },
    {
        lettre: 'h',
        libelle: "Matériels et articles destinés à la recherche ou à l'éducation",
        texte: "Matériels et articles destinés à la recherche et/ou à l'éducation.",
    },
    {
        lettre: 'i',
        libelle: "Objets religieux destinés à l'exercice du culte",
        texte: "Objets religieux destinés à être utilisés dans l'exercice du culte.",
    },
    {
        lettre: 'l',
        libelle: "Dons ou matériels fournis gratuitement à l'État ou à une entité territoriale",
        texte: "Dons ou matériels fournis gratuitement à la République Démocratique du Congo et aux entités territoriales " +
            'dotées de la personnalité juridique.',
    },
    {
        lettre: 'm',
        libelle: 'Marchandises importées dans le cadre de la coopération bilatérale ou multilatérale',
        texte: 'Marchandises importées dans le cadre des projets de coopération bilatérale ou multilatérale.',
    },
];
exports.JOURS_ALERTE_RENOUVELLEMENT = 60;
exports.AVERTISSEMENT_FRANCHISE = "Aucune franchise ne se présume : « Il ne peut être accordé de franchise des droits et taxes qu'en application " +
    'des conventions internationales ou que par la loi ou en vertu de celle-ci » (code des douanes, ordonnance-loi ' +
    "n° 10/002, art. 338). Un arrêté interministériel du Plan et des Finances est le titre ; sans lui, les droits sont " +
    'dus, et la marchandise reste au port.';
//# sourceMappingURL=correspondance-exonerations.js.map