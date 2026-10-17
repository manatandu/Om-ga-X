"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLE_REMUNERATION_PREAVIS_RESTANT = exports.RESERVE_DEPART_AVANT_LA_MOITIE = exports.PREFIXE_GRATIFICATION_STIPULEE = exports.prorataAnnuel = exports.trancheDAnciennete = exports.DELAI_NOUVEL_EMPLOI_MAXIMUM_JOURS = exports.DIVISEUR_ANNUEL = exports.LIVRE_DE_PAIE_CONGE_PAR_JOUR = exports.REGLE_MOYENNE_AU_JOUR = exports.JOURS_PAR_MOIS_DE_MOYENNE = exports.MOIS_DE_MOYENNE = exports.DELAI_PAIEMENT_JOURS_OUVRABLES = exports.CONGE_TRANCHE_ANNEES = exports.CONGE_AJOUT_PAR_TRANCHE_JOURS = exports.CONGE_JOURS_PAR_MOIS_MINEUR = exports.CONGE_JOURS_PAR_MOIS_MAJEUR = exports.JOURS_D_ESSAI_SANS_PREAVIS = exports.PREAVIS_ESSAI_JOURS = exports.JOURS_OUVRABLES_MAXIMUM_EN_TROIS_MOIS = exports.CANDIDAT_NON_ELU_MOIS = exports.PREAVIS_DELEGUE_PLANCHER_MOIS = exports.PREAVIS_DELEGUE_MULTIPLICATEUR = exports.PREAVIS_PAR_ANNEE_JOURS = exports.PREAVIS_PLANCHER_JOURS = void 0;
exports.joursOuvrablesDeTroisMois = joursOuvrablesDeTroisMois;
exports.preavisLegal = preavisLegal;
exports.allocationDeConge = allocationDeConge;
exports.congeLegal = congeLegal;
exports.motifRefusDecompte = motifRefusDecompte;
exports.decompteFinal = decompteFinal;
const bareme_smig_1 = require("./bareme-smig");
const livre_de_paie_1 = require("./livre-de-paie");
const jours_du_code_du_travail_1 = require("./jours-du-code-du-travail");
const remuneration_du_delai_1 = require("./remuneration-du-delai");
const decompte_retenues_stipulations_1 = require("./decompte-retenues-stipulations");
exports.PREAVIS_PLANCHER_JOURS = 14;
exports.PREAVIS_PAR_ANNEE_JOURS = 7;
exports.PREAVIS_DELEGUE_MULTIPLICATEUR = 2;
exports.PREAVIS_DELEGUE_PLANCHER_MOIS = 3;
exports.CANDIDAT_NON_ELU_MOIS = 6;
exports.JOURS_OUVRABLES_MAXIMUM_EN_TROIS_MOIS = 92 - 13;
exports.PREAVIS_ESSAI_JOURS = 3;
exports.JOURS_D_ESSAI_SANS_PREAVIS = 3;
exports.CONGE_JOURS_PAR_MOIS_MAJEUR = 1;
exports.CONGE_JOURS_PAR_MOIS_MINEUR = 1.5;
exports.CONGE_AJOUT_PAR_TRANCHE_JOURS = 1;
exports.CONGE_TRANCHE_ANNEES = 5;
exports.DELAI_PAIEMENT_JOURS_OUVRABLES = 2;
exports.MOIS_DE_MOYENNE = 12;
exports.JOURS_PAR_MOIS_DE_MOYENNE = bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS;
exports.REGLE_MOYENNE_AU_JOUR = `la moyenne mensuelle des douze mois est ramenée au jour à 1/${bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS} · les articles 66, al. 3 et 142, al. 2 ` +
    "la font entrer dans la rémunération de chaque jour sans fixer la conversion, et la seule conversion légale entre valeur journalière " +
    "et valeur mensuelle est celle du décret n° 25/22, art. 7 (« en multipliant par 6, 26 et 312 »), appliquée par analogie de la loi la plus proche";
exports.LIVRE_DE_PAIE_CONGE_PAR_JOUR = "le livre de paie porte le nombre de jours de congés payés, le taux journalier de l'allocation de congé et son total " +
    "(arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, art. 1er, mentions 14 à 16)";
exports.DIVISEUR_ANNUEL = bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.ANNEE;
exports.DELAI_NOUVEL_EMPLOI_MAXIMUM_JOURS = 7;
const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const ENTREE_EN_VIGUEUR_ORDONNANCE_23_042 = '2023-03-30';
function joursOuvrablesDeTroisMois(dateNotification) {
    const m = JOUR.exec(dateNotification);
    if (!m)
        return { refus: 'La date de notification doit être écrite AAAA-MM-JJ.' };
    const debut = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
    if (Number.isNaN(debut.getTime()))
        return { refus: 'La date de notification est illisible.' };
    const du = debut.toISOString().slice(0, 10);
    if (du < ENTREE_EN_VIGUEUR_ORDONNANCE_23_042) {
        return {
            refus: "La période commence avant le 30 mars 2023 · la liste des jours fériés antérieure à l'ordonnance n° 23-042 n'est pas au corpus, et les trois mois ne se comptent pas en jours ouvrables sans elle.",
        };
    }
    const moisCible = debut.getUTCMonth() + exports.PREAVIS_DELEGUE_PLANCHER_MOIS;
    const dernierDuMoisCible = new Date(Date.UTC(debut.getUTCFullYear(), moisCible + 1, 0)).getUTCDate();
    const fin = new Date(Date.UTC(debut.getUTCFullYear(), moisCible, Math.min(debut.getUTCDate(), dernierDuMoisCible)));
    let jours = 0;
    for (let d = new Date(debut); d.getTime() < fin.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
        if ((0, jours_du_code_du_travail_1.estJourOuvrableDuCode)(d))
            jours += 1;
    }
    return { jours, du, auExclu: fin.toISOString().slice(0, 10) };
}
const RESERVE_PLANCHER_64 = "PLANCHER, JAMAIS DURÉE DUE · l'article 64 s'ouvre par « sauf durée plus longue fixée par les parties ou par la convention collective » et se referme par « ne peut être inférieure à ». " +
    "Et son dernier alinéa renvoie à un ARRÊTÉ du Ministre du Travail, qui n'est PAS au corpus · c'est de lui que viennent les barèmes par catégorie (maîtrise, cadres) que la pratique applique. Vérifier la convention du dossier avant d'opposer ce chiffre.";
const RESERVE_JOUR_OUVRABLE_CODE = "JOURS OUVRABLES AU SENS DU CODE DU TRAVAIL, article 7, point 9 · « chaque jour de la semaine à l'exception du jour de repos hebdomadaire et des jours fériés légaux », le repos ayant lieu le dimanche (art. 121, al. 2). LE SAMEDI EST OUVRABLE, sauf celui qui porte le congé d'un férié tombé un dimanche (ordonnance n° 23-042, art. 2, « le congé relatif à ce jour est pris le jour précédent » · règle de protection, le compter ouvrable ôterait au férié tout effet). La règle des échéances fiscales, qui écarte tout samedi, répond à une autre question · elle vise un guichet de l'Administration.";
function preavisLegal(params) {
    const reserves = [];
    const aucun = (motifAucunPreavis, fondement) => ({
        joursOuvrables: null,
        motifAucunPreavis,
        motifIndetermine: null,
        fondement,
        reserves,
    });
    const indetermine = (motifIndetermine, fondement) => ({
        joursOuvrables: null,
        motifAucunPreavis: null,
        motifIndetermine,
        fondement,
        reserves,
    });
    if (params.motif === 'FAUTE_LOURDE') {
        return aucun("Article 72 · « Tout contrat de travail peut être résilié immédiatement sans préavis, pour faute lourde. » La qualification de faute lourde appartient au dossier, et l'article l'enferme dans une notification écrite dans les quinze jours ouvrables de la connaissance des faits.", 'Article 72');
    }
    if (params.motif === 'FORCE_MAJEURE') {
        const conditions = "Article 57 · « Le cas de force majeure est constaté par l'Inspecteur du Travail. » Article 60 c) · « en cas de force majeure, la partie intéressée peut résilier le contrat sans indemnité, après deux mois de suspension ». Article 80 · « La faillite et la liquidation judiciaire ne sont pas considérées comme des cas de force majeure. »";
        if (params.forceMajeureConstateeParInspecteur === true && params.deuxMoisDeSuspension === true) {
            return aucun(`${conditions} Constat de l'Inspecteur et deux mois de suspension déclarés.`, 'Articles 57 et 60 c)');
        }
        return indetermine(`${conditions} Tant que le constat de l'Inspecteur du travail et les deux mois de suspension ne sont pas déclarés, la résiliation sans indemnité n'est pas établie.`, 'Articles 57 et 60 c)');
    }
    if (params.motif === 'TERME_DU_CDD') {
        return aucun("Article 69 · le contrat à durée déterminée « prend fin à l'expiration du terme fixé par les parties » · il n'y a pas de résiliation à notifier, donc pas de préavis.", 'Article 69');
    }
    if (params.motif === 'COMMUN_ACCORD') {
        return aucun("Article 61 bis · « le contrat de travail peut être également résilié d'un commun accord des parties ». L'article ne fixe aucun préavis · ce que les parties ont convenu se saisit.", 'Article 61 bis');
    }
    if (params.typeContrat !== 'DUREE_INDETERMINEE' && params.typeContrat !== 'DUREE_DETERMINEE') {
        return indetermine("Le type de contrat n'est pas déclaré · l'article 64 ne régit que le contrat à durée indéterminée, le contrat à durée déterminée ne se résiliant pas par préavis (art. 69).", 'Articles 64 et 69');
    }
    if (params.periodeDEssai) {
        const ecoules = params.joursDEssaiEcoules;
        if (ecoules === undefined || ecoules === null) {
            return indetermine("Article 71 · pendant les trois premiers jours d'essai, le contrat se résilie sans préavis ; ensuite, moyennant un préavis de trois jours ouvrables. Le nombre de jours d'essai écoulés n'est pas renseigné.", 'Article 71');
        }
        if (ecoules <= exports.JOURS_D_ESSAI_SANS_PREAVIS) {
            return aucun("Article 71, alinéa 2 · « pendant les trois premiers jours d'essai, le contrat peut être résilié sans préavis, la totalité de la rémunération étant due pour toute journée commencée ».", 'Article 71');
        }
        reserves.push(RESERVE_JOUR_OUVRABLE_CODE);
        return {
            joursOuvrables: exports.PREAVIS_ESSAI_JOURS,
            motifAucunPreavis: null,
            motifIndetermine: null,
            fondement: 'Article 71',
            reserves,
        };
    }
    if (params.typeContrat === 'DUREE_DETERMINEE') {
        return aucun("Article 69 · « La clause insérée dans un tel contrat prévoyant le droit d'y mettre fin par préavis est nulle de plein droit. » La rupture avant le terme donne lieu aux dommages-intérêts de l'article 70, rubrique à part.", 'Articles 69 et 70');
    }
    const annees = Math.max(0, Math.floor(params.anneesAnciennete));
    const legal = exports.PREAVIS_PLANCHER_JOURS + exports.PREAVIS_PAR_ANNEE_JOURS * annees;
    const retenu = typeof params.preavisRetenuJours === 'number' && params.preavisRetenuJours > 0 ? params.preavisRetenuJours : null;
    let fondement = 'Article 64';
    let delaiDeDateADate = null;
    reserves.push(RESERVE_PLANCHER_64, RESERVE_JOUR_OUVRABLE_CODE);
    let employeur = Math.max(legal, retenu ?? 0);
    if (retenu !== null && retenu > legal) {
        reserves.push(`DURÉE RETENUE PAR LE DOSSIER · ${retenu} jours ouvrables déclarés, au-dessus du plancher de ${legal} jours de l'article 64.`);
    }
    if (params.delegueSyndical && params.initiative === 'EMPLOYEUR') {
        fondement = 'Articles 64 et 258';
        const double = legal * exports.PREAVIS_DELEGUE_MULTIPLICATEUR;
        employeur = Math.max(double, retenu ?? 0);
        const texte258 = "ARTICLE 258 · « Sauf faute lourde, la durée du préavis à observer en cas de licenciement d'un délégué titulaire ou suppléant est LE DOUBLE de la période applicable en vertu des dispositions de l'article 64, SANS POUVOIR ÊTRE INFÉRIEURE À TROIS MOIS. » Et « les candidats non élus ou non réélus bénéficient pendant une durée de 6 mois après les élections des règles de préavis » de cet alinéa.";
        const trois = params.dateNotification ? joursOuvrablesDeTroisMois(params.dateNotification) : null;
        if (trois && 'jours' in trois) {
            if (trois.jours >= employeur)
                delaiDeDateADate = { du: trois.du, auExclu: trois.auExclu };
            employeur = Math.max(employeur, trois.jours);
            reserves.push(`${texte258} Doublé : ${double} jours ouvrables. Trois mois du ${trois.du} au ${trois.auExclu} exclu : ${trois.jours} jours ouvrables (dimanches, jours fériés de l'ordonnance n° 23-042 et samedi portant le congé d'un férié tombé un dimanche exclus). Le plus grand est retenu.`);
        }
        else if (double >= exports.JOURS_OUVRABLES_MAXIMUM_EN_TROIS_MOIS || retenu !== null) {
            reserves.push(retenu !== null
                ? `${texte258} Doublé : ${double} jours ouvrables ; la durée retenue par le dossier (${retenu} jours) est prise pour la conversion des trois mois.`
                : `${texte258} Doublé : ${double} jours ouvrables, au-delà des ${exports.JOURS_OUVRABLES_MAXIMUM_EN_TROIS_MOIS} jours ouvrables que trois mois peuvent compter · le plancher est atteint.`);
        }
        else {
            return indetermine(`${texte258} Doublé, le préavis fait ${double} jours ouvrables, et trois mois en comptent jusqu'à ${exports.JOURS_OUVRABLES_MAXIMUM_EN_TROIS_MOIS} · il peut rester sous le plancher. Déclarer la date de notification, ou la durée retenue en jours ouvrables.` +
                (trois && 'refus' in trois ? ` ${trois.refus}` : ''), fondement);
        }
    }
    let jours = employeur;
    if (params.initiative === 'TRAVAILLEUR') {
        jours = employeur / 2;
        reserves.push("ARTICLE 64, ALINÉA 2 · « La durée du préavis à donner par le travailleur est égale à LA MOITIÉ de celui qu'aurait dû remettre l'employeur. Elle ne peut en aucun cas excéder cette limite. »");
    }
    return { joursOuvrables: jours, delaiDeDateADate, motifAucunPreavis: null, motifIndetermine: null, fondement, reserves };
}
const trancheDAnciennete = (anneesAnciennete) => Math.floor(Math.max(0, anneesAnciennete) / exports.CONGE_TRANCHE_ANNEES) * exports.CONGE_AJOUT_PAR_TRANCHE_JOURS;
exports.trancheDAnciennete = trancheDAnciennete;
function allocationDeConge(p) {
    if (p.remunerationJournaliereFc === null) {
        return { montantFc: null, tauxJournalierFc: null, motif: "Le taux journalier de la rémunération n'est pas renseigné." };
    }
    if (p.moyenneMensuelleArticle142Fc === null) {
        return {
            montantFc: null,
            tauxJournalierFc: null,
            motif: "La moyenne des douze mois de l'article 142, alinéa 2 n'est pas renseignée · elle entre dans l'allocation de chaque jour de congé (zéro est une réponse).",
        };
    }
    const tauxJournalierFc = p.remunerationJournaliereFc + p.moyenneMensuelleArticle142Fc / exports.JOURS_PAR_MOIS_DE_MOYENNE;
    return { montantFc: p.jours * tauxJournalierFc, tauxJournalierFc, motif: null };
}
function congeLegal(params) {
    const mois = Math.max(0, Math.floor(params.moisNonCouvertsParUnConge));
    const parMois = params.moinsDeDixHuitAns
        ? exports.CONGE_JOURS_PAR_MOIS_MINEUR
        : exports.CONGE_JOURS_PAR_MOIS_MAJEUR;
    const joursDeBase = mois * parMois;
    const anciennete = Math.max(0, params.anneesAnciennete);
    const reste = mois % 12;
    const anneesCompletes = (mois - reste) / 12;
    const tranches = exports.trancheDAnciennete;
    let joursDAnciennete = reste > 0 ? tranches(anciennete) : 0;
    for (let i = 0; i < anneesCompletes; i += 1) {
        joursDAnciennete += tranches(anciennete - reste / 12 - i);
    }
    const reserves = [
        "ARTICLE 141 · « au moins UN jour ouvrable par mois entier de service pour le travailleur âgé de PLUS de dix-huit ans », « au moins UN jour ouvrable ET DEMI » pour celui de MOINS de dix-huit ans, et « augmente d'UN jour ouvrable par tranche de cinq années d'ancienneté ». C'est un PLANCHER · une convention collective plus favorable prime.",
        "LE SÉMINAIRE CPCC PORTE 1,5 JOUR POUR LE MAJEUR, 2 POUR LE MINEUR ET 2 PAR TRANCHE DE CINQ ANS · il a décalé d'un cran, et une indemnité calculée ainsi est de cinquante pour cent trop élevée. Le fichier porte lui-même la règle : en cas de désaccord, l'article prime.",
        "ARTICLE 141, ALINÉA 2 · les services pris en compte comprennent les jours de repos hebdomadaire, de congé payé et les jours fériés, ainsi que l'incapacité de travail jusqu'à six mois par année, sans cette limite pour un accident du travail ou une maladie professionnelle. OmegaX ne recompose pas ce décompte · les mois NON COUVERTS PAR UN CONGÉ PRIS OU PAYÉ sont SAISIS (art. 144, le congé est « remplacé »).",
        "TRANCHE D'ANCIENNETÉ · ajoutée à chaque période annuelle non prise, à l'ancienneté atteinte en fin de période, les mois saisis étant lus comme les plus récents ; la période en cours, incomplète, la reçoit ENTIÈRE · l'article 141 rapporte l'augmentation à l'ancienneté (« par tranche de cinq années »), non au mois, et l'article 144 remplace le congé « quel que soit le moment ». Une période sans aucun mois entier ne reçoit aucun jour, ce qu'aucun texte lu ne tranche. L'article 140 ne laisse cumuler que « la moitié des congés pendant une période de deux ans ».",
    ];
    return {
        joursOuvrables: joursDeBase + joursDAnciennete,
        joursDeBase,
        joursDAnciennete,
        reserves,
    };
}
const prorataAnnuel = (montantAnnuelFc, joursPrestes) => (Math.max(0, montantAnnuelFc) * Math.max(0, joursPrestes)) / exports.DIVISEUR_ANNUEL;
exports.prorataAnnuel = prorataAnnuel;
exports.PREFIXE_GRATIFICATION_STIPULEE = 'GRATIFICATION STIPULÉE';
function motifRefusDecompte(p) {
    if ((p.executionPreavis === 'DEPART_A_MI_PREAVIS' || p.executionPreavis === 'DEPART_POUR_NOUVEL_EMPLOI') &&
        p.initiative !== 'EMPLOYEUR') {
        return p.executionPreavis === 'DEPART_A_MI_PREAVIS'
            ? "Article 66 · « Le travailleur qui reçoit le préavis peut cesser le travail à l'expiration de la moitié du délai » · il vise le préavis donné par l'employeur, pas celui que le travailleur donne."
            : "Article 67 · « Le travailleur qui a reçu le préavis et justifie avoir trouvé un nouvel emploi » · il vise le préavis donné par l'employeur, pas celui que le travailleur donne.";
    }
    if ((p.executionPreavis === 'DEPART_A_MI_PREAVIS' || p.executionPreavis === 'DEPART_POUR_NOUVEL_EMPLOI') &&
        (p.motif !== 'LICENCIEMENT' || p.typeContrat === 'DUREE_DETERMINEE')) {
        return "Les départs des articles 66 et 67 supposent un préavis de licenciement reçu de l'employeur · la faute lourde (art. 72), la force majeure (art. 60 c), le commun accord (art. 61 bis), le terme du contrat à durée déterminée et sa rupture (art. 69 et 70) n'en comportent pas.";
    }
    if (p.motif === 'DEMISSION' && p.initiative !== 'TRAVAILLEUR') {
        return "Une démission est l'initiative du travailleur · l'article 64, alinéa 2 fixe son préavis à la moitié de celui de l'employeur.";
    }
    if (p.motif === 'LICENCIEMENT' && p.initiative !== 'EMPLOYEUR') {
        return "Un licenciement est l'initiative de l'employeur (art. 61 et 62).";
    }
    if (p.motif === 'TERME_DU_CDD' && p.typeContrat === 'DUREE_INDETERMINEE') {
        return "Un contrat à durée indéterminée n'a pas de terme (art. 69).";
    }
    return null;
}
exports.RESERVE_DEPART_AVANT_LA_MOITIE = "LECTURE D'OMEGAX · le Code ne dit pas expressément ce que doit le travailleur qui part AVANT la moitié du préavis reçu. " +
    "L'article 66, alinéa 1 fixant à cette moitié le délai qu'il est tenu d'observer, seuls les jours non observés avant elle lui sont imputés (art. 63, al. 3), " +
    "et la rémunération du temps restant (art. 66, al. 2) n'est pas due, faute de départ à la moitié. " +
    "S'il justifie d'un nouvel emploi et d'un délai convenu d'au plus sept jours, c'est un départ de l'article 67 · rien ne lui est alors imputé. " +
    "Et si l'employeur n'a pas respecté ses obligations pendant le préavis (jour de liberté hebdomadaire compris), rien n'est dû par le travailleur · article 65, alinéa 3, « La partie à l'égard de laquelle ces obligations ne seraient pas respectées ne pourra se voir imposer aucun délai de préavis, sans préjudice des dommages-intérêts qu'elle jugerait bon de demander au tribunal compétent. »";
function mentionDureeRetenue(params) {
    return typeof params.preavisRetenuJours === 'number' && params.preavisRetenuJours > 0
        ? ''
        : " La moitié est prise sur le plancher légal de l'article 64 · déclarez la durée retenue si le préavis dû le dépasse (convention collective ou contrat, art. 64, al. 1 et 3).";
}
const AF_DUES_ARTICLE_66 = "DÉPART À MI-PRÉAVIS · les allocations familiales du temps restant à courir sont DUES (art. 66, al. 2, « l'employeur doit la rémunération et les allocations familiales pendant le temps restant à courir ») · les jours saisis les comptent.";
const AF_PERDUES_ARTICLE_67 = "DÉPART POUR UN NOUVEL EMPLOI · les allocations familiales de la période de préavis restant à courir sont PERDUES (art. 67) · les jours saisis ne la comptent pas.";
const AF_NON_DUES_AVANT_LA_MOITIE = "DÉPART AVANT LA MOITIÉ DU PRÉAVIS · les allocations familiales du temps restant ne sont pas dues, l'article 66, alinéa 2 ne jouant pas faute de départ à la moitié (lecture d'OmegaX) · les jours saisis ne le comptent pas.";
const LIBELLE_REMUNERATION_RESTANTE = 'Rémunération du préavis restant à courir';
exports.CLE_REMUNERATION_PREAVIS_RESTANT = 'remuneration-preavis-restant';
function rubriqueDepartAMiPreavis(params, preavis, jours, fondementDuree, jour, conversionMoyenne) {
    const restants = typeof params.joursPreavisNonObserves === 'number' ? params.joursPreavisNonObserves : null;
    const avantages = typeof params.avantagesEnNatureRestantsFc === 'number' ? params.avantagesEnNatureRestantsFc : null;
    const mensuelle = typeof params.remunerationMensuelleFc === 'number' ? params.remunerationMensuelleFc : null;
    const moyenneMensuelle = typeof params.moyenneMensuelleArticle66Fc === 'number' ? params.moyenneMensuelleArticle66Fc : null;
    const moitie = jours / 2;
    let reserve = null;
    let montant = null;
    let detailDelai = '';
    if (restants === null) {
        reserve = "Les jours ouvrables du préavis restant à courir à la cessation ne sont pas renseignés · c'est sur eux que l'employeur doit la rémunération (art. 66, al. 2).";
    }
    else if (restants < 0) {
        reserve = 'Les jours restant à courir ne peuvent être négatifs.';
    }
    else if (restants > moitie) {
        reserve =
            `${restants} jours restant à courir sur un préavis de ${jours} · le travailleur est parti AVANT la moitié (${moitie} jours). ` +
                "L'article 66 ne l'autorise à cesser le travail qu'« à l'expiration de la moitié du délai de préavis » · ce départ est un préavis non observé par le travailleur (art. 63, al. 3), ou un départ pour un nouvel emploi (art. 67) s'il en justifie." +
                mentionDureeRetenue(params);
    }
    else if (jour === null && mensuelle === null) {
        reserve = "Le taux journalier du contrat (ou sa rémunération mensuelle) n'est pas renseigné.";
    }
    else if (moyenneMensuelle === null) {
        reserve =
            "La moyenne des douze mois de l'article 66, alinéa 3 n'est pas renseignée · elle entre dans la rémunération du temps restant à courir (zéro est une réponse).";
    }
    else if (avantages === null) {
        reserve =
            "La valeur des avantages en nature non fournis pendant le temps restant à courir n'est pas renseignée · l'article 7, point 8 la compte dans la rémunération, soins de santé, logement, allocations familiales, transport, frais de voyage et avantages de fonction exclus (zéro est une réponse).";
    }
    else {
        const debut = preavis.delaiDeDateADate ? { du: preavis.delaiDeDateADate.du } : (0, remuneration_du_delai_1.debutDuDelai)(params.dateNotification);
        if ('refus' in debut) {
            reserve = debut.refus;
        }
        else {
            const r = (0, remuneration_du_delai_1.remunerationDuDelai)({
                delai: { du: debut.du, auExclu: preavis.delaiDeDateADate?.auExclu ?? null },
                joursOuvrables: jours,
                de: jours - restants,
                a: jours,
                journaliereFc: jour,
                mensuelleFc: mensuelle,
                moyenneMensuelleFc: moyenneMensuelle,
            });
            if ('refus' in r) {
                reserve = r.refus;
            }
            else {
                montant = r.montantFc + avantages;
                detailDelai = ` ${r.explication}`;
            }
        }
    }
    return {
        cle: 'remuneration-preavis-restant',
        libelle: LIBELLE_REMUNERATION_RESTANTE,
        montantFc: montant,
        fondement: `${fondementDuree} Article 66 · « Le travailleur qui reçoit le préavis peut cesser le travail à l'expiration de la moitié du délai de préavis que l'employeur est tenu de lui donner. L'employeur doit la rémunération et les allocations familiales pendant le temps restant à courir. » ` +
            `Les ${restants ?? '?'} derniers jours ouvrables du délai, rémunérés jours fériés compris (art. 93), plus les avantages en nature ;${detailDelai} ${conversionMoyenne}. ` +
            "Rémunération au sens de l'article 7, point 8 · ni les soins de santé, ni le logement ou son indemnité, ni les allocations familiales, ni le transport, ni les frais de voyage et avantages de fonction n'y entrent ; seuls les avantages en nature non fournis jusqu'au terme s'y ajoutent en valeur. Les jours prestés se paient en salaire, aux arriérés ; les allocations familiales du temps restant restent dues (rubrique à part).",
        reserve,
    };
}
function rubriqueDepartPourNouvelEmploi(params, jours, fondementDuree) {
    const TEXTE_67 = "Article 67 · « Le travailleur qui a reçu le préavis et justifie avoir trouvé un nouvel emploi peut quitter son employeur dans un délai moindre, fixé de commun accord, sans qu'il puisse être supérieur à sept jours à dater du jour où il trouve un nouvel engagement. Dans ce cas, il perd le droit à la rémunération et aux allocations familiales de la période de préavis restant à courir. »";
    const delai = typeof params.delaiDepartNouvelEmploiJours === 'number' ? params.delaiDepartNouvelEmploiJours : null;
    const restants = typeof params.joursPreavisNonObserves === 'number' ? params.joursPreavisNonObserves : null;
    const moitie = jours / 2;
    let reserve = null;
    if (restants === null) {
        reserve =
            "Les jours ouvrables du préavis restant à courir au départ ne sont pas renseignés · le délai moindre de l'article 67 se lit contre la moitié du préavis de l'article 66.";
    }
    else if (restants < 0 || restants > jours) {
        reserve = `Les jours restant à courir (${restants}) doivent être compris entre zéro et la durée du préavis (${jours}).`;
    }
    else if (restants <= moitie) {
        reserve =
            `${restants} jours restant à courir sur un préavis de ${jours} · le travailleur est parti à la moitié (${moitie} jours) ou après. ` +
                "L'article 66 lui garde alors « la rémunération et les allocations familiales pendant le temps restant à courir » ; l'article 67, qui les lui retire, ne se lit que pour un départ avant la moitié (lecture protectrice d'OmegaX, le texte ne disant pas à quoi le délai est « moindre »). " +
                'Déclarez le départ à mi-préavis.' +
                mentionDureeRetenue(params);
    }
    else if (params.nouvelEmploiJustifie === false) {
        reserve =
            "Le nouvel emploi n'est pas justifié · l'article 67 exige que le travailleur « justifie avoir trouvé un nouvel emploi ». Sans justification, le départ anticipé est un préavis non observé par le travailleur (art. 63, al. 3).";
    }
    else if (params.nouvelEmploiJustifie !== true) {
        reserve = "La justification du nouvel emploi n'est pas déclarée (art. 67, « justifie avoir trouvé un nouvel emploi »).";
    }
    else if (delai === null) {
        reserve = "Le délai de départ convenu de commun accord n'est pas déclaré · l'article 67 le borne à sept jours à dater du nouvel engagement.";
    }
    else if (delai < 0) {
        reserve = 'Le délai de départ convenu ne peut être négatif.';
    }
    else if (delai > exports.DELAI_NOUVEL_EMPLOI_MAXIMUM_JOURS) {
        reserve =
            `Délai convenu de ${delai} jours · l'article 67 dit « sans qu'il puisse être supérieur à sept jours à dater du jour où il trouve un nouvel engagement ». ` +
                "Un départ au-delà n'est pas celui de l'article 67.";
    }
    return {
        cle: 'preavis',
        libelle: LIBELLE_REMUNERATION_RESTANTE,
        montantFc: reserve === null ? 0 : null,
        fondement: `${fondementDuree} ${TEXTE_67} Le travailleur perd la rémunération du temps restant ; il ne doit rien de son côté, son départ étant autorisé et non une inexécution du préavis (art. 63, al. 3). ` +
            "« Sept jours » et non « jours ouvrables » · jours de calendrier (lecture d'OmegaX, l'art. 64 écrivant « jours ouvrables » quand il les veut). Les jours prestés se paient en salaire, aux arriérés.",
        reserve,
    };
}
function decompteFinal(params) {
    const preavis = preavisLegal(params);
    const conge = congeLegal(params);
    const rubriques = [];
    const horsBrut = [];
    const duParLeTravailleur = [];
    const jour = params.remunerationJournaliereFc ?? null;
    const saisi = (v) => (typeof v === 'number' ? v : null);
    const parJour = (mensuelle) => (mensuelle === null ? null : mensuelle / exports.JOURS_PAR_MOIS_DE_MOYENNE);
    const moyenne66 = parJour(saisi(params.moyenneMensuelleArticle66Fc));
    const moyenne142 = parJour(saisi(params.moyenneMensuelleArticle142Fc));
    const conversionMoyenne = exports.REGLE_MOYENNE_AU_JOUR;
    rubriques.push({
        cle: 'arrieres',
        libelle: 'Arriérés de rémunération et jours prestés non payés',
        montantFc: saisi(params.arrieresFc),
        fondement: "Article 100 · « toute somme restant due en exécution d'un contrat de travail ».",
        reserve: saisi(params.arrieresFc) === null
            ? "Aucun livre ne porte ce qui reste dû à la date de cessation · le montant est saisi. Un préavis PRESTÉ s'y paie, en salaire."
            : null,
    });
    let sortDuTempsRestant = null;
    const LIBELLE_PREAVIS = 'Indemnité compensatrice de préavis';
    if (params.motif === 'COMMUN_ACCORD') {
        const convenu = saisi(params.montantConvenuCommunAccordFc);
        rubriques.push({
            cle: 'preavis',
            libelle: 'Indemnité convenue de rupture d’un commun accord',
            montantFc: convenu,
            fondement: preavis.motifAucunPreavis,
            reserve: convenu === null ? "Le montant convenu par les parties n'est pas renseigné · zéro est une réponse, l'absence n'en est pas une." : null,
        });
    }
    else if (preavis.motifIndetermine !== null) {
        rubriques.push({ cle: 'preavis', libelle: LIBELLE_PREAVIS, montantFc: null, fondement: preavis.fondement, reserve: preavis.motifIndetermine });
    }
    else if (preavis.joursOuvrables === null) {
        rubriques.push({ cle: 'preavis', libelle: LIBELLE_PREAVIS, montantFc: 0, fondement: preavis.motifAucunPreavis, reserve: null });
    }
    else {
        const jours = preavis.joursOuvrables;
        const execution = params.executionPreavis ?? null;
        const responsable = params.partieResponsable ?? params.initiative;
        const fondementDuree = `${preavis.fondement} · ${jours} jours ouvrables.`;
        if (execution === null) {
            rubriques.push({
                cle: 'preavis',
                libelle: LIBELLE_PREAVIS,
                montantFc: null,
                fondement: fondementDuree,
                reserve: "L'exécution du préavis n'est pas déclarée · l'article 63, alinéa 3 ne rend l'indemnité due que si le préavis n'a pas été intégralement observé, et par la partie responsable à l'autre.",
            });
        }
        else if (execution === 'PRESTE') {
            rubriques.push({
                cle: 'preavis',
                libelle: LIBELLE_PREAVIS,
                montantFc: 0,
                fondement: `${fondementDuree} Préavis presté · il se paie en salaire, aux arriérés, et non en indemnité (art. 63, al. 3).`,
                reserve: null,
            });
        }
        else if (execution === 'DISPENSE_A_LA_DEMANDE_DU_TRAVAILLEUR') {
            rubriques.push({
                cle: 'preavis',
                libelle: LIBELLE_PREAVIS,
                montantFc: 0,
                fondement: `${fondementDuree} Dispense demandée par le travailleur · il perd le droit à l'indemnité.`,
                reserve: "Lecture du séminaire CPCC (« si le travailleur demande lui-même la dispense, il perd le droit à l'indemnité de préavis ») · le Code ne la nomme pas.",
            });
        }
        else if (execution === 'DEPART_A_MI_PREAVIS') {
            const r = rubriqueDepartAMiPreavis(params, preavis, jours, fondementDuree, jour, conversionMoyenne);
            rubriques.push(r);
            if (r.montantFc !== null)
                sortDuTempsRestant = AF_DUES_ARTICLE_66;
        }
        else if (execution === 'DEPART_POUR_NOUVEL_EMPLOI') {
            const r = rubriqueDepartPourNouvelEmploi(params, jours, fondementDuree);
            rubriques.push(r);
            if (r.montantFc === 0)
                sortDuTempsRestant = AF_PERDUES_ARTICLE_67;
        }
        else {
            const nonObserves = execution === 'DISPENSE_PAR_EMPLOYEUR' ? jours : saisi(params.joursPreavisNonObserves);
            const doitLEmployeur = execution === 'DISPENSE_PAR_EMPLOYEUR' || responsable === 'EMPLOYEUR';
            const preavisRecuParLeTravailleur = !doitLEmployeur && params.initiative === 'EMPLOYEUR';
            const moitie = jours / 2;
            const imputables = nonObserves === null || !preavisRecuParLeTravailleur ? nonObserves : nonObserves - moitie;
            const relevantDeLArticle66 = preavisRecuParLeTravailleur && nonObserves !== null && nonObserves >= 0 && nonObserves <= moitie;
            const avantages = saisi(params.avantagesPendantPreavisFc);
            const mensuelle = saisi(params.remunerationMensuelleFc);
            let montant = null;
            let reserve = null;
            let detailDelai = '';
            if (nonObserves === null) {
                reserve = "Le nombre de jours ouvrables de préavis non observés n'est pas renseigné.";
            }
            else if (nonObserves > jours || nonObserves < 0) {
                reserve = `Les jours non observés (${nonObserves}) dépassent la durée du préavis (${jours}).`;
            }
            else if (relevantDeLArticle66) {
                reserve =
                    `${nonObserves} jours non observés sur ${jours} · le travailleur est parti à la moitié du préavis ou après. ` +
                        "Article 66 · « Le travailleur qui reçoit le préavis peut cesser le travail à l'expiration de la moitié du délai de préavis que l'employeur est tenu de lui donner. L'employeur doit la rémunération et les allocations familiales pendant le temps restant à courir. » " +
                        'Déclarez le départ à mi-préavis · rien n\'est dû par le travailleur, la rémunération du temps restant l\'est par l\'employeur.' +
                        mentionDureeRetenue(params);
            }
            else if (jour === null && mensuelle === null) {
                reserve = "Le taux journalier du contrat (ou sa rémunération mensuelle) n'est pas renseigné.";
            }
            else if (moyenne66 === null) {
                reserve =
                    "La moyenne des douze mois de l'article 66, alinéa 3 n'est pas renseignée · elle entre dans la rémunération de chaque jour de préavis (zéro est une réponse).";
            }
            else if (avantages === null) {
                reserve =
                    "Les avantages de toute nature pendant le préavis ne sont pas renseignés · l'article 63, alinéa 3 les compte avec la rémunération (zéro est une réponse).";
            }
            else {
                const debut = preavis.delaiDeDateADate ? { du: preavis.delaiDeDateADate.du } : (0, remuneration_du_delai_1.debutDuDelai)(params.dateNotification);
                if ('refus' in debut) {
                    reserve = debut.refus;
                }
                else {
                    const delai = { du: debut.du, auExclu: preavis.delaiDeDateADate?.auExclu ?? null };
                    const de = jours - nonObserves;
                    const a = preavisRecuParLeTravailleur ? moitie : jours;
                    const r = (0, remuneration_du_delai_1.remunerationDuDelai)({
                        delai,
                        joursOuvrables: jours,
                        de,
                        a,
                        journaliereFc: jour,
                        mensuelleFc: mensuelle,
                        moyenneMensuelleFc: saisi(params.moyenneMensuelleArticle66Fc),
                    });
                    if ('refus' in r) {
                        reserve = r.refus;
                    }
                    else {
                        montant = r.montantFc + avantages;
                        detailDelai = ` ${r.explication}`;
                    }
                }
            }
            const lectureArticle66 = preavisRecuParLeTravailleur && !relevantDeLArticle66
                ? ` Préavis reçu de l'employeur · le travailleur pouvait cesser à la moitié (${moitie} jours, art. 66, al. 1) ; seuls les ${imputables ?? '?'} jours non observés avant elle lui sont imputés, et les avantages déclarés sont ceux de ces jours.`
                : '';
            const ligne = {
                cle: 'preavis',
                libelle: LIBELLE_PREAVIS,
                montantFc: montant,
                ...(montant !== null && avantages !== null && avantages > 0 ? { avantagesInclusFc: avantages } : {}),
                fondement: relevantDeLArticle66
                    ? `${fondementDuree} Article 66 · le travailleur qui reçoit le préavis peut cesser le travail à l'expiration de la moitié du délai.`
                    : `${fondementDuree} Article 63, alinéa 3 · « une indemnité dont le montant correspond à la rémunération et aux avantages de toute nature dont aurait bénéficié le travailleur durant le délai de préavis qui n'a pas été effectivement respecté ». ` +
                        "Article 93 · la rémunération « est également due [...] pour les jours fériés légaux » · l'indemnité paie la rémunération du délai, fériés compris, non ses seuls jours ouvrables." +
                        `${detailDelai} Avantages en sus.${lectureArticle66}`,
                reserve,
            };
            if (doitLEmployeur || relevantDeLArticle66) {
                rubriques.push(ligne);
            }
            else {
                if (preavisRecuParLeTravailleur && nonObserves !== null && nonObserves > moitie && nonObserves <= jours) {
                    sortDuTempsRestant = AF_NON_DUES_AVANT_LA_MOITIE;
                }
                duParLeTravailleur.push({
                    ...ligne,
                    libelle: 'Indemnité de préavis due par le travailleur',
                    reserve: ligne.reserve ?? (preavisRecuParLeTravailleur ? exports.RESERVE_DEPART_AVANT_LA_MOITIE : null),
                });
                rubriques.push({
                    cle: 'preavis',
                    libelle: LIBELLE_PREAVIS,
                    montantFc: 0,
                    fondement: `${fondementDuree} Le préavis non observé l'est par le travailleur · l'indemnité est due PAR lui à l'employeur (art. 63, al. 3), hors du total qui lui revient.`,
                    reserve: null,
                });
            }
        }
    }
    if (params.typeContrat === 'DUREE_DETERMINEE' &&
        !params.periodeDEssai &&
        (params.motif === 'LICENCIEMENT' || params.motif === 'DEMISSION')) {
        const TEXTE_70 = "Article 70 · « Toute rupture du contrat à durée déterminée prononcée en violation de l'article 69 donne lieu à des dommages-intérêts. Lorsque la rupture irrégulière est le fait de l'employeur, ces dommages-intérêts correspondent aux salaires et avantages de toute nature dont le salarié aurait bénéficié pendant la période restant à courir jusqu'au terme de son contrat. »";
        if (params.initiative === 'EMPLOYEUR') {
            const avantages = saisi(params.avantagesJusquAuTermeFc);
            const mensuelleCdd = saisi(params.remunerationMensuelleFc);
            let reserve = null;
            let montant = null;
            let detail = '';
            if (!params.dateRuptureContrat || !params.dateTermeContrat) {
                reserve =
                    "La date de la rupture ou celle du terme n'est pas déclarée · les dommages-intérêts sont les salaires de la période restant à courir jusqu'au terme (art. 70, al. 2), jours fériés compris (art. 93), et les fériés de la période ne se placent pas sans elles.";
            }
            else if (jour === null && mensuelleCdd === null) {
                reserve = "Le taux journalier du contrat (ou sa rémunération mensuelle) n'est pas renseigné.";
            }
            else if (avantages === null) {
                reserve = "Les avantages de toute nature jusqu'au terme ne sont pas renseignés (zéro est une réponse).";
            }
            else {
                const lendemain = (0, remuneration_du_delai_1.debutDuDelai)(params.dateRuptureContrat);
                const terme = /^\d{4}-\d{2}-\d{2}$/.test(params.dateTermeContrat.slice(0, 10)) ? params.dateTermeContrat.slice(0, 10) : null;
                if ('refus' in lendemain) {
                    reserve = lendemain.refus.replace('La date de notification', 'La date de la rupture').replace('date de notification', 'date de la rupture');
                }
                else if (terme === null) {
                    reserve = 'La date du terme doit être écrite AAAA-MM-JJ.';
                }
                else if (terme < lendemain.du) {
                    reserve = `La rupture (${params.dateRuptureContrat.slice(0, 10)}) n'est pas antérieure au terme (${terme}) · aucune période ne restait à courir.`;
                }
                else {
                    const apresLeTerme = (0, remuneration_du_delai_1.debutDuDelai)(terme);
                    const r = 'refus' in apresLeTerme
                        ? apresLeTerme
                        : (0, remuneration_du_delai_1.remunerationDuDelai)({
                            delai: { du: lendemain.du, auExclu: apresLeTerme.du },
                            joursOuvrables: 0,
                            de: 0,
                            a: Number.POSITIVE_INFINITY,
                            journaliereFc: jour,
                            mensuelleFc: mensuelleCdd,
                            moyenneMensuelleFc: 0,
                        });
                    if ('refus' in r) {
                        reserve = r.refus;
                    }
                    else {
                        montant = r.montantFc + avantages;
                        detail = ` ${r.explication.replace('Délai rémunéré', 'Période rémunérée')}`;
                    }
                }
            }
            rubriques.push({
                cle: 'dommages-interets-art-70',
                libelle: "Dommages-intérêts de rupture d'un contrat à durée déterminée",
                montantFc: montant,
                ...(montant !== null && avantages !== null && avantages > 0 ? { avantagesInclusFc: avantages } : {}),
                fondement: `${TEXTE_70} Article 93 · la rémunération « est également due [...] pour les jours fériés légaux » · la période restant à courir se paie fériés compris.` +
                    `${detail} Avantages en sus. La qualification de l'irrégularité appartient au dossier.`,
                reserve,
            });
        }
        else {
            duParLeTravailleur.push({
                cle: 'dommages-interets-art-70',
                libelle: 'Dommages-intérêts dus par le travailleur',
                montantFc: null,
                fondement: TEXTE_70,
                reserve: "Le texte ne chiffre les dommages-intérêts que lorsque la rupture est le fait de l'employeur · ceux dus par le travailleur se fixent au dossier ou par le juge.",
            });
        }
    }
    const reserveConge = "ARTICLE 142 · l'allocation se calcule sur « la rémunération », et l'article 7, point 8 en exclut « l'indemnité de logement ou le logement en nature » · ni l'une ni l'autre n'y entre. L'article 142 exclut en outre le logement de la conversion en espèces des avantages en nature, « EXCEPTION FAITE SEULEMENT POUR LE LOGEMENT ». Le séminaire CPCC porte une « indemnité congé / logement » que le texte n'ouvre pas ; une indemnité de logement restant due pendant le congé relève du contrat (art. 138), hors de l'indemnité compensatoire.";
    const fondementConge = `Article 144 · « en cas de résiliation du contrat, QUEL QUE SOIT LE MOMENT où celle-ci intervient, le congé est remplacé par une indemnité compensatoire calculée conformément à l'article 142 ». ${conge.joursOuvrables} jours ouvrables × (taux journalier + moyenne de l'art. 142, al. 2), ${exports.LIVRE_DE_PAIE_CONGE_PAR_JOUR} ; ${conversionMoyenne}.`;
    const allocation = allocationDeConge({
        jours: conge.joursOuvrables,
        remunerationJournaliereFc: jour,
        moyenneMensuelleArticle142Fc: saisi(params.moyenneMensuelleArticle142Fc),
    });
    if (jour === null) {
        rubriques.push({ cle: 'conge', libelle: 'Indemnité compensatrice de congé', montantFc: null, fondement: fondementConge, reserve: "Le taux journalier du contrat n'est pas renseigné." });
    }
    else if (moyenne142 === null) {
        rubriques.push({
            cle: 'conge',
            libelle: 'Indemnité compensatrice de congé',
            montantFc: null,
            fondement: fondementConge,
            reserve: "La moyenne des douze mois de l'article 142, alinéa 2 n'est pas renseignée · elle entre dans l'allocation de chaque jour de congé (zéro est une réponse). Les bulletins émis dans OmegaX la portent quand ils existent · elle est relevée et saisie.",
        });
    }
    else {
        rubriques.push({
            cle: 'conge',
            libelle: 'Indemnité compensatrice de congé',
            montantFc: allocation.montantFc,
            fondement: fondementConge,
            reserve: reserveConge,
        });
    }
    const gratificationSaisie = saisi(params.gratificationFc);
    const stipulee = params.gratificationStipulee ?? null;
    const refusStipulation = stipulee ? (0, decompte_retenues_stipulations_1.motifRefusGratificationStipulee)(stipulee) : null;
    const proposition = stipulee && refusStipulation === null ? (0, decompte_retenues_stipulations_1.propositionGratification)(stipulee) : null;
    let reserveGratification;
    if (stipulee && refusStipulation !== null) {
        reserveGratification = `${exports.PREFIXE_GRATIFICATION_STIPULEE} · ${refusStipulation}`;
    }
    else if (proposition && gratificationSaisie === null) {
        reserveGratification =
            `${exports.PREFIXE_GRATIFICATION_STIPULEE} · proposée ${proposition.montantFc.toFixed(2)} FC (${proposition.base}) · ` +
                'confirmez-la, ou saisissez le montant que la stipulation donne. ' + decompte_retenues_stipulations_1.RESERVE_PRORATA_GRATIFICATION;
    }
    else if (proposition && gratificationSaisie !== null) {
        reserveGratification =
            Math.round(gratificationSaisie * 100) === Math.round(proposition.montantFc * 100)
                ? `${exports.PREFIXE_GRATIFICATION_STIPULEE} · confirmée sur la proposition (${proposition.base}) ${decompte_retenues_stipulations_1.RESERVE_PRORATA_GRATIFICATION}`
                : `${exports.PREFIXE_GRATIFICATION_STIPULEE} · le montant retenu (${gratificationSaisie.toFixed(2)} FC) diffère de la proposition ` +
                    `(${proposition.montantFc.toFixed(2)} FC, ${proposition.base}) · c'est la stipulation qui fixe la gratification, et le cabinet l'a lue.`;
    }
    else {
        reserveGratification =
            gratificationSaisie === null
                ? "La gratification n'est pas légale · son absence n'est pas un manque, et OmegaX ne la présume ni due ni nulle."
                : null;
    }
    rubriques.push({
        cle: 'gratification',
        libelle: 'Gratification',
        montantFc: refusStipulation !== null ? null : gratificationSaisie,
        fondement: "Article 7, point 8 · les sommes versées à titre de gratification sont des éléments de la rémunération. AUCUN article n'en impose le versement.",
        reserve: reserveGratification,
    });
    const indemnite = params.indemniteStipulee ?? null;
    if (indemnite) {
        const refusIndemnite = (0, decompte_retenues_stipulations_1.motifRefusIndemniteStipulee)(indemnite);
        rubriques.push({
            cle: 'indemnite-stipulee',
            libelle: 'Indemnité de fin de contrat stipulée',
            montantFc: refusIndemnite === null ? indemnite.montantFc : null,
            fondement: `${decompte_retenues_stipulations_1.FONDEMENT_INDEMNITE_STIPULEE} Source déclarée · ${indemnite.source?.trim() || 'aucune'}.`,
            reserve: refusIndemnite,
        });
    }
    const enfants = saisi(params.enfantsBeneficiairesAllocations);
    const joursAf = saisi(params.joursAllocationsFamiliales);
    const tauxAf = saisi(params.allocationFamilialeParEnfantFc);
    let montantAf = null;
    let reserveAf = null;
    if (enfants === 0) {
        montantAf = 0;
    }
    else if (enfants === null || joursAf === null) {
        reserveAf = "Le nombre d'enfants bénéficiaires et les jours pour lesquels les allocations sont dues sont saisis · OmegaX ne déduit aucun décompte de jours.";
    }
    else if (tauxAf === null) {
        reserveAf = params.explicationAllocationFamiliale ?? "Le taux de la colonne 19 n'est pas lu · le mois de cessation n'est pas renseigné.";
    }
    else {
        montantAf = enfants * joursAf * tauxAf;
    }
    if (reserveAf === null && montantAf !== null && montantAf > 0)
        reserveAf = sortDuTempsRestant;
    horsBrut.push({
        cle: 'allocations-familiales',
        libelle: 'Allocations familiales',
        montantFc: montantAf,
        fondement: "Article 142, alinéa 3 · « Les allocations familiales sont dues pendant toute la durée du congé. » Article 66, alinéa 2 · « L'employeur doit la rémunération et les allocations familiales pendant le temps restant à courir. » Hors du brut, comme la formule 20 du modèle de livre de paie de 2008 ; les inclure dans l'indemnité de préavis (« avantages de toute nature ») est une lecture, et les jours se saisissent.",
        reserve: reserveAf,
    });
    const somme = (lignes) => lignes.some((r) => r.montantFc === null) ? null : lignes.reduce((n, r) => n + r.montantFc, 0);
    const totalBrutFc = somme(rubriques);
    const totalHorsBrut = somme(horsBrut);
    const totalDuAuTravailleurFc = totalBrutFc === null || totalHorsBrut === null ? null : totalBrutFc + totalHorsBrut;
    return {
        preavis,
        conge,
        rubriques,
        totalBrutFc,
        horsBrut,
        totalDuAuTravailleurFc,
        duParLeTravailleur,
        echeancePaiement: `Articles 100 et 145, alinéa 2 · au plus tard dans les ${exports.DELAI_PAIEMENT_JOURS_OUVRABLES} JOURS OUVRABLES qui suivent la cessation des services.`,
        reserves: [
            "UN SOLDE PARTIEL SE LIT COMME UN SOLDE · dès qu'une rubrique est indéterminée, le total l'est aussi. Le travailleur signe pour ce qui est écrit.",
            livre_de_paie_1.DECOMPTE_A_LA_RUPTURE,
            livre_de_paie_1.SANCTION_ARTICLE_103,
            "CE CALCUL N'EST PAS ENCORE LE DÉCOMPTE ÉCRIT · il le devient à l'ÉMISSION, qui fige le document daté que l'employeur remet au travailleur, dans la numérotation continue des bulletins, avec ses retenues et son net.",
            "LES RETENUES S'APPLIQUENT À L'ÉMISSION · l'assiette sociale, l'assiette fiscale et le barème de l'article 118 valent pour le décompte comme pour un mois ordinaire (`assiettes-paie.ts`, `bareme-irpp.ts`), sur le mois de cessation. Aucune retenue « syndicat » n'est appliquée · l'article 112 énumère les retenues autorisées et ne la nomme pas.",
            ...preavis.reserves,
            ...conge.reserves,
        ],
        propositionGratification: proposition,
    };
}
//# sourceMappingURL=decompte-final.js.map