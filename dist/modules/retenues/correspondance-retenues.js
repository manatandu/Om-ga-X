"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVERTISSEMENT_REVERSEMENT_ANTERIEUR = exports.AVERTISSEMENT_REVERSEMENT_EXERCICE_SUIVANT = exports.AVERTISSEMENT_REDEVABLE = exports.AVERTISSEMENT_REGISTRE = exports.OBLIGATIONS_DECLARATIVES = exports.FORMES_PERSONNES_PHYSIQUES = exports.NATURES_RETENUES = exports.BORNE_PRESTATAIRES_NON_RESIDENTS = exports.BORNE_PLUS_VALUES = exports.BORNE_CAPITAUX_MOBILIERS = exports.BORNE_IRPP_SALAIRES = exports.DERNIERE_VERIFICATION = void 0;
exports.compteRelevantDe = compteRelevantDe;
exports.estEcheanceFiscale = estEcheanceFiscale;
exports.avertissementRegimeImpot = avertissementRegimeImpot;
exports.obligationsDeclarativesApplicables = obligationsDeclarativesApplicables;
exports.reservePourReferentiel = reservePourReferentiel;
exports.avertissementDeductibiliteArticle20 = avertissementDeductibiliteArticle20;
const client_1 = require("@prisma/client");
const jour_ouvrable_1 = require("./jour-ouvrable");
const bareme_irpp_1 = require("../personnel/bareme-irpp");
exports.DERNIERE_VERIFICATION = '2026-08-29';
function compteRelevantDe(numero, nature) {
    return nature.comptes.some((p) => numero.startsWith(p)) && !(nature.exclusions ?? []).some((e) => numero.startsWith(e));
}
const LIRE_A_LA_DATE = " Cet état est servi exercice par exercice · lisez cette réserve à la date de l'exercice affiché.";
exports.BORNE_IRPP_SALAIRES = "EN VIGUEUR AU 1er JANVIER 2026 · l'impôt sur le revenu des personnes physiques (loi n° 23/053, art. 153), la " +
    "rédaction de l'article 18 de la loi de procédures fiscales issue de la loi n° 23/052 (art. 1er et 6) et l'arrêté " +
    "ministériel du 19 février 2025 sur la perception et le reversement de la retenue sur les revenus salariaux " +
    "(art. 5). SUR UN EXERCICE ANTÉRIEUR, les rémunérations relevaient de l'impôt professionnel (titre IV de " +
    "l'ordonnance-loi n° 69/009, abrogé par l'art. 152 de la loi n° 23/053), qui n'est pas au corpus du logiciel : " +
    "l'échéance et la base servies ici ne lui sont pas opposables." +
    LIRE_A_LA_DATE;
exports.BORNE_CAPITAUX_MOBILIERS = "EN VIGUEUR AU 1er JANVIER 2026 · la retenue de l'article 120 de la loi n° 23/053 (art. 153), l'article 18 bis " +
    "de la loi de procédures fiscales, inséré par la loi n° 23/052 (art. 2 et 6), et l'arrêté " +
    "n° 008/CAB/MIN/FINANCES/2025 (art. 4). SUR UN EXERCICE ANTÉRIEUR, ces revenus relevaient de l'impôt mobilier " +
    "(titre III de l'ordonnance-loi n° 69/009, abrogé par l'art. 152 de la loi n° 23/053), qui n'est pas au corpus " +
    "du logiciel : l'échéance et la base servies ici ne lui sont pas opposables." +
    LIRE_A_LA_DATE;
exports.BORNE_PLUS_VALUES = "EN VIGUEUR AU 1er JANVIER 2026 · la retenue de l'article 120 de la loi n° 23/053 (art. 153) et l'article 18 ter " +
    "de la loi de procédures fiscales, inséré par la loi n° 23/052 (art. 2 et 6). SUR UN EXERCICE ANTÉRIEUR, le " +
    "régime des plus-values n'est pas au corpus du logiciel : l'échéance et la base servies ici ne lui sont pas " +
    "opposables." +
    LIRE_A_LA_DATE;
exports.BORNE_PRESTATAIRES_NON_RESIDENTS = "EN VIGUEUR AU 1er JANVIER 2026 · le taux et l'assiette de l'article 144 de la loi n° 23/053 (art. 153) et la " +
    "rédaction de l'article 22 bis de la loi de procédures fiscales issue de la loi n° 23/052 (art. 1er et 6). " +
    "L'article 22 bis, créé par la loi de finances n° 21/029, existait avant dans une rédaction qui n'est pas au " +
    "corpus du logiciel, pas plus que le texte qui fixait alors le prélèvement : SUR UN EXERCICE ANTÉRIEUR, le taux, " +
    "l'échéance et la base servis ici ne lui sont pas opposables." +
    LIRE_A_LA_DATE;
exports.NATURES_RETENUES = [
    {
        cle: 'irppSalaires',
        libelle: 'IRPP retenu sur les revenus salariaux',
        comptes: ['4471', '4472'],
        beneficiaire: 'ETAT',
        joursApresPeriode: 15,
        echeance: 'Le 15 du mois suivant le versement des rémunérations · due chaque mois, même sans rémunération versée, avec la mention « Néant » (art. 18, al. 2)',
        imprime: 'IRPPDR1',
        baseLegale: "Article 18 de la loi n° 004/2003 portant réforme des procédures fiscales, tel que modifié par la loi de finances n° 23/056 du 10 décembre 2023, art. 24, et par la loi n° 23/052 du 30 novembre 2023.",
        chargeSousConditionArticle20: "Les traitements, salaires et autres rémunérations sur lesquels l'IRPP est retenu (comptes 66). L'article 21 y ajoute d'ailleurs sa propre condition : ces rémunérations ne sont déductibles que si elles ont été imposées à l'IRPP.",
        reserve: "PERSONNEL DOMESTIQUE ET SALARIÉS DE MICRO-ENTREPRISES · leurs rémunérations ne suivent PAS ce régime mensuel. " +
            "L'article 70, alinéa 2 de la loi n° 23/053 les impose « suivant les taux forfaitaires fixés par voie d'Arrêté du " +
            "Ministre ayant les Finances dans ses attributions ». " +
            bareme_irpp_1.FORFAITS_ARRETE_019_2025 +
            " Cette retenue est en outre LIBÉRATOIRE de l'IRPP pour ces salariés, « pour " +
            "autant que ces rémunérations constituent pour eux des revenus uniques » (art. 121, alinéa 2) : ils n'ont alors " +
            "aucune déclaration à souscrire sur ce revenu. CE QUE LE LOGICIEL NE SAIT PAS · rien dans les comptes 4471 et " +
            "4472 ne distingue ces rémunérations des autres, ne dit si elles sont le revenu unique du bénéficiaire, ni ne " +
            "donne le taux de change à retenir pour convertir un forfait libellé en dollars. Le registre les date donc au 15 " +
            "du mois suivant, comme le reste de la paie, et ne chiffre aucune quotité. Portez la quotité au dernier mois de " +
            "chaque trimestre : l'échéance servie coïncide alors avec celle de l'arrêté. " +
            exports.BORNE_IRPP_SALAIRES,
    },
    {
        cle: 'contributions',
        libelle: 'Contribution nationale et contribution nationale de solidarité',
        comptes: ['4473', '4474'],
        beneficiaire: 'ETAT',
        joursApresPeriode: 15,
        echeance: "Le 15 du mois suivant · repère aligné sur les autres retenues, et non date tirée d'un texte",
        baseLegale: "AUCUN PRÉLÈVEMENT DE DROIT CONGOLAIS N'EST IDENTIFIÉ POUR CETTE LIGNE. « Contribution nationale » et " +
            "« contribution nationale de solidarité » sont les intitulés des comptes 4473 et 4474 du plan OHADA, et non des " +
            "impôts : ni l'une ni l'autre n'a d'occurrence dans le code général des impôts compilé au 19 juillet 2026, dans " +
            "la loi n° 004/2003 portant réforme des procédures fiscales, ni dans la loi de finances n° 25/060 du 29 décembre " +
            "2025. L'article 18 de la loi de procédures fiscales, que cette ligne citait, ne vise que les retenues opérées " +
            "par « toute personne physique ou morale qui paye des revenus salariaux et revenus assimilés » : il ne la fonde " +
            "pas.",
        reserve: "Si votre dossier mouvemente les comptes 4473 ou 4474, dites au cabinet quel prélèvement ils portent " +
            "réellement, et à quelle échéance : le logiciel ne le devine pas, et il ne servira pas une base légale qu'il ne " +
            "peut pas vérifier. La date affichée ici est un repère, pas une obligation datée par un texte.",
    },
    {
        cle: 'retenueLocative',
        libelle: 'Retenue sur les revenus locatifs',
        comptes: ['44781'],
        beneficiaire: 'PROVINCE',
        joursApresPeriode: 10,
        echeance: 'Dans les dix jours du mois suivant le paiement du loyer',
        chargeSousConditionArticle20: "Les loyers de bâtiments et de terrains versés au bailleur, sur lesquels la retenue est opérée (comptes 6221 " +
            "locations de terrains, 6222 locations de bâtiments, 6226 fermages et loyers du foncier, et la part du 6228 qui " +
            "s'y rapporte). Pour le mobilier et le matériel loués, l'ordonnance-loi n° 69/009, art. 5, écrit : « Le revenu " +
            "brut comprend éventuellement le loyer des meubles, du matériel, de l'outillage, du cheptel et de tous objets " +
            "quelconques. »",
        baseLegale: "Article 57, alinéa 4, de la loi n° 004/2003 portant réforme des procédures fiscales, modifié par la loi " +
            "n° 23/052 du 30 novembre 2023, art. 1er : « La retenue sur les revenus locatifs est reversée dans les dix " +
            "jours du mois qui suit celui du paiement de loyer, à l'aide d'un relevé conforme au modèle fixé par " +
            "l'Administration des Impôts. » TAUX DES TEXTES NATIONAUX · la retenue est de 20 % du montant brut du loyer " +
            "(article 11 de la loi n° 83/004 du 23 février 1983, tel que modifié et complété par le décret-loi " +
            "n° 109/2000 du 19 juillet 2000) ; c'est un ACOMPTE, imputé sur l'impôt sur les revenus locatifs du bailleur " +
            "(article 13 de la même loi), dont le taux national est de 22 % (article 11 de l'ordonnance-loi n° 69/009, " +
            "titre II, que la loi n° 23/053 n'abroge pas · son art. 152 point 2 ne vise que les titres III et IV). Les " +
            "deux taux ne se confondent pas.",
        reserve: "IMPÔT PROVINCIAL · la Constitution, art. 204, 16°, range « l'impôt sur les revenus locatifs » parmi les " +
            "impôts de la compétence exclusive des provinces, et chaque province en fixe le barème. À KINSHASA, depuis le " +
            "1er janvier 2024 (arrêté provincial n° 015/CAB/MIN.PROV/FIN.ECO/2023 du 7 décembre 2023, art. 5 et 8), la " +
            "retenue est de 20 % et l'impôt de 22 % dans les localités du 1er rang, de 15 % et 17 % dans celles des 2e, " +
            "3e et 4e rangs, « tout loyer confondu ». Le barème des autres provinces n'est pas au corpus du logiciel, qui " +
            "n'applique aucun taux · il lit ce que votre comptabilité porte au compte 44781. GUICHET · la loi n° 83/004, " +
            "art. 10, fait opérer la retenue « au profit du Trésor », et l'art. 57 cité renvoie au modèle « fixé par " +
            "l'Administration des Impôts » ; à Kinshasa, l'arrêté n° 015/2023, art. 3, la fait reverser « au compte Ville " +
            "de Kinshasa/Receveur des Recettes Fiscales », « suivant le modèle établi par la DGRK ». Le service qui la " +
            "perçoit dans les autres provinces n'est pas au corpus · à confirmer auprès de la régie de votre province. " +
            "ÉCHÉANCE · l'art. 57 est cité dans sa rédaction en vigueur depuis le 1er janvier 2026 (loi n° 23/052, art. 1er " +
            "et 6). La loi n° 83/004, art. 11, toujours imprimée dans la compilation, écrit « reversé dans les dix jours " +
            "qui suivent le paiement du loyer », délai plus court ; l'arrêté kinois fixe le dixième jour du mois qui suit " +
            "depuis le 1er janvier 2024. Le registre compte par MOIS et ne date pas au jour du paiement · l'échéance servie " +
            "peut donc être postérieure à celle de l'art. 11, et SUR UN EXERCICE ANTÉRIEUR à 2026 la rédaction alors en " +
            "vigueur de l'art. 57 n'est pas au corpus." +
            LIRE_A_LA_DATE,
        contenu: "Chaque retenue « doit être accompagnée d'un relevé daté et signé ». « Il est établi un relevé par bénéficiaire " +
            "des loyers, quel que soit le nombre de locaux et terrains ou autres biens imposables pris à bail », conforme au " +
            "modèle défini par l'Administration, qui mentionne obligatoirement « le nom ou la dénomination et l'adresse de " +
            "la personne débitrice des loyers qui établit le relevé ; le nom, l'adresse et le numéro d'Identification " +
            "national du bailleur concerné ; l'adresse précise de chaque immeuble pris en location, ainsi que sa surface " +
            "développée et son affectation » (loi n° 83/004, art. 12, § 1).",
        sourceDonnees: "Compte 44781 pour les retenues, et la fiche du bailleur dans le plan des tiers pour son nom, son adresse et " +
            "son Numéro Impôt. Le logiciel ne détient ni l'adresse de l'immeuble loué, ni sa surface développée, ni son " +
            "affectation · à reporter sur le relevé à partir du bail.",
    },
    {
        cle: 'prestatairesNonResidents',
        libelle: 'Prélèvement sur les sommes payées aux prestataires non-résidents (14 %)',
        comptes: ['44782'],
        beneficiaire: 'ETAT',
        joursApresPeriode: 15,
        echeance: 'Le 15 du mois suivant',
        baseLegale: 'Article 144 de la loi n° 23/053 ; article 22 bis de la loi de procédures fiscales. Prélèvement de 14 % du montant brut des factures.',
        chargeSousConditionArticle20: "Les sommes payées aux prestataires non-résidents · honoraires, études, services et redevances portés en charges de l'exercice.",
        reserve: exports.BORNE_PRESTATAIRES_NON_RESIDENTS,
    },
    {
        cle: 'prelevementExpatries',
        libelle: 'Prélèvement exceptionnel sur le personnel expatrié (25 %)',
        comptes: ['44783'],
        beneficiaire: 'ETAT',
        joursApresPeriode: 15,
        echeance: 'Dans les quinze jours suivant le mois du versement · due chaque mois, même sans rémunération versée, avec la mention « Néant » (art. 19, al. 2)',
        baseLegale: 'Articles 145 à 149 de la loi n° 23/053 ; article 19 de la loi de procédures fiscales. Prélèvement de 25 % du brut.',
        chargeSousConditionArticle20: "Les rémunérations brutes du personnel expatrié sur lesquelles le prélèvement de 25 % est assis (art. 146). Le prélèvement lui-même n'est pas déductible (art. 50, 2°) : c'est la rémunération qui l'est, et elle relève de la condition de l'article 20.",
        reserve: "L'article 145 ne vise que « les entreprises individuelles ou sociétaires », et une ASBL n'est ni l'une ni l'autre : l'assujettissement d'une association à ce prélèvement est une tension du texte, à faire trancher par un conseil et non par ce logiciel. À noter aussi que l'article 147 étend au prélèvement les immunités des articles 64 et 69, et que l'article 50, 2° le rend non déductible.",
        reserveSyscohada: "Prélèvement dû par toute entreprise individuelle ou sociétaire située en RDC employant du personnel expatrié (art. 145), assis sur le montant brut des rémunérations de l'article 68 (art. 146), les exemptions et immunités des articles 64 et 69 s'y appliquant (art. 147). Il est dû lorsque les revenus sont payés ou mis à la disposition de leurs bénéficiaires (art. 149), non lorsque la charge est engagée. Il reste à charge de l'entreprise et n'est pas déductible du bénéfice imposable (art. 50, 2°). SUR UN EXERCICE ANTÉRIEUR au 1er JANVIER 2026, trois règles de l'ordonnance-loi n° 69/007 s'appliquaient encore : le taux réduit du secteur minier, le plancher au SMIG du pays d'origine et l'assimilation des ressortissants des pays limitrophes. Cet état est servi exercice par exercice · lisez cette réserve à la date de l'exercice affiché.",
    },
    {
        cle: 'capitauxMobiliers',
        libelle: 'Retenue sur les revenus de capitaux mobiliers (20 %)',
        comptes: ['44784'],
        beneficiaire: 'ETAT',
        joursApresPeriode: 15,
        echeance: 'Le 15 du mois suivant',
        baseLegale: "Article 120 de la loi n° 23/053 ; article 18 bis de la loi de procédures fiscales ; arrêté ministériel " +
            "n° 008/CAB/MIN/FINANCES/2025 du 19 février 2025. LORSQUE LE BÉNÉFICIAIRE EST NON-RÉSIDENT, le prélèvement " +
            "relève d'un autre texte : les articles 149 bis à 149 quinquies de la loi n° 23/053, chapitre créé par la loi de " +
            "finances n° 25/060 du 29 décembre 2025, et la déclaration de l'article 22 quater de la loi de procédures " +
            "fiscales. Même taux de 20 %, même assiette brute et même échéance du 15 du mois suivant, mais deux prélèvements " +
            "distincts et DEUX déclarations.",
        chargeSousConditionArticle20: "Les INTÉRÊTS servis (emprunts, comptes courants d'associés) sur lesquels la retenue est opérée · eux seuls sont une charge, et les articles 39 à 41 leur posent en outre leurs propres limites. Un dividende distribué n'est pas une charge : la condition de l'article 20 ne le concerne pas, mais la retenue lui reste due.",
        reserve: "Cas réel pour une association qui sert des intérêts sur un emprunt reçu d'un membre. L'intérêt d'un " +
            "PLACEMENT de trésorerie est un revenu du déposant, et la retenue en est opérée par la banque dépositaire, " +
            "débitrice du revenu (loi n° 23/053, art. 78, 2° et art. 120, « opérée par les débiteurs de ces revenus ») · il " +
            "ne se reverse pas depuis ce registre. Le prélèvement sur les revenus versés à des NON-RÉSIDENTS, lui, ne vise que les revenus « versés " +
            "par des sociétés établies en République Démocratique du Congo » (art. 149 ter) et sa déclaration que « les " +
            "sociétés établies en République Démocratique du Congo » (art. 22 quater) : une ASBL n'est pas une société, et " +
            "le logiciel ne sert donc pas cette seconde obligation à un dossier SYCEBNL. Si votre entité verse des revenus " +
            "de capitaux mobiliers à un bénéficiaire établi à l'étranger, faites trancher le point par un conseil · ce " +
            "logiciel ne le tranche pas. " +
            exports.BORNE_CAPITAUX_MOBILIERS,
        reserveSyscohada: "Cas réel pour une entreprise qui distribue des dividendes ou qui sert des intérêts à ses associés. L'intérêt " +
            "d'un PLACEMENT de trésorerie est un revenu du déposant · la retenue, quand elle est due, est opérée par la " +
            "banque qui le verse (art. 120, « opérée par les débiteurs de ces revenus »), jamais reversée depuis ce registre. SOCIÉTÉ-MÈRE · une SA ou une SARL qui redistribue au " +
            "titre d'un exercice des produits de participations encaissés le même exercice impute l'impôt que ces " +
            "produits ont supporté sur celui dont elle est redevable (art. 76), à quatre conditions cumulatives · au moins " +
            "25 % du capital de la filiale, sièges en RDC, impôt de la filiale égal au droit commun, titres nominatifs ou " +
            "engagement de conservation de deux ans. Aucune ne se lit dans un compte · OmegaX n'impute rien. CE QUE LE LOGICIEL NE SAIT PAS · le compte 44784 porte la retenue, jamais la " +
            "RÉSIDENCE du bénéficiaire. Il ne peut donc pas dire si ce qui y est crédité relève de la retenue interne de " +
            "l'article 120 ou du prélèvement sur les non-résidents des articles 149 bis à 149 quinquies. Aucun montant ni " +
            "aucune date n'en dépendent · les deux prélèvements sont assis sur le montant brut, au taux de 20 %, et dus le " +
            "15 du mois suivant. Les DÉCLARATIONS, elles, sont deux : ventilez vos versements selon la résidence du " +
            "bénéficiaire avant de déclarer. " +
            exports.BORNE_CAPITAUX_MOBILIERS,
    },
    {
        cle: 'plusValues',
        libelle: 'Retenue sur les plus-values (20 %)',
        comptes: ['44785'],
        beneficiaire: 'ETAT',
        joursApresPeriode: 15,
        echeance: 'Dans les quinze jours suivant le mois de réalisation',
        baseLegale: 'Article 120 de la loi n° 23/053 ; article 18 ter de la loi de procédures fiscales.',
        reserve: exports.BORNE_PLUS_VALUES,
    },
    {
        cle: 'autresRetenues',
        libelle: 'Autres impôts et contributions retenus à la source',
        comptes: ['4478'],
        exclusions: ['44781', '44782', '44783', '44784', '44785'],
        beneficiaire: 'ETAT',
        joursApresPeriode: 15,
        echeance: 'Le 15 du mois suivant (échéance commune, à défaut de ventilation)',
        baseLegale: 'Loi de procédures fiscales, articles 18 bis, 18 ter, 19, 22 bis et 57 selon la nature du prélèvement.',
        chargeSousConditionArticle20: "Selon ce que le compte porte réellement · loyers, honoraires de non-résidents et rémunérations sont des charges soumises à la condition de l'article 20, la retenue sur plus-values ne suit aucune charge. Ventilez le 4478 sur ses sous-comptes 44781 à 44785 pour que le signalement désigne la bonne charge.",
        reserve: "Ce compte regroupe des prélèvements dont les échéances diffèrent (dix jours pour la retenue locative, quinze pour les autres) : tant qu'ils y sont mêlés, le registre les date tous au 15, ce qui est FAUX pour la retenue locative. Ventilez-les sur les sous-comptes 44781 à 44785 pour que chaque échéance soit juste.",
    },
    {
        cle: 'tva',
        libelle: 'TVA due',
        comptes: ['444'],
        exclusions: ['4449'],
        beneficiaire: 'ETAT',
        joursApresPeriode: 15,
        echeance: 'Le 15 du mois suivant',
        baseLegale: "Ordonnance-loi n° 10/001 du 20 août 2010 instituant la TVA et son décret d'application n° 011/42.",
        reserve: "Une ASBL légalement constituée est exonérée de TVA sur ses ventes et importations à caractère social, sportif, " +
            "culturel, religieux, éducatif ou philanthropique conforme à son objet (ordonnance-loi n° 10/001, art. 15, 2°) " +
            "et sur ses prestations effectuées dans le cadre de ses activités normales, lorsque son non-assujettissement " +
            "n'entraîne pas de distorsion de concurrence (même texte, art. 17, 8°). Hors de ces opérations, elle reste " +
            "redevable. L'exemption d'impôt sur les sociétés ne commande pas la TVA : l'ASBL la tient de la loi n° 23/053, " +
            "art. 5, point 3, et l'arrêté n° 007/CAB/MIN/FINANCES/2025, pris pour la seule exemption d'IS des " +
            "établissements d'utilité publique et des ONG (art. 1er), ne traite pas de TVA.",
        reserveSyscohada: "L'entreprise est assujettie de plein droit dès qu'elle franchit le seuil de chiffre d'affaires de l'article 14, et le reste tant qu'elle n'en est pas sortie dans les formes. Le solde affiché ici est la TVA DUE seule : le crédit de TVA à reporter (compte 4449) en est exclu, parce que c'est une créance sur l'État et non une dette, et l'y mêler ferait paraître la dette fiscale plus faible qu'elle n'est.",
    },
    {
        cle: 'cnss',
        libelle: 'Cotisations de sécurité sociale (CNSS)',
        comptes: ['431', '4321'],
        exclusions: ['4314'],
        beneficiaire: 'ORGANISME_SOCIAL',
        joursApresPeriode: 15,
        echeance: 'Dans les quinze jours suivant le mois civil, déclaration due même sans travailleur',
        baseLegale: "Loi n° 16/009 du 15 juillet 2016 (régime général de sécurité sociale) ; décret n° 18/041 du 24 novembre 2018 fixant les taux : prestations aux familles 6,5 % (employeur), pensions 10 % (5 % employeur, 5 % travailleur), risques professionnels 1,5 % (employeur, majorable par la Caisse jusqu'au double, décret n° 18/041, art. 5 · 50 % au premier constat, 100 % en récidive, arrêté n° 140/2018, art. 22 et 24). Échéances : arrêté ministériel n° 146/2018, article 21 (déclaration) et article 31 (versement), « dans les quinze jours suivant le mois civil » ; article 26 : la déclaration est due même en l'absence de travailleur ; régularisation possible dans les cinq jours. FEUILLES DE PAIE · l'article 24 impose de joindre à la déclaration une copie des feuilles de paie, et l'article 28 fait de leur absence un DÉFAUT DE DÉCLARATION (le texte renvoie aux « annexes requises à l'article 25 », alors que c'est l'article 24 qui les requiert et l'article 25 qui en fixe le contenu · anomalie de renvoi, signalée et non tranchée). SANCTIONS · arrêté ministériel n° 138/2018 : majoration de 0,5 % des cotisations dues par jour de retard (art. 2), qui prend cours à partir du vingt-unième jour du mois civil suivant (art. 3) ; déclaration et annexes non déposées, cotisations déterminées d'office sur la dernière déclaration majorée de 30 % (art. 9) ; déclaration produite après taxation d'office, pénalité de 0,5 % par jour sur les cotisations déclarées (art. 10) ; remise pour bonne foi ou force majeure (art. 4, 5 et 8). Le montant d'une majoration est un acte de la Caisse · ce registre n'en chiffre aucun.",
        reserve: "L'ASSIETTE N'EST PAS LE REVENU IMPOSABLE, ET DEUX TEXTES LE DISENT PLUTÔT QU'UN. L'article 13 de la loi n° 16/009 ROUTE l'assiette hors de la fiscalité : les cotisations « sont assises sur l'ensemble de la rémunération du travailleur assujetti TEL QUE PRÉVU À L'ARTICLE 7, LITERA H, DU CODE DU TRAVAIL ». Et l'arrêté n° 146/2018, article 17, point 1, définit l'« assiette de cotisation du travailleur » en RECOPIANT cette définition, exclusions comprises : ne sont pas éléments de la rémunération les soins de santé, l'indemnité de logement ou le logement en nature, les allocations familiales légales, l'indemnité de transport, les frais de voyage et les avantages accordés exclusivement en vue de faciliter au travailleur l'accomplissement de ses fonctions. CES CINQ EXCLUSIONS SONT INCONDITIONNELLES · leur montant ne change rien, leur nature suffit. C'est ce qui les sépare des immunités de l'article 69 de la loi n° 23/053, qui portent des conditions et des plafonds. LA DÉCLARATION ELLE-MÊME LE PROUVE · le formulaire Mod. DC de l'article 23 porte DEUX colonnes distinctes, le « montant total brut des sommes payées aux travailleurs » (point 5) et le « montant total des sommes payées aux travailleurs QUI SONT PRISES EN CONSIDÉRATION POUR LE CALCUL DES COTISATIONS » (point 6). Si l'assiette était le brut, le point 6 n'aurait pas lieu d'être. NE PAS LA « CORRIGER » SUR UNE SOURCE ÉTRANGÈRE · la règle inverse existe ailleurs et se trouve en premier sur le web. Le Maroc a harmonisé son assiette sociale sur le traitement fiscal des indemnités par l'arrêté n° 1314-25, et le Gabon assied ses cotisations sur le « salaire brut imposable ». Aucun des deux ne régit la RDC. Un plancher au SMIG s'applique (loi, art. 13 in fine ; décret n° 18/041, art. 8). LE SMIG EST CHIFFRÉ · décret n° 25/22 du 30 mai 2025, art. 2 : 21 500 FC par jour pour le travailleur MANŒUVRE ORDINAIRE, soit 559 000 FC par mois en appliquant le multiplicateur 26 de son article 7. Le taux monte ensuite de classe en classe jusqu'à 215 000 FC par jour au dernier échelon du cadre de collaboration, suivant la tension salariale des annexes. SUR QUEL MONTANT S'ASSIED LE PLANCHER, LA QUESTION RESTE OUVERTE, et OmegaX ne la tranche pas : l'article 2 fixe le SMIG à 21 500 FC tandis que l'article 3 échelonne son PAIEMENT (14 500 FC de la paie de mai 2025 à celle de décembre 2025, 21 500 FC ensuite). Les annexes du décret, elles, assoient les allocations familiales et la contre-valeur du logement sur le montant PAYÉ (537,04 FC de mai à décembre 2025, soit 14 500/27) · elles ne disent rien du plancher d'assiette sociale, qui relève d'un autre texte. Le point est à confirmer auprès de la CNSS avant d'en tirer une assiette. CES CINQ EXCLUSIONS SONT CELLES DU TRAVAILLEUR (art. 17, point 1) · l'arrêté n° 146/2018 assujettit aussi à toutes les branches le mandataire de l'État dans les entreprises publiques, le marin et l'ASSOCIÉ ACTIF d'une société (art. 3, points 2, 4 et 6), dont l'assiette est « l'ensemble des rétributions », avantages et jetons de présence compris, seuls ceux accordés exclusivement pour faciliter les fonctions en étant exclus (art. 17, point 2). La paie d'OmegaX, bâtie sur le contrat de travail, ne la calcule pas ; la qualité d'associé actif est au cabinet. L'APPRENTI, lui, n'est assujetti qu'à la branche des risques professionnels (loi n° 16/009, art. 4). LA PAIE D'OMEGAX applique le plancher là où les deux lectures coïncident (à partir de janvier 2026, ou sur une grille saisie par le cabinet), au SMIG des jours payés, et s'abstient sur la CNSS de mai à décembre 2025 quand l'assiette tombe entre les deux. DEUX VOIES DE DÉCLARATION, et OmegaX n'en choisit aucune pour le dossier · l'arrêté n° 146/2018, art. 21, nomme le guichet unique et la « déclaration mensuelle unique des impôts, cotisations sociales et contributions patronales sur les rémunérations » pour les employeurs créateurs d'entreprise, et la représentation territorialement compétente de la Caisse, avec le formulaire Mod. DC en trois exemplaires, pour les autres catégories ; l'arrêté interministériel du 12 mai 2015, qu'il vise sans l'abroger, étend la déclaration unique à tout employeur assujetti au régime général (art. 3). Les deux textes ne s'articulent pas, et le logiciel ne tranche pas entre eux. Télédéclaration obligatoire au-delà de vingt-cinq travailleurs (arrêté n° 146/2018, art. 24).",
    },
    {
        cle: 'inppOnem',
        libelle: "Formation professionnelle (INPP) et contribution à l'emploi (ONEM)",
        comptes: ['4428', '4334', '4335'],
        beneficiaire: 'ORGANISME_SOCIAL',
        joursApresPeriode: 15,
        porteLInppTrimestriel: true,
        echeance: 'ONEM · au plus tard le 15 du mois suivant ; INPP · par trimestre, au plus tard le 30 avril, le 31 juillet, le 31 octobre et le 31 janvier de l’année suivante',
        baseLegale: "Code du travail, art. 15 b) : la cotisation est « la cotisation mensuelle des employeurs proportionnelle à la somme des rémunérations versées par eux à leur personnel au cours du trimestre précédent », son TAUX seul étant fixé par arrêté. " +
            "PAIEMENT · ordonnance n° 84/186 du 15 octobre 1984 fixant les modalités de paiement de la cotisation due par les employeurs à l'INPP, art. 1er (« la cotisation trimestrielle ») et art. 3, al. 2 : versements « au plus tard, pour les quatre trimestres de l'année, respectivement le 30 avril, le 31 juillet, le 31 octobre et le 31 janvier de l'année suivante », au compte bancaire ou postal de l'INPP (art. 3, al. 1er) ; un versement entre les mains d'un tiers ne libère pas l'employeur, sauf preuve que l'INPP l'a reçu (art. 3, al. 3). Majoration de retard de 0,5 pour mille par jour (art. 4). " +
            "Arrêté interministériel n° 002/CAB/MET/2025, n° […]/CAB/MIN/FINANCES/2025, n° 003/CAB/VPM/MIN/BUD/2025 du 24 septembre 2025, article 1er : 4 % pour les entreprises et établissements PUBLICS ; pour les entreprises et établissements PRIVÉS, 3,5 % de 1 à 50 travailleurs, 3 % de 51 à 300, 2 % au-delà de 300. L\'assiette est « les rémunérations versées à ses travailleurs ». Son article 3 le fait entrer en vigueur « à la date de sa signature », soit le 24 SEPTEMBRE 2025, et son article 2 abroge celui de 2006. " +
            "JUSQU\'AU 23 SEPTEMBRE 2025, et donc sur tout exercice antérieur : arrêté interministériel n° 12/MTPS/123, n° 007/CAB/MIN/FINANCES/2006, n° 001/CAB/MIN/BUD/2006 du 14 février 2006 (J.O. n° 6 du 15 mars 2006, p. 25-26), article 1er : 3 % pour les entreprises publiques ; 3 % de 1 à 50 travailleurs, 2 % de 51 à 300, 1 % au-delà de 300. Lui aussi entrait en vigueur à la date de sa signature." +
            " ONEM · " +
            "Arrêté ministériel n° 028/CAB/MIN.ET/FMM/RK/09/2025, art. 1er : 0,5 % de la rémunération mensuelle payée aux travailleurs, pour tout employeur public, parapublic ou privé, le secteur humanitaire compris (sous réserve des exonérations légales). Déclaration au plus tard le 10 du mois suivant le paiement de la rémunération (art. 2) ; paiement au plus tard le 15 (art. 3).",
        reserve: "UN SEUL COMPTE, LE 4428 « AUTRES IMPÔTS ET TAXES » · l'INPP et l'ONEM sont des impôts et taxes, pas des cotisations sociales (fiche du compte 64 des deux textes ; la fiche du compte 66 exclut « les impôts dont l'assiette repose sur la rémunération »). Ils partagent le 4428, et ce registre en donne la dette ENSEMBLE · le montant de chacun est sur le bulletin et dans l'écriture de paie (6415 pour l'INPP, 6413 pour l'ONEM). Le 4428 peut porter d'autres impôts et taxes · une ligne n'est comptée ici que si sa STRUCTURE la rattache à l'INPP ou à l'ONEM (écriture de la paie, charge 6415 ou 6413 dans la même écriture, lettrage avec une telle ligne) ; les autres sont nommées avec leur montant, et un reversement que rien ne rattache suspend l'affirmation d'un retard. Un dossier semé avant le 7 octobre 2026 garde ses comptes 4334 et 4335, lus ici. " +
            "DATE D\'EFFET · les deux arrêtés entrent en vigueur À LA DATE DE LEUR SIGNATURE, chacun par son article 3. Un exercice à cheval sur le 24 septembre 2025 porte donc les DEUX barèmes, mois par mois · même discipline que l\'ONEM, dont le taux a changé le lendemain. Avant le 14 février 2006, c\'est l\'arrêté n° 12/MTPS/FIN&BU/064/03 du 28 mars 2003 qui régissait ; son taux n\'est PAS reconstitué ici, le texte n\'ayant pas été lu · seule son existence est attestée, par le visa de celui de 2006. " +
            "NUMÉROTATION · sur l\'original, les trois numéros de l\'arrêté de 2025 sont manuscrits. Celui de l\'Emploi et Travail se lit « 002/CAB/MET/2025 » et celui du Budget « 003/CAB/VPM/MIN/BUD/2025 » ; CELUI DES FINANCES EST ILLISIBLE et n\'est pas restitué. Le citer complet en contentieux demande une vérification au Journal officiel. " +
            "TRANCHE D\'EFFECTIF · le taux dépend d\'abord de la NATURE de l\'employeur (public ou privé), puis, pour le privé seulement, de la tranche d\'effectif · jamais d\'un chiffre d\'affaires ni d\'une masse salariale. La cotisation se calcule dans la paie (fenêtre Personnel), sur la nature de l\'employeur et l\'effectif déclarés, et s\'y abstient tant qu\'ils ne le sont pas. Ce registre, lui, ne recalcule rien : il recense ce que votre comptabilité porte sur le compte 4428 et en date le reversement. " +
            "DEUX ÉCHÉANCES SUR UN COMPTE · chaque ligne de la dette se partage entre l\'INPP et l\'ONEM au prorata des charges de son écriture (6415 pour l\'INPP, 6413 pour l\'ONEM) ; la part de l\'INPP est datée à l\'échéance du trimestre de son mois, celle de l\'ONEM au 15 du mois suivant. Une ligne dont l\'écriture ne porte aucune de ces charges n\'est pas partagée · elle est datée à l\'échéance de l\'INPP, la plus tardive, et nommée. Un reversement ne dit pas ce qu\'il acquitte · il s\'impute sur les échéances les plus proches d\'abord. " +
            "MAJORATION DE RETARD · 0,5 pour mille de la cotisation par jour de retard, à compter de l\'échéance, versée avec la cotisation (ordonnance n° 84/186, art. 4) ; taxation d\'office après mise en demeure pour défaut de déclaration des rémunérations (art. 6). Actes de l\'INPP · ce registre n\'en chiffre aucun." +
            " ONEM · " +
            "DATE D'EFFET · les 0,5 % ne valent qu'à partir du 25 septembre 2025, date que porte la mention de signature (« Fait à Kinshasa, le 25 septembre 2025 »), l'art. 10 faisant entrer l'arrêté en vigueur « à la date de sa signature ». RÉSERVE, et elle est dans le texte officiel : son INTITULÉ le date du 24 septembre 2025, sa signature du 25. Un jour d'écart, sans portée sur un exercice civil, mais à confirmer au Journal officiel avant tout usage contentieux. Avant cette date, le taux est de 0,2 % (arrêté ministériel n° 095/CAB/MINETAT/MTEPS/01/2018 du 17 août 2018) · un exercice à cheval sur septembre 2025 porte donc les deux taux. Les arriérés antérieurs non acquittés se recalculent en revanche au nouveau taux (art. 6). SANCTIONS · 50 % de la contribution due en cas de défaut de déclaration ou de déclaration fausse, inexacte ou incomplète (art. 2) ; majoration de retard de 0,5 % PAR JOUR, tout mois commencé compté entier (art. 3). La cotisation se calcule dans la paie (fenêtre Personnel), au taux du mois de paie. Ce registre, lui, ne recalcule rien : il recense ce que votre comptabilité porte sur le compte 4428 et en date le reversement.",
    },
    {
        cle: 'autresOrganismesSociaux',
        libelle: 'Autres organismes sociaux',
        comptes: ['432', '433', '438', '4314'],
        exclusions: ['4321', '4334', '4335'],
        beneficiaire: 'ORGANISME_SOCIAL',
        joursApresPeriode: 15,
        echeance: 'Selon les règles propres à chaque organisme',
        baseLegale: 'Mutuelles, assurances retraite et organismes de santé · conventions propres à chaque organisme.',
    },
];
const BASE_ACOMPTES = "Article 57 bis de la loi de procédures fiscales n° 004/2003, tel que modifié par la loi de finances " +
    'n° 25/060 du 29 décembre 2025 pour l’exercice 2026.';
const SOURCE_ACOMPTES = "Impôt déclaré au titre de l'exercice PRÉCÉDENT, augmenté des suppléments établis par l'Administration, ou " +
    "impôt reconstitué d'office à défaut de déclaration · que ces sommes soient contestées ou non. Il ne se lit " +
    "donc dans aucun solde de compte de l'exercice en cours.";
exports.FORMES_PERSONNES_PHYSIQUES = [
    client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE,
    client_1.FormeJuridiqueSyscohada.ENTREPRENANT,
];
const SANCTION_ARTICLE_94 = "Amende pour absence d'une déclaration ne servant pas au calcul de l'impôt, GRADUÉE PAR TAILLE depuis l'article 29 " +
    'de la loi de finances n° 23/056 du 10 décembre 2023 : 5 000 000 de francs congolais pour les grandes entreprises, ' +
    '2 500 000 pour les moyennes entreprises et les associations sans but lucratif, 250 000 pour les entreprises de ' +
    "petite taille (article 94 de la loi de procédures fiscales, qui range nommément « le relevé trimestriel des sommes " +
    "versées aux tiers » parmi ces déclarations). Le logiciel ne connaît pas la taille de votre entité : il ne choisit " +
    'pas le montant à votre place.';
const CONTENU_ACOMPTE = (quotite) => `Versement de ${quotite} de l'impôt de référence, au moyen du bordereau de versement d'acomptes ` +
    "provisionnels dont le modèle est défini par l'Administration des Impôts.";
const RESERVE_ARRETE_CERTIFICATION = "CERTIFICATION · arrêté ministériel n° 014/CAB/MIN/FINANCES/2023 du 16 mai 2023, applicable « à compter de " +
    "l'exercice fiscal 2024/revenus 2023 » (art. 28). Il a été pris pour l'impôt sur les bénéfices et profits " +
    "(art. 1er), et aucun arrêté d'application de l'article 14 postérieur au passage à l'impôt sur les sociétés n'est " +
    "au corpus du logiciel. Son article 7, alinéa 2 écrit : « Par dérogation à l'article 5 du présent Arrêté, les " +
    "entités non astreintes, par les Actes uniformes, à la nomination d'un ou des plusieurs commissaires aux comptes " +
    "doivent désigner pour un mandat de six (6) ans renouvelables un expert-comptable pour certifier leurs états " +
    "financiers », et son alinéa 3 que « les Cabinets comptables non astreints [...] certifient eux-mêmes leurs états " +
    "financiers » · la portée de cette dérogation sur l'incompatibilité de l'article 5 n'est pas tranchée ici. Pour " +
    "une entité astreinte à un commissaire aux comptes, c'est lui qui certifie (art. 6).";
exports.OBLIGATIONS_DECLARATIVES = [
    {
        cle: 'declarationMensuelleOnem',
        libelle: "Déclaration mensuelle de la contribution patronale ONEM",
        periodicite: 'MENSUELLE',
        echeanceFiscale: false,
        joursApresPeriode: 10,
        echeance: 'Au plus tard le 10 du mois suivant le paiement de la rémunération',
        baseLegale: "Article 2 de l'arrêté ministériel n° 028/CAB/MIN.ET/FMM/RK/09/2025 (date, voir la réserve portée sur la contribution ONEM).",
        contenu: "Déclaration de la rémunération mensuelle payée aux travailleurs et de la contribution de 0,5 % qui en découle. Elle figure comme ligne dédiée de la Déclaration mensuelle unique du guichet unique (DGI, ONEM, INPP, CNSS), aux côtés de l'IRPP, de l'INPP et de la CNSS.",
        sanction: "50 % du montant de la contribution due en cas de défaut de déclaration ou de déclaration fausse, inexacte ou incomplète (art. 2). Le versement tardif, lui, subit une majoration de 0,5 % par jour, tout mois commencé compté entier (art. 3).",
        sourceDonnees: 'Comptes 66 (charges de personnel) pour l’assiette, et 4428 pour la contribution due (4335 pour un dossier semé avant le 7 octobre 2026).',
    },
    {
        cle: 'prelevementCapitauxMobiliersNonResidents',
        libelle: 'Déclaration du prélèvement sur les revenus de capitaux mobiliers versés à des non-résidents (20 %)',
        periodicite: 'MENSUELLE',
        joursApresPeriode: 15,
        echeance: 'Au plus tard le 15 du mois qui suit le paiement des revenus ou leur mise à disposition',
        baseLegale: "Article 22 quater de la loi de procédures fiscales, inséré par la loi de finances n° 25/060 du 29 décembre " +
            "2025, articles 38 et 39 : « Les sociétés établies en République Démocratique du Congo qui paient des revenus " +
            "des capitaux mobiliers versés à des personnes non-résidentes sont tenues de souscrire une déclaration, au plus " +
            "tard le quinze du mois qui suit celui du paiement de ces revenus aux bénéficiaires ou de leur mise à " +
            "disposition. » Le prélèvement lui-même vient des articles 149 bis à 149 quinquies de la loi n° 23/053, " +
            "chapitre 3 créé par l'article 40 de la même loi de finances : il est assis sur « le montant brut des sommes " +
            "payées ou mises à la disposition de leurs bénéficiaires » (art. 149 ter), au taux de « 20 % du montant brut des " +
            "revenus versés » (art. 149 quater), et il est dû « au moment du paiement ou de la mise à disposition des " +
            "revenus » (art. 149 quinquies). NOTA · la loi de finances a numéroté « 22 quater » deux articles distincts, " +
            "par ses articles 23 et 39 ; celui qui fonde cette déclaration est le second.",
        contenu: "Déclaration des revenus de capitaux mobiliers versés à des personnes non-résidentes et du prélèvement de 20 % " +
            "correspondant, accompagnée de son paiement, à souscrire auprès du service gestionnaire de la société.",
        sourceDonnees: "Compte 44784 pour le prélèvement, et les dividendes et intérêts servis pour l'assiette. LE LOGICIEL NE PEUT " +
            "PAS ISOLER CETTE PART : un compte de retenue porte le montant retenu, jamais la résidence du bénéficiaire · " +
            "c'est à vous de ventiler vos versements avant de déclarer. RÉSERVE DE CHAMP · le texte dit « les sociétés » : " +
            "l'entreprise individuelle et l'entreprenant sont écartés de cette obligation, qui ne leur est plus servie. " +
            "Pour une SUCCURSALE et pour une ENTITÉ PUBLIQUE, aucun texte lu ne tranche, et l'obligation reste affichée " +
            "plutôt que retirée au jugé · à faire trancher par un conseil. Ne lisez pas cette exclusion comme une " +
            "dispense générale : la retenue INTERNE de 20 % sur les revenus de capitaux mobiliers (art. 120 de la même " +
            "loi) est une autre obligation, qui a sa propre ligne dans cet état.",
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesExclues: exports.FORMES_PERSONNES_PHYSIQUES,
    },
    {
        cle: 'releveTrimestrielTiers',
        libelle: 'Relevé des sommes versées à des tiers (hors salaires)',
        periodicite: 'TRIMESTRIELLE',
        joursApresPeriode: 10,
        echeance: 'Dans les dix jours suivant la fin de chaque trimestre',
        baseLegale: "Article 47, alinéa 1er, de la loi n° 004/2003 portant réforme des procédures fiscales, tel que modifié par la loi de finances n° 24/011 du 20 décembre 2024, article 40. Il vise nommément les associations sans but lucratif et les établissements d'utilité publique.",
        contenu: 'Relevé, sur support papier ET numérique, de « toutes les sommes versées à des tiers, à quelque titre que ce soit, à l’exclusion des salaires », notamment honoraires, commissions, courtages, ristournes, vacations, droits d’auteur, loyers. Le modèle du relevé est fixé par l’Administration des Impôts.',
        sanction: SANCTION_ARTICLE_94,
        sourceDonnees: "Comptes de tiers 40 (fournisseurs), 481 (fournisseurs d'investissements) et 47 (débiteurs et créditeurs divers), et charges des comptes 62-63 (services extérieurs) et 65. Celui qui vend une immobilisation est un tiers à qui une somme est versée : le relevé tiré des seuls 40 et 47 l'omettrait.",
        referentiels: [client_1.Referentiel.SYCEBNL],
        formesIncluses: [client_1.FormeJuridiqueSyscohada.ENTITE_PUBLIQUE],
        reserveFormesIncluses: "La forme « entité publique » du dossier couvre aussi les entités parapubliques et d'économie mixte (AUDCIF, " +
            "art. 2). L'article 47, alinéa 1er, nomme « les établissements publics, les organismes semi-publics, les " +
            "entreprises publiques » et pas l'économie mixte, que l'article 48 de la même loi nomme à part (« les " +
            "entreprises publiques ou d'économie mixte »). Confirmez la qualité de l'entité avant de tenir le relevé pour dû.",
    },
    {
        cle: 'releveTrimestrielDroitsAuteur',
        libelle: 'Relevé trimestriel des droits d’auteurs ou d’inventeurs versés aux membres ou mandants',
        periodicite: 'TRIMESTRIELLE',
        joursApresPeriode: 10,
        echeance: 'Dans les dix jours suivant la fin de chaque trimestre',
        baseLegale: "Article 47, alinéa 2, de la loi n° 004/2003 portant réforme des procédures fiscales, tel que modifié par la loi de finances n° 24/011 du 20 décembre 2024, article 40.",
        contenu: 'Relevé des sommes versées à ses membres ou mandants au titre des droits d’auteurs ou d’inventeurs, dans les mêmes conditions et sur les mêmes supports que le relevé de l’alinéa 1er.',
        sanction: SANCTION_ARTICLE_94,
        sourceDonnees: 'Comptes de redevances et de droits versés, et comptes de tiers 40 et 47 pour les bénéficiaires.',
    },
    {
        cle: 'declarationImpotSocietes',
        libelle: 'Déclaration de l’impôt sur les sociétés',
        periodicite: 'ANNUELLE',
        moisEcheance: 4,
        jourEcheance: 30,
        echeance: "Au plus tard le 30 avril de l'année qui suit celle de la réalisation des revenus",
        baseLegale: "Article 12 de la loi de procédures fiscales n° 004/2003, modifié par la loi n° 23/052 du 30 novembre 2023 " +
            'et par la loi de finances n° 25/060 du 29 décembre 2025 : « Le redevable de l’impôt sur les sociétés est ' +
            'tenu de souscrire chaque année, au plus tard le 30 avril de l’année qui suit celle de la réalisation des ' +
            'revenus, une déclaration de ses revenus. » L’alinéa 2, ajouté en 2025, permet à l’Administration de ' +
            'communiquer les informations dont elle dispose, mais « la responsabilité de la déclaration et du calcul de ' +
            'l’impôt demeure entièrement à la charge du contribuable ».',
        contenu: "Déclaration auto-liquidative des revenus de l'exercice, contresignée par le conseil ou le comptable du redevable " +
            "(art. 13, al. 2). Pour une entreprise relevant du Système normal, elle est appuyée du bilan, du compte de " +
            "résultat, du tableau des flux de trésorerie, du tableau de variation des capitaux propres et des notes annexes " +
            "(art. 13, al. 1er), certifiés « par un expert-comptable inscrit au tableau de l'Ordre national des " +
            "experts-comptables, dans les conditions définies par Arrêté du Ministre » (art. 14). Cet arrêté, n° 014 du " +
            "16 mai 2023, veut un certificateur INDÉPENDANT : « La mission de certification des états financiers est " +
            "incompatible avec celle d'assistance comptable et/ou fiscale. La certification ne peut être délivrée que par un " +
            "Expert-comptable indépendant de l'entité établissant les états financiers » (art. 5) ; celle d'« un membre non " +
            "indépendant » est irrégulière et « assimilée à un refus de certification » (art. 14) ; et la NON-DÉSIGNATION du " +
            "certificateur est « considéré[e] comme un refus », qui fait l'objet « d'une taxation d'office pour comptabilité " +
            "irrégulière au sens de l'article 41 » de la loi n° 004/2003 (art. 15). Au 30 avril, la recevabilité est " +
            "subordonnée à « l'attestation de certification » revêtue du « timbre spécial ou hologramme » (art. 20 et 22) ; " +
            "le rapport de certification est adressé à la DGI « par le commissaire aux comptes ou l'expert-comptable » avant " +
            "le 30 juin (art. 13). Tout déclarant y joint le relevé récapitulatif des ventes faites aux « commerçants » ou « fabricants » " +
            "(art. 13, al. 3), et la dépose même en cas de perte (art. 15). En cas de dissolution, de liquidation ou de " +
            "cessation, elle se remet dans le mois, avant le départ du dirigeant (art. 16). Le SOLDE de l'impôt se paie au même " +
            "moment : les trois acomptes « sont à déduire de l'impôt dû par le contribuable pour l'exercice fiscal " +
            "considéré, le solde éventuel de cet impôt devant être versé au moment du dépôt de la déclaration y " +
            "afférente » (art. 57 bis, al. 3). Le 30 avril est donc aussi une échéance de paiement.",
        sourceDonnees: "Résultat fiscal de la fenêtre État > Résultat fiscal et impôt sur les bénéfices, et liasse de la fenêtre États financiers.",
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesExclues: exports.FORMES_PERSONNES_PHYSIQUES,
        reserveCommune: RESERVE_ARRETE_CERTIFICATION,
    },
    {
        cle: 'designationCertificateur',
        libelle: 'Désignation de l’expert-comptable certificateur des états financiers',
        periodicite: 'ANNUELLE',
        moisEcheance: 6,
        jourEcheance: 29,
        echeance: 'Avant le 30 juin de chaque année',
        baseLegale: "Arrêté ministériel n° 014/CAB/MIN/FINANCES/2023 du 16 mai 2023, pris pour l'application de l'article 14 de la " +
            "loi n° 004/2003 : « Tout contribuable a l'obligation de désigner avant le 30 juin de chaque année un " +
            "expert-comptable ou une société d'expertise comptable inscrit au tableau de l'ONEC pour certifier ses états " +
            "financiers » (art. 4) ; « Toutes les entités n'ayant pas désigné des commissaires aux comptes, des " +
            "experts-comptables ou des sociétés d'expertise comptable doivent les désigner avant le 30 juin de l'année en " +
            "cours » (art. 8).",
        contenu: "Désignation de l'expert-comptable ou de la société d'expertise comptable inscrit au tableau de l'ONEC qui " +
            "certifiera les états financiers joints à la déclaration du 30 avril. Il doit être « indépendant de l'entité " +
            "établissant les états financiers » (art. 5) · voir la déclaration de l'impôt sur les sociétés. Pour une entité " +
            "astreinte à un commissaire aux comptes, c'est lui qui certifie (art. 6).",
        sanction: "« Est considéré comme un refus de faire certifier ses états financiers, la non désignation par l'entité [...] " +
            "d'un commissaire aux comptes ou d'un expert-comptable » : taxation d'office pour comptabilité irrégulière au " +
            "sens de l'article 41 de la loi n° 004/2003 (arrêté n° 014, art. 15). Aucun montant n'est chiffré ici.",
        sourceDonnees: "Aucun livre ne porte cette désignation · le module Mandat du contrôleur des comptes ne tient que le " +
            "contrôleur légal.",
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesExclues: exports.FORMES_PERSONNES_PHYSIQUES,
        reserveCommune: "Deux points que le texte ne concilie pas, et que le logiciel ne tranche pas. « Chaque année » (art. 4) contre " +
            "un mandat « de six (6) ans renouvelables » (art. 7) · une désignation pluriannuelle en cours satisfait-elle " +
            "l'obligation annuelle, le texte ne le dit pas. Et le rapport de certification, que l'article 13 fait adresser " +
            "à la DGI « par le commissaire aux comptes ou l'expert-comptable » avant le 30 juin, la norme professionnelle " +
            "ONEC n° 2024/001, § 15, le fait transmettre par l'entreprise. L'arrêté ne vise que « les entités soumises au " +
            "régime fiscal de droit commun » (art. 2), et l'article 14 de la loi n° 004/2003 que les états des entreprises " +
            "relevant du système normal. " +
            RESERVE_ARRETE_CERTIFICATION,
    },
    {
        cle: 'declarationIrpp',
        libelle: 'Déclaration annuelle de l’impôt sur le revenu des personnes physiques',
        periodicite: 'ANNUELLE',
        moisEcheance: 4,
        jourEcheance: 30,
        echeance: "Au plus tard le 30 avril de l'année qui suit celle de la réalisation des revenus",
        baseLegale: "Article 17 de la loi de procédures fiscales n° 004/2003, modifié par la loi n° 23/052 du 30 novembre 2023 " +
            'et par la loi de finances n° 25/060 du 29 décembre 2025, art. 20 : « Les personnes physiques soumises à ' +
            'l’Impôt sur le Revenu des Personnes Physiques sont tenues de souscrire chaque année, au plus tard le 30 avril ' +
            'de l’année qui suit celle de la réalisation des revenus, au Service de l’Administration des Impôts du lieu de ' +
            'leur résidence, une déclaration de leurs revenus. »',
        contenu: "Déclaration des revenus de l'année, au service du lieu de résidence. Pour une personne relevant du Système " +
            "normal et réalisant des bénéfices industriels, commerciaux, immobiliers, artisanaux, non commerciaux ou " +
            "agricoles, elle porte les mêmes annexes que celles de l'article 13, est contresignée par le conseil ou le " +
            "comptable, et s'accompagne du relevé récapitulatif des ventes aux « commerçants » ou « fabricants » (art. 17, " +
            "al. 2 et 3). En cas de cessation, elle se remet dans le mois (art. 16).",
        sourceDonnees: "Résultat fiscal de la fenêtre État > Résultat fiscal et impôt sur les bénéfices, et liasse de la fenêtre États financiers.",
        referentiels: [client_1.Referentiel.SYSCOHADA],
        personnesPhysiquesSeulement: true,
        reserveRegimePhysique: "Au RÉGIME DES PETITES ENTREPRISES, l'article 57 quater, alinéa 2, fait payer la première quotité « à la " +
            "souscription de la déclaration auto liquidative, au plus tard le 31 janvier de l'année qui suit celle de la " +
            "réalisation des revenus », quand l'article 17 fixe la déclaration au 30 avril · les deux textes ne " +
            "s'articulent pas, et l'échéancier ne déplace aucune date. À faire préciser par le service gestionnaire. Le " +
            "régime se lit dans État > Résultat fiscal et impôt sur les bénéfices.",
    },
    {
        cle: 'premierAcompteIs',
        libelle: 'Premier acompte provisionnel (30 %)',
        periodicite: 'ANNUELLE',
        moisEcheance: 7,
        jourEcheance: 25,
        echeance: 'Au plus tard le 25 juillet',
        natureEcheance: 'PAIEMENT',
        baseLegale: BASE_ACOMPTES,
        contenu: CONTENU_ACOMPTE('30 %'),
        sourceDonnees: SOURCE_ACOMPTES,
        referentiels: [client_1.Referentiel.SYSCOHADA],
        reserveRegimePhysique: "Ces trois acomptes ne sont dus qu'au RÉGIME RÉEL · l'article 57 bis ne vise que les acomptes de " +
            "l'article 57, ALINÉA 2, et une personne physique au régime des petites entreprises relève de l'alinéa 3, " +
            "qui la fait payer en deux quotités (ci-dessous). Le régime se déduit du chiffre d'affaires sur plusieurs " +
            "exercices (art. 113) et se lit dans État > Résultat fiscal et impôt sur les bénéfices · cet échéancier ne " +
            'le tranche pas, il sert les deux calendriers et vous laisse retenir le vôtre.',
    },
    {
        cle: 'deuxiemeAcompteIs',
        libelle: 'Deuxième acompte provisionnel (30 %)',
        periodicite: 'ANNUELLE',
        moisEcheance: 9,
        jourEcheance: 25,
        echeance: 'Au plus tard le 25 septembre',
        natureEcheance: 'PAIEMENT',
        baseLegale: BASE_ACOMPTES,
        contenu: CONTENU_ACOMPTE('30 %'),
        sourceDonnees: SOURCE_ACOMPTES,
        referentiels: [client_1.Referentiel.SYSCOHADA],
        reserveRegimePhysique: "Ces trois acomptes ne sont dus qu'au RÉGIME RÉEL · l'article 57 bis ne vise que les acomptes de " +
            "l'article 57, ALINÉA 2, et une personne physique au régime des petites entreprises relève de l'alinéa 3, " +
            "qui la fait payer en deux quotités (ci-dessous). Le régime se déduit du chiffre d'affaires sur plusieurs " +
            "exercices (art. 113) et se lit dans État > Résultat fiscal et impôt sur les bénéfices · cet échéancier ne " +
            'le tranche pas, il sert les deux calendriers et vous laisse retenir le vôtre.',
    },
    {
        cle: 'troisiemeAcompteIs',
        libelle: 'Troisième acompte provisionnel (20 %)',
        periodicite: 'ANNUELLE',
        moisEcheance: 11,
        jourEcheance: 25,
        echeance: 'Au plus tard le 25 novembre',
        natureEcheance: 'PAIEMENT',
        baseLegale: BASE_ACOMPTES,
        contenu: CONTENU_ACOMPTE('20 %'),
        sourceDonnees: SOURCE_ACOMPTES,
        referentiels: [client_1.Referentiel.SYSCOHADA],
        reserveRegimePhysique: "Ces trois acomptes ne sont dus qu'au RÉGIME RÉEL · l'article 57 bis ne vise que les acomptes de " +
            "l'article 57, ALINÉA 2, et une personne physique au régime des petites entreprises relève de l'alinéa 3, " +
            "qui la fait payer en deux quotités (ci-dessous). Le régime se déduit du chiffre d'affaires sur plusieurs " +
            "exercices (art. 113) et se lit dans État > Résultat fiscal et impôt sur les bénéfices · cet échéancier ne " +
            'le tranche pas, il sert les deux calendriers et vous laisse retenir le vôtre.',
    },
    {
        cle: 'premiereQuotitePetiteEntreprise',
        libelle: 'Première quotité de l’impôt (60 %)',
        periodicite: 'ANNUELLE',
        moisEcheance: 1,
        jourEcheance: 31,
        echeance: 'Au plus tard le 31 janvier',
        baseLegale: 'Article 57, alinéa 3, et article 57 quater, alinéa 2, de la loi de procédures fiscales n° 004/2003.',
        contenu: "Versement de 60 % de l'impôt dû au titre de l'exercice, au plus tard le 31 janvier de l'année qui suit celle de la réalisation des revenus. Ce n'est PAS un acompte sur l'exercice suivant : c'est le paiement de cet impôt-ci, fractionné. L'article 57 quater, alinéa 2, le lie à la déclaration : « La 1ère quotité visée à l'alinéa précédent du présent article est payée à la souscription de la déclaration auto liquidative, au plus tard le 31 janvier de l'année qui suit celle de la réalisation des revenus. » La déclaration de l'article 17, elle, est due au plus tard le 30 avril · les deux textes ne s'articulent pas, et l'échéancier ne déplace aucune date. À faire préciser par le service gestionnaire, comme l'échéance de la seconde quotité.",
        sourceDonnees: "Impôt dû de la fenêtre État > Résultat fiscal et impôt sur les bénéfices, qui sert les deux quotités chiffrées.",
        referentiels: [client_1.Referentiel.SYSCOHADA],
        personnesPhysiquesSeulement: true,
        reserveRegimePhysique: "Ces deux quotités ne sont dues qu'au RÉGIME DES PETITES ENTREPRISES (art. 57, al. 3 et art. 57 quater) · " +
            "au régime réel, ce sont les trois acomptes ci-dessus qui s'appliquent, et le régime des micro-entreprises " +
            "n'en doit aucun. Le régime se lit dans État > Résultat fiscal et impôt sur les bénéfices.",
    },
    {
        cle: 'secondeQuotitePetiteEntreprise',
        libelle: 'Seconde quotité de l’impôt (40 %)',
        periodicite: 'ANNUELLE',
        moisEcheance: 4,
        jourEcheance: 30,
        echeance: 'Au plus tard le 30 avril',
        natureEcheance: 'PAIEMENT',
        baseLegale: 'Article 57, alinéa 3, et article 57 quater, alinéa 3, de la loi de procédures fiscales n° 004/2003.',
        contenu: "Versement du solde de 40 % de l'impôt dû au titre de l'exercice. ÉCHÉANCE À CONFIRMER auprès du service gestionnaire : l'alinéa 3 de l'article 57 quater écrit une seconde fois « La 1ère quotité est acquittée [...] au plus tard le 30 avril de la même année ». Le même alinéa ne peut pas fixer deux dates à la même quotité · le défaut de rédaction est celui du texte officiel, repris tel quel par la compilation DGI au 19 juillet 2026, et il est signalé ici plutôt que corrigé en silence.",
        sourceDonnees: "Impôt dû de la fenêtre État > Résultat fiscal et impôt sur les bénéfices, qui sert les deux quotités chiffrées.",
        referentiels: [client_1.Referentiel.SYSCOHADA],
        personnesPhysiquesSeulement: true,
        reserveRegimePhysique: "Ces deux quotités ne sont dues qu'au RÉGIME DES PETITES ENTREPRISES (art. 57, al. 3 et art. 57 quater) · " +
            "au régime réel, ce sont les trois acomptes ci-dessus qui s'appliquent, et le régime des micro-entreprises " +
            "n'en doit aucun. Le régime se lit dans État > Résultat fiscal et impôt sur les bénéfices.",
    },
    {
        cle: 'declarationAnnuelleSalaires',
        libelle: 'Déclaration annuelle sur les revenus salariaux',
        periodicite: 'ANNUELLE',
        moisEcheance: 3,
        jourEcheance: 31,
        echeance: "Au plus tard le 31 mars de l'année suivante",
        baseLegale: 'Article 22 ter de la loi de procédures fiscales, créé par la loi de finances n° 22/071 du 28 décembre 2022 ' +
            'et modifié par la loi de finances n° 25/060 du 29 décembre 2025.',
        contenu: "Déclaration récapitulative des revenus salariaux et revenus assimilés versés, accompagnée des fiches individuelles de chaque rémunéré, classées par province et par ordre alphabétique, sur le modèle fixé par l'Administration des Impôts.",
        sourceDonnees: 'Comptes 66 (charges de personnel), 4471 et 4472 (impôts retenus à la source) pour les totaux, et les ' +
            'bulletins de paie émis (fenêtre Personnel) pour les montants par salarié. LA FICHE INDIVIDUELLE NE SORT PAS ' +
            'DE CES SOLDES · le texte la veut par rémunéré, CLASSÉE PAR PROVINCE, et le registre du personnel ne porte ' +
            "aucune province d'affectation. Le classement se fait hors du logiciel.",
        reserveRegimePhysique: "Pour une personne physique, cette déclaration n'est due qu'au RÉGIME RÉEL ou au RÉGIME DES PETITES ENTREPRISES " +
            "(art. 22 ter, al. 1er) · le régime des micro-entreprises n'est pas visé. Le régime se lit dans État > Résultat " +
            'fiscal et impôt sur les bénéfices.',
    },
    {
        cle: 'listeFournisseurs',
        libelle: 'Liste annuelle des fournisseurs',
        periodicite: 'ANNUELLE',
        moisEcheance: 3,
        jourEcheance: 31,
        echeance: "Au plus tard le 31 mars de l'année suivante",
        baseLegale: 'Article 47 ter de la loi de procédures fiscales, inséré par la loi de finances n° 25/060 du 29 décembre 2025.',
        contenu: "Liste des fournisseurs avec, pour chacun : identité, adresse, boîte postale, Numéro Impôt, montant hors taxes, TVA et montant toutes taxes comprises payé.",
        sourceDonnees: "Comptes 40 (fournisseurs) ET 481 (fournisseurs d'investissements), et 445 (TVA récupérable). Le texte dit « la liste de ses fournisseurs » sans distinguer l'objet de l'achat · celui qui vend une immobilisation en est un, et le relevé du seul 401 l'omettrait. Le Numéro Impôt de chaque fournisseur se renseigne sur sa fiche, dans le plan des tiers.",
        reserveSycebnl: "ENTITÉ EXEMPTÉE · l'article 47 ter vise « toute personne physique ou morale, soumise à l'impôt sur les " +
            "sociétés et à l'impôt sur le revenu des personnes physiques, exonérée ou non ». La loi n° 23/053 distingue " +
            "l'exemption, « la dispense d'une obligation fiscale de déclaration et de paiement » (art. 2, 10°), de " +
            "l'exonération, « la dispense totale ou partielle de paiement d'impôt » (11°), et exempte « les Associations " +
            "sans but lucratif constituées conformément à la Loi » (art. 5, 3°). La loi de procédures fiscales, art. 3, " +
            "dispense les personnes exemptées « de l'obligation de souscrire les déclarations, à l'exception de celles " +
            "afférentes aux impôts dont elles sont redevables légaux ». Une entité dont l'exemption n'est pas acquise " +
            "reste visée. Pour une entité exemptée, le texte lu ne tranche pas, la liste figurant au titre du contrôle et " +
            "non des déclarations · à confirmer auprès du service gestionnaire avant de la tenir pour due ou pour " +
            "dispensée.",
    },
    {
        cle: 'listeClients',
        libelle: 'Liste annuelle des clients',
        periodicite: 'ANNUELLE',
        moisEcheance: 3,
        jourEcheance: 31,
        echeance: 'Au plus tard le 31 mars de chaque année',
        baseLegale: "Article 47 bis de la loi de procédures fiscales, inséré par la loi de finances n° 24/011 du 20 décembre 2024, " +
            "art. 41 : « Les fabricants, les importateurs et toutes entreprises effectuant des ventes en gros et/ou en " +
            "demi-gros doivent adresser à l'Administration des Impôts au plus tard le 31 mars de chaque année, sur support " +
            "papier ou en support numérique, la liste de leurs clients ».",
        contenu: "Liste des clients comportant pour chacun d'eux : l'identité et l'adresse physique ainsi que le numéro de la " +
            "boîte postale ; le numéro impôt ; le montant total hors taxes des achats effectués au cours de l'année " +
            "précédente ; la taxe sur la valeur ajoutée facturée.",
        sourceDonnees: "La fiche du client dans le plan des tiers (adresse, boîte postale, Numéro Impôt), les factures de vente de la " +
            "fenêtre Facturation, et les comptes 41 (clients) et 443 (TVA facturée) pour le hors taxes et la TVA de " +
            "l'année précédente.",
        masqueeSiAucuneVente: true,
        reserveCommune: "QUALITÉ DU DÉCLARANT · le texte ne vise que les fabricants, les importateurs et les entreprises qui vendent en " +
            "gros ou en demi-gros. Aucun livre ne porte cette qualité : confirmez-la avant de tenir la liste pour due. Il " +
            "n'est pas question ici du relevé des ventes joint à la déclaration de l'impôt sur les sociétés (art. 13, " +
            "al. 3), qui est une autre obligation. L'article est en vigueur depuis le 1er janvier 2025.",
    },
    {
        cle: 'declarationRevenusLocatifs',
        libelle: 'Déclaration annuelle de l’impôt sur les revenus locatifs · si le dossier donne des bâtiments ou des terrains en location',
        periodicite: 'ANNUELLE',
        moisEcheance: 2,
        jourEcheance: 1,
        echeance: "Au plus tard le 1er février de l'année qui suit celle de la réalisation des revenus",
        baseLegale: "Article 11 de la loi de procédures fiscales : « Le redevable de l'impôt sur les revenus locatifs souscrit " +
            "chaque année une déclaration au plus tard le 1er février de l'année qui suit celle de la réalisation des " +
            "revenus. » Article 14 de la loi n° 83/004 du 23 février 1983 : « Chaque propriétaire reste tenu d'inclure " +
            "dans la déclaration annuelle de ses revenus locatifs le montant brut des loyers qui comporte, d'une part, le " +
            "montant des loyers réellement encaissés, et d'autre part, le montant des retenues à la source opérées par le " +
            "locataire ou sous-locataire. »",
        contenu: "Déclaration des loyers bruts de l'année · les loyers réellement encaissés et les retenues à la source " +
            "opérées par les locataires, que l'Administration impute sur l'impôt dû « au titre de l'année au cours de " +
            "laquelle les loyers ont fait l'objet des retenues » (loi n° 83/004, art. 13). À Kinshasa, la déclaration se " +
            "fait « suivant le modèle prévu par la Direction Générale des Recettes de Kinshasa » et l'impôt se paie au " +
            "plus tard le 1er février (arrêté provincial n° 015/CAB/MIN.PROV/FIN.ECO/2023, art. 2).",
        sourceDonnees: "Comptes de produits où le dossier porte ses loyers, et compte de l'État où il porte les retenues subies. " +
            "Aucun compte semé ne distingue un loyer d'immeuble d'un autre produit · la ventilation appartient au cabinet. " +
            "Aucun montant n'est calculé ici.",
        reserveCommune: "À TENIR POUR DUE SEULEMENT SI LE DOSSIER EST BAILLEUR. EXEMPTIONS · l'ordonnance-loi n° 69/009, art. 12, " +
            "exempte notamment l'État, les provinces et les établissements publics « n'ayant d'autres ressources que " +
            "celles provenant de subventions budgétaires », les établissements d'utilité publique et « les associations " +
            "sans but lucratif ayant pour fin de s'occuper d'œuvres religieuses, scientifiques ou philanthropiques » · le " +
            "logiciel ne tranche pas l'objet de l'entité. SOCIÉTÉS IMMOBILIÈRES · la circulaire ministérielle n° 0023 du " +
            "9 janvier 2001 les écartait de cet impôt au motif qu'elles étaient « imposés à l'impôt professionnel », " +
            "abrogé depuis le 1er janvier 2026 (loi n° 23/053, art. 152) · la portée actuelle de cette exclusion n'est pas " +
            "tranchée. TAUX · l'impôt est provincial (Constitution, art. 204, 16°) : voir la réserve de la retenue sur les " +
            "revenus locatifs. AUTRES DÉCLARATIONS DU MÊME CHAPITRE · l'impôt foncier (art. 6), l'impôt sur les véhicules " +
            "(art. 7 à 9) et la taxe de superficie des concessions minières (art. 10) ne sont pas servies non plus par cet " +
            "échéancier.",
    },
    {
        cle: 'procesVerbalAssemblee',
        libelle: "Procès-verbal de l'assemblée générale approuvant les états financiers",
        periodicite: 'ANNUELLE',
        moisEcheance: 7,
        jourEcheance: 10,
        echeance: "Dans les dix jours de la tenue de l'assemblée générale",
        baseLegale: 'Article 13 bis de la loi de procédures fiscales, inséré par la loi de finances n° 25/060 : « Les sociétés ' +
            'et les autres personnes morales soumises à l’impôt sur les sociétés sont tenues de déposer […] dans les ' +
            'dix jours de la tenue de l’Assemblée générale ordinaire approuvant les états financiers certifiés par les ' +
            'commissaires aux comptes, le procès-verbal de l’Assemblée générale. »',
        contenu: "Procès-verbal de l'assemblée générale ordinaire ayant approuvé les états financiers certifiés.",
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesExclues: exports.FORMES_PERSONNES_PHYSIQUES,
        sanction: undefined,
        sourceDonnees: "Date calculée à partir de l'échéance de dépôt au CPCC, faute de date d'assemblée renseignée : c'est un repère, à corriger sur la date réelle de votre assemblée.",
    },
];
exports.AVERTISSEMENT_REGISTRE = "Cet état ne calcule aucun impôt et n'applique aucun barème. Il recense ce que votre comptabilité porte déjà sur " +
    "les comptes de retenue et de cotisation, en regard de l'échéance légale de reversement. Les montants viennent de " +
    'vos écritures ; les échéances viennent des textes cités, à la date de vérification indiquée. ' +
    jour_ouvrable_1.RESERVE_JOUR_OUVRABLE +
    ' ' +
    jour_ouvrable_1.RESERVE_ECHEANCES_SOCIALES;
function estEcheanceFiscale(e) {
    if ('beneficiaire' in e)
        return e.beneficiaire !== 'ORGANISME_SOCIAL';
    return e.echeanceFiscale !== false;
}
function avertissementRegimeImpot(referentiel, formeJuridique = null) {
    const rappelTiers = "Quoi qu'il en soit de son propre impôt, l'entité ne se trouve dispensée d'AUCUN impôt retenu pour le compte " +
        "d'autrui, ni d'aucune cotisation sociale, ni de les DÉCLARER aux échéances prévues.";
    if (referentiel === client_1.Referentiel.SYSCOHADA) {
        if (formeJuridique === client_1.FormeJuridiqueSyscohada.ENTITE_PUBLIQUE) {
            return ("Ce dossier est une ENTITÉ PUBLIQUE, et l'impôt sur les sociétés ne lui est pas dû de plein droit. " +
                "L'article 5, 1° de la loi n° 23/053 EXEMPTE « l'Etat, les Provinces et les Entités Territoriales " +
                'Décentralisées, les établissements publics, en vertu de leurs statuts, et les autres organismes de droit ' +
                "public dont les ressources proviennent uniquement de subventions budgétaires ». L'exemption est, au sens " +
                "du Titre Ier, article 2, 10°, « la dispense d'une obligation fiscale de déclaration ET de paiement ». " +
                "Elle ne joue PAS pour une exploitation lucrative, que l'article 3 impose : OmegaX ne connaît ni les " +
                "statuts de l'établissement ni l'origine de ses ressources, et ne tranche donc pas · à vérifier avant " +
                'toute déclaration. ' +
                rappelTiers);
        }
        if (formeJuridique === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE) {
            return ("Ce dossier est une SOCIÉTÉ COOPÉRATIVE, et son régime dépend de deux données que le logiciel ne détient " +
                "pas. L'article 3 l'impose à raison de son activité ; l'article 5, 2° EXEMPTE « les sociétés coopératives " +
                'de production, de transformation, de conservation et de vente de produits agricoles, de l’élevage et de ' +
                'la pêche et leurs unions fonctionnant conformément aux dispositions légales qui les régissent, LORSQU’ELLES ' +
                'REVÊTENT LA FORME CIVILE ». Les deux conditions sont cumulatives, et le champ « forme juridique » du ' +
                "dossier porte la coopérative au sens de l'Acte uniforme, pas la forme civile au sens fiscal · à trancher " +
                'avant toute déclaration. ' +
                rappelTiers);
        }
        if (formeJuridique !== null && exports.FORMES_PERSONNES_PHYSIQUES.includes(formeJuridique)) {
            return ("Ce dossier est une PERSONNE PHYSIQUE, et l'impôt sur les sociétés ne lui est PAS dû. L'article 1er de la " +
                "loi n° 23/053 établit l'impôt sur les sociétés sur « l'ensemble des bénéfices réalisés par les sociétés et " +
                "autres personnes morales » et réserve aux personnes physiques « un impôt unique sur le revenu des personnes " +
                "physiques », l'IRPP ; l'article 2, 17°, a) range l'exploitant individuel parmi les personnes physiques, et " +
                "l'article 3 ne l'impose à l'IS ni par sa forme ni par son activité. La déclaration annuelle est celle de " +
                "l'article 17 de la loi n° 004/2003, due au plus tard le 30 avril de l'année qui suit celle de la " +
                "réalisation des revenus. SON CALENDRIER DE PAIEMENT DÉPEND DU RÉGIME, que cet état ne détermine pas : au " +
                'régime réel, trois acomptes provisionnels (art. 57 bis) ; au régime des petites entreprises, deux quotités ' +
                '(art. 57, al. 3 et 57 quater) ; au régime des micro-entreprises, ni acompte ni quotité. Le régime se lit ' +
                'dans État > Résultat fiscal et impôt sur les bénéfices. ' +
                rappelTiers);
        }
        return ("La société est redevable de l'impôt sur les sociétés (loi n° 23/053, art. 3). Sa déclaration est due au plus " +
            "tard le 30 avril de l'année qui suit celle de la réalisation des revenus (loi n° 004/2003, art. 12), et ses " +
            'trois acomptes provisionnels au plus tard les 25 juillet, 25 septembre et 25 novembre (art. 57 bis, tel que ' +
            "modifié par la loi de finances n° 25/060 du 29 décembre 2025). " +
            rappelTiers);
    }
    return ("L'exemption d'impôt sur les sociétés dont bénéficie une ASBL régulièrement constituée (loi n° 23/053, art. 5, " +
        "3°) porte, au sens du Titre Ier, article 2, 10°, sur « une obligation fiscale de DÉCLARATION ET DE PAIEMENT » · " +
        "elle ne se confond pas avec l'EXONÉRATION du 11°, qui ne dispense que du paiement. " +
        rappelTiers);
}
function obligationsDeclarativesApplicables(referentiel, formeSyscohada, faits = {}) {
    const physique = !!formeSyscohada && exports.FORMES_PERSONNES_PHYSIQUES.includes(formeSyscohada);
    const parLaForme = (o) => referentiel === client_1.Referentiel.SYSCOHADA &&
        !!formeSyscohada &&
        !!o.formesIncluses &&
        o.formesIncluses.includes(formeSyscohada);
    return exports.OBLIGATIONS_DECLARATIVES.filter((o) => (!o.referentiels || o.referentiels.includes(referentiel) || parLaForme(o)) &&
        (!o.personnesPhysiquesSeulement || physique) &&
        !(o.formesExclues && !!formeSyscohada && o.formesExclues.includes(formeSyscohada)) &&
        !(o.masqueeSiAucuneVente && faits.venteBiensServices === false)).map((o) => {
        const parts = [
            o.reserveCommune,
            referentiel === client_1.Referentiel.SYCEBNL ? o.reserveSycebnl : undefined,
            parLaForme(o) && !(o.referentiels ?? []).includes(referentiel) ? o.reserveFormesIncluses : undefined,
            physique ? o.reserveRegimePhysique : undefined,
        ].filter((r) => !!r);
        return { ...o, reserve: parts.length ? parts.join(' ') : null };
    });
}
function reservePourReferentiel(nature, referentiel) {
    return referentiel === client_1.Referentiel.SYSCOHADA ? (nature.reserveSyscohada ?? nature.reserve) : nature.reserve;
}
exports.AVERTISSEMENT_REDEVABLE = "Le redevable qui n'a pas opéré une retenue, ou qui l'a opérée pour un montant insuffisant, en est PERSONNELLEMENT " +
    'redevable, « du montant de la retenue non effectuée ET DES PÉNALITÉS Y AFFÉRENTES » (article 96 bis de la loi de procédures fiscales, INSÉRÉ par la loi de finances n° 24/011 du ' +
    '20 décembre 2024, art. 46, et REMPLACÉ par la loi de finances n° 25/060 du 29 décembre 2025, art. 35). Une ' +
    "retenue oubliée ne disparaît pas avec le paiement : elle devient une dette de l'entité elle-même, pénalités comprises. RÉSERVE · la " +
    'rédaction citée ici est celle issue du remplacement de 2025. Le texte de la version de 2024 n\u2019est pas au ' +
    "corpus du logiciel : sur un exercice antérieur à 2026, un article de ce numéro était en vigueur, mais sa " +
    'rédaction exacte reste à vérifier avant tout usage opposable.';
exports.AVERTISSEMENT_REVERSEMENT_EXERCICE_SUIVANT = 'MOIS SIGNALÉS EN RETARD · ce registre ne lit que les écritures de l’exercice affiché. Un reversement passé sur ' +
    'l’exercice suivant, celui de la retenue du dernier mois notamment, ne lui est pas visible : vérifiez-le sur ' +
    'l’exercice d’après avant de conclure au retard.';
exports.AVERTISSEMENT_REVERSEMENT_ANTERIEUR = 'REVERSEMENT NON IMPUTÉ · une part de ce qui a été reversé sur cet exercice n’éteint aucune retenue connue, ni de ' +
    'l’exercice ni de son solde d’ouverture : un versement excédentaire, ou une retenue d’une période que le dossier ' +
    'ne porte pas. Elle figure dans le total reversé de la nature, mais dans aucun de ses mois.';
function avertissementDeductibiliteArticle20(referentiel, signalements) {
    if (signalements.length === 0)
        return null;
    const detail = signalements
        .map((s) => `${s.libelle} · ${s.montantEchuNonReverse.toLocaleString('fr-FR')} FC de retenue échue non reversés au ` +
        `${s.derniereEcheanceEchue.toLocaleDateString('fr-FR')} (charge exposée : ${s.charge})`)
        .join(' ; ');
    const commun = 'RETENUES ÉCHUES ET NON REVERSÉES · ' +
        detail +
        ". L'article 20, dernier alinéa de la loi n° 23/053 range parmi les conditions générales de déductibilité des " +
        'charges que « la société apporte la preuve de la déclaration et du paiement de la retenue correspondante pour ' +
        'les sommes donnant lieu à un prélèvement ou à une retenue à la source ». Tant que le reversement n’est pas fait, ' +
        'cette preuve manque pour les charges correspondantes.';
    const reserveExercice = ' Ce registre ne lit que les écritures de l’exercice affiché : un reversement passé sur l’exercice suivant, ' +
        'celui de la retenue du dernier mois notamment, ne lui est pas visible · vérifiez-le avant de conclure.';
    if (referentiel === client_1.Referentiel.SYSCOHADA) {
        return (commun +
            ' La déduction de ces charges est donc exposée à une réintégration au résultat fiscal, pour le montant de la ' +
            'CHARGE et non pour celui de la retenue. Ce registre ne le chiffre pas : il ne connaît pas l’assiette et ' +
            'n’applique aucun taux · rapprochez ces retenues des charges qu’elles accompagnent dans État > Résultat fiscal ' +
            'avant de déclarer.' +
            reserveExercice);
    }
    return (commun +
        " L'entité qui bénéficie EFFECTIVEMENT de l'exemption d'impôt sur les sociétés de l'article 5 n'a pas de " +
        'bénéfice imposable sur lequel cette condition jouerait · exemption qui n’est pas automatique pour un ' +
        'établissement d’utilité publique ou une ONG, puisqu’elle suppose l’attestation et les conditions de fond des ' +
        'articles 2 et 3 de l’arrêté n° 007/CAB/MIN/FINANCES/2025 du 19 février 2025. Le reversement, lui, reste dû à ' +
        'l’échéance rappelée ci-dessus.' +
        reserveExercice);
}
//# sourceMappingURL=correspondance-retenues.js.map