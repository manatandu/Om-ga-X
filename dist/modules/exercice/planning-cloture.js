"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBLIGATIONS_EVENEMENTIELLES = exports.JALONS_CLOTURE = exports.DERNIERE_VERIFICATION = void 0;
exports.obligationsEvenementiellesApplicables = obligationsEvenementiellesApplicables;
exports.jalonsApplicables = jalonsApplicables;
exports.dateJalon = dateJalon;
const client_1 = require("@prisma/client");
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
const correspondance_retenues_2 = require("../retenues/correspondance-retenues");
const regles_affectation_1 = require("../affectation/regles-affectation");
const moitie_capital_1 = require("../controles/moitie-capital");
const FORMES_ASBL = [
    client_1.FormeJuridiqueEbnl.ASSOCIATION,
    client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE,
    client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE,
];
const FORMES_SOCIETES_ASSEMBLEE = [
    client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
    client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
    client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
];
const FORMES_SOCIETES_COMMERCIALES = [
    client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
    client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
    client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
    client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
    client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE,
];
const FORMES_DEPOT_RCCM = FORMES_SOCIETES_COMMERCIALES;
exports.DERNIERE_VERIFICATION = '2026-09-03';
function affectationSyscohada(forme) {
    const regime = (0, regles_affectation_1.regimeReserveLegale)(forme);
    const commerciale = forme !== null && FORMES_SOCIETES_COMMERCIALES.includes(forme);
    const individuelle = forme !== null && correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES.includes(forme);
    const comptes = individuelle
        ? 'le compte 13 est SOLDÉ selon la décision ; dans une entité individuelle, son solde est viré au compte 103 (Capital personnel).'
        : commerciale
            ? 'le compte 13 est SOLDÉ par le crédit des réserves (11), du report à nouveau (12), du capital social (101) ou des dividendes à payer (465) selon la décision.'
            : 'le compte 13 est SOLDÉ par le crédit des réserves (11) ou du report à nouveau (12) selon la décision · ce que la forme du dossier permet d’autre se lit dans le texte qui la régit.';
    const reserve = regime.exigee
        ? `La dotation à la réserve légale, d’un dixième au moins du bénéfice diminué, le cas échéant, des pertes antérieures, est obligatoire tant que la réserve n’atteint pas le cinquième du capital social · une délibération contraire est NULLE (${regime.source}).`
        : `Réserve légale · ${regime.motif}`;
    const augmentation = (0, regles_affectation_1.avertissementLigneCapital)(forme, true);
    const reduction = (0, regles_affectation_1.avertissementLigneCapital)(forme, false);
    const capital = augmentation && reduction ? ` Capital social (101) · ${augmentation} ${reduction}` : '';
    const dividendes = commerciale
        ? ' Si une distribution est décidée, la mise en paiement des dividendes doit avoir lieu dans un délai maximum de NEUF MOIS après la clôture de l’exercice, sauf prolongation accordée par la juridiction compétente (AUSCGIE, art. 146).'
        : '';
    const sources = [
        'AUDCIF, Titre VII, compte 13 (« le compte 13 est soldé lors de la comptabilisation de cette affectation »' +
            (individuelle ? ' ; « dans les entités individuelles, le solde du compte 13 est viré au compte 103 »' : '') +
            ')',
        ...(commerciale ? ['AUSCGIE, art. 142 et 143'] : []),
        regime.source,
        ...(commerciale ? ['AUSCGIE, art. 146 (mise en paiement des dividendes)'] : []),
    ];
    return {
        detail: `Comptabilisation de la décision d’affectation prise par l’organe compétent : ${comptes} ${reserve}${capital}${dividendes} Sans cette écriture, le résultat reste au compte 13 et s’y empile d’exercice en exercice.`,
        source: sources.join(' ; '),
    };
}
const RESERVE_PREMIERE_QUOTITE_PETITES_ENTREPRISES = (() => {
    const reserve = correspondance_retenues_2.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'declarationIrpp')?.reserveRegimePhysique;
    if (!reserve)
        throw new Error('Réserve de l’art. 57 quater, al. 2 introuvable dans le registre des retenues (declarationIrpp).');
    return 'RÉSERVE · ' + reserve;
})();
function approbationSas(associeUnique) {
    const assemblee = 'L’assemblée générale qui statue sur les états financiers de synthèse doit OBLIGATOIREMENT se tenir dans les six mois de la clôture de l’exercice. C’est elle qui fait courir le délai d’un mois du dépôt au registre du commerce.';
    if (associeUnique === true) {
        return {
            libelle: 'Approbation des comptes par l’associé unique',
            detail: 'Le rapport de gestion et les états financiers sont arrêtés par le président. L’associé unique approuve les comptes, après rapport du commissaire aux comptes s’il en existe un, dans les six mois de la clôture de l’exercice · il ne peut déléguer ses pouvoirs, et ses décisions sont répertoriées dans un registre spécial. Lorsque l’associé unique, personne physique, assume personnellement la présidence, le dépôt au registre du commerce, dans le même délai, de l’inventaire et des comptes annuels dûment signés vaut approbation.',
            source: 'AUSCGIE, art. 853-11, al. 4 et 5',
        };
    }
    if (associeUnique === false) {
        return { libelle: 'Assemblée générale statuant sur les états financiers', detail: assemblee, source: 'AUSCGIE, art. 140 al. 2' };
    }
    return {
        libelle: 'Assemblée générale statuant sur les états financiers',
        detail: `${assemblee} Si la société ne compte qu’un associé (SASU), c’est lui qui approuve seul, dans le même délai, les comptes arrêtés par le président · le caractère unipersonnel n’est pas encore déclaré dans les paramètres du dossier.`,
        source: 'AUSCGIE, art. 140 al. 2 ; art. 853-11, al. 4 et 5 (associé unique)',
    };
}
exports.JALONS_CLOTURE = [
    {
        etape: 1,
        libelle: 'Planning de clôture et instructions d’inventaire',
        detail: 'Concevoir, diffuser et vulgariser le planning de clôture ainsi que les instructions générale et spécifique des inventaires extracomptables. Le cours précise que ce planning doit obtenir le visa de la direction avant sa mise en application.',
        nature: 'INTERNE',
        debut: { moisApres: -2, jour: 1 },
        echeance: { moisApres: -1, jour: 'FIN' },
        source: 'CPCC, notes de cours d’organisation comptable, § 7.1 point 1 et § 2.3',
    },
    {
        etape: 2,
        libelle: 'Balance de vérification',
        detail: 'Établir la balance provisoire des comptes généraux, après validation de toutes les écritures du brouillard. Le cours rappelle qu’une procédure de validation « ne pouvant excéder le mois » doit rendre les traitements irréversibles.',
        nature: 'INTERNE',
        debut: { moisApres: 0, jour: 1 },
        echeance: { moisApres: 1, jour: 15 },
        source: 'CPCC, § 7.1 point 2 et § 2.6.2',
        observation: 'BROUILLARD',
    },
    {
        etape: 3,
        libelle: 'Inventaires extracomptables',
        detail: 'Prise d’inventaire physique des stocks, des immobilisations, de la caisse et des dons en nature. C’est cet inventaire qui donne la situation réelle, parfois différente de celle de la comptabilité. Le cours en attend une trace signée : un PV d’inventaire physique, signé par ceux qui ont inventorié ET par ceux qui ont assisté. Un comptage sans PV signé ne se prouve pas ; c’est le premier document qu’un auditeur réclame.',
        nature: 'INTERNE',
        debut: { moisApres: -1, jour: 1 },
        echeance: { moisApres: 1, jour: 'FIN' },
        source: 'CPCC, § 7.1 point 3 et § 2.3 (PV d’inventaire physique signé) ; SYCEBNL, art. 24',
        sanction: 'Article 24 de l’Acte uniforme SYCEBNL · encourent une sanction pénale les dirigeants qui n’ont pas, pour un exercice, dressé l’inventaire et établi les états financiers annuels ainsi que le rapport d’activité, ou qui n’ont pas tenu et mis à jour le registre des donateurs. L’article 27 renvoie au droit pénal de chaque État partie pour la peine.',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 3,
        libelle: 'Inventaires extracomptables',
        detail: 'Relevé physique de tous les éléments du patrimoine · stocks, immobilisations, caisse, créances et dettes · avec la nature, la quantité et la valeur de chacun à la date de l’inventaire. C’est ce relevé qui donne la situation réelle, parfois différente de celle de la comptabilité ; les données d’inventaire sont conservées de manière à justifier le contenu de chaque élément recensé. Le cours en attend une trace signée : un PV d’inventaire physique, signé par ceux qui ont inventorié ET par ceux qui ont assisté.',
        nature: 'INTERNE',
        debut: { moisApres: -1, jour: 1 },
        echeance: { moisApres: 1, jour: 'FIN' },
        source: 'AUDCIF, art. 16 (relevé physique), art. 17, 6° (contrôle par inventaire) et art. 111 (sanction pénale) ; CPCC, § 7.1 point 3 et § 2.3 (PV d’inventaire physique signé)',
        sanction: 'Article 111 de l’AUDCIF · encourent une sanction pénale les dirigeants qui n’auront pas, pour chaque exercice, dressé l’inventaire et établi les états financiers annuels, consolidés ou combinés, ainsi que le rapport de gestion et, le cas échéant, le bilan social. Le même article renvoie au droit pénal de chaque État partie pour la peine.',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 4,
        libelle: 'Compte annuel et liste des membres effectifs au Ministère de la Justice',
        detail: 'Dépôt, au Ministère de la Justice ET aux autorités administratives locales du siège, du compte annuel et de la liste alphabétique des membres effectifs, indiquant pour chaque administrateur la qualité en laquelle il a été nommé et l’acte l’ayant approuvé. Son destinataire n’est pas l’administration fiscale. L’obligation vise l’ASBL de droit congolais DOTÉE DE LA PERSONNALITÉ JURIDIQUE · la même source répond qu’une ASBL qui « n’a pas encore obtenu la personnalité juridique » n’y est pas tenue. Le compte annuel attendu est un état des recettes et des dépenses (cadre de l’annexe VII) ; aucune source lue ne dit si la liasse SYCEBNL en tient lieu. RÉSERVE · la CENCO la présente comme une mesure réglementaire du Ministère de la Justice ; aucun article de la loi n° 004/2001 ne la porte, et le texte réglementaire n’a pas été identifié.',
        nature: 'LEGALE',
        debut: { moisApres: 1, jour: 1 },
        echeance: { moisApres: 1, jour: 'FIN' },
        source: 'CENCO, Documentation à l’usage des ASBL, Vade Mecum du gestionnaire d’une ASBL de droit congolais, obligations de l’ASBL reconnue, et annexes VI et VII (« à présenter chaque année au courant du mois de janvier ») · mesure réglementaire du Ministère de la Justice selon la CENCO, portée par aucun article de la loi n° 004/2001, texte réglementaire non identifié',
        formes: FORMES_ASBL,
        referentiels: [client_1.Referentiel.SYCEBNL],
        droitCongolaisSeulement: true,
    },
    {
        etape: 4,
        libelle: 'Conventions poursuivies · information du commissaire aux comptes (SARL)',
        detail: 'Lorsque l’exécution de conventions conclues au cours d’exercices antérieurs entre la société et l’un de ses gérants ou associés (ou les entreprises et sociétés que l’article 350 leur assimile) s’est poursuivie au cours du dernier exercice, le commissaire aux comptes, s’il en existe un, en est informé dans le délai d’un mois à compter de la clôture de l’exercice. Sans commissaire aux comptes ou sans convention poursuivie, le jalon est sans objet. Une convention nouvelle, elle, s’avise dans le mois de sa conclusion (art. 351, al. 1er).',
        nature: 'LEGALE',
        debut: { moisApres: 0, jour: 1 },
        echeance: { moisApres: 1, jour: 'FIN' },
        source: 'AUSCGIE, art. 350 et art. 351, al. 2 (société à responsabilité limitée)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: [client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE],
    }, {
        etape: 5,
        libelle: 'Déclaration semestrielle relative aux ressources',
        detail: 'Déclaration des ressources de l’association, à RENOUVELER à la fin ou au début de chaque semestre · elle ne se fait donc pas une fois l’an. L’article 4, e) l’exige « sous peine d’application de l’article 19 ». RÉSERVE, et elle est dans le texte officiel : l’article 19 organise la dissolution VOLONTAIRE, décidée par les deux tiers des membres effectifs ; c’est l’article 20 qui porte la dissolution JUDICIAIRE de l’association « qui ne remplit plus ses engagements », prononcée par le Tribunal de Grande Instance. Le renvoi de l’article 4, e) est donc reproduit tel quel, sans qu’OmegaX en tire une sanction automatique : l’obligation est réelle et à ne pas manquer, sa suite exacte relève de votre conseil. L’échéance portée ici est celle du semestre qui suit la clôture ; l’autre tombe six mois plus tôt.',
        nature: 'LEGALE',
        debut: { moisApres: 0, jour: 1 },
        echeance: { moisApres: 1, jour: 'FIN' },
        source: 'Loi n° 004/2001 du 20 juillet 2001, art. 4, e (qui renvoie à l’art. 19 · voir la réserve)',
        formes: FORMES_ASBL,
        referentiels: [client_1.Referentiel.SYCEBNL],
    }, {
        etape: 6,
        libelle: 'Écritures d’inventaire',
        detail: 'Amortissements, dépréciations, provisions, régularisations, actualisation des opérations en monnaies étrangères, écarts d’inventaire. Pour une EBNL, s’y ajoute le sort des fonds affectés à un projet spécifique non consommés en fin d’exercice (compte 165, repris par le compte 7925) et des fonds reportés (compte 17).',
        nature: 'INTERNE',
        debut: { moisApres: 1, jour: 1 },
        echeance: { moisApres: 2, jour: 'FIN' },
        source: 'CPCC, § 7.1 point 4 et § 2.3 (« de janvier à mars »), adapté SYCEBNL (Partie 2, ch. 3, comptes 16 et 17 ; Partie 3, ch. 2)',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 6,
        libelle: 'Écritures d’inventaire',
        detail: 'Amortissements, dépréciations, provisions, régularisations, écarts de conversion, écarts d’inventaire, et reprise des subventions d’investissement (compte 14, repris par le compte 799 Reprises de subventions d’investissement).',
        nature: 'INTERNE',
        debut: { moisApres: 1, jour: 1 },
        echeance: { moisApres: 2, jour: 'FIN' },
        source: 'CPCC, § 7.1 point 4 et § 2.3 (« de janvier à mars ») ; AUDCIF, art. 17, 6° (contrôle par inventaire) et Titre VII, comptes 14 et 799',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 7,
        libelle: 'Détermination du résultat',
        detail: 'Excédent ou déficit de l’exercice, dégagé par le compte de résultat pour une association ou un ordre professionnel, par le compte d’exploitation pour un projet de développement.',
        nature: 'INTERNE',
        debut: { moisApres: 2, jour: 1 },
        echeance: { moisApres: 3, jour: 15 },
        source: 'CPCC, § 7.1 point 5, adapté SYCEBNL (art. 4 et Partie 4)',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 7,
        libelle: 'Détermination du résultat',
        detail: 'Bénéfice net ou perte nette de l’exercice, dégagé par le compte de résultat en liste, dont le classement fait apparaître les soldes intermédiaires de gestion en cascade. Le résultat est viré au compte 131 Résultat net : bénéfice ou au compte 139 Résultat net : perte.',
        nature: 'INTERNE',
        debut: { moisApres: 2, jour: 1 },
        echeance: { moisApres: 3, jour: 15 },
        source: 'CPCC, § 7.1 point 5 ; AUDCIF, art. 29 et 31, et Titre VII, compte 13',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 8,
        libelle: 'Balance définitive et révision des comptes',
        detail: 'Balance définitive, puis révision compte par compte : justifier le solde de chaque poste repris au bilan. C’est le self-audit décrit au § 2.3.',
        nature: 'INTERNE',
        debut: { moisApres: 2, jour: 1 },
        echeance: { moisApres: 3, jour: 'FIN' },
        source: 'CPCC, § 7.1 point 6 et § 2.3',
    },
    {
        etape: 9,
        libelle: 'Livre d’inventaire',
        detail: 'Transcription au livre d’inventaire du bilan et du compte de résultat, ainsi que du relevé des éléments d’actif et de passif. Obligation absente du cours du CPCC.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 3, jour: 'FIN' },
        source: 'SYCEBNL, art. 14 de l’Acte uniforme',
        referentiels: [client_1.Referentiel.SYCEBNL],
        observation: 'INVENTAIRE',
    },
    {
        etape: 9,
        libelle: 'Livre d’inventaire',
        detail: 'Transcription au livre d’inventaire du Bilan, du Compte de résultat et du Tableau des flux de trésorerie de l’exercice, ainsi que du résumé de l’opération d’inventaire. Le livre d’inventaire est coté, paraphé et numéroté de façon continue par la juridiction compétente ; tenu par informatique, il doit être identifié, numéroté et daté dès son établissement par des moyens garantissant la chronologie, l’irréversibilité et l’intégrité des enregistrements.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 3, jour: 'FIN' },
        source: 'AUDCIF, art. 19 (livres obligatoires), art. 66 (cote et paraphe) et art. 67 (support électronique)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 10,
        libelle: 'Budget et comptes annuels au ministre du secteur (établissement d’utilité publique)',
        detail: 'Communication, par les administrateurs, au ministre ayant le secteur d’activité dans ses attributions du budget et de tous les comptes annuels de l’établissement. Ce budget et ces comptes annuels « sont transmis au Ministre de la Justice pour publication au Journal officiel », le texte ne disant pas par qui · les frais de publication sont à charge de l’établissement. L’obligation porte sur le BUDGET autant que sur les comptes : un EUP qui ne déposerait que ses états financiers ne l’aurait pas remplie. L’article 66 ne fixe AUCUN délai : l’échéance retenue ici est un repère, pas une date légale.',
        nature: 'LEGALE',
        debut: { moisApres: 1, jour: 1 },
        echeance: { moisApres: 3, jour: 'FIN' },
        source: 'Loi n° 004/2001 du 20 juillet 2001, art. 66 (et art. 65 pour les statuts et les nominations)',
        formes: [client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE],
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 11,
        libelle: 'Accord-cadre et main-d’œuvre locale (ONG de droit étranger)',
        detail: 'Une ONG étrangère conclut un accord-cadre avec le Ministère ayant le Plan dans ses attributions, et utilise « la main d’œuvre locale à concurrence de 60 % au minimum ». Vérifiez à chaque exercice que l’accord-cadre est en cours de validité et que cette part est tenue · les deux se contrôlent ensemble, à l’occasion du rapport d’activité. L’article 37 ne fixe AUCUN délai : l’échéance retenue ici est un repère, pas une date légale.',
        nature: 'LEGALE',
        debut: { moisApres: 1, jour: 1 },
        echeance: { moisApres: 3, jour: 'FIN' },
        source: 'Loi n° 004/2001 du 20 juillet 2001, art. 37, 2° (accord-cadre) et 4° (main-d’œuvre locale)',
        formes: [client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE],
        referentiels: [client_1.Referentiel.SYCEBNL],
        droitEtrangerSeulement: true,
    },
    {
        etape: 12,
        libelle: 'Événements postérieurs à la clôture',
        detail: 'Recenser les événements survenus entre la clôture et la date d’arrêté, puis les trier. Ceux qui CONFIRMENT une situation existant à la clôture donnent lieu à AJUSTEMENT des comptes : créance devenue douteuse, stock vendu en dessous de sa valeur, litige tranché. Ceux qui révèlent une situation APPARUE APRÈS ne s’ajustent pas et se mentionnent seulement, sauf s’ils remettent en cause la continuité de l’exploitation, auquel cas les états sont établis en valeurs liquidatives. Le tri se transcrit à la NOTE 3, avec la date d’arrêté et l’organe ayant autorisé la publication.',
        nature: 'INTERNE',
        debut: { moisApres: 2, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'SYCEBNL, cadre conceptuel § 3.3.1.1.4 (postulat de la spécialisation des exercices) ; Partie 4 ch. 2, NOTE 3 (sections A, B et C)',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 12,
        libelle: 'Événements postérieurs à la clôture',
        detail: 'Recenser les événements, favorables et défavorables, survenus entre la clôture et la date d’arrêté, puis les trier. Ceux qui CONFIRMENT une situation existant à la clôture donnent lieu à AJUSTEMENT des comptes : faillite d’un client confirmant une perte sur créance, vente de stocks révélant leur valeur nette de réalisation, litige tranché, fraude ou erreur découverte. Ceux qui révèlent une situation APPARUE APRÈS ne s’ajustent pas et se mentionnent aux notes annexes s’ils sont significatifs, sauf s’ils remettent en cause la continuité de l’exploitation, auquel cas les états sont établis en valeurs liquidatives. Les dividendes déclarés après la clôture ne sont pas un passif de l’exercice. Tous les événements importants sont en outre exposés au rapport de gestion.',
        nature: 'INTERNE',
        debut: { moisApres: 2, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'AUDCIF, Titre VIII ch. 31 (sections 1 à 3) et art. 23 (date d’arrêté) ; AUSCGIE art. 138 (rapport de gestion)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 13,
        libelle: 'États financiers et notes annexes',
        detail: 'Bilan, compte de résultat ou d’exploitation, tableau de flux de trésorerie ou tableau emplois-ressources, et les notes annexes du jeu retenu (35 pour une association ou un ordre professionnel, 24 pour un projet de développement, 5 pour le Système minimal de trésorerie). Le cours note que le tableau de flux ne s’applique pas au SMT. Les états financiers annuels sont arrêtés au plus tard dans les QUATRE MOIS qui suivent la clôture, et la date d’arrêté doit être mentionnée dans toute transmission.',
        nature: 'INTERNE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'CPCC, § 7.1 point 8, adapté SYCEBNL (art. 4 à 13) ; AUDCIF art. 23 (arrêté dans les quatre mois), non exclu par l’art. 3 du SYCEBNL',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 13,
        libelle: 'États financiers et notes annexes',
        detail: 'Au Système normal, jeu complet indissociable : Bilan, Compte de résultat, Tableau des flux de trésorerie et Notes annexes (36 notes). Au Système minimal de trésorerie, bilan, compte de résultat et notes 1 à 3, plus le journal de trésorerie de la NOTE 4. Les états financiers annuels sont arrêtés au plus tard dans les QUATRE MOIS qui suivent la clôture, et la date d’arrêté doit être mentionnée dans toute transmission.',
        nature: 'INTERNE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'AUDCIF, art. 8 (jeu complet), art. 23 (arrêté dans les quatre mois) et art. 26 ; Titre IX ch. 6 (notes annexes) ; Titre X (Système minimal de trésorerie)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 14,
        libelle: 'Registre des donateurs arrêté',
        detail: 'Arrêté du registre des donateurs de l’exercice, dont la tenue est obligatoire pour une EBNL. Obligation propre au SYCEBNL, absente du cours.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'SYCEBNL, art. 17 et 18 de l’Acte uniforme',
        referentiels: [client_1.Referentiel.SYCEBNL],
        observation: 'DONATEURS',
    },
    {
        etape: 15,
        libelle: 'Déclarations fiscales annuelles',
        detail: 'Déclarations dues à l’administration fiscale. L’EXEMPTION d’impôt sur les sociétés dispense de déclarer l’impôt sur les sociétés, pas de déclarer les impôts dont l’entité est redevable légal · retenues sur salaires, relevé trimestriel des sommes versées à des tiers hors salaires (loi n° 004/2003, art. 3 · « Les personnes exemptées sont dispensées de l’obligation de souscrire les déclarations, à l’exception de celles afférentes aux impôts dont elles sont redevables légaux » ; l’EXONÉRATION, elle, ne dispense pas de déclarer). Une ASBL exemptée ne dépose donc ni déclaration d’impôt sur les sociétés ni liasse à la DGI, qui dispose en revanche d’un droit de contrôle sur sa comptabilité et ses déclarations. UNE ENTITÉ À BUT NON LUCRATIF REDEVABLE DE L’IMPÔT SUR LES SOCIÉTÉS (exemption non acquise, voir Paramètres du dossier) joint à sa déclaration ses états financiers SYCEBNL (art. 13, al. 4). Voir docs/fiscalite-asbl-rdc.md et docs/obligations-annuelles-ebnl-rdc.md. LA MENTION DU COMPTABLE · l’article 141, 2° de la loi n° 23/053 oblige le redevable « d’indiquer dans leur déclaration le nom, l’adresse et la qualification du comptable chargé de tenir leur comptabilité, en précisant si celui-ci est salarié ou non de leur entreprise ». Il vise « les redevables visés aux articles 139 ET 140 », et l’article 140 nomme expressément « les entités à but non lucratif » : la mention concerne donc aussi une ASBL. RÉSERVE · l’exemption de l’article 5, 3° dispense de la déclaration d’impôt sur les sociétés, pas des autres déclarations (loi n° 004/2003, art. 3) ; c’est sur celles-là que la mention se porte. OmegaX ne détient aucune de ces quatre données · à reporter à la main sur la déclaration.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'Loi n° 004/2003, art. 3 (exemption), art. 13, al. 4 (états des entités à but non lucratif redevables de l’IS) ; CENCO, Vade Mecum du gestionnaire ; loi n° 23/053, art. 140 et art. 141, 2° (mention du comptable)',
        echeanceFiscale: true,
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 15,
        libelle: 'Déclarations fiscales annuelles',
        detail: 'Déclaration de l’Impôt sur les Sociétés au plus tard le 30 avril de l’année qui suit celle de la réalisation des revenus, à souscrire MÊME en cas de perte ou d’absence de revenus imposables. Pour une entreprise relevant du Système normal, elle est appuyée du bilan, du compte de résultat, du tableau des flux de trésorerie, du tableau de variation des capitaux propres et des notes annexes, et, sous peine de rejet, certifiés par un expert-comptable inscrit au tableau de l’ONEC, « dans les conditions définies par Arrêté du Ministre ayant les Finances » (art. 14). Cet arrêté (n° 014 du 16 mai 2023, applicable depuis les revenus 2023) ne reconnaît qu’un certificateur INDÉPENDANT : la certification est incompatible avec l’assistance comptable et/ou fiscale (art. 5), et celle d’un membre non indépendant, suspendu ou radié, sous poursuites ou non déclaré par l’ONEC à la DGI est irrégulière et « assimilée à un refus de certification » (art. 14) ; la non-désignation d’un certificateur vaut refus de faire certifier et ouvre la taxation d’office pour comptabilité irrégulière (art. 15, renvoyant à l’art. 41 de la loi n° 004/2003). RÉSERVE · l’article 7 ouvre, « par dérogation à l’article 5 », une désignation propre aux entités non astreintes à un commissaire aux comptes, et fait certifier « eux-mêmes » leurs états aux cabinets comptables non astreints ; le texte ne dit pas la portée de cette dérogation, et OmegaX ne la tranche pas. La déclaration est contresignée par le conseil ou le comptable du redevable (art. 13, al. 2). S’y ajoute le relevé récapitulatif des ventes de l’année aux personnes réputées commerçants ou fabricants. Les trois acomptes provisionnels de l’exercice se versent en juillet, septembre et novembre, hors calendrier de clôture. LA MENTION DU COMPTABLE · l’article 141, 2° de la loi n° 23/053 oblige le redevable « d’indiquer dans leur déclaration le nom, l’adresse et la qualification du comptable chargé de tenir leur comptabilité, en précisant si celui-ci est salarié ou non de leur entreprise ». Ce n’est pas le contreseing ci-dessus : signer n’est pas déclarer son adresse, sa qualification et son lien de subordination. OmegaX ne détient aucune de ces quatre données et ne les porte donc sur aucune pièce · à reporter à la main sur la déclaration.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'Loi n° 004/2003 portant réforme des procédures fiscales, art. 12 (échéance), modifié par la loi n° 23/052 et par la loi de finances n° 25/060, et 13 (états joints), modifié par la loi n° 23/052 ; art. 14 (certification ONEC), modifié par la loi de finances n° 22/071 du 28 décembre 2022 ; art. 15 (déclaration en cas de perte) et 16 (dans le mois en cas de dissolution, de liquidation ou de cessation) ; arrêté ministériel n° 014 du 16 mai 2023 (certification des états financiers), art. 5, 7, 14, 15 et 28 ; art. 57 bis LPF tel que modifié par la loi de finances n° 25/060 du 29 décembre 2025 ; loi n° 23/053, art. 141, 2° (mention du comptable)',
        echeanceFiscale: true,
        declarationAnnuelleImpotSocietes: true,
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohadaExclues: correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES,
    },
    {
        etape: 15,
        libelle: 'Déclaration annuelle des revenus (personne physique)',
        detail: 'Déclaration des revenus de l’exercice au plus tard le 30 avril de l’année qui suit celle de leur réalisation, au Service des Impôts du lieu de résidence. Elle n’est PAS une déclaration d’impôt sur les sociétés : une entreprise individuelle et un entreprenant relèvent de l’Impôt sur le Revenu des Personnes Physiques. Elle n’est appuyée des annexes de l’article 13, et contresignée par le conseil ou le comptable (art. 17, al. 2), que si le dossier relève du SYSTÈME NORMAL de comptabilité et réalise des revenus dans les catégories énumérées par l’article 17, alinéa 2 ; un dossier au Système minimal de trésorerie n’y est pas tenu. S’y ajoute alors le relevé récapitulatif des ventes de l’année aux personnes réputées commerçants ou fabricants. LE CALENDRIER DE PAIEMENT DÉPEND DU RÉGIME : au régime réel, trois acomptes provisionnels aux 25 juillet, 25 septembre et 25 novembre ; au régime des petites entreprises, deux quotités, la première au plus tard le 31 janvier ; au régime des micro-entreprises, ni acompte ni quotité. Le régime applicable se lit dans État > Résultat fiscal et impôt sur les bénéfices, ce calendrier ne le tranche pas. ' +
            RESERVE_PREMIERE_QUOTITE_PETITES_ENTREPRISES +
            ' LA MENTION DU COMPTABLE · l’article 141, 2° de la loi n° 23/053 oblige le redevable « d’indiquer dans leur déclaration le nom, l’adresse et la qualification du comptable chargé de tenir leur comptabilité, en précisant si celui-ci est salarié ou non de leur entreprise ». Ce n’est pas le contreseing ci-dessus : signer n’est pas déclarer son adresse, sa qualification et son lien de subordination. OmegaX ne détient aucune de ces quatre données et ne les porte donc sur aucune pièce · à reporter à la main sur la déclaration.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'Loi n° 004/2003 portant réforme des procédures fiscales, art. 17 (déclaration des personnes physiques, modifié par la loi n° 23/052 et par la loi de finances n° 25/060), art. 13 (annexes), art. 57, al. 2 et 3, 57 bis et 57 quater, al. 2 (première quotité des petites entreprises) ; loi n° 23/053, art. 141, 2° (mention du comptable)',
        echeanceFiscale: true,
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES,
    },
    {
        etape: 16,
        libelle: 'Rapport de gestion',
        detail: 'Le gérant, le conseil d’administration ou l’administrateur général expose la situation de la société durant l’exercice écoulé, son évolution prévisible, les événements importants survenus entre la clôture et la date d’établissement, et en particulier les perspectives de continuation de l’activité, l’évolution de la trésorerie et le plan de financement. Ces quatre derniers points sont ceux qu’on oublie : un rapport qui se borne au compte rendu de l’exercice écoulé est incomplet.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'AUSCGIE, art. 138',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: FORMES_SOCIETES_COMMERCIALES,
    },
    {
        etape: 16,
        libelle: 'Rapport de gestion',
        detail: 'Le comité de gestion ou le conseil d’administration, selon le cas, expose la situation de la société coopérative durant l’exercice écoulé, son évolution prévisible et, en particulier, les perspectives de continuation de l’activité, l’évolution de la situation de trésorerie et le plan de financement. Il y expose également l’état de promotion des coopérateurs, et toute modification dans la présentation des états financiers ou dans les méthodes d’évaluation, d’amortissement ou de provisions (art. 111).',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 4, jour: 'FIN' },
        source: 'AUSCOOP, art. 108 et art. 111',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: [client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE],
    },
    {
        etape: 17,
        libelle: 'États financiers et rapport de gestion aux commissaires aux comptes',
        detail: 'Envoi aux commissaires aux comptes des états financiers de synthèse annuels et du rapport de gestion, QUARANTE-CINQ JOURS AU MOINS avant la date de l’assemblée générale ordinaire. Le délai se compte à rebours de l’assemblée, pas de la clôture : une assemblée tenue au dernier jour du sixième mois impose l’envoi au plus tard le 15 du cinquième mois, quarante-cinq jours francs avant (un jour plus tard si le délai n’est pas franc). L’échéance portée ici suppose cette assemblée, OmegaX n’en connaissant pas la date réelle. La désignation d’un commissaire aux comptes est obligatoire dans toute société anonyme (art. 702) et, dans la SARL comme dans la SAS, dès que deux des trois critères de taille sont dépassés à la clôture (total du bilan, chiffre d’affaires annuel, effectif permanent au-delà de cinquante personnes) · les deux premiers montants sont donnés par les articles cités, l’écran Paramètres du dossier les reprend.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 15 },
        echeance: { moisApres: 5, jour: 15 },
        source: 'AUSCGIE, art. 140 al. 1 ; art. 702 (SA) ; art. 376 (SARL) ; art. 853-13 (SAS)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: FORMES_SOCIETES_ASSEMBLEE,
    },
    {
        etape: 18,
        libelle: 'Mise à disposition de l’auditeur',
        detail: 'Transmission des états financiers et du rapport d’activité annuels à l’auditeur, QUARANTE-CINQ JOURS AU MOINS avant la date de l’assemblée générale ordinaire ou de l’instance qui en tient lieu · ou, pour un projet de développement qui ne tient pas d’assemblée, avant la date de transmission du rapport de l’auditeur aux bailleurs de fonds et/ou à l’État bénéficiaire. Le délai se compte À REBOURS de cette date, pas de la clôture : une assemblée tenue à la fin du sixième mois impose la remise vers le 15 du cinquième. La désignation d’un auditeur n’est pas systématique · elle dépend des trois critères ALTERNATIFS de l’article 19 (total du bilan, ressources annuelles, effectif permanent), dont un seul suffit.',
        nature: 'LEGALE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 5, jour: 15 },
        source: 'SYCEBNL, art. 19 al. 4 (délai de 45 jours) et art. 19 à 22 ; calendrier CPCC § 2.3',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 18,
        libelle: 'Mise à disposition du commissaire aux comptes',
        detail: 'Remise du projet d’états financiers, du rapport de gestion et, le cas échéant, du bilan social au commissaire aux comptes, QUARANTE-CINQ JOURS AU MOINS avant la date de l’assemblée générale ordinaire · le 15 du cinquième mois compte quarante-cinq jours francs avant une assemblée au dernier jour du sixième, un jour plus tard si le délai n’est pas franc. Le commissaire aux comptes émet une opinion sur la régularité, la sincérité et l’image fidèle des comptes, et se prononce sur la concordance avec les états financiers des informations données dans le rapport de gestion. Sa désignation est obligatoire dans toute société anonyme, dans la SARL comme dans la SAS au-delà de deux des trois critères de taille, et dans la SNC et la SCS au-delà de deux des trois critères de l’art. 289-1 (seuils plus élevés).',
        nature: 'INTERNE',
        debut: { moisApres: 3, jour: 1 },
        echeance: { moisApres: 5, jour: 15 },
        source: 'AUDCIF, art. 69 à 71 (contrôle externe, opinion, délai de quarante-cinq jours) ; AUSCGIE, art. 694 et 702 (SA), 376 (SARL), 853-13 (SAS), 289-1 (SNC) et 293-1 (SCS) ; CPCC, § 2.3 (« début mars au 15 mai »)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 19,
        libelle: 'Rapport d’activité au Ministère du Plan et au ministère du secteur',
        detail: 'Une ONG transmet périodiquement son rapport d’activité, pour évaluation physique, au Ministre ayant le Plan dans ses attributions et à celui en charge du secteur où elle opère. Elle l’informe également de ses projets et des ressources financières mobilisées. La loi dit « périodiquement » sans fixer de date : l’échéance retenue ici est un repère de fin de campagne annuelle, à caler sur l’accord-cadre pour une ONG étrangère.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 5, jour: 'FIN' },
        source: 'Loi n° 004/2001, art. 44 et 45',
        formes: [client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE],
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 20,
        libelle: 'Dépôt au Ministère de l’Économie nationale',
        detail: 'Le cours donne « au plus tard mi-juin » au § 7.3 et « au plus tard 15 juin » au § 2.3, avec une astreinte par jour de retard fixée par l’arrêté interministériel n° 013/CAB/MINECO/2013 et n° CAB/MIN/FINANCES/2013/1055 du 26 novembre 2013, dont le taux n’est pas repris ici. Le cours vise les entités du Système comptable OHADA ; son extension à une EBNL n’a pas pu être confirmée sur texte primaire.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 15 },
        source: 'CPCC, § 2.3 et § 7.3, portée pour une EBNL à confirmer sur texte primaire',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 20,
        libelle: 'Dépôt au Ministère de l’Économie nationale',
        detail: 'Transmission des états financiers annuels au Ministère de l’Économie nationale, au plus tard mi-juin, sur les imprimés diffusés par le CPCC. Le défaut de transmission dans le délai prescrit est puni d’une astreinte par jour de retard fixée par l’arrêté interministériel n° 013/CAB/MINECO/2013 et n° CAB/MIN/FINANCES/2013/1055 du 26 novembre 2013, dont le taux n’est pas repris ici.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 15 },
        source: 'CPCC, § 2.3 et § 7.3 ; arrêté interministériel n° 013/CAB/MINECO/2013 et n° CAB/MIN/FINANCES/2013/1055 du 26 novembre 2013',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 21,
        libelle: 'Rapport d’activité et approbation des comptes',
        detail: 'Établissement du rapport d’activité et approbation des états financiers par l’organe délibérant. Le cours rappelle que les comptes doivent être mis à la disposition des administrateurs quelques jours avant la réunion.',
        nature: 'INTERNE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'CPCC, § 2.3 (« au plus tard fin juin »), adapté SYCEBNL (art. 16-3)',
        referentiels: [client_1.Referentiel.SYCEBNL],
        observation: 'RAPPORT_ACTIVITE',
    },
    {
        etape: 21,
        libelle: 'Approbation des états financiers et du rapport de gestion',
        detail: 'Les états financiers annuels et le rapport de gestion établis par les organes d’administration ou de direction sont soumis à l’approbation des actionnaires, des associés ou des membres dans le délai de SIX MOIS à compter de la date de clôture de l’exercice.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'AUDCIF, art. 71 (rapport de gestion) et art. 72 (approbation dans les six mois) ; CPCC, § 2.3',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohadaExclues: [
            client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
            client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE,
            client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
        ],
    },
    {
        etape: 21,
        libelle: 'Approbation des états financiers et du rapport de gestion',
        detail: 'Il est tenu chaque année, dans les SIX MOIS qui suivent la clôture, une assemblée générale annuelle qui approuve le rapport de gestion, l’inventaire et les états financiers de synthèse établis par les gérants. Ces documents, le texte des résolutions proposées et, le cas échéant, le rapport du commissaire aux comptes sont COMMUNIQUÉS AUX ASSOCIÉS au moins QUINZE JOURS avant l’assemblée · toute délibération prise en violation de cette règle peut être annulée. Le délai se compte à rebours de l’assemblée, dont OmegaX ne connaît pas la date.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'AUSCGIE, art. 288 (société en nom collectif) et art. 306 (société en commandite simple) ; AUDCIF, art. 71 et 72',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: [client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF, client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE],
    },
    {
        etape: 21,
        libelle: 'Approbation des états financiers et du rapport de gestion',
        detail: 'Les états financiers de synthèse annuels et le rapport de gestion sont présentés à l’assemblée générale ordinaire de la société coopérative, qui doit obligatoirement se tenir dans les SIX MOIS de la clôture de l’exercice. Le cas échéant, si la coopérative est affiliée à une organisation faîtière, ces états financiers sont également adressés à l’organisation faîtière immédiate QUARANTE-CINQ JOURS AU MOINS avant la date de l’assemblée · délai à rebours de l’assemblée, dont OmegaX ne connaît pas la date.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'AUSCOOP, art. 110, al. 1er (assemblée) et al. 2 (organisation faîtière) ; AUDCIF, art. 71 et 72',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: [client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE],
    },
    {
        etape: 22,
        libelle: 'Dépôt des états financiers SYCEBNL au CPCC',
        detail: 'C’est ICI que la liasse se dépose, et nulle part ailleurs. Le CPCC vise toutes les entités à but non lucratif sans exception : ONG, associations, églises, mosquées, fondations, unités de gestion de projets, partis politiques, clubs sportifs, ordres professionnels, fonds de dotation. Pour l’exercice 2024, l’échéance annoncée était le 30 juin 2025. Le retard est sanctionné par une astreinte par jour fixée par l’arrêté ministériel n° 024/CAB/MIN/FINANCES/2010 du 15 avril 2010, dont le taux n’est pas repris ici.',
        nature: 'LEGALE',
        debut: { moisApres: 6, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'CPCC, note circulaire sur le dépôt des états financiers SYCEBNL (fondée sur l’art. 2 de l’AUDCIF et les art. 1, 2 et 5 de l’Acte uniforme SYCEBNL) ; CPCC, § 2.3 et § 7.3',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        etape: 22,
        libelle: 'Dépôt des états financiers au CPCC',
        detail: 'Transmission des états financiers annuels au CPCC, au plus tard fin juin, EXCLUSIVEMENT sur les imprimés qu’il diffuse. Au Système normal, deux volets : le volet 1 « États financiers & notes aux comptes » (bilan, compte de résultat, tableau des flux de trésorerie, 36 notes annexes) et le volet 2 « Données statistiques et fiscales » (19 notes). Au Système minimal de trésorerie, bilan, compte de résultat et 3 notes annexes, accompagnés des journaux de suivi des dettes à payer, des créances impayées et de trésorerie. Les imprimés doivent être complets, chaque tableau inutilisé portant la mention « NÉANT ». Le défaut ou le retard est puni d’une astreinte par jour fixée par l’arrêté ministériel n° 024/CAB/MIN/FINANCES/2010 du 15 avril 2010, dont le taux n’est pas repris ici.',
        nature: 'LEGALE',
        debut: { moisApres: 6, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'CPCC, § 7.3 (destinataires, imprimés et sanctions) et § 2.3 ; arrêté ministériel n° 024/CAB/MIN/FINANCES/2010 du 15 avril 2010',
        referentiels: [client_1.Referentiel.SYSCOHADA],
    },
    {
        etape: 23,
        libelle: 'Assemblée générale statuant sur les états financiers',
        detail: 'L’assemblée générale qui statue sur les états financiers de synthèse doit OBLIGATOIREMENT se tenir dans les six mois de la clôture de l’exercice. C’est elle qui fait courir le délai d’un mois du dépôt au registre du commerce. Durant les QUINZE JOURS qui précèdent l’assemblée, tout actionnaire peut prendre connaissance au siège social de l’inventaire, des états financiers de synthèse et de la liste des administrateurs, des rapports du commissaire aux comptes et du conseil d’administration ou de l’administrateur général, du texte des résolutions proposées, de la liste des actionnaires, et du montant global certifié par les commissaires aux comptes des rémunérations versées aux dix ou cinq dirigeants sociaux et salariés les mieux rémunérés selon que l’effectif excède ou non deux cents salariés · toute délibération prise en violation de ce droit peut être annulée. Délai à rebours de l’assemblée, dont OmegaX ne connaît pas la date.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'AUSCGIE, art. 140 al. 2 ; art. 525 (communication aux actionnaires)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: [client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME],
    },
    {
        etape: 23,
        libelle: 'Assemblée générale statuant sur les états financiers',
        detail: 'L’assemblée générale qui statue sur les états financiers de synthèse doit OBLIGATOIREMENT se tenir dans les six mois de la clôture de l’exercice. C’est elle qui fait courir le délai d’un mois du dépôt au registre du commerce. Durant les QUINZE JOURS qui précèdent l’assemblée annuelle, les associés ont un droit de communication sur les états financiers de synthèse, le rapport de gestion, le texte des résolutions proposées et, le cas échéant, les rapports général et spécial du commissaire aux comptes · toute délibération prise en violation de ce droit peut être annulée. Le gérant ou, s’il en existe un, le commissaire aux comptes présente à l’assemblée, ou joint aux documents communiqués, un RAPPORT SUR LES CONVENTIONS intervenues entre la société et l’un de ses gérants ou associés · énumération, parties, nature et objet, modalités essentielles, et sommes versées ou reçues au titre des conventions poursuivies. Les délibérations relatives à ces conventions sont NULLES lorsqu’elles ont été prises en l’absence de ce rapport. Dans une société à associé unique, une convention conclue avec lui est seulement mentionnée au registre des délibérations. Délais à rebours de l’assemblée, dont OmegaX ne connaît pas la date.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'AUSCGIE, art. 140 al. 2 ; art. 345 (droit de communication), art. 350 et 353 (rapport sur les conventions)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: [client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE],
    },
    {
        etape: 23,
        libelle: 'Assemblée générale statuant sur les états financiers',
        detail: 'L’assemblée générale qui statue sur les états financiers de synthèse doit OBLIGATOIREMENT se tenir dans les six mois de la clôture de l’exercice. C’est elle qui fait courir le délai d’un mois du dépôt au registre du commerce.',
        nature: 'LEGALE',
        debut: { moisApres: 4, jour: 1 },
        echeance: { moisApres: 6, jour: 'FIN' },
        source: 'AUSCGIE, art. 140 al. 2',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: [client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE],
        selonAssocieUniqueSas: approbationSas,
    },
    {
        etape: 24,
        libelle: 'Dépôt des états financiers au RCCM',
        detail: 'Dépôt au registre du commerce et du crédit mobilier de l’État partie du siège social, DANS LE MOIS QUI SUIT L’APPROBATION par l’organe compétent · l’échéance ci-dessous suppose donc une assemblée tenue au sixième mois. En cas de REFUS d’approbation, c’est une copie de la décision qui se dépose, dans le même délai. Le dépôt peut être électronique. Passé trente jours de demande amiable restée vaine, tout intéressé peut faire enjoindre le dépôt sous astreinte. Ne concerne pas une ASBL : l’article 1er de la loi n° 004/2001 en fait une entité non commerçante, donc non immatriculée au registre du commerce.',
        nature: 'LEGALE',
        debut: { moisApres: 7, jour: 1 },
        echeance: { moisApres: 7, jour: 'FIN' },
        source: 'AUSCGIE, art. 269 (sanction pénale des dirigeants sociaux, art. 890-1) ; CPCC, § 2.3 et § 7.3 ; loi n° 004/2001, art. 1er (exclusion des ASBL)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: FORMES_DEPOT_RCCM,
    },
    {
        etape: 25,
        libelle: 'Clôture et réouverture des livres',
        detail: 'Clôture annuelle de l’exercice, soldant les classes 6 et 7 sur le résultat et générant le report à-nouveau dans l’exercice suivant. Le cours rappelle que la clôture interdit l’ajout, la modification et la suppression d’écritures, mais autorise le lettrage et le pointage : c’est bien le comportement d’OmegaX. Une fois l’exercice clos, les livres comptables et les pièces justificatives se conservent DIX ANS.',
        nature: 'INTERNE',
        debut: { moisApres: 7, jour: 1 },
        echeance: { moisApres: 8, jour: 'FIN' },
        source: 'CPCC, § 7.1 point 10 et § 2.3 ; AUDCIF art. 24 (conservation dix ans), non exclu par l’art. 3 du SYCEBNL',
        observation: 'CLOTURE_ANNUELLE',
    },
    {
        etape: 26,
        libelle: 'Affectation du résultat',
        detail: 'Comptabilisation de la décision d’affectation prise par l’organe compétent : le compte 13 est SOLDÉ selon la décision. Sans cette écriture, le résultat reste au compte 13 et s’y empile d’exercice en exercice.',
        nature: 'LEGALE',
        debut: { moisApres: 6, jour: 1 },
        echeance: { moisApres: 8, jour: 'FIN' },
        source: 'AUDCIF, Titre VII, compte 13 (« le compte 13 est soldé lors de la comptabilisation de cette affectation »)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        selonFormeSyscohada: affectationSyscohada,
    },
    {
        etape: 26,
        libelle: 'Affectation du résultat',
        detail: 'Comptabilisation de la décision d’affectation prise par l’organe compétent : le compte 13 est SOLDÉ par le crédit des réserves (11), du report à nouveau (12) ou de la dotation (10). Une entité à but non lucratif ne distribue rien · aucune part de l’excédent ne va à ses membres. Le texte précise que l’excédent non affecté à un compte de réserves est viré au compte 12. Sans cette écriture, l’excédent reste au compte 13 et s’y empile d’exercice en exercice.',
        nature: 'LEGALE',
        debut: { moisApres: 6, jour: 1 },
        echeance: { moisApres: 8, jour: 'FIN' },
        source: 'SYCEBNL, Partie 2 ch. 3, compte 13 (« L’affectation du résultat net d’un exercice résulte des dispositions statutaires, réglementaires ou de la décision des organes compétents »)',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
];
exports.OBLIGATIONS_EVENEMENTIELLES = [
    {
        cle: 'changementAdministrateur',
        evenement: 'Nomination, démission, révocation ou décès d’un administrateur',
        libelle: 'Déclaration du changement d’administrateur',
        delai: 'Dans le mois de la décision',
        destinataire: 'Ministre de la Justice, copie au ministre ayant le secteur d’activité dans ses attributions',
        source: 'Loi n° 004/2001, art. 11',
        formes: FORMES_ASBL,
        referentiels: [client_1.Referentiel.SYCEBNL],
        droitCongolaisSeulement: true,
    },
    {
        cle: 'mouvementImmeuble',
        evenement: 'Acquisition ou aliénation d’un immeuble, ou toute opération qui en confère ou en fait perdre l’usage ou la jouissance',
        libelle: 'Déclaration écrite du mouvement d’immeuble · prix indiqué pour une acquisition ou une aliénation',
        delai: 'Dans les trois mois à compter de la date de l’acte qui la réalise',
        destinataire: 'Ministre de la Justice, COPIE AU MINISTRE DES FINANCES',
        source: 'Loi n° 004/2001, art. 15, al. 2',
        formes: FORMES_ASBL,
        referentiels: [client_1.Referentiel.SYCEBNL],
        droitCongolaisSeulement: true,
        ecranDeclencheur: 'Structure > Immobilisations · entrée ou sortie d’un bien immobilier (acquisition ou aliénation seulement ; les opérations d’usage ou de jouissance ne sont détectées par aucun écran)',
    },
    {
        cle: 'assujettissementTva',
        evenement: 'Franchissement du seuil de 80 000 000 FC de chiffre d’affaires annuel hors taxes · ou DÉBUT D’ACTIVITÉ pour une entreprise nouvelle',
        libelle: 'Déclaration d’assujettissement à la TVA',
        delai: 'Avant le 15 du mois qui suit le dépassement · pour une entreprise nouvelle, au plus tard le 15 du mois qui suit celui du début d’activités. La déclaration se souscrit en DOUBLE EXEMPLAIRE.',
        destinataire: 'Direction générale des impôts',
        source: 'Ordonnance-loi n° 10/001, art. 14 et 55 ; décret n° 011/42, art. 42-43',
        ecranDeclencheur: 'Structure > Paramètres du dossier · assujettissement à la TVA',
    },
    {
        cle: 'numeroImpot',
        evenement: 'Début d’activité',
        libelle: 'Demande de Numéro Impôt',
        delai: 'Dans les quinze jours du début d’activité',
        destinataire: 'Direction générale des impôts (dépôt papier ou en ligne)',
        source: 'Loi de procédures fiscales, art. 1er · attribution d’office possible depuis la loi de finances n° 25/060',
        ecranDeclencheur: 'Structure > Paramètres du dossier · identifiants légaux',
    },
    {
        cle: 'engagementTravailleur',
        evenement: 'Engagement d’un travailleur',
        libelle: 'Déclaration d’engagement du travailleur',
        delai: 'Dans les quinze jours de l’engagement',
        destinataire: 'Ministère du Travail et ONEM ; visa ONEM du contrat écrit',
        source: 'Code du travail, titre X (moyens de contrôle) et titre IV',
    },
    {
        cle: 'proceValAssembleeGenerale',
        evenement: 'Tenue de l’assemblée générale approuvant les états financiers certifiés par les commissaires aux comptes',
        libelle: 'Transmission du procès-verbal de l’assemblée générale',
        delai: 'Dans les dix jours de la tenue de l’assemblée',
        destinataire: 'Direction générale des impôts',
        source: 'Loi de procédures fiscales, art. 13 bis, inséré par la loi de finances n° 25/060 · vise « les sociétés et ' +
            'les autres personnes morales soumises à l’impôt sur les sociétés »',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohadaExclues: correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES,
    },
    {
        cle: 'modificationsIdentiteFiscale',
        evenement: 'Modification de l’identité, de la direction, de l’adresse physique ou électronique, du téléphone, d’un élément imposable ou de l’exploitation, ou sa cessation',
        libelle: 'Déclaration de la modification à l’Administration des impôts',
        delai: 'Dans les quinze jours de la survenance de l’événement',
        destinataire: 'Direction générale des impôts',
        source: 'Loi de procédures fiscales, art. 2 (modifié par la loi de finances n° 15/021) et art. 2 bis (adresse physique, inséré par la loi de ' +
            'finances n° 24/011, art. 33) · son absence est punie par l’art. 94, qui range nommément « la déclaration prévue à l’article 2 »',
        ecranDeclencheur: 'Structure > Paramètres du dossier · coordonnées, dirigeants et identifiants',
    },
    {
        cle: 'renouvellementFacilites',
        evenement: 'Approche du terme d’un arrêté interministériel de facilités (deux ans)',
        libelle: 'Demande de renouvellement des facilités administratives, fiscales et douanières',
        delai: 'Avant l’échéance des deux ans · le dossier de renouvellement comporte quatre pièces',
        destinataire: 'Ministère du Plan, puis arrêté interministériel Plan et Finances',
        source: 'Loi n° 004/2001, art. 39 (étendu aux EUP par l’art. 67 al. 3) ; note circulaire n° 003/CAB/MIN/PL.SMRM/COFAF/2013 du 24 janvier 2013',
        referentiels: [client_1.Referentiel.SYCEBNL],
    },
    {
        cle: 'moitieCapitalSarl',
        evenement: 'Capitaux propres devenus inférieurs à la moitié du capital social du fait des pertes constatées dans les états financiers de synthèse',
        libelle: 'Consultation des associés sur la dissolution anticipée',
        delai: 'Dans les quatre mois qui suivent l’approbation des comptes ayant fait apparaître la perte · si la dissolution est écartée, reconstitution des capitaux propres dans les deux ans qui suivent la clôture de l’exercice déficitaire, sinon réduction du capital, jamais sous le capital légal. Les art. 371 à 373 ne prescrivent aucune publicité de la décision.',
        destinataire: 'Associés, consultés par le gérant ou, le cas échéant, le commissaire aux comptes',
        source: 'AUSCGIE art. 371 à 373 · à défaut de décision, ou de reconstitution dans le délai, tout intéressé peut demander la dissolution judiciaire (art. 373)',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: (0, moitie_capital_1.formesDuRegimeMoitieCapital)(['SARL']),
        ecranDeclencheur: 'État > Analyse et contrôles · capitaux propres inférieurs à la moitié du capital social',
    },
    {
        cle: 'moitieCapitalSaSas',
        evenement: 'Capitaux propres devenus inférieurs à la moitié du capital social du fait des pertes constatées dans les états financiers de synthèse',
        libelle: 'Assemblée générale extraordinaire sur la dissolution anticipée, puis dépôt et publication de sa décision',
        delai: 'Convocation dans les quatre mois qui suivent l’approbation des comptes ayant fait apparaître la perte · si la dissolution n’est pas prononcée, réduction du capital au plus tard à la clôture du deuxième exercice suivant celui de la constatation des pertes, faute de reconstitution. La décision est déposée au RCCM et publiée dans un journal d’annonces légales du lieu du siège.',
        destinataire: 'Assemblée générale extraordinaire, convoquée par le conseil d’administration ou l’administrateur général (en SAS, décision collective des associés) · RCCM et journal d’annonces légales',
        source: 'AUSCGIE art. 664 à 669 (art. 666 pour le dépôt et la publication ; non applicables en redressement judiciaire ou en liquidation des biens, art. 669) ; art. 853-3 et 853-11, al. 2 pour la SAS ; art. 901 pour la sanction des dirigeants',
        referentiels: [client_1.Referentiel.SYSCOHADA],
        formesSyscohada: (0, moitie_capital_1.formesDuRegimeMoitieCapital)(['SA', 'SAS']),
        ecranDeclencheur: 'État > Analyse et contrôles · capitaux propres inférieurs à la moitié du capital social',
    },
];
function obligationsEvenementiellesApplicables(contexte) {
    return exports.OBLIGATIONS_EVENEMENTIELLES.filter((o) => {
        if (o.referentiels && !o.referentiels.includes(contexte.referentiel))
            return false;
        if (o.formesSyscohadaExclues && contexte.formeJuridiqueSyscohada && o.formesSyscohadaExclues.includes(contexte.formeJuridiqueSyscohada))
            return false;
        if (o.formesSyscohada && !(contexte.formeJuridiqueSyscohada && o.formesSyscohada.includes(contexte.formeJuridiqueSyscohada)))
            return false;
        if (o.formes && !o.formes.includes(contexte.formeJuridique))
            return false;
        if (o.droitEtrangerSeulement && !contexte.droitEtranger)
            return false;
        if (o.droitCongolaisSeulement && contexte.droitEtranger)
            return false;
        return true;
    });
}
function jalonsApplicables(contexte) {
    return exports.JALONS_CLOTURE.filter((j) => {
        if (j.referentiels && !j.referentiels.includes(contexte.referentiel))
            return false;
        if (j.formes && !j.formes.includes(contexte.formeJuridique))
            return false;
        if (j.formesSyscohada && !(contexte.formeJuridiqueSyscohada && j.formesSyscohada.includes(contexte.formeJuridiqueSyscohada)))
            return false;
        if (j.formesSyscohadaExclues &&
            contexte.formeJuridiqueSyscohada &&
            j.formesSyscohadaExclues.includes(contexte.formeJuridiqueSyscohada))
            return false;
        if (j.droitEtrangerSeulement && !contexte.droitEtranger)
            return false;
        if (j.droitCongolaisSeulement && contexte.droitEtranger)
            return false;
        return true;
    })
        .map((j) => (j.selonFormeSyscohada ? { ...j, ...j.selonFormeSyscohada(contexte.formeJuridiqueSyscohada ?? null) } : j))
        .map((j) => (j.selonAssocieUniqueSas ? { ...j, ...j.selonAssocieUniqueSas(contexte.associeUnique ?? null) } : j));
}
function dateJalon(dateFinExercice, decalage) {
    const annee = dateFinExercice.getUTCFullYear();
    const mois = dateFinExercice.getUTCMonth() + decalage.moisApres;
    if (estFinDeMois(dateFinExercice)) {
        if (decalage.jour === 'FIN') {
            return new Date(Date.UTC(annee, mois + 1, 0));
        }
        return new Date(Date.UTC(annee, mois, decalage.jour));
    }
    const cible = (n) => {
        const premier = new Date(Date.UTC(annee, dateFinExercice.getUTCMonth() + n, 1));
        const dernier = new Date(Date.UTC(premier.getUTCFullYear(), premier.getUTCMonth() + 1, 0)).getUTCDate();
        return new Date(Date.UTC(premier.getUTCFullYear(), premier.getUTCMonth(), Math.min(dateFinExercice.getUTCDate(), dernier)));
    };
    if (decalage.jour === 'FIN')
        return cible(decalage.moisApres);
    const base = cible(decalage.moisApres - 1);
    return new Date(base.getTime() + decalage.jour * 86_400_000);
}
function estFinDeMois(d) {
    return new Date(d.getTime() + 86_400_000).getUTCDate() === 1;
}
//# sourceMappingURL=planning-cloture.js.map