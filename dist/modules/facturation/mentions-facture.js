"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENTION_AUTORISATION_DEBITS = exports.EXCLUSION_DEDUCTION_ART_104 = exports.MENTIONS_ARTICLE_100 = exports.ENTREE_EN_VIGUEUR_DECRET_23_10 = exports.MENTIONS_DOCUMENT_EN_TENANT_LIEU = exports.MENTIONS_ARTICLE_26 = exports.OBLIGATION_DACCEPTATION = exports.HOMOLOGATION = exports.AMENDE_PAR_OMISSION = void 0;
exports.texteApplicable = texteApplicable;
exports.renvoiALaMention = renvoiALaMention;
exports.totauxFacture = totauxFacture;
exports.verifierMentions = verifierMentions;
exports.AMENDE_PAR_OMISSION = {
    personneMorale: 750_000,
    personnePhysique: 250_000,
    source: 'Loi de procédures fiscales, art. 97 bis (créé par l’O.-L. n° 13/005 du 23 février 2013)',
    reserve: 'Le texte sanctionne « par omission » sans définir si l’unité est le groupe de mentions du texte applicable ' +
        'à la pièce (décret n° 23/10, art. 26, ou décret n° 011/42, art. 100, avant le 3 mars 2023) ou chacun de ses ' +
        'éléments. Le montant total encouru ne se déduit donc pas du nombre de groupes manquants.',
};
exports.HOMOLOGATION = {
    omegaxHomologue: false,
    source: 'Décret n° 23/10 du 3 mars 2023, art. 3 (7°), 20, 21, 22 et 23',
    qualification: 'OmegaX est un « Système de Facturation d’Entreprise » au sens de l’art. 3, 7° du décret n° 23/10 : un logiciel ' +
        'permettant de gérer tout ou partie du processus de facturation.',
    procedure: 'Un SFE développé en propre ne peut être utilisé qu’après obtention d’une ATTESTATION DE CONFORMITÉ délivrée ' +
        'par l’Administration fiscale au terme de la procédure d’homologation (art. 22 et art. 3, 1°). Les modalités de ' +
        'cette procédure sont renvoyées à un arrêté du Ministre des Finances (art. 23), qui n’est dans aucune source lue.',
    consequence: 'Tant que cette attestation n’est pas obtenue, le document produit ici n’est PAS une facture normalisée : il vaut ' +
        '« document en tenant lieu », qui porte les mêmes mentions à l’exception du numéro du dispositif électronique ' +
        'fiscal et du code d’authentification (art. 26, dernier alinéa).',
    qualificationHypothetique: 'La catégorie « document tenant lieu de facture normalisée » est définie par un arrêté du Ministre des Finances ' +
        '(art. 25, dernière phrase), qui n’est dans aucune source lue. Ranger OmegaX dans cette catégorie, et en tirer ' +
        'la dispense des points k) et l), reste donc une HYPOTHÈSE à confirmer auprès de la DGI en même temps que ' +
        'l’homologation.',
};
exports.OBLIGATION_DACCEPTATION = {
    source: 'Décret n° 23/10 du 3 mars 2023, art. 25 et 27',
    mention: 'Les entreprises privées, les organisations non gouvernementales et les acteurs de la dépense publique ne ' +
        'doivent accepter que des factures normalisées de leurs fournisseurs éligibles (art. 27).',
    supportsDeDeduction: [
        {
            cas: 'de façon générale',
            support: 'une facture normalisée ou tout autre document en tenant lieu dûment délivré par un assujetti',
            tenuParOmegaX: true,
        },
        {
            cas: 'en cas d’importation',
            support: 'la déclaration de mise à la consommation délivrée par la douane',
            tenuParOmegaX: false,
        },
        {
            cas: 'en cas de livraison de biens ou de prestation de services à soi-même',
            support: 'une facture normalisée à soi-même',
            tenuParOmegaX: false,
        },
    ],
    reserveSupports: 'OmegaX ne tient ni déclaration de mise à la consommation, ni facture à soi-même. Une TVA déductible née de ces ' +
        'deux cas existe donc dans les comptes sans que son support propre soit dans le logiciel : l’état détaillé ne ' +
        'peut pas la justifier, et la pièce est à joindre à la main.',
};
const renseigne = (v) => typeof v === 'string' && v.trim().length > 0;
const nombreRenseigne = (v) => typeof v === 'number' && Number.isFinite(v);
exports.MENTIONS_ARTICLE_26 = [
    {
        cle: 'IDENTITE_VENDEUR',
        libelle: 'identité, adresse exacte et n° impôt du vendeur ou prestataire',
        presente: (f) => renseigne(f.emetteurNom) && renseigne(f.emetteurAdresse) && renseigne(f.emetteurNumeroImpot),
    },
    {
        cle: 'IDENTITE_CLIENT',
        libelle: 'identité, adresse exacte et n° impôt du client',
        presente: (f) => renseigne(f.contrepartieNom) && renseigne(f.contrepartieAdresse) && renseigne(f.contrepartieNumeroImpot),
    },
    {
        cle: 'DATE_ET_NUMERO',
        libelle: 'date et n° de série',
        presente: (f) => f.dateFacture instanceof Date && !Number.isNaN(f.dateFacture.getTime()) && renseigne(f.numeroSerie),
    },
    {
        cle: 'DESIGNATION_ET_QUANTITE',
        libelle: 'désignation et quantité',
        presente: (f) => f.lignes.length > 0 && f.lignes.every((l) => renseigne(l.designation) && nombreRenseigne(l.quantite)),
    },
    {
        cle: 'PRIX_UNITAIRE_ET_GLOBAL',
        libelle: 'prix unitaire et global par type de biens ou services (distinction sommes imposables / non imposables justifiées)',
        presente: (f) => f.lignes.length > 0 && f.lignes.every((l) => nombreRenseigne(l.prixUnitaire) && nombreRenseigne(l.montantHT)),
    },
    {
        cle: 'PRIX_HORS_TVA',
        libelle: 'prix hors TVA',
        presente: (f) => f.lignes.length > 0 && f.lignes.every((l) => nombreRenseigne(l.montantHT)),
    },
    {
        cle: 'TAUX_ET_MONTANT_TVA',
        libelle: 'taux et montant de TVA',
        presente: (f) => f.lignes.length > 0 &&
            f.lignes.filter((l) => l.imposable).every((l) => nombreRenseigne(l.tauxApplique) && nombreRenseigne(l.montantTva)),
    },
    {
        cle: 'MONTANT_NON_TAXABLE',
        libelle: 'montant non taxable',
        presente: (f) => f.lignes.length > 0 && f.lignes.every((l) => nombreRenseigne(l.montantHT)),
    },
    {
        cle: 'MONTANT_TTC',
        libelle: 'montant toutes taxes comprises',
        presente: (f) => f.lignes.length > 0 && f.lignes.every((l) => nombreRenseigne(l.montantHT) && nombreRenseigne(l.montantTva)),
    },
    {
        cle: 'AUTRES_IMPOTS_ET_TAXES',
        libelle: 'montant de tous autres impôts et taxes, le cas échéant',
        presente: (f) => nombreRenseigne(f.autresImpotsEtTaxes),
    },
    {
        cle: 'NUMERO_DISPOSITIF_ELECTRONIQUE',
        libelle: 'numéro d’identification du dispositif électronique fiscal utilisé pour la facturation',
        presente: () => false,
        exigeUnDispositifElectronique: true,
    },
    {
        cle: 'CODE_AUTHENTIFICATION_ET_QR',
        libelle: 'code d’authentification de la transaction par le dispositif électronique fiscal, et code QR',
        presente: () => false,
        exigeUnDispositifElectronique: true,
    },
];
exports.MENTIONS_DOCUMENT_EN_TENANT_LIEU = exports.MENTIONS_ARTICLE_26.filter((m) => !m.exigeUnDispositifElectronique);
exports.ENTREE_EN_VIGUEUR_DECRET_23_10 = new Date(Date.UTC(2023, 2, 3));
exports.MENTIONS_ARTICLE_100 = exports.MENTIONS_DOCUMENT_EN_TENANT_LIEU.filter((m) => m.cle !== 'AUTRES_IMPOTS_ET_TAXES');
exports.EXCLUSION_DEDUCTION_ART_104 = {
    article: 'décret n° 011/42, art. 104',
    citation: 'Les biens et services qui ne remplissent pas les conditions visées aux articles 95, 98 et 100 ci-dessus sont ' +
        'exclus du droit à déduction.',
    portee: "Une facture d'ACHAT à laquelle il manque une mention de l'article 100 n'ouvre pas droit à déduction · la " +
        "sanction ne se limite donc pas à l'amende de l'article 97 bis, elle atteint la taxe elle-même.",
};
function texteApplicable(dateFacture) {
    const anterieure = dateFacture instanceof Date &&
        !Number.isNaN(dateFacture.getTime()) &&
        dateFacture.getTime() < exports.ENTREE_EN_VIGUEUR_DECRET_23_10.getTime();
    return anterieure
        ? {
            mentions: exports.MENTIONS_ARTICLE_100,
            article: 'art. 100 du décret n° 011/42',
            numerotation: 'TIRETS',
            texte: 'Décret n° 011/42 du 22 novembre 2011, art. 100 · neuf groupes',
            source: 'Pièce antérieure au 3 mars 2023 : le décret n° 23/10 « entre en vigueur à la date de sa signature » ' +
                '(art. 29) et ne lui est pas opposable. L’ADRESSE EXACTE lui est réclamée TOUT AUTANT, aux deux tirets de ' +
                'l’article 100 ; seul le montant des autres impôts et taxes, dixième groupe ajouté par l’article 26 du ' +
                'décret n° 23/10, ne l’est pas. Et l’article 104 du même décret n° 011/42 EXCLUT DU DROIT À DÉDUCTION les ' +
                'biens et services dont la pièce ne remplit pas les conditions de l’article 100.',
        }
        : {
            mentions: exports.MENTIONS_DOCUMENT_EN_TENANT_LIEU,
            article: 'art. 26 du décret n° 23/10',
            numerotation: 'LETTRES',
            texte: 'Décret n° 23/10 du 3 mars 2023, art. 26 · dix groupes pour un document en tenant lieu',
            source: 'Le décret est entré en vigueur le 3 mars 2023, date de sa signature (art. 29).',
        };
}
const TIRETS = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième'];
function renvoiALaMention(dateFacture, cle) {
    const t = texteApplicable(dateFacture);
    const liste = t.numerotation === 'LETTRES' ? exports.MENTIONS_ARTICLE_26 : t.mentions;
    const rang = liste.findIndex((m) => m.cle === cle);
    if (rang < 0)
        throw new Error(`La mention ${cle} n'est pas écrite à l’${t.article}.`);
    return t.numerotation === 'LETTRES'
        ? `point ${'abcdefghijkl'[rang]}) de l’${t.article}`
        : `${TIRETS[rang]} tiret de l’${t.article}`;
}
function totauxFacture(f) {
    let montantHT = 0;
    let montantNonTaxable = 0;
    let montantTva = 0;
    for (const l of f.lignes) {
        const ht = l.montantHT ?? 0;
        montantHT += ht;
        if (!l.imposable)
            montantNonTaxable += ht;
        montantTva += l.montantTva ?? 0;
    }
    const montantAutresImpotsEtTaxes = f.autresImpotsEtTaxes ?? 0;
    return {
        montantHT,
        montantNonTaxable,
        montantImposable: montantHT - montantNonTaxable,
        montantTva,
        montantAutresImpotsEtTaxes,
        montantTTC: montantHT + montantTva + montantAutresImpotsEtTaxes,
    };
}
exports.MENTION_AUTORISATION_DEBITS = {
    texte: "Autorisation d'acquitter la TVA d'après les débits",
    article: "décret n° 011/42, art. 60",
    citation: 'La mention « Autorisation d\u2019acquitter la TVA d\u2019après les débits » doit figurer sur toutes les ' +
        'factures délivrées par le prestataire de services ou l\u2019entrepreneur de travaux publics ou de travaux ' +
        'immobiliers.',
    consequence: "L'article 61 du même décret fait de l'inscription au débit du compte du client l'exigibilité de la taxe, et " +
        "l'article 96 en fait naître le droit à déduction du CLIENT. Sans la mention, le client ne peut pas savoir " +
        "qu'il déduit dès la facture.",
    reserveSanction: "Le décret n° 011/42 n'énonce lui-même aucune sanction pour cette omission. OmegaX NE CHIFFRE AUCUNE AMENDE " +
        "ici, et ce silence n'est pas une dispense : l'article 97 bis de la loi de procédures fiscales frappe « TOUTE " +
        "omission d'une mention obligatoire constatée dans une facture ou un document en tenant lieu », sans désigner " +
        'le texte qui pose la mention, et la mention de l\u2019article 60 en est une · le décret écrit qu\u2019elle ' +
        '« DOIT figurer sur toutes les factures délivrées » par le prestataire autorisé. Le point n\u2019est pas ' +
        "tranché par les sources lues et appartient à l'appréciation de l'Administration : le chiffrer serait " +
        "l'inventer, le nier serait rassurer à tort.",
};
function verifierMentions(f, personneMorale, contexte = {}) {
    const applicable = texteApplicable(f.dateFacture);
    const manquantes = [];
    const presentes = [];
    for (const m of applicable.mentions) {
        if (m.presente(f))
            presentes.push(m.cle);
        else
            manquantes.push({ cle: m.cle, libelle: m.libelle });
    }
    const mentionDebitsExigee = contexte.sensVente === true && contexte.regimeExigibiliteTva === 'DEBITS';
    const mentionDebitsManquante = mentionDebitsExigee && !f.mentionTvaDebits;
    return {
        conforme: manquantes.length === 0 && !mentionDebitsManquante,
        mentionDebitsExigee,
        mentionDebitsManquante,
        mentionDebits: exports.MENTION_AUTORISATION_DEBITS,
        texteApplicable: applicable,
        manquantes,
        presentes,
        horsDePortee: exports.MENTIONS_ARTICLE_26.filter((m) => m.exigeUnDispositifElectronique).map((m) => ({
            cle: m.cle,
            libelle: m.libelle,
        })),
        amendeUnitaire: personneMorale ? exports.AMENDE_PAR_OMISSION.personneMorale : exports.AMENDE_PAR_OMISSION.personnePhysique,
        reserveAmende: exports.AMENDE_PAR_OMISSION.reserve,
        source: `${applicable.texte} · sanction : loi de procédures fiscales, art. 97 bis`,
    };
}
//# sourceMappingURL=mentions-facture.js.map