"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTREPARTIES_SANS_TRESORERIE = exports.COMPTES_A_CONTREPARTIE_INTERNE = exports.COMPTES_SANS_TRESORERIE = exports.ORDRE_AFFICHAGE_FLUX = exports.TOTAUX_FLUX = exports.TOUS_LES_POSTES_FLUX = exports.POSTES_FONDS_ETRANGERS = exports.POSTES_FONDS_PROPRES = exports.POSTES_INVESTISSEMENT = exports.POSTES_OPERATIONNELS = void 0;
exports.trouvePosteFlux = trouvePosteFlux;
exports.POSTES_OPERATIONNELS = [
    {
        ref: 'FA',
        libelle: 'Encaissement des cotisations',
        sens: 'ENCAISSEMENT',
        lectureFlux: 'NET_PRODUIT',
        comptesFlux: ['701'],
        comptesContrepartie: ['411', '4131', '4133', '4161', '4181', '4191'],
        note: "Exemple chiffré donné par le texte officiel (Partie 4, ch. 1 § 4) : « Cotisations des adhérents " +
            "encaissées en N = Cotisations des adhérents de l'exercice N + Créances adhérents de N-1 - Créances " +
            'adhérents de N ».',
    },
    {
        ref: 'FB',
        libelle: "Encaissement des subventions d'exploitation et d'équilibre",
        sens: 'ENCAISSEMENT',
        lectureFlux: 'NET_PRODUIT',
        comptesFlux: ['71', '88'],
        comptesContrepartie: ['4732', '4733'],
    },
    {
        ref: 'FC',
        libelle: 'Encaissement des revenus liés à la générosité',
        sens: 'ENCAISSEMENT',
        lectureFlux: 'NET_PRODUIT',
        comptesFlux: ['704'],
        comptesContrepartie: ['475'],
    },
    {
        ref: 'FD',
        libelle: 'Encaissement des revenus des manifestations',
        sens: 'ENCAISSEMENT',
        lectureFlux: 'NET_PRODUIT',
        comptesFlux: ['706'],
    },
    {
        ref: 'FE',
        libelle: 'Encaissement des autres revenus',
        sens: 'ENCAISSEMENT',
        lectureFlux: 'NET_PRODUIT',
        comptesFlux: ['702', '705', '707', '708', '75', '77'],
        exclusionsFlux: ['754', '7583', '759'],
        comptesContrepartie: ['412', '4132', '4138', '4162', '4182', '4192', '4194', '4198'],
    },
    {
        ref: 'FF',
        libelle: 'Décaissement des sommes versées aux fournisseurs',
        sens: 'DECAISSEMENT',
        lectureFlux: 'NET_CHARGE',
        comptesFlux: ['60', '61', '62', '63'],
        exclusionsFlux: ['603'],
        comptesContrepartie: ['40'],
        note: "Renvoi (1) du modèle officiel : « à l'exclusion des fournisseurs d'investissements » (compte 481, poste FI).",
    },
    {
        ref: 'FG',
        libelle: 'Décaissement des sommes versées au personnel',
        sens: 'DECAISSEMENT',
        lectureFlux: 'NET_CHARGE',
        comptesFlux: ['66'],
        comptesContrepartie: ['42', '43'],
    },
    {
        ref: 'FH',
        libelle: 'Autres décaissements',
        sens: 'DECAISSEMENT',
        lectureFlux: 'NET_CHARGE',
        comptesFlux: ['64', '65', '67'],
        exclusionsFlux: ['654', '659', '679'],
        comptesContrepartie: ['44', '47'],
        exclusionsContrepartie: ['4491', '472', '473', '475', '478', '479', '4713'],
    },
];
exports.POSTES_INVESTISSEMENT = [
    {
        ref: 'FI',
        libelle: "Décaissements liés aux acquisitions d'immobilisations incorporelles et corporelles",
        sens: 'DECAISSEMENT',
        lectureFlux: 'DEBIT_SEUL',
        comptesFlux: ['21', '22', '23', '24', '25'],
        comptesContrepartie: ['481'],
        reevaluationARetrancher: "Réévaluation des immobilisations passée par le module (AUDCIF Titre VIII ch. 28 § 4.2.4.1 et § 4.3.1 · D 2 / " +
            'C 28 / C 106 ou 154) · substitution d\'une valeur réévaluée à la valeur nette, sans trésorerie. Le SYCEBNL ' +
            "(Partie 4 ch. 1, section 4) ne range ici que les « décaissements et encaissements liés aux opérations " +
            "d'acquisitions et de cessions » et ne nomme pas la réévaluation ; le tableau de l'AUDCIF, lu par analogie, " +
            "l'écrit · « les variations d'immobilisations qui n'ont pas généré un flux de trésorerie ne figurent pas » et « – Écart et " +
            "provision spéciale de réévaluation de l'exercice de réévaluation uniquement » (Titre IX ch. 5 § 1.3).",
        coutsEmpruntARetrancher: "Coûts d'emprunt incorporés par le module (AUDCIF Titre VIII ch. 7 ; SYCEBNL, fiches des COMPTES 67 et 72 · " +
            "« transférés au débit du compte d'immobilisation concerné par le crédit du compte 787 ») · l'intérêt est " +
            "décaissé au 671, son transfert au coût du bien n'est pas une acquisition décaissée.",
        misesEnServiceARetrancher: "Mise en service d'un bien inscrit en cours (fiches des COMPTES 21 à 24 ; 219 et 229 offerts par décision " +
            'de Manasse du 2026-10-01) · virement de poste à poste, sans trésorerie, dont le paiement a déjà été lu au ' +
            "débit de l'en-cours.",
        creditsARetrancher: [
            {
                comptes: ['239', '249'],
                fondement: "Fiches des COMPTES 23 et 24 : après achèvement, les en-cours « seront portés au débit des comptes 231 à 238 par le crédit du compte 239 » ; le 24 est débité « du compte 249 – Matériel en cours, lorsqu'ils ont été achevés ». Le paiement de l'en-cours a déjà été lu au débit du 239 ou du 249.",
            },
            {
                comptes: ['25'],
                fondement: "Fiche du COMPTE 25 : « est crédité le compte 25 pour solde à la réception de la facture définitive […] par le débit du compte d'immobilisation concerné ». Le versement de l'avance a déjà été lu au débit du 25.",
            },
            {
                comptes: ['721', '722'],
                fondement: "Fiche du COMPTE 72 : « est crédité le compte 72 […] par le débit : du compte 21 […] du compte 23 […] ou 24 ». Les charges de production ont déjà été lues en FF, FG et FH. Le Guide neutralise côté charges ; la balance ne ventilant pas le 72 par nature, la neutralisation se fait ici, par choix de lecture.",
            },
        ],
    },
    {
        ref: 'FJ',
        libelle: "Décaissements liés aux acquisitions d'immobilisations financières",
        sens: 'DECAISSEMENT',
        lectureFlux: 'DEBIT_SEUL',
        comptesFlux: ['26', '27'],
        reevaluationARetrancher: "Réévaluation des immobilisations passée par le module (AUDCIF Titre VIII ch. 28 § 4.2.4.1 et § 4.3.1 · D 2 / " +
            'C 28 / C 106 ou 154) · substitution d\'une valeur réévaluée à la valeur nette, sans trésorerie. Le SYCEBNL ' +
            "(Partie 4 ch. 1, section 4) ne range ici que les « décaissements et encaissements liés aux opérations " +
            "d'acquisitions et de cessions » et ne nomme pas la réévaluation ; le tableau de l'AUDCIF, lu par analogie, " +
            "l'écrit · « les variations d'immobilisations qui n'ont pas généré un flux de trésorerie ne figurent pas » et « – Écart et " +
            "provision spéciale de réévaluation de l'exercice de réévaluation uniquement » (Titre IX ch. 5 § 1.3).",
    },
    {
        ref: 'FK',
        libelle: "Encaissements liés aux cessions d'immobilisations incorporelles et corporelles",
        sens: 'ENCAISSEMENT',
        lectureFlux: 'NET_PRODUIT',
        comptesFlux: ['821', '822'],
        comptesContrepartie: ['4851', '4852', '4857', '4858'],
    },
    {
        ref: 'FL',
        libelle: "Encaissements liés aux cessions d'immobilisations financières",
        sens: 'ENCAISSEMENT',
        lectureFlux: 'NET_PRODUIT',
        comptesFlux: ['826'],
        comptesContrepartie: ['4856'],
    },
];
exports.POSTES_FONDS_PROPRES = [
    {
        ref: 'FM',
        libelle: 'Encaissement des dotations et autres fonds propres',
        sens: 'ENCAISSEMENT',
        lectureFlux: 'CREDIT_SEUL',
        comptesFlux: ['10', '16'],
        exclusionsFlux: ['106', '1049'],
        comptesContrepartie: ['45'],
        exclusionsContrepartie: ['4515', '4525', '4535', '4545', '4555', '457'],
    },
    {
        ref: 'FN',
        libelle: "Subventions d'investissement reçues",
        sens: 'ENCAISSEMENT',
        lectureFlux: 'CREDIT_SEUL',
        comptesFlux: ['14'],
        comptesContrepartie: ['4731'],
    },
    {
        ref: 'FO',
        libelle: 'Décaissement des dotations et autres fonds propres',
        sens: 'DECAISSEMENT',
        lectureFlux: 'DEBIT_SEUL',
        comptesFlux: ['10', '16'],
        exclusionsFlux: ['106', '1049', '1679'],
        creditsARetrancher: [
            {
                comptes: ['792'],
                fondement: "Fiche du COMPTE 79 : « est crédité le compte 792 · REPRISES DE FONDS AFFECTES ET PROVENANT DES DONS ET LEGS D'IMMOBILISATIONS […] par le débit : du compte 16 » ; fiche du COMPTE 16 : 165 repris par le 7925, 167 par le 7923.",
            },
        ],
    },
];
exports.POSTES_FONDS_ETRANGERS = [
    {
        ref: 'FP',
        libelle: 'Encaissement provenant des emprunts et des autres dettes financières',
        sens: 'ENCAISSEMENT',
        lectureFlux: 'CREDIT_SEUL',
        comptesFlux: ['18'],
        exclusionsFlux: ['186'],
    },
    {
        ref: 'FQ',
        libelle: 'Remboursements des emprunts et autres dettes financières',
        sens: 'DECAISSEMENT',
        lectureFlux: 'DEBIT_SEUL',
        comptesFlux: ['18'],
        exclusionsFlux: ['186'],
    },
];
exports.TOUS_LES_POSTES_FLUX = [
    ...exports.POSTES_OPERATIONNELS,
    ...exports.POSTES_INVESTISSEMENT,
    ...exports.POSTES_FONDS_PROPRES,
    ...exports.POSTES_FONDS_ETRANGERS,
];
exports.TOTAUX_FLUX = [
    {
        ref: 'ZB',
        libelle: 'Flux de trésorerie provenant des activités opérationnelles (somme FA à FH)',
        repere: 'B',
        deRefs: exports.POSTES_OPERATIONNELS.map((p) => p.ref),
    },
    {
        ref: 'ZC',
        libelle: "Flux de trésorerie provenant des activités d'investissement (somme FI à FL)",
        repere: 'C',
        deRefs: exports.POSTES_INVESTISSEMENT.map((p) => p.ref),
    },
    {
        ref: 'ZD',
        libelle: 'Flux de trésorerie provenant des fonds propres (somme FM à FO)',
        repere: 'D',
        deRefs: exports.POSTES_FONDS_PROPRES.map((p) => p.ref),
    },
    {
        ref: 'ZE',
        libelle: 'Trésorerie provenant des fonds étrangers (somme FP à FQ)',
        repere: 'E',
        deRefs: exports.POSTES_FONDS_ETRANGERS.map((p) => p.ref),
    },
    {
        ref: '',
        libelle: 'Flux de trésorerie provenant des activités de financement (D+E)',
        deRefs: ['ZD', 'ZE'],
    },
    {
        ref: 'ZF',
        libelle: 'VARIATION DE LA TRÉSORERIE NETTE DE LA PÉRIODE (B+C+D+E)',
        repere: 'G',
        deRefs: ['ZB', 'ZC', 'ZD', 'ZE'],
    },
];
exports.ORDRE_AFFICHAGE_FLUX = [
    { ref: 'ZA' },
    { section: 'Flux de trésorerie provenant des activités opérationnelles' },
    ...exports.POSTES_OPERATIONNELS.map((p) => ({ ref: p.ref })),
    { ref: 'ZB' },
    { section: "Flux de trésorerie provenant des activités d'investissements" },
    ...exports.POSTES_INVESTISSEMENT.map((p) => ({ ref: p.ref })),
    { ref: 'ZC' },
    { section: 'Flux de trésorerie provenant du financement par les fonds propres' },
    ...exports.POSTES_FONDS_PROPRES.map((p) => ({ ref: p.ref })),
    { ref: 'ZD' },
    { section: 'Trésorerie provenant du financement par les fonds étrangers' },
    ...exports.POSTES_FONDS_ETRANGERS.map((p) => ({ ref: p.ref })),
    { ref: 'ZE' },
    { ref: '' },
    { ref: 'ZF' },
    { ref: 'ZG' },
];
function trouvePosteFlux(ref) {
    return exports.TOUS_LES_POSTES_FLUX.find((p) => p.ref === ref);
}
exports.COMPTES_SANS_TRESORERIE = [
    {
        numero: '9',
        motif: "Classe 9 · contributions volontaires en nature (900 à 904 par le crédit des 910 à 914) et comptabilité analytique (92 à 99), « ne répond pas à la définition [...] d'un actif ou d'un passif » (Partie 2 ch. 1) · aucune trésorerie (cas chiffrés de la clôture, constat N5).",
    },
    { numero: '654', motif: 'Dons en nature courants reçus à distribuer (Partie 3 ch. 4 § 1.1) · aucune trésorerie.' },
    { numero: '754', motif: 'Dons en nature courants (7542 reçus à distribuer) · aucune trésorerie.' },
    { numero: '832', motif: 'Dons en nature H.A.O. reçus à distribuer (Partie 3 ch. 4 § 1.1) · aucune trésorerie.' },
    { numero: '8415', motif: 'Dons en nature H.A.O. à distribuer · aucune trésorerie.' },
    { numero: '7583', motif: 'Abandons de frais par les bénévoles (Partie 3 ch. 6 § 2) · renonciation, sans flux.' },
    { numero: '846', motif: "Abandons de créances obtenus · contrepartie non récurrente de la même renonciation." },
    { numero: '4713', motif: 'Créditeurs, dons en nature courants non consommés · écriture d’inventaire extournée (§ 1.2).' },
    { numero: '4881', motif: 'Créditeurs, dons en nature H.A.O. non consommés · même mécanique, hors activités ordinaires.' },
    { numero: '603', motif: 'Variations de stocks de biens achetés · écriture d’inventaire.' },
    { numero: '659', motif: 'Charges pour dépréciations et provisions à court terme · sans décaissement.' },
    { numero: '679', motif: 'Charges financières pour dépréciations et provisions · sans décaissement.' },
    { numero: '759', motif: 'Reprises de charges pour dépréciations et provisions · sans encaissement.' },
    { numero: '68', motif: 'Dotations aux amortissements · sans décaissement.' },
    { numero: '69', motif: 'Dotations aux provisions et dépréciations · sans décaissement.' },
    { numero: '78', motif: 'Transferts de charges · reclassement interne, sans flux.' },
    { numero: '79', motif: 'Reprises de provisions, dépréciations et subventions d’investissement · sans encaissement.' },
    { numero: '85', motif: 'Dotations H.A.O. · sans décaissement.' },
    { numero: '86', motif: 'Reprises H.A.O. · sans encaissement.' },
    { numero: '87', motif: 'Variations de stocks de dons en nature H.A.O. · écriture d’inventaire.' },
    { numero: '106', motif: 'Écarts de réévaluation · réévaluation comptable, sans encaissement.' },
    { numero: '478', motif: 'Écarts de conversion - actif · réévaluation, sans flux.' },
    { numero: '479', motif: 'Écarts de conversion - passif · réévaluation, sans flux.' },
    { numero: '81', motif: "Valeurs comptables des cessions d'immobilisations · la trésorerie est au 82 (poste FK)." },
    { numero: '28', motif: 'Amortissements · contrepartie du 68, sans flux.' },
    { numero: '29', motif: 'Dépréciations · contrepartie du 69, sans flux.' },
    { numero: '19', motif: 'Provisions pour risques et charges · dotation et reprise, sans flux.' },
    {
        numero: '703',
        motif: "Quote-part de dotation consomptible transférée · « couverture des charges de la période » (Partie 3 ch. 1), débitée au 1049 (fiche du COMPTE 10), sans trésorerie.",
    },
    {
        numero: '1049',
        motif: 'Dotation consomptible inscrite au compte de résultat · débitée par le crédit du 703 seul (fiche du COMPTE 10), sans trésorerie.',
    },
    { numero: '721', motif: 'Production immobilisée incorporelle · par le débit du 21 (fiche du COMPTE 72), retranchée de FI.' },
    { numero: '722', motif: 'Production immobilisée corporelle · par le débit du 23 ou du 24 (fiche du COMPTE 72), retranchée de FI.' },
    { numero: '73', motif: 'Variations des stocks de biens produits · écriture d’inventaire contre les stocks (fiche du COMPTE 73).' },
    { numero: '49', motif: 'Dépréciations et provisions à court terme des tiers · contrepartie des 659, 759, 839 et 849, sans flux.' },
    { numero: '839', motif: 'Charges pour dépréciations et provisions à court terme H.A.O. · pendant du 659, sans décaissement.' },
    { numero: '849', motif: 'Reprises de charges pour dépréciations et provisions à court terme H.A.O. · pendant du 759, sans encaissement.' },
];
exports.COMPTES_A_CONTREPARTIE_INTERNE = [
    {
        numero: '11',
        lecture: 'MOUVEMENT',
        motif: 'Réserves · « incorporation à la dotation » (fiche du COMPTE 10), lue en FM.',
    },
    {
        numero: '12',
        lecture: 'MOUVEMENT',
        motif: 'Report à nouveau · incorporation à la dotation (FM) ou absorption par elle (FO), fiche du COMPTE 10.',
    },
    {
        numero: '13',
        lecture: 'MOUVEMENT',
        motif: 'Résultat · 131 incorporé à la dotation (FM), 139 absorbé par elle (FO), fiche du COMPTE 10.',
    },
    {
        numero: '219',
        lecture: 'CREDIT',
        motif: 'Immobilisations incorporelles en cours · un crédit peut être un achèvement, lu en FI au débit du compte définitif.',
    },
    {
        numero: '229',
        lecture: 'CREDIT',
        motif: 'Aménagements de terrains en cours · un crédit peut être un achèvement, lu en FI au débit du compte définitif.',
    },
];
exports.CONTREPARTIES_SANS_TRESORERIE = [
    {
        numero: '4713',
        intitule: 'Créditeurs, dons en nature courants non consommés',
        fondement: "Partie 3 ch. 4 § 1.2 : « 7542 Dons en nature courants reçus à distribuer » au débit par « 4713 Créditeurs, dons en nature courants non consommés » au crédit. Écriture d'inventaire, extournée à l'ouverture suivante · sans trésorerie. Sa charge symétrique (654) est déjà exclue de FH.",
    },
    {
        numero: '4881',
        intitule: 'Créditeurs, dons en nature H.A.O. non consommés',
        fondement: "Partie 3 ch. 4 § 1.2, cas de non-récurrence : « 8415 » au débit par « 488 » au crédit. Même mécanique que le 4713, hors activités ordinaires.",
    },
];
//# sourceMappingURL=correspondance-tft.js.map