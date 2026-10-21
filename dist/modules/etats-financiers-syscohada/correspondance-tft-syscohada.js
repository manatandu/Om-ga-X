"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTES_EXCLUS_SANS_REPRISE = exports.COMPTES_TFT_NON_VENTILES_JUSTIFIES = exports.COMPTES_SANS_TRESORERIE_SYSCOHADA = exports.ORDRE_AFFICHAGE_FLUX_SYSCOHADA = exports.CONTROLE_ZH_PAR_LE_BILAN = exports.CONTROLE_ZH_PAR_LES_FLUX = exports.TOTAUX_FLUX_SYSCOHADA = exports.TOUS_LES_POSTES_FLUX_SYSCOHADA = exports.POSTES_CAPITAUX_ETRANGERS_SYSCOHADA = exports.POSTES_CAPITAUX_PROPRES_SYSCOHADA = exports.POSTES_INVESTISSEMENT_SYSCOHADA = exports.POSTES_OPERATIONNELS_SYSCOHADA = exports.POSTE_TRESORERIE_OUVERTURE_SYSCOHADA = exports.RENVOI_1_TFT_SYSCOHADA = void 0;
exports.trouvePosteFluxSyscohada = trouvePosteFluxSyscohada;
exports.trouveTotalFluxSyscohada = trouveTotalFluxSyscohada;
exports.besoinsDuPoste = besoinsDuPoste;
exports.signeConformeAuModeleFlux = signeConformeAuModeleFlux;
exports.postesLisantEnMouvement = postesLisantEnMouvement;
exports.comptesCitesParLeTftSyscohada = comptesCitesParLeTftSyscohada;
function poste(signe, etat, ref, lecture, motif, colonne) {
    return { signe, poste: colonne ? { etat, ref, lecture, colonne } : { etat, ref, lecture }, motif };
}
function gestion(signe, prefixes, motif, exclusions) {
    return { signe, comptes: exclusions ? { prefixes, exclusions, lecture: 'SOLDE_GESTION' } : { prefixes, lecture: 'SOLDE_GESTION' }, motif };
}
function debit(signe, prefixes, motif, exclusions) {
    return { signe, comptes: exclusions ? { prefixes, exclusions, lecture: 'MOUVEMENT_DEBIT' } : { prefixes, lecture: 'MOUVEMENT_DEBIT' }, motif };
}
function credit(signe, prefixes, motif, exclusions) {
    return { signe, comptes: exclusions ? { prefixes, exclusions, lecture: 'MOUVEMENT_CREDIT' } : { prefixes, lecture: 'MOUVEMENT_CREDIT' }, motif };
}
function reevaluationLiee(signe, lecture, prefixes, motif, exclusions) {
    return { signe, comptes: { prefixes, ...(exclusions ? { exclusions } : {}), lecture, liaison: 'REEVALUATION' }, motif };
}
const MOTIF_REEVALUATION_LIEE = "Écriture de réévaluation du module (Titre VIII ch. 28 § 4.2.4.1 et § 4.3.1), reconnue par sa liaison · sans " +
    "trésorerie, « – Écart et provision spéciale de réévaluation de l'exercice de réévaluation uniquement » (ch. 5 " +
    "§ 1.3), relue ici en sens inverse pour que sa contribution au poste soit nulle (anomalies n° 11 et 21).";
function variation(signe, prefixes, sensSolde, motif, exclusions) {
    return {
        signe,
        comptes: exclusions ? { prefixes, exclusions, lecture: 'VARIATION_SOLDE', sensSolde } : { prefixes, lecture: 'VARIATION_SOLDE', sensSolde },
        motif,
    };
}
exports.RENVOI_1_TFT_SYSCOHADA = "À l'exclusion des variations des créances et dettes liées aux activités d'investissement (variation des créances " +
    "sur cession d'immobilisation et des dettes sur acquisition ou production d'immobilisation) et de financement " +
    "(par exemple variation des créances sur subventions d'investissements reçues).";
exports.POSTE_TRESORERIE_OUVERTURE_SYSCOHADA = {
    ref: 'ZA',
    libelle: 'Trésorerie nette au 1er janvier (Trésorerie actif N-1 – Trésorerie passif N-1)',
    section: 'OUVERTURE',
    signeModele: '',
    signeAttendu: 'LIBRE',
    termes: [
        poste(1, 'BILAN', 'BT', 'N1', 'Trésorerie actif N-1 · total BT du bilan (BQ + BR + BS, nets).', 'NET'),
        poste(-1, 'BILAN', 'DT', 'N1', 'Trésorerie passif N-1 · total DT du bilan (DQ + DR).'),
    ],
};
exports.POSTES_OPERATIONNELS_SYSCOHADA = [
    {
        ref: 'FA',
        libelle: "Capacité d'Autofinancement Globale (CAFG)",
        section: 'OPERATIONNEL',
        signeModele: '',
        signeAttendu: 'LIBRE',
        termes: [
            poste(1, 'COMPTE_RESULTAT', 'XD', 'N', "Excédent brut d'exploitation · « le point d'entrée est l'EBE, jamais le résultat net » (ch. 5 § 1.2.1)."),
            poste(1, 'COMPTE_RESULTAT', 'RQP', 'N', 'Quote-part de résultat sur opérations faites en commun, charges (652) · ch. 33 § 7.2.'),
            poste(1, 'COMPTE_RESULTAT', 'TQP', 'N', 'Quote-part de résultat sur opérations faites en commun, produits (752) · ch. 33 § 7.2.'),
            gestion(-1, ['654'], '« + Valeurs comptables des cessions courantes d\'immobilisation (compte 654) » · charge retirée de l\'EBE (RJ), donc + VNC ; la cession courante est un flux d\'investissement (FF/FG).'),
            gestion(-1, ['754'], '« – Produits des cessions courantes d\'immobilisation (compte 754) » · produit retiré de l\'EBE (TH) ; le prix encaissé est en FI.'),
            poste(1, 'COMPTE_RESULTAT', 'XF', 'N', 'Résultat financier · revenus financiers, gains de change, transferts de charges financières, frais financiers, pertes de change (TK, TM, RM).'),
            gestion(-1, ['797'], 'Reprises de provisions et dépréciations financières (TL) retirées de XF · sans encaissement.'),
            gestion(-1, ['697'], 'Dotations aux provisions et dépréciations financières (RN) retirées de XF · sans décaissement.'),
            poste(1, 'COMPTE_RESULTAT', 'TO', 'N', 'Autres produits HAO · « + Produits HAO + Transferts de charges HAO » (84 dont 848, 88).'),
            gestion(-1, ['86'], 'Reprises HAO retirées de TO · sans encaissement (Titre VII COMPTE 86 : reprises par débit de 15, 19, 29).'),
            poste(1, 'COMPTE_RESULTAT', 'RP', 'N', 'Autres charges HAO (83, 85) · [texte officiel] AUCUNE ligne « – Charges HAO » dans la formule énumérée du ' +
                "ch. 5 § 1.2.1.1 ni dans la maquette de la NOTE 34 ; terme fondé sur la définition générale « – Charges " +
                'décaissables restantes » du § 1.2.1, et sur le praticien (« − RP sauf 85 ») · anomalie n° 19.'),
            gestion(-1, ['85'], 'Dotations HAO retirées de RP · sans décaissement (Titre VII COMPTE 85 : par crédit de 15, 19, 28, 29).'),
            poste(1, 'COMPTE_RESULTAT', 'RQ', 'N', '« – Participation » · participation des travailleurs (87), déjà négative dans la convention du compte de résultat.'),
            poste(1, 'COMPTE_RESULTAT', 'RS', 'N', '« – Impôt sur les résultats » (89), déjà négatif.'),
        ],
        note: "CAFG = EBE + 654 − 754 (= CAF d'exploitation) + revenus financiers + gains de change + transferts de charges " +
            'financières + produits HAO + transferts de charges HAO − frais financiers − pertes de change − participation − ' +
            "impôt (ch. 5 § 1.2.1.1). Les cessions HAO (81/82) n'y entrent pas : elles relèvent de FF à FJ. " +
            "[texte officiel] Cette formule énumérée, identique dans la NOTE 34, ne comporte AUCUNE ligne « – Charges HAO » " +
            'alors que sa définition générale retranche les « charges décaissables restantes » : le poste 83 est donc ' +
            'retranché ici (par RP, dont le 85 sans décaissement est retiré), écart assumé et signalé, anomalie n° 19.',
    },
    {
        ref: 'FB',
        libelle: 'Actif circulant HAO',
        section: 'OPERATIONNEL',
        signeModele: '-',
        signeAttendu: 'LIBRE',
        renvoi: '(1)',
        termes: [
            poste(-1, 'BILAN', 'BA', 'VARIATION', "Variation de l'actif circulant HAO, poste BA net · une hausse pèse en négatif (renvoi (a) du ch. 5).", 'NET'),
            variation(1, ['485'], 'DEBITEUR', "Créances sur cessions d'immobilisations retirées de BA · renvoi (1) : elles vont en FI."),
        ],
        nonDeterminables: [
            {
                comptes: ['4781', '4791'],
                motif: "Part HAO des écarts de conversion sur créances (le praticien cite 47818/47918, absents du plan semé) · non séparable à 4 chiffres, prise en FD (anomalie n° 6).",
            },
        ],
    },
    {
        ref: 'FC',
        libelle: 'Variation des stocks',
        section: 'OPERATIONNEL',
        signeModele: '-',
        signeAttendu: 'LIBRE',
        termes: [poste(-1, 'BILAN', 'BB', 'VARIATION', 'Variation des stocks et encours, poste BB net · renvoi (a) : « si les stocks augmentent, la variation est négative ».', 'NET')],
    },
    {
        ref: 'FD',
        libelle: 'Variation des créances',
        section: 'OPERATIONNEL',
        signeModele: '-',
        signeAttendu: 'LIBRE',
        termes: [
            poste(-1, 'BILAN', 'BG', 'VARIATION', 'Variation des créances et emplois assimilés, total BG net (BH + BI + BJ).', 'NET'),
            variation(1, ['414'], 'DEBITEUR', "Créances sur cessions courantes d'immobilisations · renvoi (1), lues en FI."),
            variation(1, ['4493', '458'], 'DEBITEUR', 'Fonds de dotation et subventions à recevoir (4493, 4581, 4582) · financement, lus en FK et FL.'),
            variation(1, ['4494'], 'DEBITEUR', "Subventions d'investissement à recevoir · exemple même du renvoi (1), lues en FL."),
            variation(1, ['461', '467'], 'DEBITEUR', '« variation des apporteurs sur le capital » et « restant dû sur capital appelé » (ch. 5 (1)) · lues en FK.'),
            variation(1, ['4751'], 'DEBITEUR', 'Compte transitoire actif de la révision SYSCOHADA · sans flux (Titre VII COMPTE 47).'),
            variation(1, ['4713'], 'DEBITEUR', 'Obligataires, souscrit non encore libéré · le 4713 débiteur loge en BJ (ch. 7) donc dans BG, et FO le ' +
                'retranche déjà du crédit 161 : sans ce retrait il serait compté deux fois. Renvoi (1) du § 1.2.1.3, ' +
                '« dettes et créances rattachées aux opérations de financement » · anomalie n° 5.'),
            variation(-1, ['276'], 'DEBITEUR', "« intérêts courus des immobilisations financières » · le ch. 5 les range ici, hors AS (anomalie n° 4)."),
            variation(-1, ['4781'], 'DEBITEUR', "Écart de conversion actif, diminution des créances d'exploitation · réévaluation sans flux qui a réduit BG (anomalie n° 6)."),
            variation(1, ['4791'], 'CREDITEUR', "Écart de conversion passif, augmentation des créances d'exploitation · a gonflé BG sans flux."),
        ],
        nonDeterminables: [
            {
                comptes: ['4721'],
                motif: 'Créance sur cession de titres de PLACEMENT (Titre VII COMPTE 47) · le titre de placement est de la ' +
                    "trésorerie (BQ, compte 50) et non une immobilisation financière : la créance reste en FD, aucun poste " +
                    "d'investissement ne la réclame. La créance sur cession d'immobilisation financière, elle, loge en 485 " +
                    'et est lue par FI (anomalie n° 9).',
            },
        ],
    },
    {
        ref: 'FE',
        libelle: 'Variation du passif circulant',
        section: 'OPERATIONNEL',
        signeModele: '+',
        signeAttendu: 'LIBRE',
        renvoi: '(1)',
        termes: [
            poste(1, 'BILAN', 'DP', 'VARIATION', 'Variation du passif circulant, total DP · renvoi (b) : « si les dettes augmentent, la variation est positive ».'),
            variation(-1, ['404', '481', '482'], 'CREDITEUR', "Dettes sur acquisition d'immobilisations · renvoi (1), lues en FF, FG, FH."),
            variation(-1, ['461', '465'], 'CREDITEUR', 'Apporteurs (opérations sur le capital) et dividendes à payer · financement, lus en FK, FM, FN.'),
            variation(-1, ['4726'], 'CREDITEUR', '« versement restant à effectuer sur titre de placement non libérés » (ch. 5 (1)) · anomalie n° 7.'),
            variation(-1, ['4752'], 'CREDITEUR', 'Compte transitoire passif de la révision SYSCOHADA · sans flux (anomalie n° 14).'),
            variation(1, ['166', '176', '183'], 'CREDITEUR', '« intérêts des emprunts et dettes financières courus » · le ch. 5 les range ici, hors DA/DB (anomalie n° 4).'),
            variation(-1, ['4783'], 'DEBITEUR', "Écart de conversion actif, augmentation des dettes d'exploitation · a gonflé DP sans flux (anomalie n° 6)."),
            variation(1, ['4793'], 'CREDITEUR', "Écart de conversion passif, diminution des dettes d'exploitation · a réduit DP sans flux."),
        ],
    },
];
exports.POSTES_INVESTISSEMENT_SYSCOHADA = [
    {
        ref: 'FF',
        libelle: "Décaissements liés aux acquisitions d'immobilisations incorporelles",
        section: 'INVESTISSEMENT',
        signeModele: '-',
        signeAttendu: 'NEGATIF',
        termes: [
            poste(-1, 'BILAN', 'AD', 'VARIATION', 'Variation du BRUT des immobilisations incorporelles (211 à 219) · anomalie n° 3.', 'BRUT'),
            debit(-1, ['281'], 'Amortissements sortis à la cession (débit 281 par crédit 654/81) · avec la VNC ci-dessous, reconstitue la valeur d\'entrée cédée.'),
            gestion(1, ['6541', '811'], 'VNC des immobilisations incorporelles cédées (solde débiteur, donc négatif en convention gestion) · « + Valeur comptable nette des immobilisations cédées ».'),
            debit(-1, ['251'], 'Avances et acomptes versés dans l\'exercice sur immobilisations incorporelles · décaissés (Titre VII COMPTE 25).'),
            credit(1, ['251'], 'Avances imputées sur la facture définitive (débit 21x par crédit 251) · déjà décaissées, en N ou avant (anomalie n° 2).'),
            debit(-1, ['4041', '4046', '4811', '4821'], 'Règlements de dettes sur immobilisations incorporelles (fournisseurs d\'acquisitions courantes 404 et d\'investissements 481/482).'),
            credit(1, ['4041', '4046', '4811', '4821'], 'Acquisitions à crédit non encore réglées · « déduire la variation des dettes sur acquisitions » (§ 1.3 (1)).'),
        ],
        nonDeterminables: [
            {
                comptes: ['798', '862'],
                motif: "Reprises d'amortissements incluses dans le débit du 281 (Titre VII COMPTE 28 : « débité de la reprise des " +
                    'amortissements par le crédit du 798 […] ou par le crédit du 862 ») · comptées ici en fausse acquisition, ' +
                    "non séparables du débit de cession. Le 862 pèse doublement : FA le retire de TO, donc la reprise HAO n'est " +
                    'nulle part dans la CAFG (anomalies n° 3 et 22).',
            },
            { comptes: ['4816', '4817', '4818'], motif: 'Réserve de propriété, retenues de garantie, factures non parvenues sur investissements · non subdivisées, prises en FG (anomalie n° 10).' },
        ],
    },
    {
        ref: 'FG',
        libelle: "Décaissements liés aux acquisitions d'immobilisations corporelles",
        section: 'INVESTISSEMENT',
        signeModele: '-',
        signeAttendu: 'NEGATIF',
        termes: [
            poste(-1, 'BILAN', 'AI', 'VARIATION', 'Variation du BRUT des immobilisations corporelles (22, 23, 24) · anomalie n° 3.', 'BRUT'),
            debit(-1, ['282', '283', '284'], 'Amortissements sortis à la cession · reconstitue avec la VNC la valeur d\'entrée cédée.'),
            gestion(1, ['6542', '812'], 'VNC des immobilisations corporelles cédées.'),
            debit(-1, ['252'], 'Avances et acomptes versés dans l\'exercice sur immobilisations corporelles.'),
            credit(1, ['252'], 'Avances imputées sur la facture définitive · déjà décaissées (anomalie n° 2).'),
            debit(-1, ['4042', '4047', '4812', '4816', '4817', '4818', '4822'], 'Règlements de dettes sur immobilisations corporelles · 4816 à 4818 pris ici en entier (anomalie n° 10).'),
            credit(1, ['4042', '4047', '4812', '4816', '4817', '4818', '4822'], 'Acquisitions à crédit non encore réglées (§ 1.3 (1)).'),
            credit(1, ['17'], '« acquisition » par contrat de location acquisition : « transaction sans effet de trésorerie » (§ 1.3 et § 1.4) · crédit 17 par débit 2x ; 176 exclu, ses intérêts courus sont en FE.', ['176']),
            credit(1, ['1984'], '« Coûts relatifs au démantèlement […] imputés aux immobilisations » (§ 1.3) · crédit 1984 par débit du ' +
                "composant 2x, sans flux (Titre VIII ch. 6) ; le praticien cite 19842, absent du plan semé. ATTENTION : le " +
                'même crédit 1984 porte aussi la désactualisation annuelle (6971 par 1984, sans débit de classe 2), non ' +
                'séparable · anomalie n° 20.'),
            credit(1, ['106', '154'], "« Écart et provision spéciale de réévaluation de l'exercice de réévaluation » (§ 1.3 ; Titre VIII ch. 28 " +
                '§ 4.2.4.1 : 1061, ou 154 si la neutralité fiscale est imposée) · pris en entier ici (anomalie n° 11), et ' +
                "ne couvrant que la part « valeur nette comptable » de l'écart (anomalie n° 21)."),
            reevaluationLiee(1, 'MOUVEMENT_DEBIT', ['22', '23', '24'], MOTIF_REEVALUATION_LIEE),
            reevaluationLiee(-1, 'MOUVEMENT_CREDIT', ['22', '23', '24'], MOTIF_REEVALUATION_LIEE),
            reevaluationLiee(1, 'MOUVEMENT_DEBIT', ['282', '283', '284'], MOTIF_REEVALUATION_LIEE),
            reevaluationLiee(-1, 'MOUVEMENT_CREDIT', ['106', '154'], MOTIF_REEVALUATION_LIEE),
        ],
        nonDeterminables: [
            {
                comptes: ['798', '862'],
                motif: "Reprises d'amortissements incluses dans le débit de 282 à 284 (Titre VII COMPTE 28 : par le crédit du 798 " +
                    'ou du 862) · fausses acquisitions, non séparables ; le 862 échappe en outre à la CAFG, FA le retirant de ' +
                    'TO (anomalies n° 3 et 22).',
            },
            {
                comptes: ['1984'],
                motif: 'Désactualisation annuelle de la provision pour démantèlement (Titre VIII ch. 6 : « le compte 6971 est ' +
                    'débité par le crédit du compte 1984 »), incluse dans le crédit 1984 lu ci-dessus alors même que rien ' +
                    "n'est débité en classe 2 · gonfle FG et creuse un écart de bouclage du même montant, non séparable du " +
                    'coût de démantèlement imputé à l\'immobilisation (anomalie n° 20).',
            },
            {
                comptes: ['28'],
                declencheur: { comptes: ['106', '154'], sens: 'CREDIT' },
                motif: "Réévaluation passée HORS du module (celle du module est neutralisée par sa liaison) · part « amortissements » " +
                    "de l'écart de réévaluation d'un bien amortissable (Titre VIII ch. 28 § 4.2.4.1 : " +
                    'classe 2 débitée de la différence de valeur d\'entrée, 28 crédité de la différence de cumul, 1061 ou 154 ' +
                    "de la seule différence de VNC) · comprise dans le Δ brut retiré ci-dessus mais absente du crédit 106/154, " +
                    'donc en fausse acquisition ; le « + crédit 28 de réévaluation » qui la corrigerait est indissociable des ' +
                    'dotations de l\'exercice (anomalie n° 21).',
            },
            { comptes: ['72'], motif: "Production immobilisée : le ch. 5 la range ici (« y compris les immobilisations produites par l'entité »), et l'EBE la contient déjà en +72 · l'aller-retour est exact, non isolable par poste." },
            { comptes: ['14'], motif: 'Immobilisation transférée gratuitement (débit 2x par crédit 14, Titre VII COMPTE 14) · gonfle FG et FL du même montant (anomalie n° 13).' },
        ],
    },
    {
        ref: 'FH',
        libelle: "Décaissements liés aux acquisitions d'immobilisations financières",
        section: 'INVESTISSEMENT',
        signeModele: '-',
        signeAttendu: 'NEGATIF',
        termes: [
            debit(-1, ['26', '27'], 'Acquisitions de titres de participation, prêts, dépôts et cautionnements · 276 exclu (intérêts courus, en FD · anomalie n° 4).', ['276']),
            debit(-1, ['4813'], 'Versements effectués sur titres non libérés (Titre VII COMPTE 27 et 48).'),
            credit(1, ['4813'], 'Part non libérée à l\'acquisition (débit 26/274 par crédit 4813) · pas encore décaissée.'),
            variation(1, ['4792'], 'CREDITEUR', 'Écart de conversion passif, augmentation des créances financières · débit 27 sans flux.' +
                " Lu en VARIATION dans un poste bâti sur des MOUVEMENTS : exact si l'ajustement de clôture n'est pas " +
                'contre-passé à la réouverture, hypothèse écrite faute de source (anomalie n° 6).'),
            reevaluationLiee(1, 'MOUVEMENT_DEBIT', ['26', '27'], MOTIF_REEVALUATION_LIEE, ['276']),
        ],
        nonDeterminables: [
            {
                comptes: ['106', '154'],
                motif: 'Réévaluation passée HORS du module (celle du module est neutralisée par sa liaison) · part de la ' +
                    'réévaluation relative aux immobilisations financières · prise en entier en FG (anomalie ' +
                    "n° 11), alors que le débit de 26/27 qu'elle porte est lu ici en fausse acquisition : ZC est juste, la " +
                    'répartition FG/FH ne l\'est pas. Titre VIII ch. 28 § 1.2 : « la réévaluation doit porter sur ' +
                    "l'ensemble des immobilisations corporelles et financières ».",
            },
            { comptes: ['2714'], motif: 'Titres prêtés (plan semé) ou créances de location financement (Titre VII) · sans flux à l\'entrée, non isolables par numéro (anomalie n° 8).' },
        ],
    },
    {
        ref: 'FI',
        libelle: "Encaissements liés aux cessions d'immobilisations incorporelles et corporelles",
        section: 'INVESTISSEMENT',
        signeModele: '+',
        signeAttendu: 'POSITIF',
        termes: [
            gestion(1, ['754', '821', '822'], "Prix de cession (Titre VII COMPTE 82 : « produit net de la cession ») · 754 pour les cessions courantes, 821/822 pour les HAO."),
            variation(-1, ['414', '485'], 'DEBITEUR', 'Variation des créances sur cessions courantes (414) et HAO (485) · une cession à crédit non encaissée est retranchée.'),
        ],
    },
    {
        ref: 'FJ',
        libelle: "Encaissements liés aux cessions d'immobilisations financières",
        section: 'INVESTISSEMENT',
        signeModele: '+',
        signeAttendu: 'POSITIF',
        termes: [
            credit(1, ['26', '27'], '« cession et remboursement des immobilisations financières » (§ 1.3) · crédit de 26/27 : remboursement de prêt, restitution de dépôt, ou valeur d\'entrée cédée ; 276 exclu (anomalie n° 4).', ['276']),
            gestion(1, ['826', '816'], "Prix (826) et VNC (816, négative) des cessions de titres passées par 81/82 · avec le crédit de 26/27 ci-dessus, la somme vaut le prix (anomalie n° 12)."),
            variation(-1, ['4782'], 'DEBITEUR', 'Écart de conversion actif, diminution des créances financières · crédit 27 sans flux.' +
                " Lu en VARIATION dans un poste bâti sur des MOUVEMENTS : exact si l'ajustement de clôture n'est pas " +
                'contre-passé à la réouverture, hypothèse écrite faute de source (anomalie n° 6).'),
        ],
        nonDeterminables: [
            {
                comptes: ['485'],
                motif: "Cession d'immobilisation financière à crédit : Titre VII COMPTE 82 crédite le 82 « par le débit du compte " +
                    'de tiers 485 » SANS restriction de nature, et le COMPTE 48 fait du 485 le compte générique des créances ' +
                    "sur cessions · la créance est donc lue par la variation 414/485 de FI, alors que le prix (826) et la VNC " +
                    '(816) de la même cession sont lus ici. Répartition FI/FJ faussée du montant non recouvré à la clôture, ' +
                    'ZC intact (anomalie n° 9).',
            },
            { comptes: ['2714'], motif: 'Titres prêtés restitués (ou créances de location financement remboursées) · anomalie n° 8.' },
        ],
    },
];
exports.POSTES_CAPITAUX_PROPRES_SYSCOHADA = [
    {
        ref: 'FK',
        libelle: 'Augmentations de capital par apports nouveaux',
        section: 'CAPITAUX_PROPRES',
        signeModele: '+',
        signeAttendu: 'POSITIF',
        termes: [
            variation(1, ['101', '102', '105'], 'CREDITEUR', 'Variation du capital (social, par dotation) et des primes liées au capital (Titre VII COMPTE 101, 102, 105).'),
            variation(-1, ['109'], 'DEBITEUR', 'Capital souscrit non appelé · créance de la société, pas un encaissement (COMPTE 109).'),
            variation(-1, ['461', '467'], 'DEBITEUR', 'Apporteurs débiteurs (4611 à 4614, 4617, 4618) et restant dû sur capital appelé (467) · souscrit, non versé (ch. 5 (1) ; anomalie n° 16).'),
            variation(1, ['4615', '4616'], 'CREDITEUR', 'Versements reçus ou anticipés sur augmentation de capital · encaissés avant l\'écriture de capital (COMPTE 46 ; anomalie n° 16).'),
            variation(-1, ['4493', '4581'], 'DEBITEUR', 'Fonds de dotation à recevoir (État 4493, organismes internationaux 4581) · la dotation 102 non encore encaissée (COMPTE 102).'),
            debit(-1, ['11', '12', '130', '131'], 'Incorporation de réserves, de report à nouveau ou de résultat au capital (COMPTE 101 : « par le débit du 11, 12, 13 ») et affectation du résultat · sans apport.'),
            debit(-1, ['106'], "Incorporation directe de l'écart de réévaluation au capital (COMPTE 106) · sans apport (anomalie n° 16)."),
            credit(1, ['11', '12', '130', '139'], 'Contreparties des affectations et absorptions de pertes (COMPTE 11, 12, 13) · se compensent avec les ' +
                'débits ci-dessus. Le 130 est lu EN ENTIER, symétriquement à son débit : le 1301 (bénéfice en instance) ' +
                "était orphelin et faisait ressortir FK à −(bénéfice N-1) dès qu'un dossier utilisait le compte spécial " +
                'de réouverture (anomalie n° 23) ; le 1309 y est désormais compris, sans doublon.'),
            credit(1, ['465'], "Dividendes mis en paiement par débit du résultat, des réserves ou du report (COMPTE 46) · neutralise l'affectation ; le versement est en FN."),
            credit(1, ['4619'], 'Capital à rembourser (débit 101 par crédit 4619) · neutralise la baisse du capital ; le remboursement est en FM.'),
            credit(1, ['103', '104'], "Entité individuelle : apports définitifs (103) et temporaires (104) de l'exploitant (COMPTE 103, 104)."),
        ],
        nonDeterminables: [
            { comptes: ['4611', '4614', '1052', '1053', '1054'], motif: 'Apports en nature, fusion, conversion de dettes · sans trésorerie, gonflent FK et FG ou FQ du même montant (anomalie n° 13).' },
            {
                comptes: ['103', '139'],
                motif: "Entité individuelle · virement du solde du 104 au 103 à la clôture, et affectation d'une PERTE (Titre VII " +
                    "COMPTE 103 : « débité, à l'ouverture de l'exercice, du montant de l'affectation du résultat […] par le " +
                    'crédit du 139 ») · le crédit 139 entre ici en faux apport et le débit 103 en faux prélèvement dans FM. ' +
                    'ZD reste juste, la répartition FK/FM non (anomalie n° 13).',
            },
        ],
    },
    {
        ref: 'FL',
        libelle: "Subventions d'investissement reçues",
        section: 'CAPITAUX_PROPRES',
        signeModele: '+',
        signeAttendu: 'POSITIF',
        termes: [
            variation(1, ['14'], 'CREDITEUR', "Variation des subventions d'investissement (Titre VII COMPTE 14)."),
            gestion(1, ['799'], 'Quote-part reprise au résultat (débit 14 par crédit 799) · a réduit le 14 sans flux ; produit hors CAFG (TJ), rajouté ici.'),
            variation(-1, ['4494', '4582'], 'DEBITEUR', "Subventions d'investissement à recevoir (État, organismes internationaux · COMPTE 14 : « par le débit du 4494 ou 4582 ») · accordées, non encaissées."),
        ],
        nonDeterminables: [
            { comptes: ['14'], motif: 'Subvention reçue en nature (immobilisation transférée gratuitement) · gonfle FL et FG (anomalie n° 13).' },
            { comptes: ['4497'], motif: "Avances sur subventions : exploitation ou investissement indécidable par numéro · laissées en FE (anomalie n° 17)." },
        ],
    },
    {
        ref: 'FM',
        libelle: 'Prélèvements sur le capital',
        section: 'CAPITAUX_PROPRES',
        signeModele: '-',
        signeAttendu: 'NEGATIF',
        termes: [
            debit(-1, ['4619'], 'Remboursement effectif du capital à rembourser (COMPTE 46, COMPTE 101 : « remboursement d\'une partie du capital »).'),
            debit(-1, ['103', '104'], "Entité individuelle : retraits de l'exploitant (COMPTE 104 : « débité des retraits de fonds ou prélèvements »)."),
        ],
        nonDeterminables: [
            { comptes: ['104'], motif: 'Prélèvements en nature (1047) et solde de clôture 104/103 · sans flux, non séparables (anomalie n° 13).' },
            {
                comptes: ['103'],
                motif: "Affectation d'une PERTE dans une entité individuelle (Titre VII COMPTE 103 : « débité, à l'ouverture de " +
                    "l'exercice, du montant de l'affectation du résultat de l'exercice précédent, par le crédit du 139 ») · " +
                    'faux prélèvement ici, faux apport en FK par le crédit 139, ZD juste. Le retirer du terme ci-dessus ' +
                    'casserait le virement de clôture 104 → 103, dont le crédit 104 est lu par FK (anomalie n° 13).',
            },
        ],
    },
    {
        ref: 'FN',
        libelle: 'Dividendes versés',
        section: 'CAPITAUX_PROPRES',
        signeModele: '-',
        signeAttendu: 'NEGATIF',
        termes: [debit(-1, ['465'], 'Dividendes réglés (COMPTE 46 : « débité des sommes réglées au titre des dividendes ») · la retenue à la source ressort en FE via 44.')],
    },
];
exports.POSTES_CAPITAUX_ETRANGERS_SYSCOHADA = [
    {
        ref: 'FO',
        libelle: 'Emprunts',
        section: 'CAPITAUX_ETRANGERS',
        signeModele: '+',
        signeAttendu: 'POSITIF',
        termes: [
            credit(1, ['161', '162'], 'Emprunts obligataires et auprès des établissements de crédit contractés (Titre VII COMPTE 16 : « crédité du montant net des emprunts par le débit des comptes de trésorerie »).'),
            variation(-1, ['4713'], 'DEBITEUR', 'Obligataires : émis mais non encore libéré (Titre VIII ch. 20, 47131/47132) · anomalie n° 5.'),
            variation(-1, ['4784'], 'DEBITEUR', 'Écart de conversion actif, augmentation des dettes financières · crédit 16 sans flux ; pris en entier ici.' +
                " Lu en VARIATION dans un poste bâti sur des MOUVEMENTS : exact si l'ajustement de clôture n'est pas " +
                'contre-passé à la réouverture, hypothèse écrite faute de source (anomalie n° 6).'),
        ],
        nonDeterminables: [{ comptes: ['1612', '1613'], motif: 'Obligations converties ou remboursées en actions · sans trésorerie, gonflent FQ et FK (anomalie n° 13).' }],
    },
    {
        ref: 'FP',
        libelle: 'Autres dettes financières',
        section: 'CAPITAUX_ETRANGERS',
        signeModele: '+',
        signeAttendu: 'POSITIF',
        termes: [
            credit(1, ['163', '164', '165', '167', '168', '181', '182'], "Avances de l'État, comptes courants bloqués, dépôts et cautionnements reçus, avances conditionnées, autres " +
                'emprunts, dettes liées à des participations (COMPTE 16, 18) · 166 et 183 exclus (anomalie n° 4). Le 1685 ' +
                "(participation des travailleurs bloquée, subdivision du 168 au COMPTE 16) est bien lu : son crédit n'est " +
                'pas un encaissement, mais il neutralise la charge 87 que RQ laisse dans la CAFG · ZH juste, répartition ' +
                'ZB/ZE faussée du même montant.'),
        ],
        note: 'Le crédit du 1685 (participation des travailleurs bloquée, Titre VII COMPTE 16) entre dans ce poste sans être ' +
            "un encaissement : il ne s'y trouve que pour neutraliser la charge 87 laissée dans la CAFG par RQ. L'exclure " +
            'ferait sortir la participation du tableau et fausserait ZH ; le garder ne fausse que la répartition ZB/ZE, ' +
            'dite ici plutôt que masquée.',
        nonDeterminables: [
            { comptes: ['4784'], motif: 'Part de l\'écart de conversion relative à ces dettes · prise en entier en FO (anomalie n° 6).' },
            { comptes: ['184'], motif: 'Comptes permanents bloqués des établissements · liaison interne (COMPTE 18), non rattaché (anomalie n° 17).' },
        ],
    },
    {
        ref: 'FQ',
        libelle: 'Remboursements des emprunts et autres dettes financières',
        section: 'CAPITAUX_ETRANGERS',
        signeModele: '-',
        signeAttendu: 'NEGATIF',
        termes: [
            debit(-1, ['16', '17', '181', '182'], 'Principal remboursé (COMPTE 16 : « débité, à la date d\'échéance, du montant du principal remboursé ») et « remboursement de la dette de location-acquisition » (§ 1.4, COMPTE 17 : débit 17 par crédit 623) · 166, 176 exclus (anomalie n° 4).', ['166', '176']),
            variation(1, ['4794'], 'CREDITEUR', 'Écart de conversion passif, diminution des dettes financières · débit 16 sans flux.' +
                " Lu en VARIATION dans un poste bâti sur des MOUVEMENTS : exact si l'ajustement de clôture n'est pas " +
                'contre-passé à la réouverture, hypothèse écrite faute de source (anomalie n° 6).'),
        ],
    },
];
exports.TOUS_LES_POSTES_FLUX_SYSCOHADA = [
    exports.POSTE_TRESORERIE_OUVERTURE_SYSCOHADA,
    ...exports.POSTES_OPERATIONNELS_SYSCOHADA,
    ...exports.POSTES_INVESTISSEMENT_SYSCOHADA,
    ...exports.POSTES_CAPITAUX_PROPRES_SYSCOHADA,
    ...exports.POSTES_CAPITAUX_ETRANGERS_SYSCOHADA,
];
exports.TOTAUX_FLUX_SYSCOHADA = [
    { ref: '', libelle: 'Variation du BF lié aux activités opérationnelles (FB+FC+FD+FE)', deRefs: ['FB', 'FC', 'FD', 'FE'] },
    { ref: 'ZB', libelle: 'Flux de trésorerie provenant des activités opérationnelles (somme FA à FE)', cle: 'B', deRefs: ['FA', 'FB', 'FC', 'FD', 'FE'] },
    { ref: 'ZC', libelle: "Flux de trésorerie provenant des activités d'investissement (somme FF à FJ)", cle: 'C', deRefs: ['FF', 'FG', 'FH', 'FI', 'FJ'] },
    { ref: 'ZD', libelle: 'Flux de trésorerie provenant des capitaux propres (somme FK à FN)', cle: 'D', deRefs: ['FK', 'FL', 'FM', 'FN'] },
    { ref: 'ZE', libelle: 'Flux de trésorerie provenant des capitaux étrangers (somme FO à FQ)', cle: 'E', deRefs: ['FO', 'FP', 'FQ'] },
    { ref: 'ZF', libelle: 'Flux de trésorerie provenant des activités de financement (D + E)', cle: 'F', deRefs: ['ZD', 'ZE'] },
    { ref: 'ZG', libelle: 'VARIATION DE LA TRÉSORERIE NETTE DE LA PÉRIODE (B + C + F)', cle: 'G', deRefs: ['ZB', 'ZC', 'ZF'] },
    { ref: 'ZH', libelle: 'Trésorerie nette au 31 Décembre (G + A)', cle: 'H', deRefs: ['ZG', 'ZA'] },
];
exports.CONTROLE_ZH_PAR_LES_FLUX = ['ZA', 'ZB', 'ZC', 'ZF'];
exports.CONTROLE_ZH_PAR_LE_BILAN = [
    poste(1, 'BILAN', 'BT', 'N', 'Trésorerie actif N · total BT du bilan.', 'NET'),
    poste(-1, 'BILAN', 'DT', 'N', 'Trésorerie passif N · total DT du bilan.'),
];
exports.ORDRE_AFFICHAGE_FLUX_SYSCOHADA = [
    { ref: 'ZA' },
    { section: 'Flux de trésorerie provenant des activités opérationnelles' },
    ...exports.POSTES_OPERATIONNELS_SYSCOHADA.map((p) => ({ ref: p.ref })),
    { ref: '' },
    { ref: 'ZB' },
    { section: "Flux de trésorerie provenant des activités d'investissements" },
    ...exports.POSTES_INVESTISSEMENT_SYSCOHADA.map((p) => ({ ref: p.ref })),
    { ref: 'ZC' },
    { section: 'Flux de trésorerie provenant du financement par les capitaux propres' },
    ...exports.POSTES_CAPITAUX_PROPRES_SYSCOHADA.map((p) => ({ ref: p.ref })),
    { ref: 'ZD' },
    { section: 'Trésorerie provenant du financement par les capitaux étrangers' },
    ...exports.POSTES_CAPITAUX_ETRANGERS_SYSCOHADA.map((p) => ({ ref: p.ref })),
    { ref: 'ZE' },
    { ref: 'ZF' },
    { ref: 'ZG' },
    { ref: 'ZH' },
];
function trouvePosteFluxSyscohada(ref) {
    return exports.TOUS_LES_POSTES_FLUX_SYSCOHADA.find((p) => p.ref === ref);
}
function trouveTotalFluxSyscohada(ref) {
    return exports.TOTAUX_FLUX_SYSCOHADA.find((t) => t.ref === ref);
}
function besoinsDuPoste(p) {
    return {
        exerciceN1: p.termes.some((t) => t.poste && t.poste.etat === 'BILAN' && t.poste.lecture !== 'N'),
        soldesAnterieurs: p.termes.some((t) => t.comptes?.lecture === 'VARIATION_SOLDE'),
        mouvements: p.termes.some((t) => t.comptes?.lecture === 'MOUVEMENT_DEBIT' || t.comptes?.lecture === 'MOUVEMENT_CREDIT'),
    };
}
function signeConformeAuModeleFlux(p, montant) {
    if (p.signeAttendu === 'LIBRE' || Math.abs(montant) < 0.005)
        return true;
    return p.signeAttendu === 'POSITIF' ? montant > 0 : montant < 0;
}
function postesLisantEnMouvement(numero) {
    const refs = new Set();
    for (const p of exports.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
        for (const t of p.termes) {
            const c = t.comptes;
            if (!c || (c.lecture !== 'MOUVEMENT_DEBIT' && c.lecture !== 'MOUVEMENT_CREDIT'))
                continue;
            if (!c.prefixes.some((x) => numero.startsWith(x)))
                continue;
            if ((c.exclusions ?? []).some((x) => numero.startsWith(x)))
                continue;
            refs.add(p.ref);
        }
    }
    return [...refs].sort();
}
function comptesCitesParLeTftSyscohada() {
    const cites = [];
    for (const p of exports.TOUS_LES_POSTES_FLUX_SYSCOHADA) {
        for (const t of p.termes) {
            for (const prefixe of t.comptes?.prefixes ?? [])
                cites.push({ ref: p.ref, prefixe });
            for (const prefixe of t.comptes?.exclusions ?? [])
                cites.push({ ref: p.ref, prefixe });
        }
        for (const nd of p.nonDeterminables ?? []) {
            for (const prefixe of nd.comptes)
                cites.push({ ref: p.ref, prefixe });
            for (const prefixe of nd.declencheur?.comptes ?? [])
                cites.push({ ref: p.ref, prefixe });
        }
    }
    return cites;
}
exports.COMPTES_SANS_TRESORERIE_SYSCOHADA = [
    { prefixe: '29', motif: 'Dépréciations des immobilisations · contrepartie de 691/697/85 et 791/797/86, tous hors CAFG.' },
    { prefixe: '39', motif: 'Dépréciations des stocks · contrepartie de 6593/7593 gardés dans la CAFG, neutralisée par le NET de BB (FC).' },
    { prefixe: '49', motif: 'Dépréciations et provisions à court terme sur tiers · neutralisées par le NET de BA/BG et par DN (FB, FD, FE).' },
    { prefixe: '59', motif: 'Dépréciations et provisions à court terme sur trésorerie · dans le net de BT et en DN.' },
    { prefixe: '151', motif: 'Amortissements dérogatoires · dotation 851 et reprise 861, retirées de la CAFG.' },
    { prefixe: '152', motif: 'Plus-values de cession à réinvestir · provision réglementée, 851/861 hors CAFG.' },
    { prefixe: '153', motif: 'Fonds réglementés · 851/861 hors CAFG.' },
    { prefixe: '155', motif: 'Provisions réglementées relatives aux immobilisations · 851/861 hors CAFG.' },
    { prefixe: '156', motif: 'Provisions réglementées relatives aux stocks · 851/861 hors CAFG.' },
    { prefixe: '157', motif: 'Provisions pour investissement · 851/861 hors CAFG.' },
    { prefixe: '158', motif: 'Autres provisions et fonds réglementés · 851/861 hors CAFG.' },
    { prefixe: '191', motif: "Provisions pour risques et charges · 691/697/85 et 791/797/86, hors CAFG (seul le 1984 est lu, en FG, et pour sa seule part imputée aux immobilisations · anomalie n° 20)." },
    { prefixe: '192', motif: 'Idem 191.' },
    { prefixe: '193', motif: 'Idem 191.' },
    { prefixe: '194', motif: 'Idem 191.' },
    { prefixe: '195', motif: 'Idem 191.' },
    { prefixe: '1961', motif: 'Idem 191 · 1962 (actif du régime de retraite) est à part, voir COMPTES_TFT_NON_VENTILES_JUSTIFIES.' },
    { prefixe: '197', motif: 'Idem 191.' },
    { prefixe: '1981', motif: 'Idem 191.' },
    { prefixe: '1983', motif: 'Idem 191.' },
    { prefixe: '1985', motif: 'Idem 191.' },
    { prefixe: '1988', motif: 'Idem 191.' },
    { prefixe: '132', motif: 'Soldes intermédiaires de gestion (Titre VII COMPTE 13) · étapes de calcul, soldées entre elles.' },
    { prefixe: '133', motif: 'Idem 132.' },
    { prefixe: '134', motif: 'Idem 132.' },
    { prefixe: '135', motif: 'Idem 132.' },
    { prefixe: '136', motif: 'Idem 132.' },
    { prefixe: '137', motif: 'Idem 132.' },
    { prefixe: '138', motif: 'Idem 132 · résultat HAO, fusion, scission, liquidation.' },
];
exports.COMPTES_TFT_NON_VENTILES_JUSTIFIES = [
    { prefixe: '1962', anomalie: 17, motif: "Actif du régime de retraite · prime versée à l'assureur (Titre VII COMPTE 19), décaissement réel qu'aucune ligne du ch. 5 ne nomme : ressort en écart de bouclage." },
    { prefixe: '184', anomalie: 17, motif: 'Comptes permanents bloqués des établissements et succursales · liaison interne (Titre VII COMPTE 18).' },
    { prefixe: '186', anomalie: 17, motif: 'Comptes de liaison charges · neutralisés dans la comptabilité fusionnée.' },
    { prefixe: '187', anomalie: 17, motif: 'Comptes de liaison produits · idem.' },
    { prefixe: '188', anomalie: 17, motif: 'Comptes de liaison des sociétés en participation · aucun poste.' },
    { prefixe: '4786', anomalie: 24, motif: "Différences d'évaluation sur instruments de trésorerie, ACTIF · contrepartie du 54 (Titre VII COMPTE 47), qui est dans BS donc dans BT : le ch. 7 range le 478 en BU, hors de tout total que le tableau lit." },
    { prefixe: '4788', anomalie: 24, motif: 'Différences compensées par couverture de change, ACTIF · contrepartie de la créance ou dette couverte (BG/DP), mais rangée en BU par le ch. 7 : aucun poste ne la lit.' },
    { prefixe: '4797', anomalie: 24, motif: "Différences d'évaluation sur instruments de trésorerie, PASSIF · symétrique du 4786, rangée en DV, hors de DP." },
    { prefixe: '4798', anomalie: 24, motif: 'Différences compensées par couverture de change, PASSIF · symétrique du 4788, rangée en DV, hors de DP.' },
    { prefixe: '585', anomalie: 17, motif: 'Virements de fonds · à solder à la clôture (COMPTE 58) ; un résidu fausse BT.' },
    { prefixe: '588', anomalie: 17, motif: 'Autres virements internes · idem.' },
];
exports.COMPTES_EXCLUS_SANS_REPRISE = [
    { prefixe: '4726', anomalie: 7, motif: 'Versements restant à effectuer sur titres de placement non libérés · exclu de FE par le (1), compté dans BT par le contrôle : un solde non nul est un écart de bouclage du même montant.' },
    { prefixe: '4751', anomalie: 14, motif: 'Compte transitoire actif de la révision SYSCOHADA · sans flux, retiré de FD.' },
    { prefixe: '4752', anomalie: 14, motif: 'Compte transitoire passif de la révision SYSCOHADA · sans flux, retiré de FE.' },
];
//# sourceMappingURL=correspondance-tft-syscohada.js.map