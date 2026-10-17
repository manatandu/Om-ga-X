"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CODES_NOTES_SYSCOHADA_3 = exports.NOTES_SYSCOHADA_3 = exports.FICHE_SYNTHESE_SYSCOHADA = exports.RENVOI_DETTES_FINANCIERES_NOTE_34 = exports.MARQUE_HORS_MAQUETTE_NOTE_34 = exports.RENVOI_A_NOTE_34 = exports.RENVOI_B_NOTE_34 = exports.GROUPES_ACTIVITES_SYSCOHADA = exports.CODE_PAYS_OHADA_RDC = exports.CODES_PAYS_OHADA_SYSCOHADA = exports.CODES_PAYS_SIEGE_SYSCOHADA = exports.CODES_REGIME_FISCAL_SYSCOHADA = exports.RENVOI_1_FORME_JURIDIQUE_SYSCOHADA = exports.CODES_FORME_JURIDIQUE_SYSCOHADA = exports.SEUILS_NOTE_35 = void 0;
const COLONNES_N_N1_POURCENT = [
    { type: 'EXERCICE_N', libelle: 'Année N' },
    { type: 'EXERCICE_N1', libelle: 'Année N-1' },
    { type: 'VARIATION_POURCENT', libelle: 'Variation en %' },
];
const COLONNES_NOTE_28 = [
    { type: 'OUVERTURE', libelle: "A · PROVISIONS À L'OUVERTURE DE L'EXERCICE" },
    { type: 'AUGMENTATION_EXPLOITATION', libelle: "B · AUGMENTATIONS : DOTATIONS D'EXPLOITATION" },
    { type: 'AUGMENTATION_FINANCIERE', libelle: 'B · AUGMENTATIONS : DOTATIONS FINANCIÈRES' },
    { type: 'AUGMENTATION_HAO', libelle: 'B · AUGMENTATIONS : DOTATIONS HORS ACTIVITÉS ORDINAIRES' },
    { type: 'DIMINUTION_EXPLOITATION', libelle: "C · DIMINUTIONS : REPRISES D'EXPLOITATION" },
    { type: 'DIMINUTION_FINANCIERE', libelle: 'C · DIMINUTIONS : REPRISES FINANCIÈRES' },
    { type: 'DIMINUTION_HAO', libelle: 'C · DIMINUTIONS : REPRISES HORS ACTIVITÉS ORDINAIRES' },
    { type: 'CLOTURE', libelle: "D = A + B – C · PROVISIONS À LA CLÔTURE DE L'EXERCICE" },
];
const COLONNE_INFORMATIONS = [{ type: 'LIBRE', libelle: 'Informations' }];
const COLONNES_CINQ_EXERCICES = [
    { type: 'LIBRE', libelle: 'N' },
    { type: 'LIBRE', libelle: 'N-1' },
    { type: 'LIBRE', libelle: 'N-2' },
    { type: 'LIBRE', libelle: 'N-3' },
    { type: 'LIBRE', libelle: 'N-4 (¹)' },
];
const quantiteValeur = (groupe) => [
    { type: 'LIBRE', libelle: `${groupe} · Quantité` },
    { type: 'LIBRE', libelle: `${groupe} · Valeur` },
];
exports.SEUILS_NOTE_35 = {
    effectifNote35TitreIX: 250,
    effectifTitreVIIIChapitre30: 500,
};
exports.CODES_FORME_JURIDIQUE_SYSCOHADA = [
    { code: '00', libelle: 'Société Anonyme (SA) à participation publique' },
    { code: '01', libelle: 'Société Anonyme (SA)' },
    { code: '02', libelle: 'Société à Responsabilité Limitée (SARL)' },
    { code: '03', libelle: 'Société en Commandite Simple (SCS)' },
    { code: '04', libelle: 'Société en Nom Collectif (SNC)' },
    { code: '05', libelle: 'Société en Participation (SP)' },
    { code: '06', libelle: "Groupement d'Intérêt Économique (GIE)" },
    { code: '07', libelle: 'Association' },
    { code: '08', libelle: 'Société par Actions Simplifiée (SAS)' },
    { code: '09', libelle: 'Autre forme juridique (à préciser)' },
];
exports.RENVOI_1_FORME_JURIDIQUE_SYSCOHADA = "(1) Remplacer le premier 0 par 1 si l'entité bénéficie d'un agrément prioritaire.";
exports.CODES_REGIME_FISCAL_SYSCOHADA = [
    { code: '1', libelle: 'Réel normal' },
    { code: '2', libelle: 'Réel simplifié' },
    { code: '3', libelle: 'Synthétique' },
    { code: '4', libelle: 'Forfait' },
];
exports.CODES_PAYS_SIEGE_SYSCOHADA = [
    { code: '00', libelle: 'Pays OHADA (2)' },
    { code: '21', libelle: 'Autres pays africains' },
    { code: '23', libelle: 'France' },
    { code: '39', libelle: "Autres pays de l'Union Européenne" },
    { code: '40', libelle: 'U.S.A.' },
    { code: '41', libelle: 'Canada' },
    { code: '49', libelle: 'Autres pays américains' },
    { code: '50', libelle: 'Pays asiatiques' },
    { code: '99', libelle: 'Autres pays' },
];
exports.CODES_PAYS_OHADA_SYSCOHADA = [
    { code: '01', libelle: 'Bénin' },
    { code: '02', libelle: 'Burkina' },
    { code: '03', libelle: "Côte d'Ivoire" },
    { code: '04', libelle: 'Guinée Bissau' },
    { code: '05', libelle: 'Mali' },
    { code: '06', libelle: 'Niger' },
    { code: '07', libelle: 'Sénégal' },
    { code: '08', libelle: 'Togo' },
    { code: '09', libelle: 'Cameroun' },
    { code: '10', libelle: 'Congo' },
    { code: '11', libelle: 'Gabon' },
    { code: '12', libelle: 'République Centrafricaine' },
    { code: '13', libelle: 'Tchad' },
    { code: '14', libelle: 'Comores' },
    { code: '15', libelle: 'Guinée' },
    { code: '16', libelle: 'Guinée Équatoriale' },
    { code: '17', libelle: 'Congo RDC' },
];
exports.CODE_PAYS_OHADA_RDC = '17';
exports.GROUPES_ACTIVITES_SYSCOHADA = [
    { code: '001', libelle: 'Agriculture vivrière' },
    { code: '002', libelle: "Agriculture industrielle et d'exportation" },
    { code: '003', libelle: 'Élevage et chasse' },
    { code: '004', libelle: 'Sylviculture, exploitation forestière' },
    { code: '005', libelle: 'Pêche et aquaculture' },
    { code: '006', libelle: 'Industries extractives' },
    { code: '007', libelle: 'Production de viande et de poissons' },
    { code: '008', libelle: 'Travail des grains et fabrication de produits amylacés' },
    { code: '009', libelle: 'Transformation du café et du cacao' },
    { code: '010', libelle: 'Industrie des oléagineux' },
    { code: '011', libelle: 'Boulangerie, pâtisserie et pâtes alimentaires' },
    { code: '012', libelle: 'Industries laitières' },
    { code: '013', libelle: "Transformation des fruits et légumes et fabrication d'autres produits alimentaires" },
    { code: '014', libelle: 'Industrie des boissons' },
    { code: '015', libelle: 'Industries du tabac' },
    { code: '016', libelle: 'Industries textiles et habillement' },
    { code: '017', libelle: 'Industries du cuir et de la chaussure' },
    { code: '018', libelle: 'Industries du bois' },
    { code: '019', libelle: "Industries du papier et cartons, de l'édition et de l'imprimerie" },
    { code: '020', libelle: 'Raffinage du pétrole' },
    { code: '021', libelle: 'Industrie chimique' },
    { code: '022', libelle: 'Industries du caoutchouc et des plastiques' },
    { code: '023', libelle: "Fabrication d'autres produits minéraux non métalliques et de matériaux de construction" },
    { code: '024', libelle: 'Métallurgie et travail des métaux' },
    { code: '025', libelle: "Fabrication de machines, d'équipements et d'appareils électriques" },
    {
        code: '026',
        libelle: "Fabrication d'équipements et appareils audiovisuels et de communication ; fabrication d'instruments " +
            "médicaux, d'optique et d'horlogerie",
    },
    { code: '027', libelle: 'Fabrication de matériel de transport' },
    { code: '028', libelle: 'Industries diverses' },
    { code: '029', libelle: "Production et distribution d'eau, d'électricité et de gaz" },
    { code: '030', libelle: 'Construction' },
    { code: '031', libelle: 'Commerce' },
    { code: '032', libelle: 'Réparations' },
    { code: '033', libelle: 'Hôtels, restaurants' },
    { code: '034', libelle: 'Transport et communication' },
    { code: '035', libelle: 'Postes, télécommunications' },
    { code: '036', libelle: 'Activités financières' },
    { code: '037', libelle: 'Activités immobilières' },
    { code: '038', libelle: 'Services aux entités' },
    { code: '039', libelle: 'Administrations publiques' },
    { code: '040', libelle: 'Éducation' },
    { code: '041', libelle: 'Santé et action sociale' },
    { code: '042', libelle: 'Services collectifs, sociaux et personnels' },
    { code: '043', libelle: "Service d'intermédiation financière indirectement mesuré" },
    { code: '044', libelle: 'Correction territoriale' },
];
const cr = (signe, ref, motif) => ({ signe, source: 'COMPTE_RESULTAT', ref, motif });
const bilan = (signe, ref, motif) => ({ signe, source: 'BILAN', ref, motif });
const flux = (signe, ref, motif) => ({ signe, source: 'FLUX_TRESORERIE', ref, motif });
const compte = (signe, ref, solde, motif) => ({
    signe, source: 'COMPTE', ref, solde, motif,
});
const ligne = (signe, ref, horsMaquette, motif) => ({
    signe, source: 'LIGNE', ref, horsMaquette, motif,
});
exports.RENVOI_B_NOTE_34 = '(b) Les écarts de conversion doivent être éliminés afin de ramener les créances et les dettes concernées à ' +
    'leur valeur initiale.';
exports.RENVOI_A_NOTE_34 = '(a) Résultat d’exploitation après impôt théorique sur le bénéfice.';
exports.MARQUE_HORS_MAQUETTE_NOTE_34 = '[hors maquette] Ligne absente du modèle officiel de la note 34, ajoutée pour que la CAFG puisse égaler le ' +
    'poste FA du tableau des flux ; le service la retient ou l’écarte, en le disant.';
exports.RENVOI_DETTES_FINANCIERES_NOTE_34 = 'Dettes financières* = emprunts et dettes financières diverses + dettes de location acquisition (DA + DB).';
exports.FICHE_SYNTHESE_SYSCOHADA = [
    { cle: 'chiffre-affaires', section: 'ACTIVITE', libelle: "Chiffre d'affaires", termes: [cr(1, 'XB')] },
    { cle: 'marge-commerciale', section: 'ACTIVITE', libelle: 'Marge commerciale', termes: [cr(1, 'XA')] },
    { cle: 'valeur-ajoutee', section: 'ACTIVITE', libelle: 'Valeur ajoutée', termes: [cr(1, 'XC')] },
    { cle: 'ebe', section: 'ACTIVITE', libelle: "Excédent brut d'exploitation (EBE)", termes: [cr(1, 'XD')] },
    { cle: 'resultat-exploitation', section: 'ACTIVITE', libelle: "Résultat d'exploitation", termes: [cr(1, 'XE')] },
    { cle: 'resultat-financier', section: 'ACTIVITE', libelle: 'Résultat financier', termes: [cr(1, 'XF')] },
    { cle: 'resultat-activites-ordinaires', section: 'ACTIVITE', libelle: 'Résultat des activités ordinaires', termes: [cr(1, 'XG')] },
    { cle: 'resultat-hao', section: 'ACTIVITE', libelle: 'Résultat hors activités ordinaires', termes: [cr(1, 'XH')] },
    { cle: 'resultat-net', section: 'ACTIVITE', libelle: 'Résultat net', termes: [cr(1, 'XI')] },
    { cle: 'caf-ebe', section: 'CAPACITE_AUTOFINANCEMENT', libelle: 'EBE', termes: [cr(1, 'XD')] },
    {
        cle: 'caf-vnc-cessions-courantes',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: "+ Valeurs comptables des cessions courantes d'immobilisation (compte 654)",
        termes: [compte(1, '654', 'DEBITEUR', 'Charge déjà retirée de l’EBE par RJ (65 en bloc, ch. 7) : réintégrée, la cession courante étant un flux d’investissement.')],
    },
    {
        cle: 'caf-produits-cessions-courantes',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: "– Produits des cessions courantes d'immobilisation (compte 754)",
        termes: [compte(-1, '754', 'CREDITEUR', 'Produit compris dans l’EBE par TH (75 en bloc) : retranché, le prix de cession étant encaissé en investissement.')],
    },
    {
        cle: 'caf-exploitation',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: "= CAPACITÉ D'AUTOFINANCEMENT D'EXPLOITATION",
        formuleOfficielle: 'EBE + 654 – 754',
        termes: [ligne(1, 'caf-ebe'), ligne(1, 'caf-vnc-cessions-courantes'), ligne(1, 'caf-produits-cessions-courantes')],
    },
    {
        cle: 'caf-revenus-financiers',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: '+ Revenus financiers',
        termes: [cr(1, 'TK', '77 en bloc (ch. 7).'), compte(-1, '776', 'CREDITEUR', 'Gains de change présentés sur la ligne suivante.')],
    },
    { cle: 'caf-gains-change', section: 'CAPACITE_AUTOFINANCEMENT', libelle: '+ Gains de change', termes: [compte(1, '776', 'CREDITEUR')] },
    {
        cle: 'caf-transferts-charges-financieres',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: '+ Transferts de charges financières',
        termes: [cr(1, 'TM', '787 (ch. 7).')],
    },
    {
        cle: 'caf-produits-hao',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: '+ Produits HAO',
        termes: [
            cr(1, 'TO', '84, 86, 88 (ch. 7).'),
            compte(-1, '86', 'CREDITEUR', 'Reprises HAO : produit non encaissable, comme dans FA du TFT.'),
            compte(-1, '848', 'CREDITEUR', 'Transferts de charges HAO présentés sur la ligne suivante.'),
        ],
    },
    { cle: 'caf-transferts-charges-hao', section: 'CAPACITE_AUTOFINANCEMENT', libelle: '+ Transferts de charges HAO', termes: [compte(1, '848', 'CREDITEUR')] },
    {
        cle: 'caf-frais-financiers',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: '– Frais financiers',
        termes: [cr(-1, 'RM', '67 en bloc (ch. 7).'), compte(1, '676', 'DEBITEUR', 'Pertes de change présentées sur la ligne suivante.')],
    },
    { cle: 'caf-pertes-change', section: 'CAPACITE_AUTOFINANCEMENT', libelle: '– Pertes de change', termes: [compte(-1, '676', 'DEBITEUR')] },
    {
        cle: 'caf-autres-charges-hao',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: '– Autres charges HAO (hors dotations)',
        horsMaquette: true,
        termes: [cr(-1, 'RP', '83, 85 (ch. 7).'), compte(1, '85', 'DEBITEUR', 'Dotations HAO : charge non décaissable, retirée comme dans FA.')],
    },
    { cle: 'caf-participation', section: 'CAPACITE_AUTOFINANCEMENT', libelle: '– Participation', termes: [cr(-1, 'RQ', '87 (ch. 7).')] },
    { cle: 'caf-impots', section: 'CAPACITE_AUTOFINANCEMENT', libelle: '– Impôts sur les résultats', termes: [cr(-1, 'RS', '89 (ch. 7).')] },
    {
        cle: 'cafg',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: "= CAPACITÉ D'AUTOFINANCEMENT GLOBALE (C.A.F.G.)",
        formuleOfficielle: 'CAF d’exploitation + revenus financiers + gains de change + transferts de charges financières + produits HAO ' +
            '+ transferts de charges HAO – frais financiers – pertes de change – participation – impôts sur les résultats',
        termes: [
            ligne(1, 'caf-exploitation'),
            ligne(1, 'caf-revenus-financiers'),
            ligne(1, 'caf-gains-change'),
            ligne(1, 'caf-transferts-charges-financieres'),
            ligne(1, 'caf-produits-hao'),
            ligne(1, 'caf-transferts-charges-hao'),
            ligne(1, 'caf-frais-financiers'),
            ligne(1, 'caf-pertes-change'),
            ligne(1, 'caf-autres-charges-hao', true, 'Absent de la formule énumérée du ch. 5 § 1.2.1.1, exigé par sa définition (« charges décaissables ' +
                'restantes ») et retenu par FA du TFT : le retenir aligne la CAFG de la note sur celle du tableau des ' +
                'flux, l’écarter la ramène à la formule imprimée. Choix du service, à dire dans les deux cas.'),
            ligne(1, 'caf-participation'),
            ligne(1, 'caf-impots'),
        ],
    },
    {
        cle: 'dividendes-distribues',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: "– Distributions de dividendes opérées durant l'exercice",
        termes: [flux(1, 'FN', 'Dividendes versés, poste FN du TFT, déjà négatif dans le tableau.')],
    },
    {
        cle: 'autofinancement',
        section: 'CAPACITE_AUTOFINANCEMENT',
        libelle: '= AUTOFINANCEMENT',
        formuleOfficielle: 'CAFG – distributions de dividendes',
        termes: [ligne(1, 'cafg'), ligne(1, 'dividendes-distribues')],
    },
    {
        cle: 'rentabilite-economique',
        section: 'RENTABILITE',
        libelle: 'Rentabilité économique',
        formuleOfficielle: "Résultat d'exploitation (a) / (Capitaux propres + dettes financières)",
        renvoi: exports.RENVOI_A_NOTE_34,
        ratio: {
            numerateur: [cr(1, 'XE', 'Avant l’impôt théorique du renvoi (a).')],
            denominateur: [
                bilan(1, 'CP'),
                bilan(1, 'DA', '[texte officiel] La formule écrit ici « dettes financières » SANS astérisque, seule occurrence de la ' +
                    'fiche ; la définition étoilée (DA + DB) lui est assimilée par cohérence avec les lignes de structure ' +
                    'financière et d’endettement. L’autre lecture serait DD, qui inclut les provisions DC. Assimilation ' +
                    'dite, non faite en silence.'),
                bilan(1, 'DB', 'Même assimilation que DA : voir le motif porté par ce terme.'),
            ],
        },
    },
    {
        cle: 'rentabilite-financiere',
        section: 'RENTABILITE',
        libelle: 'Rentabilité financière',
        formuleOfficielle: 'Résultat net / Capitaux propres',
        ratio: { numerateur: [cr(1, 'XI')], denominateur: [bilan(1, 'CP')] },
    },
    { cle: 'capitaux-propres', section: 'STRUCTURE_FINANCIERE', libelle: 'Capitaux propres et ressources assimilées', termes: [bilan(1, 'CP')] },
    {
        cle: 'dettes-financieres',
        section: 'STRUCTURE_FINANCIERE',
        libelle: '+ Dettes financières* et autres ressources assimilées (b)',
        renvoi: `${exports.RENVOI_DETTES_FINANCIERES_NOTE_34} ${exports.RENVOI_B_NOTE_34}`,
        termes: [bilan(1, 'DA'), bilan(1, 'DB')],
    },
    {
        cle: 'ressources-stables',
        section: 'STRUCTURE_FINANCIERE',
        libelle: '= Ressources stables',
        termes: [ligne(1, 'capitaux-propres'), ligne(1, 'dettes-financieres')],
    },
    { cle: 'actif-immobilise', section: 'STRUCTURE_FINANCIERE', libelle: '– Actif immobilisé (b)', renvoi: exports.RENVOI_B_NOTE_34, termes: [bilan(-1, 'AZ')] },
    {
        cle: 'fonds-de-roulement',
        section: 'STRUCTURE_FINANCIERE',
        libelle: '= FONDS DE ROULEMENT (1)',
        termes: [ligne(1, 'ressources-stables'), ligne(1, 'actif-immobilise')],
    },
    {
        cle: 'actif-circulant-exploitation',
        section: 'STRUCTURE_FINANCIERE',
        libelle: "Actif circulant d'exploitation (b)",
        renvoi: exports.RENVOI_B_NOTE_34,
        termes: [bilan(1, 'BK', 'Total actif circulant.'), bilan(-1, 'BA', 'Actif circulant HAO, compté en (3).')],
    },
    {
        cle: 'passif-circulant-exploitation',
        section: 'STRUCTURE_FINANCIERE',
        libelle: "– Passif circulant d'exploitation (b)",
        renvoi: exports.RENVOI_B_NOTE_34,
        termes: [bilan(-1, 'DP', 'Total passif circulant.'), bilan(1, 'DH', 'Dettes circulantes HAO, comptées en (3).')],
    },
    {
        cle: 'besoin-financement-exploitation',
        section: 'STRUCTURE_FINANCIERE',
        libelle: "= BESOIN DE FINANCEMENT D'EXPLOITATION (2)",
        termes: [ligne(1, 'actif-circulant-exploitation'), ligne(1, 'passif-circulant-exploitation')],
    },
    { cle: 'actif-circulant-hao', section: 'STRUCTURE_FINANCIERE', libelle: 'Actif circulant HAO (b)', renvoi: exports.RENVOI_B_NOTE_34, termes: [bilan(1, 'BA')] },
    { cle: 'passif-circulant-hao', section: 'STRUCTURE_FINANCIERE', libelle: '– Passif circulant HAO (b)', renvoi: exports.RENVOI_B_NOTE_34, termes: [bilan(-1, 'DH')] },
    {
        cle: 'besoin-financement-hao',
        section: 'STRUCTURE_FINANCIERE',
        libelle: '= BESOIN DE FINANCEMENT HAO (3)',
        termes: [ligne(1, 'actif-circulant-hao'), ligne(1, 'passif-circulant-hao')],
    },
    {
        cle: 'besoin-financement-global',
        section: 'STRUCTURE_FINANCIERE',
        libelle: 'BESOIN DE FINANCEMENT GLOBAL (4)',
        formuleOfficielle: '(4) = (2) + (3)',
        termes: [ligne(1, 'besoin-financement-exploitation'), ligne(1, 'besoin-financement-hao')],
    },
    {
        cle: 'tresorerie-nette',
        section: 'STRUCTURE_FINANCIERE',
        libelle: 'TRÉSORERIE NETTE (5)',
        formuleOfficielle: '(5) = (1) – (4)',
        termes: [ligne(1, 'fonds-de-roulement'), ligne(-1, 'besoin-financement-global')],
    },
    {
        cle: 'controle-tresorerie-nette',
        section: 'STRUCTURE_FINANCIERE',
        libelle: 'CONTRÔLE : TRÉSORERIE NETTE = (TRÉSORERIE-ACTIF) – (TRÉSORERIE-PASSIF)',
        formuleOfficielle: 'BT – DT',
        controleDe: 'tresorerie-nette',
        renvoi: '[texte officiel] Ce contrôle ne boucle que si les provisions pour risques et charges (DC) sont nulles. ' +
            '« Dettes financières* » valant DA + DB, les ressources stables de la note excluent DC alors que le bilan ' +
            'l’inclut dans DF : la trésorerie nette (5) vaut (BT – DT) + (BU – DV) – DC. Le renvoi (b) élimine les ' +
            'écarts de conversion (BU, DV) ; l’écart résiduel est exactement DC. Écart STRUCTUREL du texte, ni un défaut ' +
            'du calcul ni une anomalie du dossier.',
        termes: [bilan(1, 'BT'), bilan(-1, 'DT')],
    },
    { cle: 'flux-operationnels', section: 'VARIATION_TRESORERIE', libelle: 'Flux de trésorerie des activités opérationnelles', termes: [flux(1, 'ZB')] },
    {
        cle: 'flux-investissement',
        section: 'VARIATION_TRESORERIE',
        libelle: "– Flux de trésorerie des activités d'investissement",
        formuleOfficielle: '– Flux de trésorerie des activités d’investissement [texte officiel]',
        termes: [flux(1, 'ZC', 'ZC est déjà signé (décaissements négatifs) : + ZC, selon le modèle du TFT et non le « – » de la note.')],
    },
    { cle: 'flux-financement', section: 'VARIATION_TRESORERIE', libelle: '+ Flux de trésorerie des activités de financement', termes: [flux(1, 'ZF')] },
    {
        cle: 'variation-tresorerie-nette',
        section: 'VARIATION_TRESORERIE',
        libelle: '= VARIATION DE LA TRÉSORERIE NETTE DE LA PÉRIODE',
        formuleOfficielle: 'ZG = B + C + F (modèle du TFT, ch. 5 section 2)',
        termes: [ligne(1, 'flux-operationnels'), ligne(1, 'flux-investissement'), ligne(1, 'flux-financement')],
    },
    {
        cle: 'endettement-financier-brut',
        section: 'ENDETTEMENT_FINANCIER_NET',
        libelle: 'Endettement financier brut (Dettes financières* + Trésorerie-passif)',
        renvoi: exports.RENVOI_DETTES_FINANCIERES_NOTE_34,
        termes: [bilan(1, 'DA'), bilan(1, 'DB'), bilan(1, 'DT')],
    },
    { cle: 'tresorerie-actif', section: 'ENDETTEMENT_FINANCIER_NET', libelle: '– Trésorerie-actif', termes: [bilan(-1, 'BT')] },
    {
        cle: 'endettement-financier-net',
        section: 'ENDETTEMENT_FINANCIER_NET',
        libelle: '= ENDETTEMENT FINANCIER NET',
        termes: [ligne(1, 'endettement-financier-brut'), ligne(1, 'tresorerie-actif')],
    },
];
const saisie = (cle, libelle, renvoi) => ({ cle, libelle, saisie: true, renvoi });
exports.NOTES_SYSCOHADA_3 = [
    {
        code: '28',
        titre: 'PROVISIONS ET DÉPRÉCIATIONS INSCRITES AU BILAN',
        sensAccroissement: 'CREDIT',
        colonnes: COLONNES_NOTE_28,
        renvoyeeDepuis: ['XD', 'TJ', 'RL', 'TL', 'RN'],
        rubriques: [
            {
                libelle: 'Provisions réglementées',
                comptes: ['15'],
                renvoi: '[texte officiel] Le ch. 7 pose CM = « 15 » en bloc et le compte 15 s’intitule « Provisions réglementées ' +
                    'ET FONDS ASSIMILÉS » : le 153 « Fonds réglementés » (1531, 1532) n’est pas une provision, mais il est au ' +
                    'bilan et n’a pas d’autre note. Colonnes HAO conformes au Titre VII COMPTE 15 (« exclusivement par ' +
                    'Dotations H.A.O. », repris « exclusivement par Reprises H.A.O. »).',
            },
            {
                libelle: 'Provisions financières pour risques et charges',
                comptes: ['19'],
                renvoi: '[texte officiel] Le ch. 7 pose DC = « 19 » en bloc, or le 1962 « Actif du régime de retraite » est ' +
                    'DÉBITEUR (Titre VII COMPTE 19 : « la prime versée est enregistrée au débit du 1962 par le crédit d’un ' +
                    'compte de trésorerie »). Dans ce tableau au crédit ses primes versées ressortent en diminution, avec une ' +
                    'contrepartie de classe 5 : elles tombent en part non ventilée par nature, ce qui est la lacune du texte, ' +
                    'pas celle du dossier.',
            },
            { libelle: 'Dépréciation des immobilisations', comptes: ['29'] },
            { libelle: 'TOTAL : DOTATIONS', totalDeRubriques: [0, 1, 2] },
            { libelle: 'Dépréciations des stocks', comptes: ['39'] },
            {
                libelle: 'Dépréciations actif circulant HAO',
                comptes: ['498', '4998'],
                renvoi: '[texte officiel] Le 4998 « Provisions pour risques à court terme sur opérations HAO » est une PROVISION ' +
                    'DE PASSIF que le ch. 7 sort du 499 pour le porter en DH ; la note n’a pas d’autre ligne HAO dans ce bloc, ' +
                    'il est donc rattaché ici, sur une ligne de dépréciation d’actif. Colonnes HAO conformes (dotation 839, ' +
                    'reprise 849 · Titre VII COMPTE 84). Le moteur Python du skill l’exclut de la note (« 499!4998 ») : le ' +
                    'laisser dehors ferait diverger la note du bilan.',
            },
            { libelle: 'Dépréciations fournisseurs', comptes: ['490'] },
            { libelle: 'Dépréciations clients', comptes: ['491'] },
            { libelle: 'Dépréciations autres créances', comptes: ['492', '493', '494', '495', '496', '497'] },
            { libelle: 'Dépréciations titres de placement', comptes: ['590'] },
            { libelle: 'Dépréciations valeurs à encaisser', comptes: ['591'] },
            { libelle: 'Dépréciations disponibilité', comptes: ['592', '593', '594'] },
            { libelle: 'Dépréciations et provisions pour risques à court termes exploitation', comptes: ['4991'] },
            {
                libelle: 'Dépréciations et provisions pour risques à court termes à caractère financier',
                comptes: ['4997', '599'],
                renvoi: '[texte officiel] Le 4997 est rangé au financier d’après le Titre VIII ch. 22 § 2.3, qui écrit ' +
                    '« risques à court terme : débit 6791 Charges pour provisions sur risques financiers · crédit 4997 ». Le ' +
                    'Titre VII COMPTE 49, Fonctionnement, dit l’inverse pour le compte 49 entier : ses seules contreparties y ' +
                    'sont 659 et 839, et « les dépréciations et les provisions pour risques à court terme correspondent à des ' +
                    'charges d’exploitation ou H.A.O. selon leur nature ». Contradiction signalée, non tranchée en silence. ' +
                    'Deux suites : la ventilation B et C suit la CONTREPARTIE RÉELLE de l’écriture, donc un dossier qui ' +
                    'crédite le 4997 par le débit du 659 verra sa dotation en colonne « d’exploitation » sur cette ligne ; et ' +
                    'le moteur Python du skill range le 4997 avec le 4991 en exploitation, ne laissant ici que le 599.',
            },
            {
                libelle: 'TOTAL : CHARGES POUR DÉPRÉCIATIONS ET PROVISIONS À COURT TERME',
                totalDeRubriques: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
            },
            { libelle: 'TOTAL PROVISIONS ET DÉPRÉCIATIONS', totalDeRubriques: [3, 14] },
        ],
        renvoiOfficiel: '[texte officiel] La numérotation du second bloc est corrompue : le 5 et le 7 sont employés deux fois chacun, ' +
            'et « Dépréciations fournisseurs » apparaît deux fois (en 6 et en 5). Transcrit sans renuméroter, la ligne ' +
            'dupliquée n’étant portée qu’une fois. Le sous-total intermédiaire est intitulé « TOTAL : DOTATIONS » alors ' +
            'qu’il ne totalise que les trois premières lignes.',
        commentaire: 'indiquer les événements et circonstances qui ont conduit à la constitution et à la reprise de la ' +
            'dépréciation et de la provision.',
    },
    {
        code: '29',
        titre: 'CHARGES ET REVENUS FINANCIERS',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['TK', 'RM'],
        rubriques: [
            { libelle: 'Intérêts des emprunts', comptes: ['671'] },
            { libelle: 'Intérêts dans loyers de locations acquisition', comptes: ['672'] },
            { libelle: 'Escomptes accordés', comptes: ['673'] },
            { libelle: 'Autres intérêts', comptes: ['674'] },
            { libelle: 'Escomptes des effets de commerce', comptes: ['675'] },
            { libelle: 'Pertes de change', comptes: ['676'] },
            { libelle: 'Pertes sur cessions de titres de placement', comptes: ['6771'] },
            { libelle: "Malis provenant d'attribution gratuite d'actions au personnel salarié et aux dirigeants", comptes: ['6772'] },
            { libelle: 'Pertes sur risques financiers', comptes: ['678'] },
            {
                libelle: 'Charges pour dépréciation et provisions à court terme à caractère financier (voir note 28)',
                comptes: ['679'],
                renvoi: '28',
            },
            { libelle: 'SOUS TOTAL : FRAIS FINANCIERS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
            { libelle: 'Intérêts de prêts et créances diverses', comptes: ['771', '775'], natureCreditrice: true },
            { libelle: 'Revenus de participations', comptes: ['772'], natureCreditrice: true },
            { libelle: 'Escomptes obtenus', comptes: ['773'], natureCreditrice: true },
            { libelle: 'Revenus de placement', comptes: ['774'], natureCreditrice: true },
            { libelle: 'Gains de change', comptes: ['776'], natureCreditrice: true },
            { libelle: 'Gains sur cessions de titres de placement', comptes: ['777'], natureCreditrice: true },
            { libelle: 'Gains sur risques financiers', comptes: ['778'], natureCreditrice: true },
            {
                libelle: 'Reprises de charges pour dépréciation et provisions à court terme à caractère financier (voir note 28)',
                comptes: ['779'],
                natureCreditrice: true,
                renvoi: '28',
            },
            { libelle: 'SOUS TOTAL : REVENUS FINANCIERS', totalDeRubriques: [11, 12, 13, 14, 15, 16, 17, 18] },
            { libelle: 'TOTAL', totalDeRubriques: [19], moinsRubriques: [10] },
        ],
        commentaire: 'commenter toute variation significative ; en cas de paiement à terme, indiquer le montant des intérêts ' +
            'non comptabilisés.',
    },
    {
        code: '30',
        titre: 'AUTRES CHARGES ET PRODUITS HAO',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['TO', 'RP', 'RQ'],
        rubriques: [
            {
                libelle: 'Charges HAO constatées (1)',
                comptes: ['831', '833', '837'],
                renvoi: '(1) à détailler',
            },
            { libelle: 'Pertes sur créances HAO', comptes: ['834'] },
            { libelle: 'Dons et libéralités accordés', comptes: ['835'] },
            { libelle: 'Abandons de créances consentis', comptes: ['836'] },
            { libelle: 'Charges provisionnées HAO', comptes: ['839'] },
            { libelle: 'Dotations hors activités ordinaires', comptes: ['85'] },
            { libelle: 'Participation des travailleurs', comptes: ['87'] },
            {
                libelle: "Subventions d'équilibre",
                comptes: ['88'],
                presenterEnNegatif: true,
                renvoi: '[texte officiel] produit (compte 88, poste TO) rangé par la note parmi les charges HAO ; présenté en ' +
                    'négatif dans ce bloc, pour que le sous-total reste le solde réel du bloc et non une charge gonflée d’un ' +
                    'produit. Divergence assumée avec le moteur Python du skill, qui DÉPLACE le 88 dans le bloc des produits ' +
                    '(sous-total « B31 = SUM(B22:B30) ») : le TOTAL est le même dans les deux lectures (TO – RP – RQ), seuls ' +
                    'les deux sous-totaux diffèrent, et la ligne reste ici à la place que le texte lui donne.',
            },
            { libelle: 'SOUS TOTAL : AUTRES CHARGES HAO', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7] },
            {
                libelle: 'Produits HAO constatés (1)',
                comptes: ['841', '843', '844', '847'],
                natureCreditrice: true,
                renvoi: '(1) à détailler',
            },
            { libelle: 'Dons et libéralités obtenus', comptes: ['845'], natureCreditrice: true },
            { libelle: 'Abandons de créances obtenus', comptes: ['846'], natureCreditrice: true },
            { libelle: 'Transferts de charges HAO', comptes: ['848'], natureCreditrice: true },
            {
                libelle: 'Reprises des charges pour dépréciations et provisions à court terme HAO',
                comptes: ['849'],
                natureCreditrice: true,
            },
            { libelle: 'Reprises hors activités ordinaires', comptes: ['86'], natureCreditrice: true },
            { libelle: 'SOUS TOTAL : AUTRES PRODUITS HAO', totalDeRubriques: [9, 10, 11, 12, 13, 14] },
            { libelle: 'TOTAL', totalDeRubriques: [15], moinsRubriques: [8] },
        ],
        renvoiOfficiel: '(1) à détailler. [texte officiel] Les subventions d’équilibre (compte 88) sont un produit ; la note les ' +
            'range dans les « autres charges HAO ». De même la participation des travailleurs (compte 87) est une ' +
            'répartition du résultat, portée par le poste RQ distinct du poste RP.',
        commentaire: 'commenter toute variation significative.',
    },
    {
        code: '31',
        titre: 'RÉPARTITION DU RÉSULTAT ET AUTRES ÉLÉMENTS CARACTÉRISTIQUES DES CINQ DERNIERS EXERCICES',
        horsBalance: true,
        colonnes: COLONNES_CINQ_EXERCICES,
        rubriques: [
            saisie('structure-du-capital-a-la-cloture-de-l-exercice', "STRUCTURE DU CAPITAL À LA CLÔTURE DE L'EXERCICE (²)", '(²) Indication, en cas de libération partielle du capital, du montant du capital non appelé.'),
            saisie('capital-social', 'Capital social'),
            saisie('actions-ordinaires', 'Actions ordinaires'),
            saisie('actions-a-dividendes-prioritaires-a-d-p-sans-dro', 'Actions à dividendes prioritaires (A.D.P) sans droit de vote'),
            saisie('actions-nouvelles-a-emettre-par-conversion-d-obl', "Actions nouvelles à émettre : par conversion d'obligations"),
            saisie('actions-nouvelles-a-emettre-par-exercice-de-droi', 'Actions nouvelles à émettre : par exercice de droits de souscription'),
            saisie('operations-et-resultats-de-l-exercice', "OPÉRATIONS ET RÉSULTATS DE L'EXERCICE (³)", '(³) Les éléments de cette rubrique sont ceux figurant au compte de résultat.'),
            saisie('chiffre-d-affaires-hors-taxes', "Chiffre d'affaires hors taxes"),
            saisie('resultat-des-activites-ordinaires-r-a-o-hors-dot', 'Résultat des activités ordinaires (R.A.O) hors dotations et reprises (exploitation et financières)'),
            saisie('participation-des-travailleurs-aux-benefices', 'Participation des travailleurs aux bénéfices'),
            saisie('impot-sur-le-resultat', 'Impôt sur le résultat'),
            saisie('resultat-net', 'Résultat net (⁴)', '(⁴) Le résultat, lorsqu’il est négatif, doit être mis entre parenthèses.'),
            saisie('resultat-et-dividende-distribues', 'RÉSULTAT ET DIVIDENDE DISTRIBUÉS'),
            saisie('resultat-distribue', 'Résultat distribué (⁵)', '(⁵) L’exercice N correspond au dividende proposé du dernier exercice.'),
            saisie('dividende-attribue-a-chaque-action', 'Dividende attribué à chaque action'),
            saisie('personnel-et-politique-salariale', 'PERSONNEL ET POLITIQUE SALARIALE'),
            saisie('effectif-moyen-des-travailleurs-au-cours-de-l-ex', "Effectif moyen des travailleurs au cours de l'exercice (⁶)", '(⁶) Personnel propre.'),
            saisie('effectif-moyen-de-personnel-exterieur', 'Effectif moyen de personnel extérieur'),
            saisie('masse-salariale-distribuee-au-cours-de-l-exercic', "Masse salariale distribuée au cours de l'exercice (⁷)", '(⁷) Total des comptes 661, 662, 663.'),
            saisie('avantages-sociaux-verses-au-cours-de-l-exercice', "Avantages sociaux versés au cours de l'exercice (⁸) [Sécurité sociale, œuvres sociales]", '(⁸) Total des comptes 664, 668.'),
            saisie('personnel-exterieur-facture-a-l-entite', "Personnel extérieur facturé à l'entité (⁹)", '(⁹) Compte 667.'),
        ],
        renvoiOfficiel: '(¹) Y compris l’exercice dont les états financiers sont soumis à l’approbation de l’Assemblée. ' +
            '(²) Indication, en cas de libération partielle du capital, du montant du capital non appelé. ' +
            '(³) Les éléments de cette rubrique sont ceux figurant au compte de résultat. ' +
            '(⁴) Le résultat, lorsqu’il est négatif, doit être mis entre parenthèses. ' +
            '(⁵) L’exercice N correspond au dividende proposé du dernier exercice. ' +
            '(⁶) Personnel propre. (⁷) Total des comptes 661, 662, 663. (⁸) Total des comptes 664, 668. (⁹) Compte 667.',
    },
    {
        code: '32',
        titre: "PRODUCTION DE L'EXERCICE",
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: 'DÉSIGNATION DU PRODUIT' },
            { type: 'LIBRE', libelle: 'UNITÉ CHOISIE' },
            { type: 'LIBRE', libelle: 'PRODUCTION QUANTITÉ' },
            ...quantiteValeur('PRODUCTION VENDUE DANS LE PAYS'),
            ...quantiteValeur("PRODUCTION VENDUE DANS LES AUTRES PAYS DE L'OHADA"),
            ...quantiteValeur('PRODUCTION VENDUE HORS OHADA'),
            ...quantiteValeur('PRODUCTION IMMOBILISÉE'),
            ...quantiteValeur("STOCK OUVERTURE DE L'EXERCICE"),
            ...quantiteValeur("STOCK CLÔTURE DE L'EXERCICE"),
        ],
        rubriques: [
            { ...saisie('produit', 'Produit (une ligne par produit)'), repetable: true },
            saisie('non-ventile', 'NON VENTILÉ'),
            saisie('total', 'TOTAL'),
        ],
    },
    {
        code: '33',
        titre: 'ACHATS DESTINÉS À LA PRODUCTION',
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: 'DÉSIGNATION DES MATIÈRES ET PRODUITS' },
            { type: 'LIBRE', libelle: 'UNITÉ CHOISIE' },
            ...quantiteValeur("ACHATS EFFECTUÉS AU COURS DE L'EXERCICE · PRODUITS DE L'ÉTAT · achetés dans l'État"),
            ...quantiteValeur("ACHATS EFFECTUÉS AU COURS DE L'EXERCICE · PRODUITS IMPORTÉS · achetés hors de l'État"),
            ...quantiteValeur("ACHATS EFFECTUÉS AU COURS DE L'EXERCICE · [sans intitulé, texte officiel]"),
            { type: 'LIBRE', libelle: 'VARIATION DES STOCKS (en valeur)' },
        ],
        rubriques: [
            { ...saisie('matiere', 'Matière ou produit (une ligne par matière ou produit)'), repetable: true },
            saisie('non-ventiles', 'NON VENTILÉS'),
            saisie('total', 'TOTAL'),
        ],
        renvoiOfficiel: '[texte officiel] Les en-têtes des notes 32 et 33 sont désalignés : la note 33 annonce trois couples ' +
            'Quantité/Valeur pour deux origines déclarées (« dans l’État » / « hors de l’État »).',
    },
    {
        code: '34',
        titre: 'FICHE DE SYNTHÈSE DES PRINCIPAUX INDICATEURS FINANCIERS',
        horsBalance: true,
        colonnes: COLONNES_N_N1_POURCENT,
        rubriques: exports.FICHE_SYNTHESE_SYSCOHADA.map((l) => ({
            cle: l.cle,
            libelle: l.libelle,
            saisie: true,
            renvoi: l.horsMaquette ? `${exports.MARQUE_HORS_MAQUETTE_NOTE_34}${l.renvoi ? ` ${l.renvoi}` : ''}` : l.renvoi,
        })),
        renvoiOfficiel: 'EN MILLIERS DE FRANCS. (a) Résultat d’exploitation après impôt théorique sur le bénéfice. (b) Les écarts de ' +
            'conversion doivent être éliminés afin de ramener les créances et les dettes concernées à leur valeur ' +
            'initiale. Dettes financières* = emprunts et dettes financières diverses + dettes de location acquisition ' +
            '(DA + DB). [texte officiel] La variation de la trésorerie nette est écrite « – Flux d’investissement » alors ' +
            'que le modèle du TFT pose ZG = B + C + F avec C déjà signé.',
    },
    {
        code: '35',
        titre: 'LISTE DES INFORMATIONS SOCIALES, ENVIRONNEMENTALES ET SOCIÉTALES À FOURNIR',
        horsBalance: true,
        colonnes: COLONNE_INFORMATIONS,
        rubriques: [
            saisie('informations-sociales', 'INFORMATIONS SOCIALES'),
            saisie('emploi-effectif-total-et-repartition-des-salarie', 'Emploi : effectif total et répartition des salariés par sexe, âge et zone géographique'),
            saisie('emploi-embauches-et-licenciements', 'Emploi : embauches et licenciements'),
            saisie('emploi-remunerations-et-leur-evolution', 'Emploi : rémunérations et leur évolution'),
            saisie('relations-sociales-organisation-du-dialogue-soci', 'Relations sociales : organisation du dialogue social'),
            saisie('relations-sociales-bilan-des-accords-collectifs', 'Relations sociales : bilan des accords collectifs'),
            saisie('sante-et-securite-conditions-de-sante-et-de-secu', 'Santé et sécurité : conditions de santé et de sécurité au travail'),
            saisie('sante-et-securite-bilan-des-accords-signes-avec', 'Santé et sécurité : bilan des accords signés avec les organisations syndicales ou les représentants du ' +
                'personnel en matière de santé et de sécurité au travail'),
            saisie('formation-politiques-mises-en-uvre-en-matiere-de', 'Formation : politiques mises en œuvre en matière de formation'),
            saisie('formation-nombre-total-d-heures-de-formation', "Formation : nombre total d'heures de formation"),
            saisie('egalite-de-traitement-mesures-prises-en-faveur-d', "Égalité de traitement : mesures prises en faveur de l'égalité entre les femmes et les hommes"),
            saisie('egalite-de-traitement-mesures-prises-en-faveur-d-2', "Égalité de traitement : mesures prises en faveur de l'emploi et de l'insertion des personnes handicapées"),
            saisie('informations-environnementales', 'INFORMATIONS ENVIRONNEMENTALES'),
            saisie('politique-generale-en-matiere-environnementale-o', 'Politique générale en matière environnementale : organisation de la société pour prendre en compte les ' +
                "questions environnementales et, le cas échéant, les démarches d'évaluation ou de certification"),
            saisie('politique-generale-en-matiere-environnementale-a', "Politique générale en matière environnementale : actions de formation et d'information des salariés " +
                "menées en matière de protection de l'environnement"),
            saisie('politique-generale-en-matiere-environnementale-m', 'Politique générale en matière environnementale : moyens consacrés à la prévention des risques ' +
                'environnementaux et des pollutions'),
            saisie('pollution-et-gestion-des-dechets-mesures-de-prev', "Pollution et gestion des déchets : mesures de prévention, de réduction ou de réparation de rejets dans l'air, " +
                "l'eau et le sol affectant gravement l'environnement"),
            saisie('pollution-et-gestion-des-dechets-mesures-de-prev-2', "Pollution et gestion des déchets : mesures de prévention, de recyclage et d'élimination des déchets"),
            saisie('pollution-et-gestion-des-dechets-prise-en-compte', 'Pollution et gestion des déchets : prise en compte des nuisances sonores et de toute autre forme de ' +
                'pollution spécifique à une activité'),
            saisie('utilisation-durable-des-ressources-consommation', "Utilisation durable des ressources : consommation d'eau et approvisionnement en eau en fonction des " +
                'contraintes locales'),
            saisie('utilisation-durable-des-ressources-consommation-2', 'Utilisation durable des ressources : consommation de matières premières et mesures prises pour améliorer ' +
                "l'efficacité dans leur utilisation"),
            saisie('utilisation-durable-des-ressources-consommation-3', "Utilisation durable des ressources : consommation d'énergie, mesures prises pour améliorer l'efficacité " +
                'énergétique et recours aux énergies renouvelables'),
            saisie('changement-climatique-rejets-de-gaz-a-effet-de-s', 'Changement climatique : rejets de gaz à effet de serre'),
            saisie('protection-de-la-biodiversite-mesures-prises-pou', 'Protection de la biodiversité : mesures prises pour préserver ou développer la biodiversité'),
            saisie('informations-relatives-aux-engagements-societaux', 'INFORMATIONS RELATIVES AUX ENGAGEMENTS SOCIÉTAUX EN FAVEUR DU DÉVELOPPEMENT DURABLE'),
            saisie('impact-territorial-economique-et-social-de-l-act', "Impact territorial, économique et social de l'activité de la société : en matière d'emploi et de " +
                'développement régional'),
            saisie('impact-territorial-economique-et-social-de-l-act-2', "Impact territorial, économique et social de l'activité de la société : sur les populations riveraines ou locales"),
            saisie('relations-entretenues-avec-les-personnes-ou-les', "Relations entretenues avec les personnes ou les organisations intéressées par l'activité de la société " +
                "(associations d'insertion, établissements d'enseignement…) : conditions du dialogue avec ces personnes ou " +
                'organisations'),
            saisie('relations-entretenues-avec-les-personnes-ou-les-2', "Relations entretenues avec les personnes ou les organisations intéressées par l'activité de la société : " +
                'actions de partenariat ou de mécénat'),
            saisie('sous-traitance-et-fournisseurs-prise-en-compte-d', "Sous-traitance et fournisseurs : prise en compte dans la politique d'achat des enjeux sociaux et environnementaux"),
        ],
        renvoiOfficiel: `Note obligatoire pour les entités ayant un effectif de plus de ${exports.SEUILS_NOTE_35.effectifNote35TitreIX} salariés. ` +
            `[texte officiel] Le Titre VIII ch. 30 § 1.4.3 fixe la même obligation à plus de ${exports.SEUILS_NOTE_35.effectifTitreVIIIChapitre30} ` +
            'salariés : contradiction entre les deux titres, non tranchée ici.',
    },
    {
        code: '36',
        titre: 'TABLES DES CODES',
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: 'Code' },
            { type: 'LIBRE', libelle: 'Libellé' },
        ],
        precisionEditeur: "Les codes qui renvoient à ces tables sont ceux de l'AUDCIF · fiche R2 : ZK forme juridique, ZL régime " +
            "fiscal, ZM pays du siège, colonne « code nomenclature d'activité » (le renvoi (¹) officiel imprime NOTE 34) ; " +
            "fiche R1 : ZE code activité principale, rattachement lu par OmegaX. La Fiche 1 de cette liasse suit le gabarit " +
            "ETAFI, où le code activité principale est en ZI. La fiche R2 de la liasse du Système normal lit ses codes ZK, " +
            'ZL et ZM dans les trois premières rubriques de cette note.',
        rubriques: [
            saisie('1-code-forme-juridique-1', '1 · Code forme juridique (1)', exports.RENVOI_1_FORME_JURIDIQUE_SYSCOHADA),
            saisie('2-code-regime-fiscal', '2 · Code régime fiscal'),
            saisie('3-code-pays-du-siege-social-2', '3 · Code pays du siège social (2)', `(2) Pays OHADA : Congo RDC = ${exports.CODE_PAYS_OHADA_RDC}.`),
            saisie('codes-activites-economiques-44-groupes-nomenclat', 'Codes activités économiques (44 groupes, nomenclature à six chiffres)'),
        ],
        renvoiOfficiel: '[texte officiel] La table 3 est lacunaire : elle saute de 00 à 21, puis de 23 à 39, de 41 à 49, de 50 à 99 ; ' +
            'les codes intermédiaires ne sont pas définis. Le renvoi (¹) de la fiche R2 désigne la NOTE 34 alors que les ' +
            'tables des codes sont la NOTE 36.',
    },
];
exports.CODES_NOTES_SYSCOHADA_3 = ['28', '29', '30', '31', '32', '33', '34', '35', '36'];
//# sourceMappingURL=correspondance-notes-syscohada-3.js.map