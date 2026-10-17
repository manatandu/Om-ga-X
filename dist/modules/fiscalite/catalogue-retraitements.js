"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETRAITEMENT_PAR_CODE = exports.MENTION_ARTICLE_73_5 = exports.CODES_HORS_ARTICLE_73_5 = exports.CATALOGUE_RETRAITEMENTS = exports.CODE_LIBRE = void 0;
const client_1 = require("@prisma/client");
exports.CODE_LIBRE = 'AUTRE';
exports.CATALOGUE_RETRAITEMENTS = [
    {
        code: 'DEPENSES_PERSONNELLES',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Dépenses à caractère personnel',
        aide: "Dépenses du dirigeant ou des associés étrangères à l'exploitation, passées en charges. Une dépense mixte se ventile. À l'impôt sur les sociétés, à défaut de ventilation possible, c'est l'article 20 qui commande, la charge devant être exposée dans l'intérêt direct de l'entreprise. À l'IRPP d'un exploitant ou d'un professionnel (personne physique au régime réel), le texte tranche autrement · à défaut de pouvoir déterminer la fraction professionnelle, 50 % de la charge mixte sont retenus forfaitairement, et seule l'autre moitié se réintègre (art. 89, al. 4 ; art. 99, al. 2).",
        source: 'Loi n° 23/053, art. 50, 1° (et art. 20 pour les conditions générales) ; personnes physiques · art. 89, al. 4 et art. 99, al. 2',
    },
    {
        code: 'IMPOT_SUR_LE_RESULTAT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Impôt sur les sociétés et impôt minimum comptabilisés en charges',
        aide: "L'impôt sur le résultat n'est pas une charge déductible de son propre calcul. En SYSCOHADA, il s'agit du compte 89. Le minimum forfaitaire de perception suit la même règle.",
        source: 'Loi n° 23/053, art. 45 et art. 50, 2°',
    },
    {
        code: 'PRELEVEMENT_EXPATRIES',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Prélèvement exceptionnel sur les rémunérations du personnel expatrié',
        aide: "Prélèvement de 25 % à charge de l'entreprise, assis sur le montant brut des rémunérations. Il est expressément exclu des charges déductibles, alors qu'il est bien une charge comptable.",
        source: 'Loi n° 23/053, art. 50, 2° (prélèvement : art. 145 à 149)',
    },
    {
        code: 'AMENDES_PENALITES',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Amendes, confiscations et pénalités de toute nature',
        aide: "Y compris les honoraires et frais payés à cet effet. Attention au piège comptable : le SYSCOHADA range les amendes fiscales et pénales dans les charges ORDINAIRES, ce qui ne les rend pas déductibles pour autant.",
        source: 'Loi n° 23/053, art. 50, 3°',
    },
    {
        code: 'BIENS_DONNES_EN_LOCATION',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Dépenses relatives aux biens donnés en location, amortissements compris',
        aide: "Sauf location par une institution de crédit-bail agréée par la Banque Centrale du Congo, dont les amortissements restent déductibles (art. 28).",
        source: 'Loi n° 23/053, art. 50, 4°',
    },
    {
        code: 'PROVISIONS_NON_ADMISES',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Provisions et dépréciations non admises',
        aide: "Les provisions ne sont PAS déductibles, à quatre exceptions près : reconstitution de gisements miniers, créances des établissements de crédit et de microfinance, engagements réglementés des sociétés d'assurance et de réassurance, sous certification du commissaire aux comptes. Toute autre dotation de la classe 69 se réintègre.",
        source: 'Loi n° 23/053, art. 50, 5°',
    },
    {
        code: 'DEPENSES_SOMPTUAIRES',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Dépenses somptuaires',
        aide: "Chasse et pêche sportives, bateaux de plaisance, aéronefs de tourisme, résidences d'agrément, et toute dépense de même nature.",
        source: 'Loi n° 23/053, art. 50, 6°',
    },
    {
        code: 'FRAIS_SIEGE_ETRANGER',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Frais généraux du siège à l’étranger et frais exposés à l’étranger',
        aide: "Concerne les établissements stables d'une société non-résidente : la quote-part de frais généraux du siège et les frais engagés à l'étranger par la société ne sont pas déductibles du résultat de l'établissement congolais.",
        source: 'Loi n° 23/053, art. 50, 7°',
    },
    {
        code: 'DONS_EXCEDENT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Dons, libéralités et subventions au-delà du plafond',
        aide: "Seuls sont déductibles les versements au Fonds Social de la RDC, à des organismes de recherche, à des œuvres ou organismes d'utilité publique à caractère philanthropique et social, et à des associations sportives situées en RDC. Double condition de forme : un relevé joint à la déclaration, et un résultat net imposable POSITIF avant déduction. L'excédent se réintègre.",
        source: 'Loi n° 23/053, art. 44',
        plafond: { part: 0.005, assiette: 'CHIFFRE_AFFAIRES', enonce: "0,5 % du chiffre d'affaires de l'exercice, plafond global pour l'ensemble des versements de l'article 44" },
        conditionResultatNetPositif: {
            enonce: "Le bénéfice de cette disposition est subordonné à la double condition que : 1. un relevé indiquant les montants, la date des versements et l'identité des bénéficiaires soit joint à la déclaration des résultats ; 2. le résultat net imposable avant déduction de ces versements soit positif.",
            source: 'Loi n° 23/053, art. 44, al. 2',
        },
    },
    {
        code: 'CADEAUX_EXCEDENT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Cadeaux et objets publicitaires au-delà du plafond',
        aide: "Le plafond est de deux pour mille, non de deux pour cent · l'erreur de virgule est fréquente et se paie au contrôle.",
        source: 'Loi n° 23/053, art. 49, 1°',
        plafond: { part: 0.002, assiette: 'CHIFFRE_AFFAIRES', enonce: "2 pour mille du chiffre d'affaires hors taxes, plafond global pour l'ensemble des cadeaux et objets publicitaires" },
    },
    {
        code: 'REPRESENTATION_EXCEDENT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Frais de représentation, fraction non déductible',
        aide: "Soixante pour cent du montant sont déductibles, le solde se réintègre · le plafond porte sur la charge elle-même, pas sur le chiffre d'affaires.",
        source: 'Loi n° 23/053, art. 49, 2°',
        plafond: { part: 0.6, assiette: 'CHARGE', enonce: '60 % du montant engagé' },
    },
    {
        code: 'COMMUNICATION_EXCEDENT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Frais de communication, fraction non déductible',
        aide: "Cinquante pour cent des frais de communication sont déductibles. Les frais d'internet le sont à 100 % si l'usage est exclusivement professionnel : dans ce cas, ne rien porter ici.",
        source: 'Loi n° 23/053, art. 49, 7°',
        plafond: { part: 0.5, assiette: 'CHARGE', enonce: '50 % du montant engagé' },
    },
    {
        code: 'REDEVANCES_LIEES_EXCEDENT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Redevances versées à des entités liées au-delà du plafond',
        aide: "Concessions de licences, brevets, marques et procédés versées à une entité liée. Le débiteur doit en outre prouver que les dépenses correspondent à des opérations réelles et ne sont pas exagérées.",
        source: 'Loi n° 23/053, art. 43',
        plafond: { part: 0.035, assiette: 'CHIFFRE_AFFAIRES', enonce: "3,5 % du chiffre d'affaires hors taxes, plafond global pour l'ensemble des redevances versées à des entités liées" },
    },
    {
        code: 'INTERETS_ASSOCIES_EXCEDENT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Intérêts servis aux associés au-delà du taux admis',
        aide: "Le taux admis est celui des avances de la Banque Centrale du Congo majoré de deux points. Trois conditions s'y ajoutent : une convention de prêt écrite et enregistrée, la libération intégrale du capital souscrit, et, pour les associés dirigeants, des sommes laissées à disposition n'excédant pas le capital social libéré. Le taux de référence change · le relever à la date des intérêts.",
        source: 'Loi n° 23/053, art. 39 à 41',
    },
    {
        code: 'INTERETS_ENTITE_LIEE_EXCEDENT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Intérêts payés à une entité liée au-delà du plafond',
        aide: "Trois conditions cumulatives : remboursement du principal dans les cinq ans, taux n'excédant pas la moyenne annuelle des taux effectifs pratiqués par les établissements de crédit du pays de l'entreprise prêteuse, et plafond de 15 % du résultat retraité de l'entité emprunteuse.",
        source: 'Loi n° 23/053, art. 42',
    },
    {
        code: 'AMORTISSEMENTS_EXCEDENT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Amortissements excédant les taux fiscaux',
        aide: "Les taux linéaires admis sont fixés par l'arrêté ministériel n° 013/CAB/MIN/FINANCES/2025 du 19 février 2025 · cent trente et une lignes, neuf familles. Un bien en location-acquisition ne s'amortit pas sur moins de sept ans (constructions, hors la valeur du terrain), quatre ans (équipements) ou trois ans (matériel de transport), art. 5. La différence entre la dotation comptable et l'annuité fiscale se réintègre. Le dégressif n'est ouvert, sur option, qu'aux biens neufs limitativement énumérés, à l'exclusion notamment des véhicules de tourisme et des immobilisations incorporelles.",
        source: 'Loi n° 23/053, art. 28 à 38 ; arrêté ministériel n° 013/CAB/MIN/FINANCES/2025, art. 2 et 5',
        assietteHorsPortee: "Le mouvement du compte de dotations est la DOTATION ENTIÈRE, dont l'art. 28 admet en déduction tout ce qui respecte le barème de l'arrêté n° 013/CAB/MIN/FINANCES/2025 ; seul l'EXCÉDENT se réintègre. L'annuité fiscale se lit dans le tableau des amortissements, immobilisation par immobilisation, et non dans une balance : ce module ne propose donc aucun montant. " +
            "BIEN AMORTI EN DÉGRESSIF FISCAL (SYSCOHADA, Système normal, option prise) : l'excédent à réintégrer est calculé avec le dérogatoire de l'exercice, dans la fenêtre Immobilisations, bouton « Fiscal », une fois ce dérogatoire passé ; reportez-le ici. " +
            "AUTRES BIENS : OmegaX ne tient pas leur plan fiscal · établissez l'écart hors du logiciel, puis saisissez-le ici. " +
            "TAUX DÉROGATOIRE : l'arrêté n° 013/CAB/MIN/FINANCES/2025, art. 4, admet d'autres taux lorsque les conditions particulières d'exploitation le justifient ; justifié lors du contrôle, l'écart n'est pas à réintégrer, et à défaut de justification il est rejeté.",
    },
    {
        code: 'REEVALUATION_SUPPLEMENT_ANNUITE',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: "Supplément d'annuité d'amortissement des immobilisations réévaluées",
        aide: "Après réévaluation, l'amortissement se calcule sur la valeur RÉÉVALUÉE, mais l'augmentation de l'annuité qui en résulte ne doit diminuer ni le bénéfice comptable ni le bénéfice fiscal : la neutralité s'obtient chaque année par la réintégration d'une fraction égale à cette augmentation. Le montant est la différence entre l'annuité calculée sur la valeur réévaluée et celle qui aurait été calculée sur la valeur d'origine · un immeuble de 100 000 000 FC réévalué à 160 000 000 FC et amorti sur 20 ans porte 3 000 000 FC de supplément. À reprendre chaque exercice tant que le plan court, et à cesser à la cession du bien, où c'est le solde de la plus-value de réévaluation qui se réintègre (art. 133, al. 3).",
        source: 'Loi n° 23/053, art. 133, al. 2 (portée : art. 134 ; réévaluation : art. 129 à 132 et AUDCIF art. 62 à 65)',
        assietteHorsPortee: "Le supplément d'annuité ne se lit dans aucun solde : il est la DIFFÉRENCE entre l'annuité de la valeur réévaluée et celle de la valeur d'origine. " +
            "RÉÉVALUATION PASSÉE PAR OMEGAX (fenêtre Immobilisations, « Réévaluation ») : chaque bien garde ses valeurs d'avant et son coefficient retenu k' ; les annuités nouvelles étant les anciennes multipliées par k' (AUDCIF Titre VIII ch. 28 § 4.2.2), le supplément d'une dotation D vaut D × (1 − 1/k'), montant que la reprise de la provision spéciale calcule bien par bien. RÉÉVALUATION PASSÉE HORS D'OMEGAX : le calcul suppose le tableau des amortissements d'avant la réévaluation. Ce module ne propose donc aucun montant ici. " +
            "NEUTRALITÉ DÉJÀ OBTENUE PAR LA PROVISION SPÉCIALE : si l'écart d'un bien a été porté au 154 et que sa reprise de l'exercice est passée au 861 (ch. 28 § 4.2.4.1 et § 4.2.4.2), le résultat porte déjà ce supplément en produit · le réintégrer en plus le neutraliserait deux fois et surévaluerait le résultat fiscal. Ne le portez ici que pour les biens dont l'écart est au 106.",
    },
    {
        code: 'REMUNERATIONS_NON_DECLAREES',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Rémunérations et honoraires non déclarés ou non justifiés',
        aide: "Salaires, commissions, honoraires et rémunérations de services ne sont déductibles que s'ils ont fait l'objet des déclarations aux impôts correspondants. Commissions, courtages, ristournes, vacations et gratifications exigent en outre l'indication exacte du nom et du domicile du bénéficiaire, de la date du paiement et de la somme allouée à chacun ; à défaut, elles s'ajoutent au bénéfice de celui qui les a payées. Une société passible de l'IS qui a versé des sommes à des personnes dont elle ne révèle pas l'identité est EN OUTRE assujettie à l'IRPP sur leur montant global, au taux le plus élevé du barème de l'art. 118, sans préjudice de l'imposition des bénéficiaires que l'Administration identifie (art. 117). OmegaX ne le chiffre pas · l'identité ne se lit dans aucun compte.",
        source: 'Loi n° 23/053, art. 21 à 24, art. 26 et art. 117',
    },
    {
        code: 'SOMMES_NON_RESIDENTS',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Sommes versées à des non-résidents non justifiées',
        aide: "Vers une personne liée : triple condition de réalité du service, d'impossibilité pour une personne établie en RDC de le rendre, et de prix de pleine concurrence. Les sommes versées à une personne établie dans un État ou territoire NON COOPÉRATIF ne sont jamais déductibles, qu'il y ait ou non lien de dépendance.",
        source: 'Loi n° 23/053, art. 46 à 48',
    },
    {
        code: 'PRIX_DE_TRANSFERT',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Bénéfices indirectement transférés à des entreprises liées hors RDC',
        aide: "Majoration ou diminution des prix d'achat ou de vente, redevances excessives, renonciation à recette, abandon de créance, remise de dette, avantage hors proportion avec le service rendu. La condition de dépendance n'est PAS exigée lorsque le transfert s'opère avec une entreprise établie dans un État à régime fiscal privilégié ou non coopératif.",
        source: 'Loi n° 23/053, art. 53',
    },
    {
        code: 'ECARTS_CONVERSION_CREANCES_DETTES',
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Gains de change latents sur créances et dettes en devises',
        aide: "Distinction commandée par l'article 17 : les écarts sur les AVOIRS en devise entrent dans le résultat imposable de l'exercice ; ceux sur les CRÉANCES ET DETTES libellées en monnaies étrangères n'y entrent qu'au dénouement de l'opération. Les gains latents comptabilisés se retranchent donc, les pertes latentes se réintègrent · porter ici ce qui doit être neutralisé dans un sens, et sur la ligne symétrique dans l'autre.",
        source: 'Loi n° 23/053, art. 17',
    },
    {
        code: 'PERTES_CHANGE_LATENTES',
        sens: client_1.SensRetraitementFiscal.DEDUCTION,
        libelle: 'Pertes de change latentes déjà réintégrées, dénouées sur l’exercice',
        aide: "Seules les pertes de change EFFECTIVEMENT RÉALISÉES sont déductibles, et les gains effectivement réalisés imposables. Cette ligne sert à déduire, à l'exercice du dénouement, ce qui avait été neutralisé les exercices précédents.",
        source: 'Loi n° 23/053, art. 14 et art. 49, 4°',
    },
    {
        code: 'PLUS_VALUES_NON_REALISEES',
        sens: client_1.SensRetraitementFiscal.DEDUCTION,
        libelle: 'Plus-values simplement exprimées en comptabilité',
        aide: "Les accroissements résultant de plus-values non traitées comme des bénéfices ne sont pas imposables, sous condition d'une comptabilité régulière, du respect des obligations déclaratives et de l'absence de taxation d'office. L'exemption n'est maintenue qu'à cinq conditions cumulatives, dont l'absence d'amortissement, de distribution ou de prélèvement sur ces plus-values, et leur inscription à un compte spécial du passif, distinct des réserves et du capital.",
        source: 'Loi n° 23/053, art. 19',
    },
    {
        code: 'PLUS_VALUES_FUSION',
        sens: client_1.SensRetraitementFiscal.DEDUCTION,
        libelle: 'Plus-values de fusion ou d’apport partiel d’actif exonérées',
        aide: "Exonération réservée aux plus-values, autres que sur marchandises, résultant de l'attribution d'actions ou de parts à la suite d'une fusion, d'une scission ou d'un apport partiel d'actif au profit d'une SA, SAS ou SARL ayant son siège en RDC. Deux obligations à constater dans l'acte : reprise du prix de revient de l'apporteuse pour les amortissements et plus-values ultérieures, et inscription immédiate au passif des provisions pour renouvellement figurant chez elle.",
        source: 'Loi n° 23/053, art. 54',
    },
    {
        code: 'SUBVENTIONS_EQUIPEMENT_ETALEES',
        sens: client_1.SensRetraitementFiscal.DEDUCTION,
        libelle: 'Subventions d’équipement, fraction non encore imposable',
        aide: "Une subvention d'équipement n'est pas comprise dans les résultats de l'année d'encaissement : elle se rapporte au rythme des amortissements pratiqués sur le prix de revient de l'immobilisation. Pour une immobilisation non amortissable, par fractions égales sur la durée d'inaliénabilité prévue à l'acte, ou par dixièmes à défaut de clause. Les subventions d'exploitation et d'équilibre, elles, sont imposables dès l'encaissement.",
        source: 'Loi n° 23/053, art. 18',
    },
    {
        code: 'REVENUS_DEJA_IMPOSES',
        sens: client_1.SensRetraitementFiscal.DEDUCTION,
        libelle: 'Éléments déjà imposés au cours de l’exercice',
        aide: "Déduction destinée à éviter la double imposition d'un même revenu dans le chef d'un même redevable.",
        source: 'Loi n° 23/053, art. 55',
    },
    {
        code: exports.CODE_LIBRE,
        sens: client_1.SensRetraitementFiscal.REINTEGRATION,
        libelle: 'Autre retraitement',
        aide: "Ligne libre, pour un redressement que ce catalogue ne nomme pas. Écrivez le fondement dans le commentaire : c'est lui qui sera opposé au vérificateur, et une ligne sans justification est une ligne indéfendable.",
        source: 'À renseigner par le comptable',
    },
];
exports.CODES_HORS_ARTICLE_73_5 = {
    IMPOT_SUR_LE_RESULTAT: 'impôt',
    PRELEVEMENT_EXPATRIES: 'impôt',
    AMENDES_PENALITES: 'amendes et pénalités',
    PROVISIONS_NON_ADMISES: 'provisions',
    AMORTISSEMENTS_EXCEDENT: 'amortissements',
    REEVALUATION_SUPPLEMENT_ANNUITE: 'amortissements',
    ECARTS_CONVERSION_CREANCES_DETTES: 'décalage temporaire (art. 17), non une charge interdite',
};
exports.MENTION_ARTICLE_73_5 = "Dans une société passible de l'IS, la charge réintégrée est aussi un REVENU DISTRIBUÉ (loi n° 23/053, art. 73, al. 2, 5°), qui porte la retenue de 20 % de l'art. 120 · OmegaX ne la chiffre pas, la qualification reste au cabinet.";
for (const r of exports.CATALOGUE_RETRAITEMENTS) {
    if (r.sens === client_1.SensRetraitementFiscal.REINTEGRATION && r.code !== exports.CODE_LIBRE && !(r.code in exports.CODES_HORS_ARTICLE_73_5)) {
        r.revenusDistribues = exports.MENTION_ARTICLE_73_5;
    }
}
exports.RETRAITEMENT_PAR_CODE = new Map(exports.CATALOGUE_RETRAITEMENTS.map((r) => [r.code, r]));
//# sourceMappingURL=catalogue-retraitements.js.map