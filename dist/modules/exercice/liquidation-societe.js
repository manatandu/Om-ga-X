"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOTALISATION_ARTICLE_12_AL_4 = exports.FORMES_EN_LIQUIDATION = exports.ETAPE_LIQUIDATION = void 0;
exports.formeEnLiquidation = formeEnLiquidation;
exports.plusMois = plusMois;
exports.autreLectureDuMois = autreLectureDuMois;
exports.lendemainDe = lendemainDe;
exports.estExerciceDeLiquidation = estExerciceDeLiquidation;
exports.situationsAnnuelles = situationsAnnuelles;
exports.sansLiquidation = sansLiquidation;
exports.estFinSansLiquidation = estFinSansLiquidation;
exports.jalonsLiquidation = jalonsLiquidation;
exports.cotisationsDues = cotisationsDues;
exports.echeanceDansLeMois = echeanceDansLeMois;
exports.echeanceDerniereCotisation = echeanceDerniereCotisation;
exports.exercicePorteurSecondeCotisation = exercicePorteurSecondeCotisation;
exports.impotAnnuelCedeAuxCotisations = impotAnnuelCedeAuxCotisations;
exports.cotisationsSpeciales = cotisationsSpeciales;
exports.echeancierDissolution = echeancierDissolution;
const client_1 = require("@prisma/client");
const echeance_1 = require("../../common/echeance");
const mentions_societe_1 = require("../tenant/mentions-societe");
const jour_ouvrable_1 = require("../retenues/jour-ouvrable");
const portefeuille_etat_1 = require("./portefeuille-etat");
exports.ETAPE_LIQUIDATION = 27;
const SANCTION_902_1 = 'Article 902, 1° de l’AUSCGIE · encourt une sanction pénale le liquidateur qui, sciemment, n’a pas, dans le délai ' +
    'd’un mois à compter de sa nomination, publié l’acte le nommant liquidateur et déposé au registre du commerce et ' +
    'du crédit mobilier les décisions prononçant la dissolution.';
const SANCTION_902_2_3 = 'Article 902, 2° et 3° de l’AUSCGIE · encourt une sanction pénale le liquidateur qui, sciemment, n’a pas convoqué ' +
    'les associés en fin de liquidation pour statuer sur le compte définitif, le quitus et la décharge et constater la ' +
    'clôture, ou n’a pas, dans le cas de l’article 219, déposé ses comptes définitifs au registre du commerce et du ' +
    'crédit mobilier, ni demandé en justice leur approbation.';
const SANCTION_903_1 = 'Article 903, 1° de l’AUSCGIE (liquidation sur décision judiciaire) · encourt une sanction pénale le liquidateur ' +
    'qui, sciemment, n’a pas, dans les six mois de sa nomination, présenté un rapport sur la situation active et ' +
    'passive de la société et sur la poursuite des opérations, ni sollicité les autorisations nécessaires.';
const SANCTION_903_2 = 'Article 903, 2° de l’AUSCGIE (liquidation sur décision judiciaire) · encourt une sanction pénale le liquidateur ' +
    'qui, sciemment, n’a pas, dans les trois mois de la clôture de chaque exercice, établi les états financiers de ' +
    'synthèse au vu de l’inventaire et un rapport écrit rendant compte des opérations de la liquidation.';
exports.FORMES_EN_LIQUIDATION = [
    ...mentions_societe_1.FORMES_SOCIETES_COMMERCIALES,
    client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
];
function formeEnLiquidation(forme) {
    return !!forme && exports.FORMES_EN_LIQUIDATION.includes(forme);
}
function plusMois(d, n) {
    const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(d.getUTCDate(), dernier)));
}
function autreLectureDuMois(evenement, n) {
    const dernierDuMois = new Date(Date.UTC(evenement.getUTCFullYear(), evenement.getUTCMonth() + 1, 0)).getUTCDate();
    if (evenement.getUTCDate() !== dernierDuMois)
        return null;
    const finDuMoisDArrivee = new Date(Date.UTC(evenement.getUTCFullYear(), evenement.getUTCMonth() + n + 1, 0));
    const servie = plusMois(evenement, n);
    return finDuMoisDArrivee.getTime() === servie.getTime() ? null : finDuMoisDArrivee;
}
const dansLExercice = (d, e) => d.getTime() >= e.dateDebut.getTime() && d.getTime() <= e.dateFin.getTime();
const JOUR_MS = 86_400_000;
function lendemainDe(d) {
    return new Date(d.getTime() + JOUR_MS);
}
function estExerciceDeLiquidation(exercice, dateDissolution) {
    return !!dateDissolution && exercice.dateDebut.getTime() === lendemainDe(dateDissolution).getTime();
}
function situationsAnnuelles(dissolution, exercice, clotureLiquidation) {
    const situations = [];
    for (let a = exercice.dateDebut.getUTCFullYear(); a <= exercice.dateFin.getUTCFullYear(); a++) {
        const d = new Date(Date.UTC(a, 11, 31));
        if (d.getTime() <= dissolution.getTime() || !dansLExercice(d, exercice))
            continue;
        if (clotureLiquidation && d.getTime() >= clotureLiquidation.getTime())
            continue;
        situations.push(d);
    }
    return situations;
}
function sansLiquidation(faits) {
    return (!!faits.forme &&
        mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(faits.forme) &&
        faits.associeUniquePersonneMorale === true &&
        faits.regimeLiquidation !== client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE);
}
function estFinSansLiquidation(exercice, dossier) {
    return (!!dossier.dateDissolution &&
        exercice.dateFin.getTime() === dossier.dateDissolution.getTime() &&
        sansLiquidation({
            forme: dossier.formeJuridiqueSyscohada,
            regimeLiquidation: dossier.regimeLiquidation,
            associeUniquePersonneMorale: dossier.associeUniquePersonneMorale,
        }));
}
exports.TOTALISATION_ARTICLE_12_AL_4 = 'Lorsqu’il est dressé des bilans successifs au cours d’une même année, les résultats en sont totalisés pour ' +
    'l’assiette de l’impôt dû au titre de ladite année · la première cotisation se calcule sur la période ' +
    'd’activité, la seconde sur le total de l’année de la dissolution, moins ce qui est déjà réglé (État > ' +
    'Résultat fiscal, sur l’exercice de liquidation).';
function jalonsLiquidation(faits, exercice, aujourdHui) {
    const dissolution = faits.dateDissolution;
    if (!dissolution || !formeEnLiquidation(faits.forme))
        return [];
    if (exercice.dateFin.getTime() < dissolution.getTime())
        return [];
    const cooperative = faits.forme === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE;
    const sanction = (texte) => (cooperative ? null : texte);
    const clotureDeclaree = faits.dateClotureLiquidation ?? null;
    const jalon = (j) => ({
        etape: exports.ETAPE_LIQUIDATION,
        ...j,
        sanction: j.sanction ?? null,
        enRetard: j.echeance !== null && (0, echeance_1.echeanceDepassee)(j.echeance, aujourdHui) && !(j.observation?.satisfait ?? false),
    });
    const exerciceDeDissolution = dansLExercice(dissolution, exercice);
    if (faits.regimeLiquidation === client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE) {
        return [
            jalon({
                libelle: 'Liquidation dans une procédure collective',
                detail: 'La liquidation intervient dans le cadre de l’Acte uniforme portant organisation des procédures ' +
                    'collectives d’apurement du passif · les dispositions générales de la liquidation des sociétés ne ' +
                    's’appliquent pas, et aucun jalon n’est calculé ici. La décision qui prononce la liquidation des biens ' +
                    'emporte dessaisissement du débiteur, ses actes étant accomplis par le syndic' +
                    (faits.associeUniquePersonneMorale === true
                        ? ' · la transmission universelle du patrimoine à l’associé unique personne morale ne joue pas.'
                        : '.'),
                nature: 'LEGALE',
                source: faits.associeUniquePersonneMorale === true
                    ? 'AUSCGIE, art. 200, 6°, 201 al. 4 et 203 al. 2 ; AUPCAP, art. 53'
                    : 'AUSCGIE, art. 203 al. 2 ; AUPCAP, art. 53',
                debut: dissolution,
                echeance: null,
                observation: { libelle: 'Hors des articles 203 à 241 de l’AUSCGIE', satisfait: true },
            }),
        ];
    }
    if (sansLiquidation(faits)) {
        return exerciceDeDissolution
            ? [
                jalon({
                    libelle: 'Dissolution sans liquidation · associé unique personne morale',
                    detail: 'Tous les titres étant détenus par un seul associé personne morale, la dissolution « entraîne la ' +
                        'transmission universelle du patrimoine de la société à cet associé, sans qu’il y ait lieu à ' +
                        'liquidation » · aucun jalon de liquidation n’est servi, et les pièces ne portent pas la mention ' +
                        '« société en liquidation ». La transmission n’est réalisée qu’à l’issue du délai d’opposition des ' +
                        'créanciers (trente jours de la publication de la dissolution).',
                    nature: 'LEGALE',
                    source: 'AUSCGIE, art. 201 al. 4 et 202',
                    debut: dissolution,
                    echeance: null,
                    observation: { libelle: 'Aucune liquidation à conduire', satisfait: true },
                }),
            ]
            : [];
    }
    const jalons = [];
    const nomination = faits.dateNominationLiquidateur;
    if (exerciceDeDissolution) {
        jalons.push(jalon({
            libelle: 'Bilan avant liquidation',
            detail: 'Au début de la liquidation · inventaire du patrimoine, solde des amortissements et des provisions ' +
                'existants, établissement du bilan avant liquidation à la date de dissolution. Le texte ne fixe AUCUN ' +
                'DÉLAI · aucune échéance n’est calculée. La continuité d’exploitation n’étant plus assurée, ' +
                'l’évaluation des biens est reconsidérée (AUDCIF art. 39). Les opérations de liquidation passent aux ' +
                'comptes 837 et 847, leur résultat au 1384 « Résultat de liquidation », le capital à rembourser aux ' +
                'associés au 4619. Les actes et documents destinés aux tiers portent la mention « société en ' +
                (cooperative
                    ? 'liquidation » et le nom du ou des liquidateurs (AUSCOOP art. 183).'
                    : 'liquidation » et le nom du ou des liquidateurs (AUSCGIE art. 204).'),
            nature: 'LEGALE',
            source: cooperative
                ? 'AUDCIF, Titre VIII ch. 40 § 2.1 et § 2.2 ; Titre VII, compte 13 (1384) ; art. 39 ; AUSCOOP, art. 180 et 183'
                : 'AUDCIF, Titre VIII ch. 40 § 2.1 et § 2.2 ; Titre VII, compte 13 (1384) ; art. 39 ; AUSCGIE, art. 204',
            debut: dissolution,
            echeance: null,
            sansDelai: true,
        }));
    }
    if (!cooperative && (nomination ? dansLExercice(nomination, exercice) : exerciceDeDissolution)) {
        const publication = nomination ? plusMois(nomination, 1) : null;
        jalons.push(jalon({
            libelle: 'Publication de la nomination du liquidateur',
            detail: 'L’acte de nomination du ou des liquidateurs, quelle que soit sa forme, est publié dans un journal ' +
                'habilité à recevoir les annonces légales dans le délai d’un mois à compter de la nomination. ' +
                (nomination
                    ? 'Délai compté depuis la nomination déclarée.'
                    : 'Échéance non calculée · déclarez la date de nomination dans Paramètres du dossier.'),
            nature: 'LEGALE',
            source: 'AUSCGIE, art. 266',
            sanction: SANCTION_902_1,
            debut: nomination,
            echeance: publication,
        }));
    }
    const cloture = plusMois(dissolution, 36);
    const observationCloture = (0, portefeuille_etat_1.observationDuFait)({ passe: 'Liquidation clôturée', prevu: 'Clôture prévue' }, faits.dateClotureLiquidation ?? null, cloture, aujourdHui);
    jalons.push(jalon({
        libelle: 'Clôture de la liquidation',
        detail: 'La clôture de la liquidation intervient dans un délai de trois ans à compter de la dissolution. À défaut, ' +
            'le ministère public ou tout intéressé peut saisir la juridiction compétente du siège afin qu’il soit ' +
            'procédé à la liquidation ou à son achèvement. Déclarez la date de clôture dans Paramètres du dossier.',
        nature: 'LEGALE',
        source: cooperative ? 'AUSCOOP, art. 191' : 'AUSCGIE, art. 216',
        debut: dissolution,
        echeance: cloture,
        observation: observationCloture,
    }), jalon({
        libelle: 'Comptes définitifs, assemblée de clôture et dépôt au registre',
        detail: cooperative
            ? 'Les comptes définitifs établis par le liquidateur sont déposés auprès de l’autorité chargée des sociétés ' +
                'coopératives, avec la décision de l’assemblée des coopérateurs statuant sur les comptes de la liquidation, ' +
                'le quitus et la décharge du liquidateur, ou à défaut la décision de justice. Le liquidateur demande la ' +
                'radiation au Registre des Sociétés Coopératives dans le mois de la publication de la clôture · délai non ' +
                'calculé, la date de cette publication n’étant pas déclarée.'
            : 'En fin de liquidation, les associés sont convoqués pour statuer sur les comptes définitifs, le quitus et ' +
                'la décharge du liquidateur, et constater la clôture ; les comptes définitifs sont déposés au registre du ' +
                'commerce et du crédit mobilier avec cette décision, ou avec la décision de justice qui en tient lieu. Le ' +
                'texte ne fixe aucun délai pour ces actes, sinon la clôture dans les trois ans. Le liquidateur demande la ' +
                'radiation dans le mois de la publication de la clôture · délai non calculé, la date de cette publication ' +
                'n’étant pas déclarée.',
        nature: 'LEGALE',
        source: cooperative ? 'AUSCOOP, art. 192 et 193' : 'AUSCGIE, art. 217, 218, 219 et 220',
        sanction: sanction(SANCTION_902_2_3),
        debut: null,
        echeance: null,
        sansDelai: true,
    }));
    if (faits.regimeLiquidation === null) {
        jalons.push(jalon({
            libelle: 'Régime de la liquidation à déclarer',
            detail: cooperative
                ? 'Le régime de la liquidation n’est pas déclaré · selon les statuts, aucun article de l’AUSCGIE ne ' +
                    's’applique ; à défaut de clauses statutaires, la liquidation suit les articles 203 à 241 de l’AUSCGIE, ' +
                    'états annuels et assemblée du liquidateur compris (articles 228, 232 et 233). Déclarez-le dans ' +
                    'Paramètres du dossier.'
                : 'Le régime de la liquidation n’est pas déclaré · les états annuels et l’assemblée du liquidateur ' +
                    '(articles 228, 232 et 233) ne s’appliquent que dans les deux cas de l’article 223, et la seule ' +
                    'situation annuelle provisoire de l’AUDCIF dans les autres. Déclarez-le dans Paramètres du dossier.',
            nature: 'LEGALE',
            source: cooperative ? 'AUSCOOP, art. 182 et 196 ; AUDCIF, art. 7 al. 4' : 'AUSCGIE, art. 203 et 223 ; AUDCIF, art. 7 al. 4',
            debut: dissolution,
            echeance: null,
        }));
        return jalons;
    }
    const chapitre2 = faits.regimeLiquidation === client_1.RegimeLiquidation.ARTICLE_223_1 ||
        faits.regimeLiquidation === client_1.RegimeLiquidation.ARTICLE_223_2_JUDICIAIRE;
    const judiciaire = faits.regimeLiquidation === client_1.RegimeLiquidation.ARTICLE_223_2_JUDICIAIRE;
    if (chapitre2) {
        if (nomination ? dansLExercice(nomination, exercice) : exerciceDeDissolution) {
            const rapport = nomination ? plusMois(nomination, 6) : null;
            jalons.push(jalon({
                libelle: 'Rapport du liquidateur à l’assemblée des associés',
                detail: 'Dans les six mois de sa nomination, le liquidateur convoque l’assemblée des associés et lui fait ' +
                    'rapport sur l’actif et le passif, la poursuite des opérations et le délai pour les terminer · délai ' +
                    'portable à douze mois par décision de justice. ' +
                    (nomination ? '' : 'Échéance non calculée · déclarez la date de nomination.'),
                nature: 'LEGALE',
                source: cooperative ? 'AUSCOOP, art. 196 ; AUSCGIE, art. 223 et 228' : 'AUSCGIE, art. 223 et 228',
                sanction: judiciaire ? sanction(SANCTION_903_1) : null,
                debut: nomination,
                echeance: rapport,
            }));
        }
        const avantLaCloture = (echeance) => !clotureDeclaree || echeance.getTime() <= clotureDeclaree.getTime();
        const source232 = cooperative
            ? 'AUSCOOP, art. 196 ; AUSCGIE, art. 223 et 232 ; AUDCIF, art. 7 al. 2 et 4'
            : 'AUSCGIE, art. 223 et 232 ; AUDCIF, art. 7 al. 2 et 4';
        const source233 = cooperative ? 'AUSCOOP, art. 196 ; AUSCGIE, art. 225 et 233' : 'AUSCGIE, art. 225 et 233';
        for (const situation of situationsAnnuelles(dissolution, exercice, clotureDeclaree)) {
            const etats = plusMois(situation, 3);
            const assemblee = plusMois(situation, 6);
            jalons.push(...(avantLaCloture(etats) ? [jalon({
                    libelle: 'États financiers annuels et rapport écrit du liquidateur',
                    detail: `Situation au ${(0, portefeuille_etat_1.jourFr)(situation)} · dans les trois mois de la clôture de l’exercice, le liquidateur ` +
                        'établit les états financiers de synthèse annuels au vu de l’inventaire, et un rapport écrit rendant ' +
                        'compte des opérations de la liquidation au cours de l’exercice écoulé. La liquidation formant un seul ' +
                        'exercice, ces états sont les situations annuelles provisoires, arrêtées à chaque 31 décembre.',
                    nature: 'LEGALE',
                    source: source232,
                    sanction: judiciaire ? sanction(SANCTION_903_2) : null,
                    debut: situation,
                    echeance: etats,
                })] : []), ...(avantLaCloture(assemblee) ? [jalon({
                    libelle: 'Assemblée des associés sur les états annuels de liquidation',
                    detail: `Situation au ${(0, portefeuille_etat_1.jourFr)(situation)} · sauf dispense de la juridiction compétente, le liquidateur ` +
                        'convoque l’assemblée des associés au moins une fois par an et dans les six mois de la clôture de ' +
                        'l’exercice · elle statue sur les états financiers annuels et renouvelle, le cas échéant, le mandat du ' +
                        'commissaire aux comptes, qui reste en fonctions. Si l’assemblée n’est pas réunie, le rapport écrit du ' +
                        'liquidateur est déposé au registre du commerce et du crédit mobilier.',
                    nature: 'LEGALE',
                    source: source233,
                    debut: situation,
                    echeance: assemblee,
                })] : []));
        }
    }
    else {
        for (const situation of situationsAnnuelles(dissolution, exercice, clotureDeclaree)) {
            jalons.push(jalon({
                libelle: 'Situation annuelle provisoire de liquidation',
                detail: `Situation au ${(0, portefeuille_etat_1.jourFr)(situation)} · la durée des opérations de liquidation compte pour un seul ` +
                    'exercice, sous réserve de situations annuelles provisoires, arrêtées à chaque 31 décembre que ' +
                    'l’exercice traverse (situation intermédiaire du logiciel). Le texte ne fixe AUCUN DÉLAI pour les ' +
                    'établir · aucune échéance n’est calculée. ' +
                    (cooperative
                        ? 'Liquidation amiable selon les statuts · les articles 203 à 241 de l’AUSCGIE ne s’appliquent pas.'
                        : 'Liquidation amiable selon les statuts · les articles 224 à 241 ne s’appliquent pas.'),
                nature: 'LEGALE',
                source: cooperative ? 'AUDCIF, art. 7 al. 2 et 4 ; AUSCOOP, art. 182 et 196' : 'AUDCIF, art. 7 al. 2 et 4 ; AUSCGIE, art. 223',
                debut: situation,
                echeance: null,
                sansDelai: true,
            }));
        }
    }
    return jalons;
}
function cotisationsDues(faits) {
    return !!faits.dateDissolution && formeEnLiquidation(faits.forme);
}
const RESERVE_COOPERATIVE_EXEMPTEE = ' La coopérative agricole de production, de transformation, de conservation ou de vente qui revêt la forme ' +
    'civile est exemptée de l’impôt sur les sociétés et ne doit pas ces cotisations · le dossier ne porte pas ce ' +
    'fait, à vérifier par le cabinet.';
function echeanceDansLeMois(evenement) {
    return (0, jour_ouvrable_1.reporterAuJourOuvrable)(plusMois(evenement, 1), 'DECLARATION');
}
function mentionAutreLecture(evenement) {
    const autre = autreLectureDuMois(evenement, 1);
    return autre
        ? ` Lu de quantième à veille de quantième (Code de procédure civile de 1960, art. 195), le mois finirait le ` +
            `${(0, portefeuille_etat_1.jourFr)(autre)} · l’échéance servie est la plus précoce, qui satisfait les deux lectures.`
        : '';
}
function echeanceDerniereCotisation(faits) {
    if (!faits.dateDissolution)
        return null;
    if (sansLiquidation(faits))
        return echeanceDansLeMois(faits.dateDissolution);
    return faits.dateClotureLiquidation ? echeanceDansLeMois(faits.dateClotureLiquidation) : null;
}
function exercicePorteurSecondeCotisation(exercices, faits) {
    const dissolution = faits.dateDissolution;
    if (!dissolution || !cotisationsDues(faits) || sansLiquidation(faits))
        return null;
    const cloture = faits.dateClotureLiquidation ?? null;
    if (cloture) {
        const contient = exercices.find((e) => dansLExercice(cloture, e));
        if (contient)
            return contient.id;
    }
    const liquidation = exercices.find((e) => estExerciceDeLiquidation(e, dissolution));
    if (liquidation)
        return liquidation.id;
    const apres = exercices
        .filter((e) => e.dateFin.getTime() >= dissolution.getTime())
        .sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime());
    return apres[0]?.id ?? null;
}
function impotAnnuelCedeAuxCotisations(faits, exercice) {
    return (cotisationsDues(faits) && exercice.dateFin.getUTCFullYear() >= faits.dateDissolution.getUTCFullYear());
}
function cotisationsSpeciales(faits, exercice, aujourdHui, options = {}) {
    const dissolution = faits.dateDissolution;
    if (!dissolution || !cotisationsDues(faits))
        return [];
    if (exercice.dateFin.getTime() < dissolution.getTime())
        return [];
    const cooperative = faits.forme === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE;
    const reserveCooperative = cooperative ? RESERVE_COOPERATIVE_EXEMPTEE : '';
    const enRetard = (echeance, observation) => echeance !== null && (0, echeance_1.echeanceDepassee)(echeance, aujourdHui) && !(observation?.satisfait ?? false);
    const quitterLaRdc = ' et, en tout cas, avant que le dirigeant ne quitte la République démocratique du Congo.';
    const jalons = [];
    if (dansLExercice(dissolution, exercice)) {
        const echeance = echeanceDansLeMois(dissolution);
        const observation = (0, portefeuille_etat_1.observationDuFait)({ passe: 'Déclarée', prevu: 'Déclaration prévue' }, faits.dateDeclarationCotisationActivite ?? null, echeance, aujourdHui);
        const arrete = exercice.dateFin.getTime() === dissolution.getTime();
        jalons.push({
            etape: 15,
            libelle: 'Déclaration de la cotisation spéciale (période d’activité)',
            detail: 'En cas de dissolution, une cotisation spéciale est réglée immédiatement d’après les résultats de la ' +
                'période pendant laquelle l’activité a été exercée · la déclaration se remet dans le mois de la ' +
                `dissolution${quitterLaRdc}${mentionAutreLecture(dissolution)} ` +
                (arrete
                    ? 'L’exercice est arrêté à la date de dissolution · son bilan est le bilan avant liquidation. '
                    : 'L’exercice n’est pas arrêté à la date de dissolution · arrêtez-le dans la fenêtre Exercices, la loi ' +
                        'fiscale exigeant l’arrêté des comptes en cas de cessation en cours d’année. ') +
                (sansLiquidation(faits)
                    ? 'Sans liquidation, cette cotisation est la seule de l’année de la dissolution. '
                    : `${exports.TOTALISATION_ARTICLE_12_AL_4} `) +
                `Déclarez la date de dépôt dans Paramètres du dossier.${reserveCooperative}`,
            nature: 'LEGALE',
            source: 'Loi n° 23/053, art. 3, 12 al. 1 et 4 et art. 13 al. 1 et 3 ; loi de procédures fiscales, art. 16 et 110 bis ; ' +
                'AUDCIF, Titre VIII ch. 40 § 2.1 ; AUPSRVE, art. 1-14 (délai en mois)',
            sanction: null,
            debut: dissolution,
            echeance,
            observation,
            enRetard: enRetard(echeance, observation),
        });
    }
    if (!sansLiquidation(faits)) {
        const clotureL = faits.dateClotureLiquidation ?? null;
        const porteur = options.porteurSeconde ??
            (clotureL
                ? dansLExercice(clotureL, exercice)
                : estExerciceDeLiquidation(exercice, dissolution) ||
                    (!exercice.clos && exercice.dateDebut.getTime() > dissolution.getTime()));
        if (porteur) {
            const echeance = clotureL ? echeanceDansLeMois(clotureL) : null;
            const observation = (0, portefeuille_etat_1.observationDuFait)({ passe: 'Déclarée', prevu: 'Déclaration prévue' }, faits.dateDeclarationCotisationLiquidation ?? null, echeance, aujourdHui);
            const enAttente = !clotureL && !exercice.clos && aujourdHui.getTime() <= exercice.dateFin.getTime();
            const horsExercice = clotureL && !dansLExercice(clotureL, exercice);
            jalons.push({
                etape: 15,
                libelle: 'Déclaration de la cotisation spéciale (dernier bilan de liquidation)',
                detail: 'En cas de dissolution suivie de liquidation, une autre cotisation spéciale est réglée d’après les ' +
                    'résultats accusés par le dernier bilan de liquidation, rattachée à l’exercice désigné par le millésime de ' +
                    `l’année de la dissolution · la déclaration se remet dans le mois de la clôture de la liquidation${quitterLaRdc} ` +
                    (clotureL
                        ? `Délai compté depuis la clôture déclarée le ${(0, portefeuille_etat_1.jourFr)(clotureL)}.${mentionAutreLecture(clotureL)} ` +
                            (horsExercice
                                ? `Cette clôture tombe hors de l’exercice (du ${(0, portefeuille_etat_1.jourFr)(exercice.dateDebut)} au ${(0, portefeuille_etat_1.jourFr)(exercice.dateFin)}) · ` +
                                    'portez la fin de l’exercice de liquidation à la date de clôture. '
                                : '')
                        : 'Échéance non calculée · déclarez la date de clôture de la liquidation dans Paramètres du dossier une ' +
                            'fois intervenue. ') +
                    exports.TOTALISATION_ARTICLE_12_AL_4 +
                    reserveCooperative,
                nature: 'LEGALE',
                source: 'Loi n° 23/053, art. 11, 1°, 12 al. 4 et 13 al. 2 et 3 ; loi de procédures fiscales, art. 16 et 110 bis ; ' +
                    'AUPSRVE, art. 1-14 (délai en mois)',
                sanction: null,
                debut: clotureL,
                echeance,
                ...(enAttente ? { enAttente: 'En attente de la clôture de la liquidation' } : {}),
                observation,
                enRetard: enRetard(echeance, observation),
            });
        }
    }
    return jalons;
}
function echeancierDissolution(faits, reference) {
    const dissolution = faits.dateDissolution;
    if (!dissolution || !cotisationsDues(faits)) {
        return { cotisationsDues: false, retenir: () => true, mentionAcompte: null, cotisations: [], avertissements: [] };
    }
    const anneeDissolution = dissolution.getUTCFullYear();
    const derniere = echeanceDerniereCotisation(faits);
    const acompte = /^(premier|deuxieme|troisieme)AcompteIs$/;
    const retenir = (cle, prochaine) => {
        if (cle === 'declarationImpotSocietes')
            return prochaine.getUTCFullYear() - 1 < anneeDissolution;
        if (acompte.test(cle)) {
            const annee = prochaine.getUTCFullYear();
            if (annee < anneeDissolution)
                return true;
            if (annee > anneeDissolution)
                return false;
            return !derniere || prochaine.getTime() < derniere.getTime();
        }
        return true;
    };
    const cotisations = [];
    const avertissements = [];
    const aServir = (date, deposee) => !deposee && !(0, echeance_1.echeanceDepassee)(date, reference);
    const premiere = echeanceDansLeMois(dissolution);
    if (aServir(premiere, faits.dateDeclarationCotisationActivite)) {
        cotisations.push({
            cle: 'cotisationSpecialeActivite',
            libelle: 'Déclaration de la cotisation spéciale (période d’activité)',
            date: premiere,
            echeance: `Dans le mois de la dissolution du ${(0, portefeuille_etat_1.jourFr)(dissolution)}, et en tout cas avant que le dirigeant ne quitte ` +
                `la République démocratique du Congo${mentionAutreLecture(dissolution)}`,
            baseLegale: 'Loi n° 23/053, art. 13 al. 1 et 3 · « une cotisation spéciale est réglée immédiatement par chaque société ' +
                'd’après les résultats de la période pendant laquelle l’activité a été exercée » ; loi de procédures ' +
                'fiscales, art. 16 et 110 bis',
            reserve: null,
        });
    }
    if (!sansLiquidation(faits)) {
        const cloture = faits.dateClotureLiquidation ?? null;
        if (cloture) {
            const seconde = echeanceDansLeMois(cloture);
            if (aServir(seconde, faits.dateDeclarationCotisationLiquidation)) {
                cotisations.push({
                    cle: 'cotisationSpecialeLiquidation',
                    libelle: 'Déclaration de la cotisation spéciale (dernier bilan de liquidation)',
                    date: seconde,
                    echeance: `Dans le mois de la clôture de la liquidation du ${(0, portefeuille_etat_1.jourFr)(cloture)}, et en tout cas avant que le ` +
                        `dirigeant ne quitte la République démocratique du Congo${mentionAutreLecture(cloture)}`,
                    baseLegale: 'Loi n° 23/053, art. 12 al. 4 et 13 al. 2 et 3 · impôt de l’année de la dissolution, sur le total des ' +
                        'résultats de la période d’activité et de la liquidation, moins ce qui est déjà réglé ; loi de procédures ' +
                        'fiscales, art. 16 et 110 bis',
                    reserve: null,
                });
            }
        }
        else if (!faits.dateDeclarationCotisationLiquidation) {
            avertissements.push('Société dissoute · la seconde cotisation spéciale (dernier bilan de liquidation) se déclare dans le mois de ' +
                'la clôture de la liquidation · échéance non calculée tant que la clôture n’est pas déclarée dans ' +
                'Paramètres du dossier. Les acomptes de l’année de la dissolution restent dus jusque-là.');
        }
    }
    const mentionAcompte = 'Société dissoute · acompte de l’année de la dissolution, à déduire de la cotisation spéciale dont la ' +
        'déclaration le suit (LPF art. 57 bis, al. 3) ; aucun acompte n’est dû pour les années suivantes.';
    return { cotisationsDues: true, retenir, mentionAcompte, cotisations, avertissements };
}
//# sourceMappingURL=liquidation-societe.js.map