"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CODES_NOTES_SYSCOHADA_1 = exports.NOTES_SYSCOHADA_1 = void 0;
const COLONNES_N_N1_POURCENT = [
    { type: 'EXERCICE_N', libelle: 'Année N' },
    { type: 'EXERCICE_N1', libelle: 'Année N-1' },
    { type: 'VARIATION_POURCENT', libelle: 'Variation en %' },
];
const COLONNES_CREANCES_ECHEANCES = [
    ...COLONNES_N_N1_POURCENT,
    { type: 'ECHEANCE_1AN', libelle: 'Créances à un an au plus' },
    { type: 'ECHEANCE_2ANS', libelle: "Créances à plus d'un an et à deux ans au plus" },
    { type: 'ECHEANCE_PLUS_2ANS', libelle: 'Créances à plus de deux ans' },
];
function enAttente(cle, libelle, attendu) {
    return { cle, libelle, subdivisionAttendue: attendu };
}
exports.NOTES_SYSCOHADA_1 = [
    {
        code: '1',
        sousTableau: 'DETTES GARANTIES PAR DES SÛRETÉS RÉELLES',
        titre: 'DETTES GARANTIES PAR DES SÛRETÉS RÉELLES',
        colonnes: [
            { type: 'LIBRE', libelle: 'Note', porteLeRenvoi: true },
            { type: 'EXERCICE_N', libelle: 'Montant brut' },
            { type: 'LIBRE', libelle: 'SÛRETÉS RÉELLES : Hypothèques', saisieSurLigneChiffree: true },
            { type: 'LIBRE', libelle: 'SÛRETÉS RÉELLES : Nantissements', saisieSurLigneChiffree: true },
            { type: 'LIBRE', libelle: 'SÛRETÉS RÉELLES : Gages/autres', saisieSurLigneChiffree: true },
        ],
        rubriques: [
            {
                cle: 'dettes-garanties-emprunts-obligataires-convertibles',
                libelle: 'Emprunts obligataires convertibles',
                comptes: ['1612'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            {
                cle: 'dettes-garanties-autres-emprunts-obligataires',
                libelle: 'Autres emprunts obligataires',
                comptes: ['161'],
                exclusions: ['1612'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            {
                cle: 'dettes-garanties-etablissements-de-credit',
                libelle: 'Emprunts et dettes des établissements de crédit',
                comptes: ['162'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            {
                cle: 'dettes-garanties-autres-dettes-financieres',
                libelle: 'Autres dettes financières',
                comptes: ['16', '181', '182', '183', '184'],
                exclusions: ['161', '162'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            { libelle: 'SOUS TOTAL (1)', totalDeRubriques: [0, 1, 2, 3] },
            {
                cle: 'dettes-garanties-credit-bail-immobilier',
                libelle: 'Dettes de crédit-bail immobilier',
                comptes: ['172', '1762'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            {
                cle: 'dettes-garanties-credit-bail-mobilier',
                libelle: 'Dettes de crédit-bail mobilier',
                comptes: ['173', '1763'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            {
                cle: 'dettes-garanties-location-vente',
                libelle: 'Dettes sur contrats de location-vente',
                comptes: ['174', '1764'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            {
                cle: 'dettes-garanties-location-acquisition',
                libelle: 'Dettes sur contrats de location-acquisition',
                comptes: ['178', '1768'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            { libelle: 'SOUS TOTAL (2)', totalDeRubriques: [5, 6, 7, 8] },
            {
                cle: 'dettes-garanties-fournisseurs',
                libelle: 'Fournisseurs et comptes rattachés',
                comptes: ['40'],
                exclusions: ['409'],
                natureCreditrice: true,
                renvoi: '17',
            },
            { cle: 'dettes-garanties-clients', libelle: 'Clients', comptes: ['419'], natureCreditrice: true, renvoi: '7' },
            { cle: 'dettes-garanties-personnel', libelle: 'Personnel', comptes: ['42'], sens: 'CREDITEUR', renvoi: '18' },
            {
                cle: 'dettes-garanties-securite-sociale',
                libelle: 'Sécurité sociale et organismes sociaux',
                comptes: ['43'],
                sens: 'CREDITEUR',
                renvoi: '18',
            },
            { cle: 'dettes-garanties-etat', libelle: 'État', comptes: ['44'], sens: 'CREDITEUR', renvoi: '18' },
            {
                cle: 'dettes-garanties-organismes-internationaux',
                libelle: 'Organismes internationaux',
                comptes: ['45'],
                sens: 'CREDITEUR',
                renvoi: '19',
            },
            {
                cle: 'dettes-garanties-associes-et-groupe',
                libelle: 'Associés et groupe',
                comptes: ['46'],
                sens: 'CREDITEUR',
                renvoi: '19',
            },
            {
                cle: 'dettes-garanties-crediteurs-divers',
                libelle: 'Créditeurs divers',
                comptes: ['47', '185'],
                exclusions: ['478', '479'],
                sens: 'CREDITEUR',
                renvoi: '19',
            },
            { libelle: 'SOUS TOTAL (3)', totalDeRubriques: [10, 11, 12, 13, 14, 15, 16, 17] },
            { libelle: 'TOTAL (1) + (2) + (3)', totalDeRubriques: [4, 9, 18] },
        ],
        commentaire: "indiquer la raison d'être des sûretés.",
    },
    {
        code: '1',
        sousTableau: 'ENGAGEMENTS FINANCIERS',
        titre: 'ENGAGEMENTS FINANCIERS',
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: 'Engagements donnés' },
            { type: 'LIBRE', libelle: 'Engagements reçus' },
        ],
        rubriques: [
            { cle: 'engagements-consentis-a-des-entites-liees', libelle: 'Engagements consentis à des entités liées', saisie: true },
            { cle: 'primes-de-remboursement-non-echues', libelle: 'Primes de remboursement non échues', saisie: true },
            { cle: 'avals-cautions-garanties', libelle: 'Avals, cautions, garanties', saisie: true },
            { cle: 'hypotheques-nantissements-gages-autres', libelle: 'Hypothèques, nantissements, gages, autres', saisie: true },
            { cle: 'effets-escomptes-non-echus', libelle: 'Effets escomptés non échus', saisie: true },
            { cle: 'creances-commerciales-et-professionnelles-cedees', libelle: 'Créances commerciales et professionnelles cédées', saisie: true },
            { cle: 'abandons-de-creances-conditionnels', libelle: 'Abandons de créances conditionnels', saisie: true },
            { cle: 'total', libelle: 'TOTAL', saisie: true },
        ],
    },
    {
        code: '2',
        titre: 'INFORMATIONS OBLIGATOIRES',
        horsBalance: true,
        applicableDOffice: "AUDCIF Titre IX ch. 6 § 1.1 · « Les Notes annexes doivent comporter obligatoirement une déclaration " +
            'explicite de conformité », portée par cette note.',
        colonnes: [{ type: 'LIBRE', libelle: 'Informations' }],
        rubriques: [
            { cle: 'a-declaration-de-conformite-au-syscohada', libelle: 'A - DÉCLARATION DE CONFORMITÉ AU SYSCOHADA', saisie: true },
            { cle: 'b-regles-et-methodes-comptables', libelle: 'B - RÈGLES ET MÉTHODES COMPTABLES', saisie: true },
            { cle: 'c-derogation-aux-postulats-et-conventions-compta', libelle: 'C - DÉROGATION AUX POSTULATS ET CONVENTIONS COMPTABLES', saisie: true },
            {
                cle: 'd-informations-complementaires-relatives-au-bila', libelle: 'D - INFORMATIONS COMPLÉMENTAIRES RELATIVES AU BILAN, AU COMPTE DE RÉSULTAT ET AU TABLEAU DES FLUX DE ' +
                    'TRÉSORERIE',
                saisie: true,
            },
        ],
        commentaire: 'Les Notes annexes doivent comporter obligatoirement une déclaration explicite de conformité au Plan ' +
            'Comptable OHADA (PCGO). Les états financiers ne doivent être déclarés conformes au SYSCOHADA que s’ils ' +
            'sont conformes à toutes les dispositions relatives au Système comptable OHADA.',
    },
    {
        code: '3A',
        titre: 'IMMOBILISATION BRUTE',
        colonnes: [
            { type: 'OUVERTURE', libelle: "MONTANT BRUT À L'OUVERTURE DE L'EXERCICE" },
            { type: 'AUGMENTATIONS', libelle: 'Acquisitions, Apports, Créations' },
            { type: 'VIREMENTS_AUGMENTATION', libelle: 'AUGMENTATIONS : Virements de poste à poste' },
            { type: 'REEVALUATION', libelle: "Suite à une réévaluation pratiquée au cours de l'exercice" },
            { type: 'DIMINUTIONS', libelle: 'Cessions, Scissions, Hors service' },
            { type: 'VIREMENTS_DIMINUTION', libelle: 'DIMINUTIONS : Virements de poste à poste' },
            { type: 'CLOTURE', libelle: "MONTANT BRUT À LA CLÔTURE DE L'EXERCICE" },
        ],
        renvoyeeDepuis: ['AD', 'AI', 'AP'],
        rubriques: [
            { libelle: 'Frais de développement et de prospection', comptes: ['211', '2181', '2191'] },
            { libelle: 'Brevets, licences, logiciels et droits similaires', comptes: ['212', '213', '214', '2193'] },
            { libelle: 'Fonds commercial et droit au bail', comptes: ['215', '216'] },
            { libelle: 'Autres immobilisations incorporelles', comptes: ['217', '218', '2198'], exclusions: ['2181'] },
            { libelle: 'Terrains hors immeuble de placement', comptes: ['22'], exclusions: ['2281'] },
            { libelle: 'Terrains - immeuble de placement', comptes: ['2281'] },
            {
                libelle: 'Bâtiments hors immeuble de placement',
                comptes: ['231', '232', '233', '237', '2391'],
                exclusions: ['2315', '2325'],
            },
            { libelle: 'Bâtiments - immeuble de placement', comptes: ['2315', '2325'] },
            {
                libelle: 'Aménagements, agencements et installations',
                comptes: ['234', '235', '238', '2392', '2393', '2394', '2395', '2398'],
            },
            { libelle: 'Matériel, mobilier et actifs biologiques', comptes: ['24'], exclusions: ['245', '2495'] },
            { libelle: 'Matériel de transport', comptes: ['245', '2495'] },
            { libelle: 'Avances et acomptes versés sur immobilisations incorporelles', comptes: ['251'] },
            { libelle: 'Avances et acomptes versés sur immobilisations corporelles', comptes: ['252'] },
            { libelle: 'Titres de participation', comptes: ['26'] },
            { libelle: 'Autres immobilisations financières', comptes: ['27'] },
            { libelle: 'TOTAL GÉNÉRAL', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
        ],
        commentaire: 'toute variation significative doit être commentée ; détailler les éléments constitutifs du fonds ' +
            "commercial et indiquer la date d'acquisition ; pour l'immobilisation incorporelle relative à la " +
            "concession, faire un descriptif de l'accord et indiquer la nature de la créance, la durée de la " +
            "concession, l'échéance ; indiquer les créances du groupe avec nature et date d'échéance ; pour les " +
            "banques, DAT, indiquer le nom de la banque, le montant et la date d'échéance.",
    },
    {
        code: '3B',
        titre: 'BIENS PRIS EN LOCATION ACQUISITION',
        colonnes: [
            { type: 'LIBRE', libelle: 'NATURE DU CONTRAT (I ; M ; A)', saisieSurLigneChiffree: true },
            { type: 'OUVERTURE', libelle: "A · MONTANT BRUT À L'OUVERTURE" },
            { type: 'AUGMENTATIONS', libelle: 'B · AUGMENTATIONS : Acquisitions/Apports/Créations' },
            { type: 'VIREMENTS_AUGMENTATION', libelle: 'B · AUGMENTATIONS : Virements de poste à poste' },
            {
                type: 'REEVALUATION',
                libelle: "B · AUGMENTATIONS : Suite à une réévaluation pratiquée au cours de l'exercice",
            },
            { type: 'DIMINUTIONS', libelle: 'C · DIMINUTIONS : Cessions/Scissions/Hors service' },
            { type: 'VIREMENTS_DIMINUTION', libelle: 'C · DIMINUTIONS : Virements de poste à poste' },
            { type: 'CLOTURE', libelle: 'D = A + B - C · MONTANT BRUT À LA CLÔTURE' },
        ],
        rubriques: [
            {
                cle: 'brevets-licences-logiciels-et-droits-similaires',
                libelle: 'Brevets, licences, logiciels et droits similaires',
                saisie: true,
            },
            { cle: 'fonds-commercial-et-droit-au-bail', libelle: 'Fonds commercial et droit au bail', saisie: true },
            { cle: 'autres-immobilisations-incorporelles', libelle: 'Autres immobilisations incorporelles', saisie: true },
            { libelle: 'SOUS TOTAL : IMMOBILISATIONS INCORPORELLES', totalDeRubriques: [0, 1, 2] },
            { cle: 'location-acquisition-terrains', libelle: 'Terrains', comptes: ['2286'] },
            { cle: 'location-acquisition-batiments', libelle: 'Bâtiments', comptes: ['2316', '2326'] },
            enAttente('amenagements-location-acquisition', 'Aménagements, agencements et installations', 'Le plan ne prévoit aucun divisionnaire « de location-acquisition » dans les comptes 234, 235 et 238 ' +
                '(Titre VII COMPTE 23 n’en ouvre qu’en 2316 et 2326) : subdiviser le compte concerné et rattacher ' +
                'ici le sous-compte des aménagements pris en location-acquisition.'),
            {
                cle: 'location-acquisition-materiel-mobilier',
                libelle: 'Matériel, mobilier et actifs biologiques',
                comptes: ['2416', '2426', '2446'],
            },
            { cle: 'location-acquisition-materiel-transport', libelle: 'Matériel de transport', comptes: ['2456'] },
            { libelle: 'SOUS TOTAL : IMMOBILISATIONS CORPORELLES', totalDeRubriques: [4, 5, 6, 7, 8] },
            { libelle: 'TOTAL GÉNÉRAL', totalDeRubriques: [3, 9] },
        ],
        renvoiOfficiel: 'I : Crédit-bail immobilier ; M : Crédit-bail mobilier ; A : Autres contrats (dédoubler le poste si ' +
            'montants significatifs).',
        commentaire: 'indiquer la nature du bien, le nom du bailleur et la durée du bail.',
    },
    {
        code: '3C',
        titre: 'IMMOBILISATIONS : AMORTISSEMENTS',
        sensAccroissement: 'CREDIT',
        colonnes: [
            { type: 'OUVERTURE', libelle: "A · AMORTISSEMENTS CUMULÉS À L'OUVERTURE DE L'EXERCICE" },
            { type: 'AUGMENTATIONS', libelle: "B · AUGMENTATIONS : DOTATIONS DE L'EXERCICE" },
            {
                type: 'DIMINUTIONS',
                libelle: "C · DIMINUTIONS : amortissements relatifs aux éléments sortis de l'actif",
            },
            { type: 'CLOTURE', libelle: "D = A + B - C · CUMUL DES AMORTISSEMENTS À LA CLÔTURE DE L'EXERCICE" },
        ],
        renvoyeeDepuis: ['AD', 'AI', 'AP', 'RL', 'RN'],
        rubriques: [
            { libelle: 'Frais de développement et de prospection', comptes: ['2811'] },
            { libelle: 'Brevets, licences, logiciels et droits similaires', comptes: ['2812', '2813', '2814'] },
            { libelle: 'Fonds commercial et droit au bail', comptes: ['2815', '2816'] },
            { libelle: 'Autres immobilisations incorporelles', comptes: ['2817', '2818'] },
            { libelle: 'SOUS TOTAL : IMMOBILISATIONS INCORPORELLES', totalDeRubriques: [0, 1, 2, 3] },
            { libelle: 'Terrains hors immeuble de placement', comptes: ['282'] },
            {
                cle: 'terrains-immeuble-de-placement',
                libelle: 'Terrains - immeuble de placement',
                saisie: true,
                renvoi: 'Le compte 282 « Amortissements des terrains » n’est pas subdivisé par destination (seul 2824 ' +
                    'existe) et la ligne « Terrains hors immeuble de placement » ci-dessus prend 282 en entier : ' +
                    'montant à saisir, hors balance, sans quoi il serait compté deux fois.',
            },
            { libelle: 'Bâtiments hors immeuble de placement', comptes: ['2831', '2832', '2833', '2837'] },
            {
                cle: 'batiments-immeuble-de-placement',
                libelle: 'Bâtiments - immeuble de placement',
                saisie: true,
                renvoi: 'Les comptes 2831 et 2832 ne sont pas subdivisés (contrairement au brut, 2315 et 2325) et la ligne ' +
                    '« Bâtiments hors immeuble de placement » ci-dessus les prend en entier : montant à saisir, hors ' +
                    'balance, sans quoi il serait compté deux fois.',
            },
            { libelle: 'Aménagements, agencements et installations', comptes: ['2834', '2835', '2838'] },
            { libelle: 'Matériel, mobilier et actifs biologiques', comptes: ['284'], exclusions: ['2845'] },
            { libelle: 'Matériel de transport', comptes: ['2845'] },
            { libelle: 'SOUS TOTAL : IMMOBILISATIONS CORPORELLES', totalDeRubriques: [5, 6, 7, 8, 9, 10, 11] },
            { libelle: 'TOTAL GÉNÉRAL', totalDeRubriques: [4, 12] },
        ],
        commentaire: "indiquer les modes d'amortissement utilisés ; la durée de vie ou les taux d'amortissements utilisés.",
    },
    {
        code: '3D',
        titre: 'IMMOBILISATIONS : PLUS-VALUES ET MOINS VALUE DE CESSION',
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: 'A · MONTANT BRUT' },
            { type: 'LIBRE', libelle: 'B · AMORTISSEMENTS PRATIQUÉS' },
            { type: 'LIBRE', libelle: 'C = A - B · VALEUR COMPTABLE NETTE' },
            { type: 'LIBRE', libelle: 'D · PRIX DE CESSION' },
            { type: 'LIBRE', libelle: 'E = D - C · PLUS-VALUE OU MOINS-VALUE' },
        ],
        renvoyeeDepuis: ['TN', 'RO'],
        rubriques: [
            { cle: 'frais-de-developpement-et-de-prospection', libelle: 'Frais de développement et de prospection', saisie: true },
            { cle: 'brevets-licences-logiciels-et-droits-similaires', libelle: 'Brevets, licences, logiciels et droits similaires', saisie: true },
            { cle: 'fonds-commercial-et-droit-au-bail', libelle: 'Fonds commercial et droit au bail', saisie: true },
            { cle: 'autres-immobilisations-incorporelles', libelle: 'Autres immobilisations incorporelles', saisie: true },
            { cle: 'sous-total-immobilisations-incorporelles', libelle: 'SOUS TOTAL : IMMOBILISATIONS INCORPORELLES', saisie: true },
            { cle: 'terrains', libelle: 'Terrains', saisie: true },
            { cle: 'batiments', libelle: 'Bâtiments', saisie: true },
            { cle: 'amenagements-agencements-et-installations', libelle: 'Aménagements, agencements et installations', saisie: true },
            { cle: 'materiel-mobilier-et-actifs-biologiques', libelle: 'Matériel, mobilier et actifs biologiques', saisie: true },
            { cle: 'materiel-de-transport', libelle: 'Matériel de transport', saisie: true },
            { cle: 'sous-total-immobilisations-corporelles', libelle: 'SOUS TOTAL : IMMOBILISATIONS CORPORELLES', saisie: true },
            { cle: 'titres-de-participations', libelle: 'Titres de participations', saisie: true },
            { cle: 'autres-immobilisations-financieres', libelle: 'Autres immobilisations financières', saisie: true },
            { cle: 'sous-total-immobilisations-financieres', libelle: 'SOUS TOTAL : IMMOBILISATIONS FINANCIÈRES', saisie: true },
            { cle: 'total-general', libelle: 'TOTAL GÉNÉRAL', saisie: true },
        ],
        commentaire: "mentionner la justification de la cession ainsi que la date d'acquisition et la date de sortie.",
    },
    {
        code: '3E',
        titre: "INFORMATIONS SUR LES RÉÉVALUATIONS EFFECTUÉES PAR L'ENTITÉ",
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: 'Éléments réévalués par postes du bilan' },
            { type: 'LIBRE', libelle: 'Montants coûts historiques' },
            { type: 'LIBRE', libelle: 'Amortissements supplémentaires' },
        ],
        renvoyeeDepuis: ['CE'],
        rubriques: [
            { cle: 'nature-et-date-des-reevaluations', libelle: 'Nature et date des réévaluations', saisie: true },
            { cle: 'elements-reevalues-par-postes-du-bilan', libelle: 'Éléments réévalués par postes du bilan', saisie: true },
            { cle: 'methode-de-reevaluation-utilisee', libelle: 'Méthode de réévaluation utilisée', saisie: true },
            {
                cle: 'traitement-fiscal-de-l-ecart-de-reevaluation-et',
                libelle: "Traitement fiscal de l'écart de réévaluation et des amortissements supplémentaires",
                saisie: true,
            },
            { cle: 'montant-de-l-ecart-incorpore-au-capital', libelle: "Montant de l'écart incorporé au capital", saisie: true },
        ],
    },
    {
        code: '3F',
        titre: "TABLEAU D'ÉTALEMENT DES CHARGES IMMOBILISÉES",
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: "Frais d'établissement" },
            { type: 'LIBRE', libelle: 'Charges à répartir sur plusieurs exercices' },
            { type: 'LIBRE', libelle: 'Primes de remboursement des obligations' },
        ],
        rubriques: [
            { cle: 'montant-global-a-etaler-au-1er-janvier-2018', libelle: 'Montant global à étaler au 1er janvier 2018', saisie: true },
            { cle: 'duree-d-etalement-retenue', libelle: "Durée d'étalement retenue", saisie: true },
            {
                cle: 'exercice-2018-comptes-montants-comptes-60-61-62',
                libelle: 'Exercice 2018 · Comptes / Montants (comptes 60…, 61…, 62…, 63… ; compte 6714 pour les primes)',
                saisie: true,
            },
            { cle: 'total-exercice-2018', libelle: 'Total exercice 2018', saisie: true },
            { cle: 'total-exercice-2019', libelle: 'Total exercice 2019', saisie: true },
            { cle: 'total-exercice-2020', libelle: 'Total exercice 2020', saisie: true },
            { cle: 'total-exercice-2021', libelle: 'Total exercice 2021', saisie: true },
            { cle: 'total-exercice-2022', libelle: 'Total exercice 2022', saisie: true },
            { cle: 'total-general', libelle: 'TOTAL GÉNÉRAL', saisie: true },
        ],
    },
    {
        code: '4',
        sousTableau: 'IMMOBILISATIONS FINANCIÈRES',
        titre: 'IMMOBILISATIONS FINANCIÈRES',
        colonnes: COLONNES_CREANCES_ECHEANCES,
        renvoyeeDepuis: ['AQ'],
        rubriques: [
            { libelle: 'Titres de participation', comptes: ['26'] },
            {
                libelle: 'Prêts et créances',
                comptes: ['27'],
                exclusions: ['272', '273', '274', '275', '276'],
                renvoi: 'Comprend, faute de ligne au modèle officiel, le compte 277 « Créances rattachées à des ' +
                    'participations et avances à des GIE » (Titre VII COMPTE 27 : ce sont « des prêts ou avances ' +
                    'consentis à une société dans laquelle l’entité détient une participation ») et le compte 278 ' +
                    '« Immobilisations financières diverses », dont 2784 « Banques dépôts à terme » et 2785 « Or et ' +
                    'métaux précieux » ne sont ni des prêts ni des créances.',
            },
            { libelle: 'Prêt au personnel', comptes: ['272'] },
            { libelle: "Créances sur l'état", comptes: ['273'] },
            { libelle: 'Titres immobilisés', comptes: ['274'] },
            { libelle: 'Dépôts et cautionnements', comptes: ['275'] },
            { libelle: 'Intérêts courus', comptes: ['276'] },
            { libelle: 'TOTAL BRUT', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6] },
            { libelle: 'Dépréciations titres de participation', comptes: ['296'], presenterEnNegatif: true },
            { libelle: 'Dépréciations autres immobilisations', comptes: ['297'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DÉPRÉCIATION', totalDeRubriques: [7, 8, 9] },
        ],
        commentaire: 'justifier toute variation significative ; commenter toutes les créances anciennes ; pour les créances ' +
            "relatives à la concession, faire un descriptif de l'accord et indiquer la nature de la créance, la " +
            "durée de la concession, l'échéance ; indiquer le nombre et la date d'acquisition des actions ou parts " +
            'propres ; dépréciation : indiquer les événements et les circonstances qui ont motivé la dépréciation ' +
            'ou la reprise.',
    },
    {
        code: '4',
        sousTableau: 'LISTE DES FILIALES ET PARTICIPATIONS',
        titre: 'LISTE DES FILIALES ET PARTICIPATIONS',
        horsBalance: true,
        colonnes: [
            { type: 'LIBRE', libelle: 'Dénomination sociale' },
            { type: 'LIBRE', libelle: 'Localisation (ville / pays)' },
            { type: 'LIBRE', libelle: "Valeur d'acquisition" },
            { type: 'LIBRE', libelle: '% Détenu' },
            { type: 'LIBRE', libelle: 'Montant des capitaux propres filiale' },
            { type: 'LIBRE', libelle: 'Résultat dernier exercice filiale' },
        ],
        rubriques: [
            {
                cle: 'filiales-et-participations-une-ligne-par-entite',
                libelle: 'Filiales et participations (une ligne par entité)',
                saisie: true,
                repetable: true,
            },
        ],
    },
    {
        code: '5',
        sousTableau: 'ACTIF CIRCULANT HAO',
        titre: 'ACTIF CIRCULANT HAO',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['BA'],
        rubriques: [
            { libelle: "Créances sur cessions d'immobilisations", comptes: ['485'] },
            { libelle: 'Autres créances hors activités ordinaires', comptes: ['488'] },
            { libelle: 'TOTAL BRUT', totalDeRubriques: [0, 1] },
            { libelle: 'Dépréciations des créances HAO', comptes: ['498'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DÉPRÉCIATION', totalDeRubriques: [2, 3] },
        ],
        commentaire: 'commenter toute variation significative ; dépréciation : indiquer les événements et circonstances qui ' +
            'ont motivé la dépréciation ou la reprise.',
    },
    {
        code: '5',
        sousTableau: 'DETTES CIRCULANTES HAO',
        titre: 'DETTES CIRCULANTES HAO',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['DH'],
        rubriques: [
            { libelle: "Fournisseurs d'investissements", comptes: ['481'], exclusions: ['4813'], natureCreditrice: true },
            { libelle: "Fournisseurs d'investissements effets à payer", comptes: ['482'], natureCreditrice: true },
            {
                libelle: 'Versements restant à effectuer sur titres de participation et titres immobilisés non libérés',
                comptes: ['4813'],
                natureCreditrice: true,
            },
            { libelle: 'Autres dettes hors activités ordinaires', comptes: ['484', '4998'], natureCreditrice: true },
            { libelle: 'TOTAL', totalDeRubriques: [0, 1, 2, 3] },
        ],
        commentaire: "indiquer la date de cession et la nature de l'immobilisation achetée et/ou cédée ; expliciter toute " +
            'variation significative.',
    },
    {
        code: '6',
        titre: 'STOCKS ET ENCOURS',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['BB', 'RB', 'TE', 'RD', 'RF'],
        rubriques: [
            { libelle: 'Marchandises', comptes: ['31'] },
            { libelle: 'Matières premières et fournitures liées', comptes: ['32'] },
            { libelle: 'Autres approvisionnements', comptes: ['33'] },
            { libelle: 'Produits en cours', comptes: ['34'] },
            { libelle: 'Services en cours', comptes: ['35'] },
            { libelle: 'Produits finis', comptes: ['36'] },
            { libelle: 'Produits intermédiaires', comptes: ['37'] },
            { libelle: 'Stocks en cours de route, en consignation ou en dépôt', comptes: ['38'] },
            { libelle: 'TOTAL BRUT STOCKS ET EN COURS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7] },
            { libelle: 'Dépréciations des stocks', comptes: ['39'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DÉPRÉCIATION', totalDeRubriques: [8, 9] },
        ],
        renvoiOfficiel: "(1) Les stocks HAO seront inscrits dans l'actif circulant HAO que lorsque leur montant total est " +
            "significatif (supérieur à 5 % du total de l'actif circulant).",
        commentaire: "indiquer la date de prise d'inventaire et décrire brièvement la procédure et les méthodes comptables " +
            'adoptées pour évaluer le stock ; commenter toute variation significative des stocks ; indiquer le détail ' +
            'des stocks dépréciés et les événements et circonstances qui ont conduit à la dépréciation et à la reprise.',
    },
    {
        code: '7',
        titre: 'CLIENTS PRODUITS À RECEVOIR',
        colonnes: COLONNES_CREANCES_ECHEANCES,
        renvoyeeDepuis: ['BI', 'DI'],
        rubriques: [
            {
                libelle: 'Clients (hors réserves de propriété Groupe)',
                comptes: ['411', '413'],
                exclusions: ['4112', '4116'],
            },
            { libelle: 'Clients effets à recevoir (hors réserves de propriété groupe)', comptes: ['412'], exclusions: ['4122'] },
            { libelle: 'Clients et effets à recevoir avec réserves de propriété', comptes: ['4116'] },
            { libelle: 'Clients et effets à recevoir Groupe', comptes: ['4112', '4122'] },
            { libelle: "Créances sur cession d'immobilisations", comptes: ['414'] },
            { libelle: 'Clients effets escomptés et non échus', comptes: ['415'] },
            { libelle: 'Créances litigieuses ou douteuses', comptes: ['416'] },
            { libelle: 'Clients produits à recevoir', comptes: ['418'] },
            { libelle: 'TOTAL BRUT CLIENTS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7] },
            { libelle: 'Dépréciations des comptes clients', comptes: ['491'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DÉPRÉCIATION', totalDeRubriques: [8, 9] },
            { libelle: 'Clients, avances reçues hors groupe', comptes: ['4191'], natureCreditrice: true },
            { libelle: 'Clients, avances reçues groupe', comptes: ['4192'], natureCreditrice: true },
            { libelle: 'Autres clients créditeurs', comptes: ['419'], exclusions: ['4191', '4192'], natureCreditrice: true },
            { libelle: 'TOTAL CLIENTS CRÉDITEURS', totalDeRubriques: [11, 12, 13] },
        ],
        commentaire: 'commenter toutes variations significatives ; indiquer pour les créances du groupe le nom de la société ' +
            'du groupe et le % de titres détenues ; commenter les créances anciennes ; indiquer les événements et ' +
            'circonstances qui ont conduit à la dépréciation et à la reprise.',
    },
    {
        code: '8',
        titre: 'AUTRES CRÉANCES',
        colonnes: COLONNES_CREANCES_ECHEANCES,
        renvoyeeDepuis: ['BJ'],
        rubriques: [
            { libelle: 'Personnel', comptes: ['42'], sens: 'DEBITEUR' },
            { libelle: 'Organismes sociaux', comptes: ['43'], sens: 'DEBITEUR' },
            { libelle: 'État et Collectivités publiques', comptes: ['44'], sens: 'DEBITEUR' },
            { libelle: 'Organismes internationaux', comptes: ['45'], sens: 'DEBITEUR' },
            { libelle: 'Apporteurs, associés et groupe', comptes: ['46'], sens: 'DEBITEUR' },
            {
                libelle: 'Compte transitoire ajustement spécial lié à la révision du SYSCOHADA',
                comptes: ['475'],
                sens: 'DEBITEUR',
            },
            { libelle: 'Autres débiteurs divers', comptes: ['47'], exclusions: ['475', '478', '479'], sens: 'DEBITEUR' },
            { libelle: 'Comptes permanents non bloqués des établissements et des succursales', comptes: ['185'], sens: 'DEBITEUR' },
            { libelle: 'Comptes de liaison charges et produits', comptes: ['186', '187'], sens: 'DEBITEUR' },
            { libelle: 'Comptes de liaison des sociétés en participation', comptes: ['188'], sens: 'DEBITEUR' },
            { libelle: 'TOTAL BRUT AUTRES CRÉANCES', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
            {
                libelle: 'Dépréciations des autres créances',
                comptes: ['492', '493', '494', '495', '496', '497'],
                presenterEnNegatif: true,
            },
            { libelle: 'TOTAL NET DE DÉPRÉCIATION', totalDeRubriques: [10, 11] },
        ],
        commentaire: 'justifier toute variation significative ; détailler les créances dont le montant est significatif ; ' +
            'justifier les créances anciennes ; indiquer les événements et circonstances qui ont conduit à la ' +
            "dépréciation et à la reprise ; compte transitoire ajustement spécial : indiquer le détail du compte et " +
            "la durée restant pour l'apurement.",
    },
    {
        code: '9',
        titre: 'TITRES DE PLACEMENT',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['BQ'],
        rubriques: [
            { libelle: 'Titres de trésor et bons de caisse à court terme', comptes: ['501'] },
            { libelle: 'Actions', comptes: ['502'] },
            { libelle: 'Obligations', comptes: ['503'] },
            { libelle: 'Bons de souscription', comptes: ['504'] },
            { libelle: 'Titres négociables hors régions', comptes: ['505'] },
            { libelle: 'Intérêts courus', comptes: ['506'] },
            { libelle: 'Autres valeurs assimilés', comptes: ['50'], exclusions: ['501', '502', '503', '504', '505', '506'] },
            { libelle: 'TOTAL BRUT TITRES', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6] },
            { libelle: 'Dépréciations des titres', comptes: ['590'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DÉPRÉCIATION', totalDeRubriques: [7, 8] },
        ],
        commentaire: 'justifier toute variation significative ; pour les titres cotés à une bourse de valeur, indiquer le ' +
            "nombre, le prix unitaire d'acquisition et le cours de la bourse au 31 décembre ; faire ressortir les " +
            "actions ou parts propres et indiquer la date d'acquisition et le nombre de titres détenus ; indiquer " +
            'les événements et circonstances qui ont conduit à la dépréciation et à la reprise.',
    },
    {
        code: '10',
        titre: 'VALEURS À ENCAISSER',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['BR'],
        rubriques: [
            { libelle: 'Effets à encaisser', comptes: ['511'] },
            { libelle: "Effets à l'encaissement", comptes: ['512'] },
            { libelle: 'Chèques à encaisser', comptes: ['513'] },
            { libelle: "Chèques à l'encaissement", comptes: ['514'] },
            { libelle: 'Cartes de crédit à encaisser', comptes: ['515'] },
            { libelle: 'Autres valeurs à encaisser', comptes: ['51'], exclusions: ['511', '512', '513', '514', '515'] },
            { libelle: 'TOTAL BRUT VALEURS À ENCAISSER', totalDeRubriques: [0, 1, 2, 3, 4, 5] },
            { libelle: 'Dépréciations des valeurs à encaisser', comptes: ['591'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DÉPRÉCIATION', totalDeRubriques: [6, 7] },
        ],
        commentaire: 'commenter toute variation significative ; indiquer les événements et circonstances qui ont conduit à la ' +
            'dépréciation et à la reprise.',
    },
    {
        code: '11',
        titre: 'DISPONIBILITÉS',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['BS'],
        rubriques: [
            { libelle: 'Banques locales', comptes: ['521'], sens: 'DEBITEUR' },
            { libelle: 'Banques autres états région', comptes: ['522'], sens: 'DEBITEUR' },
            { libelle: 'Banques, dépôt à terme', comptes: ['525'], sens: 'DEBITEUR' },
            { libelle: 'Autres banques', comptes: ['52'], exclusions: ['521', '522', '525', '526'], sens: 'DEBITEUR' },
            { libelle: 'Banques intérêts courus', comptes: ['526'], sens: 'DEBITEUR' },
            { libelle: 'Chèques postaux', comptes: ['531'], sens: 'DEBITEUR' },
            { libelle: 'Autres établissement financiers', comptes: ['53'], exclusions: ['531', '536'], sens: 'DEBITEUR' },
            { libelle: 'Établissement financiers intérêts courus', comptes: ['536'], sens: 'DEBITEUR' },
            { libelle: 'Instruments de trésorerie', comptes: ['54'] },
            { libelle: 'Caisse', comptes: ['57'] },
            { libelle: 'Caisse électronique mobile', comptes: ['55'] },
            { libelle: "Régies d'avances et virements accréditifs", comptes: ['581', '582'] },
            { libelle: 'TOTAL BRUT DISPONIBILITÉS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
            { libelle: 'Dépréciations', comptes: ['592', '593', '594'], presenterEnNegatif: true },
            { libelle: 'TOTAL NET DE DÉPRÉCIATIONS', totalDeRubriques: [12, 13] },
        ],
        renvoiOfficiel: 'NB : Banques intérêts courus et Établissement financiers intérêts courus figurent dans cette rubrique en ' +
            'négatif si le compte principal attaché est débiteur.',
        commentaire: "indiquer la date de rapprochement des comptes bancaires ; indiquer la date d'inventaire de la caisse et " +
            'des instruments de monnaie électronique ; justifier toute variation significative ; détailler les ' +
            'instruments de monnaie électronique si le montant est significatif ; indiquer les événements et ' +
            'circonstances qui ont conduit à la dépréciation et à la reprise.',
    },
    {
        code: '12',
        sousTableau: 'ÉCARTS DE CONVERSION',
        titre: 'ÉCARTS DE CONVERSION',
        colonnes: [
            { type: 'LIBRE', libelle: 'Devises' },
            { type: 'LIBRE', libelle: 'Montant en devises' },
            { type: 'LIBRE', libelle: 'Cours UML Année acquisition' },
            { type: 'LIBRE', libelle: 'Cours UML 31/12' },
            { type: 'EXERCICE_N', libelle: 'Variation en valeur absolue' },
        ],
        renvoyeeDepuis: ['BU', 'DV'],
        rubriques: [
            { libelle: 'Écarts de conversion actif', comptes: ['478'], renvoi: 'détailler les créances et dettes concernées' },
            {
                libelle: 'Écart de conversion passif',
                comptes: ['479'],
                natureCreditrice: true,
                renvoi: 'détailler les créances et dettes concernées',
            },
        ],
        commentaire: 'faire un commentaire.',
    },
    {
        code: '12',
        sousTableau: 'TRANSFERTS DE CHARGES',
        titre: 'TRANSFERTS DE CHARGES',
        colonnes: COLONNES_N_N1_POURCENT,
        renvoyeeDepuis: ['TI', 'TM'],
        rubriques: [
            {
                libelle: "Transferts de charges d'exploitation",
                comptes: ['781'],
                natureCreditrice: true,
                renvoi: 'détailler la nature des charges transférées',
            },
            {
                libelle: 'Transferts de charges financières',
                comptes: ['787'],
                natureCreditrice: true,
                renvoi: 'détailler la nature des charges transférées',
            },
        ],
        commentaire: 'faire un commentaire.',
    },
    {
        code: '13',
        titre: 'CAPITAL : VALEUR NOMINALE DES ACTIONS OU PARTS',
        colonnes: [
            { type: 'LIBRE', libelle: 'Nom et prénoms' },
            { type: 'LIBRE', libelle: 'Nationalité' },
            { type: 'LIBRE', libelle: 'Nature des actions ou parts (Ordinaires ou préférences)' },
            { type: 'LIBRE', libelle: 'Nombre' },
            { type: 'EXERCICE_N', libelle: 'Montant total' },
            { type: 'LIBRE', libelle: "Cessions ou remboursements en cours d'exercice" },
        ],
        renvoyeeDepuis: ['CA', 'CB'],
        rubriques: [
            {
                cle: 'apporteurs-une-ligne-par-apporteur-nom-et-prenom',
                libelle: 'Apporteurs (une ligne par apporteur : nom et prénoms, nationalité, nature, nombre)',
                saisie: true,
                repetable: true,
            },
            { libelle: 'Apporteurs, capital non appelé', comptes: ['109'], natureCreditrice: true },
            {
                libelle: 'TOTAL',
                comptes: ['101', '102', '103', '104'],
                natureCreditrice: true,
                confronteSaisiesDe: { cleRubrique: 'apporteurs-une-ligne-par-apporteur-nom-et-prenom', colonne: 4 },
                renvoi: 'Le modèle officiel ne dit pas ce que totalise cette ligne, et le détail par apporteur qui la ' +
                    'précède n’est pas comptable : elle porte ici le capital du bilan (poste CA, « 101 à 104 »), lu en ' +
                    'balance, et n’est donc pas la somme arithmétique des lignes affichées.',
            },
        ],
        commentaire: 'indiquer si possible le montant du capital à la constitution ; indiquer si possible les dates des AGE ' +
            "et le montant du capital augmenté en cas d'augmentation de capital ; indiquer si possible les dates des " +
            'AGE et le montant du capital diminué en cas de réduction de capital ; indiquer les avantages accordés ' +
            'aux actions de préférence ; apporteurs, capital non appelé : indiquer le délai restant pour appeler ' +
            'le capital.',
    },
    {
        code: '14',
        titre: 'PRIMES ET RÉSERVES',
        colonnes: [
            { type: 'EXERCICE_N', libelle: 'Année N' },
            { type: 'EXERCICE_N1', libelle: 'Année N-1' },
            { type: 'VARIATION_VALEUR', libelle: 'Variation en valeur absolue' },
        ],
        renvoyeeDepuis: ['CD', 'CF', 'CG', 'CH'],
        rubriques: [
            { libelle: "Prime d'apport", comptes: ['1052'], natureCreditrice: true },
            { libelle: "Primes d'émission", comptes: ['1051'], natureCreditrice: true },
            { libelle: 'Prime de fusion', comptes: ['1053'], natureCreditrice: true },
            { libelle: 'Prime de conversion', comptes: ['1054'], natureCreditrice: true },
            {
                libelle: 'Autres primes',
                comptes: ['105'],
                exclusions: ['1051', '1052', '1053', '1054'],
                natureCreditrice: true,
            },
            { libelle: 'TOTAL PRIMES', totalDeRubriques: [0, 1, 2, 3, 4] },
            { libelle: 'Réserves légales', comptes: ['111'], natureCreditrice: true },
            { libelle: 'Réserves statutaires', comptes: ['112'], natureCreditrice: true },
            { libelle: 'Réserves de plus-values nettes à long terme', comptes: ['1131'], natureCreditrice: true },
            {
                libelle: "Réserves d'attribution gratuite d'actions au personnel salarié et aux dirigeants",
                comptes: ['1132'],
                natureCreditrice: true,
            },
            { libelle: 'Autres réserves réglementées', comptes: ['113'], exclusions: ['1131', '1132'], natureCreditrice: true },
            { libelle: 'TOTAL RÉSERVES INDISPONIBLES', totalDeRubriques: [6, 7, 8, 9, 10] },
            { libelle: 'Réserves libres', comptes: ['118'], natureCreditrice: true },
            { libelle: 'Report à nouveau', comptes: ['12'], natureCreditrice: true },
        ],
        commentaire: "indiquer les dates de l'AGE qui a décidé des primes d'apport, d'émission, de fusion ; indiquer le " +
            'détail des réserves libres ; indiquer le montant restant à doter et le taux de dotation de la réserve ' +
            "légale ; indiquer la date de l'AGO qui justifie la variation des réserves et du report à nouveau.",
    },
    {
        code: '15A',
        titre: 'SUBVENTIONS ET PROVISIONS RÉGLEMENTÉES',
        colonnes: [
            { type: 'LIBRE', libelle: 'NOTE' },
            { type: 'EXERCICE_N', libelle: 'Année N' },
            { type: 'EXERCICE_N1', libelle: 'Année N-1' },
            { type: 'VARIATION_VALEUR', libelle: 'Variation en valeur absolue' },
            { type: 'VARIATION_POURCENT', libelle: 'Variation en %' },
            { type: 'LIBRE', libelle: 'Régime fiscal', saisieSurLigneChiffree: true },
            { type: 'LIBRE', libelle: 'Échéances', saisieSurLigneChiffree: true },
        ],
        renvoyeeDepuis: ['CL', 'CM'],
        rubriques: [
            { cle: 'subventions-etat', libelle: 'État', comptes: ['1411'], natureCreditrice: true },
            { cle: 'subventions-regions', libelle: 'Régions', comptes: ['1412'], natureCreditrice: true },
            { cle: 'subventions-departements', libelle: 'Départements', comptes: ['1413'], natureCreditrice: true },
            {
                cle: 'subventions-communes',
                libelle: 'Communes et collectivités publiques décentralisées',
                comptes: ['1414'],
                natureCreditrice: true,
            },
            {
                cle: 'subventions-entites-publiques-ou-mixtes',
                libelle: 'Entités publiques ou mixtes',
                comptes: ['1415'],
                natureCreditrice: true,
            },
            {
                cle: 'subventions-entites-privees',
                libelle: 'Entités et organismes privés',
                comptes: ['1416'],
                natureCreditrice: true,
            },
            {
                cle: 'subventions-organismes-internationaux',
                libelle: 'Organismes internationaux',
                comptes: ['1417'],
                natureCreditrice: true,
            },
            {
                cle: 'subventions-autres',
                libelle: 'Autres',
                comptes: ['14'],
                exclusions: ['1411', '1412', '1413', '1414', '1415', '1416', '1417'],
                natureCreditrice: true,
            },
            { libelle: 'TOTAL SUBVENTIONS', totalDeRubriques: [0, 1, 2, 3, 4, 5, 6, 7] },
            {
                cle: 'provisions-amortissements-derogatoires',
                libelle: 'Amortissements dérogatoires',
                comptes: ['151'],
                natureCreditrice: true,
            },
            {
                cle: 'provisions-plus-value-a-reinvestir',
                libelle: 'Plus-value de cession à réinvestir',
                comptes: ['152'],
                natureCreditrice: true,
            },
            {
                cle: 'provisions-speciale-de-reevaluation',
                libelle: 'Provision spéciale de réévaluation',
                comptes: ['154'],
                natureCreditrice: true,
                renvoi: '3E',
            },
            {
                cle: 'provisions-immobilisations',
                libelle: 'Provisions réglementées relatives aux immobilisations',
                comptes: ['155'],
                natureCreditrice: true,
            },
            {
                cle: 'provisions-stocks',
                libelle: 'Provisions réglementées relatives aux stocks',
                comptes: ['156'],
                natureCreditrice: true,
            },
            {
                cle: 'provisions-pour-investissement',
                libelle: 'Provisions pour investissement',
                comptes: ['157'],
                natureCreditrice: true,
            },
            {
                cle: 'provisions-autres',
                libelle: 'Autres provisions et fonds réglementées',
                comptes: ['153', '158'],
                natureCreditrice: true,
            },
            { libelle: 'TOTAL PROVISIONS RÉGLEMENTÉES', totalDeRubriques: [9, 10, 11, 12, 13, 14, 15] },
            { libelle: 'TOTAL SUBVENTIONS ET PROVISIONS RÉGLEMENTÉES', totalDeRubriques: [8, 16] },
        ],
        commentaire: "indiquer pour la subvention la date d'octroi, la nature, les obligations éventuelles ; pour les " +
            'provisions réglementées, indiquer le texte de référence, les obligations ; commenter toute variation ' +
            'significative.',
    },
    {
        code: '15B',
        titre: 'AUTRES FONDS PROPRES',
        colonnes: [
            { type: 'LIBRE', libelle: 'NOTE' },
            { type: 'EXERCICE_N', libelle: 'Année N' },
            { type: 'EXERCICE_N1', libelle: 'Année N-1' },
            { type: 'VARIATION_VALEUR', libelle: 'Variation en valeur absolue' },
            { type: 'VARIATION_POURCENT', libelle: 'Variation en %' },
            { type: 'LIBRE', libelle: 'Échéances', saisieSurLigneChiffree: true },
        ],
        rubriques: [
            enAttente('titres-participatifs', 'Titres participatifs', 'Le plan ne prévoit aucun compte de passif pour les titres participatifs ÉMIS (2742 est un titre ' +
                'DÉTENU, à l’actif) : subdiviser le compte 168 « Autres emprunts et dettes » et rattacher ici le ' +
                'sous-compte des titres participatifs émis. Attention : 1684 « Emprunts participatifs » (Titre VII ' +
                'COMPTE 16) n’est PAS la bonne réponse · un emprunt participatif est un contrat de prêt, un titre ' +
                'participatif une valeur mobilière émise par l’entité ; le rattacher ici le sortirait de la note ' +
                '16A sans lui donner sa vraie ligne.'),
            {
                cle: 'avances-conditionnees',
                libelle: 'Avances conditionnées',
                comptes: ['167'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            enAttente('titres-subordonnes-duree-indeterminee', 'Titres subordonnés à durée indéterminée (T.S.D.I.)', 'Le plan ne prévoit aucun compte pour les titres subordonnés à durée indéterminée : subdiviser le ' +
                'compte 168 « Autres emprunts et dettes » et rattacher ici le sous-compte des T.S.D.I.'),
            {
                cle: 'obligations-remboursables-en-actions',
                libelle: 'Obligations remboursables en actions (O.R.A.)',
                comptes: ['1613'],
                natureCreditrice: true,
                renvoi: '16A',
            },
            enAttente('autres-fonds-propres', 'Autres', 'Rattacher ici les autres sous-comptes du 16 que l’entité présente en « autres fonds propres » (faible ' +
                'probabilité de remboursement, absence d’échéancier…).'),
            { libelle: 'TOTAL AUTRES FONDS PROPRES', totalDeRubriques: [0, 1, 2, 3, 4] },
        ],
        renvoiOfficiel: '(1) Le cas échéant, une rubrique « Autres fonds propres » (montant des émissions de titres participatifs, ' +
            'avances conditionnées…) sur une ligne séparée est intercalée entre les rubriques « TOTAL CAPITAUX ' +
            'PROPRES ET RESSOURCES ASSIMILÉES » et « emprunts et dettes financières » si le montant des autres fonds ' +
            'propres est significatif.',
        commentaire: "justifier l'inscription de ces dettes dans une rubrique spécifique du passif du bilan « autres fonds " +
            "propres » (faible probabilité de remboursement, absence d'échéancier…) ; justifier le caractère " +
            'significatif du montant total de cette rubrique ; commenter toute variation significative.',
    },
];
exports.CODES_NOTES_SYSCOHADA_1 = [
    '1', '2', '3A', '3B', '3C', '3D', '3E', '3F', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15A', '15B',
];
//# sourceMappingURL=correspondance-notes-syscohada-1.js.map