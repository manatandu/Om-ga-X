"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_ARTICLE_104 = exports.SANCTION_ARTICLE_103 = exports.RESERVE_MISE_EN_FORME = exports.SANCTION_ARTICLE_328 = exports.EXIGENCE_INALTERABILITE = exports.DECOMPTE_A_LA_RUPTURE = exports.ECARTS_2008_2018 = exports.MENTIONS_ARRETE_142_2018 = exports.REFERENCE_ARRETE_142_2018 = exports.TEXTE_ARTICLE_2_SECOND_DOUBLE = exports.DESTINATION_DES_DOUBLES = exports.FORMULES_DU_MODELE = exports.MENTIONS_MODELE_2008 = exports.MENTIONS_ARTICLE_25 = exports.ARRETE_DU_MODELE = exports.DOUBLES_DETACHABLES_MINIMUM = exports.RESERVE_CONTRADICTION_DE_SEUIL = exports.EFFECTIF_LIVRE_INSPIRE_ARRETE = exports.EFFECTIF_LIVRE_INSPIRE = void 0;
exports.livreDePaie = livreDePaie;
exports.EFFECTIF_LIVRE_INSPIRE = 25;
exports.EFFECTIF_LIVRE_INSPIRE_ARRETE = 10;
exports.RESERVE_CONTRADICTION_DE_SEUIL = "CONTRADICTION DE SEUIL · l'article 215, alinéa 3, du Code laisse le livre « inspiré du modèle » aux " +
    "employeurs de MOINS DE VINGT-CINQ travailleurs ; l'article 1er de l'arrêté n° 12/CAB.MIN/ETPS/042 du " +
    "8 août 2008 impose la conformité au modèle dès DIX travailleurs et ne laisse le livre inspiré qu'en " +
    "dessous de dix. Pour un effectif de dix à vingt-quatre, les deux textes disent le contraire. UN ARRÊTÉ NE " +
    "DÉROGE PAS À LA LOI, et l'article 215 n'a pas été modifié par la loi n° 16/010 du 15 juillet 2016 : OmegaX " +
    "retient VINGT-CINQ. Le seuil de l'arrêté reste à connaître, parce que c'est celui que l'inspection applique.";
exports.DOUBLES_DETACHABLES_MINIMUM = 2;
exports.ARRETE_DU_MODELE = {
    reference: "Arrêté ministériel n° 12/CAB.MIN/ETPS/042 du 8 août 2008",
    objet: "fixant le modèle de livre de paie et de décompte écrit de la rémunération",
    publie: "Journal officiel de la République Démocratique du Congo, première partie, 49ème année, n° 16, 15 août 2008",
    signataire: 'Marie Ange Lukiana Mufwankolo',
    viseParLeCodeDuTravail: ['article 103', 'article 214', 'article 215'],
    abroge: "Arrêté ministériel n° 17/67 du 3 octobre 1967",
    avisDuConseilNationalDuTravail: 'troisième session extraordinaire, 25 mars au 8 avril 2008',
    lu: true,
    pourquoi: "AU CORPUS DEPUIS LE 19/09/2026, texte intégral et annexe. OmegaX restitue donc ses trente-trois " +
        "énonciations et ses trois formules de total. Il ne certifie toujours pas la conformité AU MODÈLE ANNEXÉ, " +
        "qui est une mise en forme et non une liste · voir RESERVE_MISE_EN_FORME.",
};
exports.MENTIONS_ARTICLE_25 = [
    { rang: 1, libelle: 'nom du travailleur' },
    { rang: 2, libelle: 'emploi et catégorie professionnelle' },
    { rang: 3, libelle: "numéro d'immatriculation attribué par la Caisse" },
    { rang: 4, libelle: 'salaire horaire, journalier ou mensuel' },
    { rang: 5, libelle: "nombre d'heures ou de jours pour lesquels le salaire est payé" },
    {
        rang: 6,
        libelle: 'rémunération totale à payer pour la période à laquelle se rapporte le décompte',
    },
    { rang: 7, libelle: 'taux auxquels sont payées les heures supplémentaires effectuées' },
    { rang: 8, libelle: 'montant total à payer pour les heures supplémentaires' },
    {
        rang: 9,
        libelle: 'suppléments éventuellement payés pour le travail du dimanche et des jours fériés légaux',
    },
    { rang: 10, libelle: 'primes éventuelles' },
    {
        rang: 11,
        libelle: "arriérés de rémunération portés sous la rubrique divers et accompagnés le cas échéant, d'une note sous la rubrique observation",
    },
    { rang: 12, libelle: 'nombre de jours de congés payés' },
    { rang: 13, libelle: 'taux journalier des allocations de congé' },
    { rang: 14, libelle: 'total des allocations dues pour le congé' },
    {
        rang: 15,
        libelle: "nombre de jours pour lesquels le salaire est payé aux deux tiers en cas de maladie ou d'accident et de congé de maternité",
    },
    { rang: 16, libelle: "taux journalier de salaire en cas de maladie ou d'accident" },
    { rang: 17, libelle: "total du salaire pour les journées d'incapacité" },
    { rang: 18, libelle: 'total de la rémunération brute' },
    { rang: 19, libelle: 'cotisation retenue à charge du travailleur pour la pension' },
    { rang: 20, libelle: 'montant des indemnités compensatoires' },
    { rang: 21, libelle: "montant de l'avance hebdomadaire ou autre" },
    {
        rang: 22,
        libelle: 'déductions pour motifs divers accompagnés d’une note dans la rubrique fiscale',
    },
    { rang: 23, libelle: 'retenue fiscale' },
    { rang: 24, libelle: 'total des déductions' },
    { rang: 25, libelle: "nombre d'enfants pour lesquels les allocations familiales sont dues" },
    { rang: 26, libelle: 'nombre de jours donnant droit à des allocations familiales' },
    { rang: 27, libelle: 'taux journalier des allocations familiales' },
    { rang: 28, libelle: 'montant à payer' },
    { rang: 29, libelle: 'montant pris en considération pour le calcul des cotisations' },
    { rang: 30, libelle: 'observations' },
];
exports.MENTIONS_MODELE_2008 = [
    { rang: 1, libelle: "le numéro d'ordre du travailleur, s'il lui en est attribué un dans l'établissement ou l'entreprise" },
    { rang: 2, libelle: "les noms et prénoms du travailleur, en majuscules d'imprimerie" },
    { rang: 3, libelle: "l'emploi et la catégorie professionnelle" },
    { rang: 4, libelle: "le numéro d'affiliation à l'Institut National de Sécurité Sociale" },
    { rang: 5, libelle: 'le salaire horaire, journalier ou mensuel' },
    { rang: 6, libelle: "le nombre d'heures ou de jours pour lesquels le salaire est payé à 100 %" },
    { rang: 7, libelle: 'la rémunération totale à payer de ce chef pour la période à laquelle se rapporte le décompte' },
    { rang: 8, libelle: "le nombre d'heures supplémentaires prestées" },
    { rang: 9, libelle: 'les taux auxquels sont payées les heures supplémentaires' },
    { rang: 10, libelle: 'le montant total à payer pour les heures supplémentaires' },
    { rang: 11, libelle: 'les suppléments éventuellement payés pour le travail du samedi, du dimanche et des jours fériés légaux' },
    { rang: 12, libelle: 'les primes éventuelles' },
    { rang: 13, libelle: "les arriérés de rémunération, portés sous la rubrique « divers » et accompagnés, le cas échéant, d'une note sous la rubrique « observations »" },
    { rang: 14, libelle: 'le nombre de jours de congés payés' },
    { rang: 15, libelle: "le taux journalier de l'allocation de congé" },
    { rang: 16, libelle: "le total de l'allocation due pour le congé" },
    { rang: 17, libelle: "le nombre de jours pour lesquels le salaire est payé aux deux tiers en cas de maladie ou d'accident" },
    { rang: 18, libelle: "le taux journalier de salaire, en cas de maladie ou d'accident" },
    { rang: 19, libelle: "le total du salaire pour les journées d'incapacité" },
    { rang: 20, libelle: "le total de la rémunération brute, c'est-à-dire, le total des mentions visées ci-dessus sous les numéros 7, 10, 11, 12, 13, 16 et 19" },
    { rang: 21, libelle: 'la cotisation retenue à charge du travailleur pour la pension' },
    { rang: 22, libelle: 'le montant des indemnités compensatrices' },
    { rang: 23, libelle: "le montant des avances hebdomadaires ou autres" },
    { rang: 24, libelle: "les déductions pour motifs divers, accompagnés d'une note dans la rubrique « observations »" },
    { rang: 25, libelle: 'la retenue fiscale' },
    { rang: 26, libelle: "le total des déductions, c'est-à-dire, le total des montants visés sous les numéros 21, 22, 23, 24 et 25 ci-dessus" },
    { rang: 27, libelle: "le nombre d'enfants pour lesquels les allocations familiales sont dues" },
    { rang: 28, libelle: "le nombre de jours donnant droit à des allocations familiales, c'est-à-dire, le total des nombres visés ci-dessus sous les numéros 6, 14 et 17" },
    { rang: 29, libelle: 'le taux journalier des allocations familiales' },
    { rang: 30, libelle: 'le montant total des allocations familiales à payer' },
    { rang: 31, libelle: 'le montant net à payer' },
    { rang: 32, libelle: 'le montant pris en considération pour le calcul des cotisations de sécurité sociale à payer' },
    { rang: 33, libelle: 'les observations' },
];
exports.FORMULES_DU_MODELE = {
    brut: { rang: 20, composantes: [7, 10, 11, 12, 13, 16, 19] },
    totalDesDeductions: { rang: 26, composantes: [21, 22, 23, 24, 25] },
    joursDAllocationsFamiliales: { rang: 28, composantes: [6, 14, 17] },
};
exports.DESTINATION_DES_DOUBLES = {
    premier: "au TRAVAILLEUR, à chaque paie · c'est le bulletin de paie écrit de la rémunération payée, « constitué par un des doubles du livre de paie prévus à l'article 214 du Code du Travail »",
    second: 'à la CNSS, selon la réglementation en vigueur',
};
exports.TEXTE_ARTICLE_2_SECOND_DOUBLE = "Arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, art. 2 : « Le second double est à remettre à l'Institut National de Sécurité Sociale, selon la réglementation en vigueur. » L'Institut est devenu la Caisse nationale de sécurité sociale par le décret n° 18/027 du 14 juillet 2018.";
exports.REFERENCE_ARRETE_142_2018 = "Arrêté ministériel n° 142/2018 déterminant les modalités d'application du mois d'assurance, art. 10 et 12";
exports.MENTIONS_ARRETE_142_2018 = [
    { rang: 1, libelle: "le matricule du travailleur, s'il lui en est attribué un dans l'établissement ou l'entreprise" },
    { rang: 2, libelle: 'le nom du travailleur' },
    { rang: 3, libelle: "l'emploi et la catégorie professionnelle" },
    { rang: 4, libelle: "le numéro d'immatriculation à la caisse de sécurité sociale" },
    { rang: 5, libelle: 'le salaire horaire, journalier ou mensuel' },
    { rang: 6, libelle: "le nombre d'heures ou de jours pour lesquels le salaire est payé à cent pour cent" },
    { rang: 7, libelle: 'la rémunération totale à payer de ce chef pour la période à laquelle se rapporte le décompte' },
    { rang: 8, libelle: "le nombre d'heures supplémentaires" },
    { rang: 9, libelle: 'les taux auxquels sont payées les heures supplémentaires' },
    { rang: 10, libelle: 'le montant total à payer pour les heures supplémentaires' },
    { rang: 11, libelle: 'les suppléments éventuellement payés pour le travail du dimanche et des jours fériés légaux' },
    { rang: 12, libelle: 'les primes éventuelles' },
    { rang: 13, libelle: "les arriérés de rémunération, portés sous la rubrique « divers » et accompagnés, le cas échéant, d'une note sous la rubrique « observation »" },
    { rang: 14, libelle: 'le nombre de jours de congé payés' },
    { rang: 15, libelle: "le taux journalier de l'allocation de congé" },
    { rang: 16, libelle: "le total de l'allocation due pour le congé en cas de maladie, d'accident et de congé de maternité" },
    { rang: 17, libelle: "le nombre de jours pour lesquels le salaire est payé aux deux tiers en cas de maladie, d'accident et de congé de maternité" },
    { rang: 18, libelle: "le taux journalier de salaire, en cas de maladie ou d'accident" },
    { rang: 19, libelle: "le total du salaire pour les journées d'incapacité" },
    { rang: 20, libelle: "le total de la rémunération brute, c'est-à-dire le total des mentions visées ci-dessus sous les numéros 7, 10, 11, 12, 13,16 et 19" },
    { rang: 21, libelle: 'la cotisation retenue à charge du travailleur pour la branche de pensions à la Caisse de sécurité sociale' },
    { rang: 22, libelle: 'le montant des indemnités compensatoires' },
    { rang: 23, libelle: 'le montant des avances hebdomadaires' },
    { rang: 24, libelle: 'les déductions pour motifs divers, accompagnées d’une note dans la rubrique fiscale' },
    { rang: 25, libelle: 'la retenue fiscale' },
    { rang: 26, libelle: "le total des déductions, c'est-à-dire le total des montants visés sous les numéros 21, 22, 23,24 et 25 ci-dessus" },
    { rang: 27, libelle: "le nombre d'enfants pour lesquels les allocations familiales extra-légales sont dues" },
    { rang: 28, libelle: "le nombre de jours donnant droit à des allocations familiales extra-légales, c'est-à-dire le total des nombres visés ci-dessus sous les numéros 6, 14 et 17" },
    { rang: 29, libelle: 'le taux journalier des allocations familiales extra-légales' },
    { rang: 30, libelle: 'le montant des allocations familiales extra-légales' },
    { rang: 31, libelle: 'le montant (net) à payer' },
    { rang: 32, libelle: 'le montant pris en considération pour le calcul des cotisations sociales' },
    { rang: 33, libelle: 'les observations' },
];
exports.ECARTS_2008_2018 = [
    { rangs: '4', ecart: "« caisse de sécurité sociale » en 2018, « Institut National de Sécurité Sociale » en 2008" },
    { rangs: '11', ecart: 'le samedi est nommé en 2008, pas en 2018' },
    { rangs: '16 et 17', ecart: 'le congé de maternité est ajouté en 2018' },
    { rangs: '24', ecart: 'la note va « dans la rubrique fiscale » en 2018, « observations » en 2008' },
    { rangs: '27 à 30', ecart: 'les allocations familiales sont dites « extra-légales » en 2018' },
];
exports.DECOMPTE_A_LA_RUPTURE = "ARTICLE 2, ALINÉA 3, DE L'ARRÊTÉ · « Lors de la résiliation du contrat de travail, POUR QUELQUE CAUSE QUE " +
    "CE SOIT, l'employeur doit remettre au travailleur un décompte écrit des payements effectués prévus à " +
    "l'article 103 du Code du Travail. » C'est une SECONDE échéance, qui s'ajoute au bulletin de chaque paie, et " +
    "que l'article 103 lu seul (« au moment du paiement ») ne laissait pas deviner. Elle joint le décompte final.";
exports.EXIGENCE_INALTERABILITE = "ARTICLE 4 DE L'ARRÊTÉ · « QUELLE QUE SOIT LA FORME ADOPTÉE, le livre de paie et le décompte écrit de la " +
    "rémunération payée sont rédigés à l'encre ou à l'aide d'un procédé permettant d'obtenir une ÉCRITURE " +
    "INDÉLÉBILE. » Pour le fichier informatisé de l'article 1er, cela devient une exigence d'INALTÉRABILITÉ du " +
    "support, et elle est de 2008.";
exports.SANCTION_ARTICLE_328 = "ARTICLE 328 a) DU CODE · pour les infractions à l'article 215, « l'amende est appliquée AUTANT DE FOIS " +
    "QU'IL Y A DE TRAVAILLEURS NON INSCRITS OU DE RENSEIGNEMENTS OMIS ». Une mention manquante se multiplie donc " +
    "par l'effectif, le total ne pouvant excéder cinquante fois le taux maximum. L'article 5 de l'arrêté vise " +
    "aussi « l'article 323 (9) », qui n'existe pas : l'article 323 énumère des cas a) à e). Anomalie du texte " +
    "officiel, signalée et non corrigée.";
exports.RESERVE_MISE_EN_FORME = "L'article 1er exige DEUX choses : les trente-trois énonciations, ET la conformité AU MODÈLE ANNEXÉ, qui est " +
    "une mise en forme. OmegaX vérifie les énonciations sur déclaration ; il ne sait pas vérifier qu'un document " +
    "a la forme du tableau annexé. La conformité au modèle n'est donc jamais certifiée ici.";
function livreDePaie(entree) {
    const refus = [];
    const reserves = [
        exports.RESERVE_MISE_EN_FORME,
        exports.RESERVE_CONTRADICTION_DE_SEUIL,
        exports.EXIGENCE_INALTERABILITE,
        exports.DECOMPTE_A_LA_RUPTURE,
        exports.SANCTION_ARTICLE_328,
    ];
    refus.push({
        motif: 'MISE_EN_FORME_NON_VERIFIABLE',
        explication: exports.RESERVE_MISE_EN_FORME,
    });
    const livreDu = !entree.exclusivementPersonnelDomestique;
    if (livreDu && !entree.siegeDExploitation) {
        refus.push({
            motif: 'SIEGE_DEXPLOITATION_NON_DESIGNE',
            explication: "ARTICLE 213 · le livre se tient « DANS CHACUN DES SIÈGES D'EXPLOITATION de l'entreprise ». Un seul " +
                "livre pour plusieurs sièges ne satisfait pas le texte, et OmegaX ne sait pas à quel siège rattacher " +
                "ce document tant que le siège n'est pas désigné.",
        });
    }
    const forme = entree.formeDuDocument ?? 'AUTRE_DOCUMENT';
    const formeAdmiseDOffice = forme === 'LIVRE_PAPIER' || forme === 'FICHIER_INFORMATISE';
    const autorisation = entree.autorisationInspecteurDuTravail === true;
    if (livreDu && !formeAdmiseDOffice && !autorisation) {
        refus.push({
            motif: 'AUTORISATION_INSPECTEUR_ABSENTE',
            explication: "ARTICLE 215 ALINÉA 2 · le remplacement du livre de paie par « TOUT AUTRE DOCUMENT » suppose que " +
                "« L'INSPECTEUR DU TRAVAIL PEUT AUTORISER » ce remplacement. L'autorisation est un ACTE à obtenir et à " +
                "conserver au dossier. ELLE N'EST PAS DUE POUR UN FICHIER INFORMATISÉ · l'article 1er de l'arrêté du " +
                "8 août 2008 vise « le livre de paie OU FICHIER INFORMATISÉ », qui est donc une forme du livre et non " +
                "un autre document. Déclarer la forme adoptée lève ce refus quand elle est l'une des deux.",
        });
    }
    const portees = new Set(entree.mentionsPortees ?? []);
    const mentionsManquantes = exports.MENTIONS_MODELE_2008.filter((m) => !portees.has(m.rang));
    const enonciationsCompletes = mentionsManquantes.length === 0;
    if (livreDu && !enonciationsCompletes) {
        refus.push({
            motif: 'ENONCIATIONS_INCOMPLETES',
            explication: `ARTICLE 1er DE L'ARRÊTÉ · ${mentionsManquantes.length} des ${exports.MENTIONS_MODELE_2008.length} ` +
                "énonciations ne sont pas portées, et la liste est FERMÉE (« il doit contenir les énonciations " +
                "ci-après »). " +
                exports.SANCTION_ARTICLE_328,
        });
    }
    return {
        livreDu,
        remplacementAutorise: livreDu && (formeAdmiseDOffice || autorisation),
        enonciationsCompletes,
        livreInspireAdmis: typeof entree.effectifHabituel === 'number' && entree.effectifHabituel < exports.EFFECTIF_LIVRE_INSPIRE,
        mentionsPorteesCount: exports.MENTIONS_MODELE_2008.length - mentionsManquantes.length,
        mentionsManquantes,
        conformiteAuModeleCertifiee: false,
        refus,
        reserves,
    };
}
exports.SANCTION_ARTICLE_103 = "ARTICLE 103 ALINÉA 2 · faute d'avoir remis au travailleur un décompte écrit AU MOMENT DU PAIEMENT, les " +
    "allégations de l'employeur sur les paiements effectués SONT REJETÉES. Trois échappatoires seulement : la " +
    "faute du travailleur rendant la remise impossible, une preuve écrite ou un commencement de preuve par " +
    "écrit, ou l'aveu du travailleur. Un paiement réel mais non décompté se plaide donc comme un non-paiement.";
exports.RESERVE_ARTICLE_104 = "ARTICLE 104 · l'acceptation sans réserve du décompte, la signature du travailleur et la mention « pour " +
    "solde de tout compte » NE VALENT PAS renonciation à ses droits, ni compte arrêté et réglé au sens de " +
    "l'article 317. Un décompte signé ne clôt rien.";
//# sourceMappingURL=livre-de-paie.js.map