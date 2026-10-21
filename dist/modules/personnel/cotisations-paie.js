"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_SAISIES_ET_CESSIONS = exports.RESERVE_BAREME_CABINET = exports.ABSTENTION_CNSS_TRANSITOIRE = exports.BAREMES_CNSS = exports.RESERVE_ONEM_ARTICLE_6 = exports.reserveBaremeInppAuMois = exports.RESERVE_ASSIETTE_INPP = exports.BAREMES_ONEM = exports.BAREMES_INPP = exports.RESERVE_REGIME_CNSS_INCONNU = exports.RESERVE_ASSIETTE_ASSIMILE = exports.NON_DUES_APPRENTI = exports.MAJORATIONS_RISQUES_PROFESSIONNELS_POUR_CENT = exports.MAJORATION_RISQUES_PROFESSIONNELS_MAXIMUM = exports.TAUX_CNSS = void 0;
exports.reserveMajorationRisquesProfessionnels = reserveMajorationRisquesProfessionnels;
exports.tauxInpp = tauxInpp;
exports.tauxOnem = tauxOnem;
exports.tauxCnss = tauxCnss;
exports.plancherCnss = plancherCnss;
exports.cotisations = cotisations;
exports.cotisationsExactes = cotisationsExactes;
exports.netAPayer = netAPayer;
exports.netAPayerExact = netAPayerExact;
exports.netNegatifAuCentime = netNegatifAuCentime;
const bareme_smig_1 = require("./bareme-smig");
const au_centime_1 = require("./au-centime");
const decimal_exact_1 = require("../../common/decimal-exact");
const inpp_trimestriel_1 = require("../retenues/inpp-trimestriel");
exports.TAUX_CNSS = {
    prestationsAuxFamilles: { tauxPourCent: 6.5, charge: 'EMPLOYEUR', article: 'article 2' },
    pensionsEmployeur: { tauxPourCent: 5, charge: 'EMPLOYEUR', article: 'article 3' },
    pensionsTravailleur: { tauxPourCent: 5, charge: 'TRAVAILLEUR', article: 'article 3' },
    risquesProfessionnels: { tauxPourCent: 1.5, charge: 'EMPLOYEUR', article: 'article 4' },
};
exports.MAJORATION_RISQUES_PROFESSIONNELS_MAXIMUM = 2;
exports.MAJORATIONS_RISQUES_PROFESSIONNELS_POUR_CENT = [50, 100];
function reserveMajorationRisquesProfessionnels(pourCent) {
    const article = pourCent === 100
        ? "majoré de cent pour cent en cas de RÉCIDIVE (arrêté n° 140/2018, art. 24, al. 3), soit le double que l'article 5 du décret n° 18/041 fixe pour plafond"
        : "majoré de cinquante pour cent (arrêté n° 140/2018, art. 22), le double de l'article 5 du décret n° 18/041 n'étant que le plafond";
    return (`Taux ${article}. La majoration est notifiée par la Caisse · elle court du premier jour du mois civil qui suit ` +
        "la fin du délai de correction et est suspendue à partir du mois qui suit la correction totale des anomalies " +
        "(art. 24, al. 1 et 2). Elle se déclare, elle ne se déduit d'aucun manquement constaté par le logiciel.");
}
exports.NON_DUES_APPRENTI = "CNSS · prestations aux familles et pensions NON DUES · l'apprenti n'est assujetti qu'à la branche des risques professionnels (loi n° 16/009, art. 4, 1° ; arrêté n° 139/2018, art. 1er, 1°), aucune quote-part ouvrière n'est retenue.";
exports.RESERVE_ASSIETTE_ASSIMILE = "Apprenti · travailleur assimilé, la cotisation est à la charge du maître (arrêté n° 139/2018, art. 4, 1°). Pour les assimilés, « les cotisations peuvent être assises sur les revenus fixés par le Conseil d'administration » de la Caisse (loi n° 16/009, art. 13, al. 2) · cette décision n'est pas au corpus, OmegaX garde l'assiette de l'article 7 et le dit.";
exports.RESERVE_REGIME_CNSS_INCONNU = "CNSS · calcul valable pour un travailleur assujetti à toutes les branches (loi n° 16/009, art. 3). Le contrat du mois n'est pas lu · un apprenti ne cotise qu'aux risques professionnels (art. 4).";
exports.BAREMES_INPP = [
    {
        aPartirDu: '2006-02-14',
        reference: "Arrêté interministériel n° 12/MTPS/123, n° 007/CAB/MIN/FINANCES/2006, n° 001/CAB/MIN/BUD/2006 du 14 février 2006, article 1er",
        publicPourCent: 3,
        priveParTranche: [
            { jusqua: 50, tauxPourCent: 3 },
            { jusqua: 300, tauxPourCent: 2 },
            { jusqua: null, tauxPourCent: 1 },
        ],
    },
    {
        aPartirDu: '2025-09-24',
        reference: "Arrêté interministériel n° 002/CAB/MET/2025, n° […]/CAB/MIN/FINANCES/2025, n° 003/CAB/VPM/MIN/BUD/2025 du 24 septembre 2025, article 1er",
        publicPourCent: 4,
        priveParTranche: [
            { jusqua: 50, tauxPourCent: 3.5 },
            { jusqua: 300, tauxPourCent: 3 },
            { jusqua: null, tauxPourCent: 2 },
        ],
    },
];
exports.BAREMES_ONEM = [
    {
        aPartirDu: '2018-08-17',
        tauxPourCent: 0.2,
        reference: "Arrêté ministériel n° 095/CAB/MINETAT/MTEPS/01/2018 du 17 août 2018",
    },
    {
        aPartirDu: '2025-09-25',
        tauxPourCent: 0.5,
        reference: "Arrêté ministériel n° 028/CAB/MIN.ET/FMM/RK/09/2025, article 1er",
    },
];
const RESERVE_ASSIETTE_EMPRUNTEE = "LECTURE · ce texte dit « rémunération » sans renvoyer à l'article 7 du Code du travail. OmegaX retient la même assiette que la CNSS, le mot étant DÉFINI par le Code dont cet arrêté relève. Lue comme le brut versé, l'assiette serait plus large de tout le logement et le transport.";
exports.RESERVE_ASSIETTE_INPP = "Assiette · la cotisation naît de l'article 15 b) du Code du travail, qui ne délègue que le taux à l'arrêté ; « rémunération » s'y lit au sens de l'article 7 du même Code. PAIEMENT · la cotisation est trimestrielle et se verse au plus tard le 30 avril, le 31 juillet, le 31 octobre et le 31 janvier (ordonnance n° 84/186 du 15 octobre 1984, art. 1er et 3). PÉRIODE DE L'ASSIETTE · l'article 15 b) dit « la cotisation mensuelle des employeurs proportionnelle à la somme des rémunérations versées par eux à leur personnel au cours du trimestre précédent ». La paie calcule chaque mois la cotisation sur les rémunérations versées dans le mois, et tient la somme des trois mois pour la cotisation du trimestre payée à l'échéance · c'est une LECTURE, qu'aucun texte n'écrit. L'autre lecture prend pour assiette les rémunérations du trimestre précédent, ce qui décale la cotisation d'un trimestre ; si c'est la vôtre, le montant de ce mois ne vaut pas. Aucun texte ne dit à quelle date se lit l'effectif d'un employeur privé dont la tranche change en cours de trimestre · la paie retient l'effectif déclaré pour le mois.";
const reserveBaremeInppAuMois = (moisDePaie, aPartirDu) => `TAUX INPP DU MOIS · le barème du ${aPartirDu.split('-').reverse().join('/')} change au cours du mois de paie ${moisDePaie}, et le taux s'attache aux « rémunérations versées » (arrêté, art. 1er, en vigueur à sa signature). La date de mise à disposition n'est pas déclarée · le barème en vigueur à la fin du mois est retenu ; une rémunération versée avant le ${aPartirDu.split('-').reverse().join('/')} porte le barème précédent. Déclarez la date de mise à disposition.`;
exports.reserveBaremeInppAuMois = reserveBaremeInppAuMois;
exports.RESERVE_ONEM_ARTICLE_6 = "ONEM, ARRÊTÉ n° 028/2025, art. 6 · « Les contributions non acquittées à la date d'entrée en vigueur du présent Arrêté ainsi que les pénalités y applicables sont calculées conformément au taux fixé aux articles 1er et 3, alinéa 2. » Si la contribution de ce mois n'était pas acquittée le 25 septembre 2025, elle se calcule à 0,5 %, et ses pénalités au nouveau taux · le taux rendu ici est celui du mois de paie.";
const baremeDuMois = (baremes, moisDePaie) => {
    const applicables = baremes.filter((b) => b.aPartirDu.slice(0, 7) <= moisDePaie.slice(0, 7));
    return applicables.length === 0 ? null : applicables[applicables.length - 1];
};
function tauxInpp(moisDePaie, nature, effectif, versionsDossier = [], dateVersement = null) {
    const baremes = fusionner(exports.BAREMES_INPP, versionsDossier);
    const bareme = dateVersement ? baremeAuJour(baremes, dateVersement) : baremeDuMois(baremes, moisDePaie);
    if (!bareme) {
        return {
            tauxPourCent: null,
            source: '',
            motifAbstention: `Aucun barème INPP lu pour le mois ${moisDePaie}.`,
        };
    }
    if (nature === 'PUBLIC') {
        return { tauxPourCent: bareme.publicPourCent, source: bareme.reference, motifAbstention: null, saisieCabinet: bareme.saisieCabinet };
    }
    if (effectif === null || !Number.isFinite(effectif) || effectif <= 0) {
        return {
            tauxPourCent: null,
            source: bareme.reference,
            motifAbstention: "Le taux INPP d'un employeur PRIVÉ dépend de sa tranche d'effectif. Renseignez l'effectif, OmegaX ne choisit pas de tranche.",
        };
    }
    for (const tranche of bareme.priveParTranche) {
        if (tranche.jusqua === null || effectif <= tranche.jusqua) {
            return { tauxPourCent: tranche.tauxPourCent, source: bareme.reference, motifAbstention: null, saisieCabinet: bareme.saisieCabinet };
        }
    }
    return { tauxPourCent: null, source: bareme.reference, motifAbstention: 'Tranche introuvable.' };
}
const baremeAuJour = (baremes, jour) => {
    const applicables = baremes.filter((b) => b.aPartirDu <= jour.slice(0, 10));
    return applicables.length === 0 ? null : applicables[applicables.length - 1];
};
const changementAuCoursDuMois = (baremes, moisDePaie) => baremes.find((b) => b.aPartirDu.slice(0, 7) === moisDePaie.slice(0, 7) && b.aPartirDu.slice(8, 10) !== '01') ?? null;
function tauxOnem(moisDePaie, versionsDossier = []) {
    const bareme = baremeDuMois(fusionner(exports.BAREMES_ONEM, versionsDossier), moisDePaie);
    return bareme
        ? { tauxPourCent: bareme.tauxPourCent, source: bareme.reference, saisieCabinet: bareme.saisieCabinet }
        : { tauxPourCent: null, source: '' };
}
exports.BAREMES_CNSS = [
    {
        aPartirDu: '2018-11-24',
        reference: 'Décret n° 18/041 du 24 novembre 2018, articles 4, 10 (régime transitoire) et 11',
        prestationsAuxFamilles: null,
        pensionsEmployeur: 3.5,
        pensionsTravailleur: 3.5,
        risquesProfessionnels: exports.TAUX_CNSS.risquesProfessionnels.tauxPourCent,
    },
    {
        aPartirDu: '2019-01-01',
        reference: 'Décret n° 18/041 du 24 novembre 2018, articles 2 à 4 et 10',
        prestationsAuxFamilles: exports.TAUX_CNSS.prestationsAuxFamilles.tauxPourCent,
        pensionsEmployeur: exports.TAUX_CNSS.pensionsEmployeur.tauxPourCent,
        pensionsTravailleur: exports.TAUX_CNSS.pensionsTravailleur.tauxPourCent,
        risquesProfessionnels: exports.TAUX_CNSS.risquesProfessionnels.tauxPourCent,
    },
];
exports.ABSTENTION_CNSS_TRANSITOIRE = "CNSS · prestations aux familles, novembre et décembre 2018 · le régime transitoire de l'article 10 du décret n° 18/041 ne fixe ce taux que pour l'ex-province du Katanga (4 % à charge de l'employeur) ; ailleurs le taux antérieur n'est pas au corpus, et OmegaX ne connaît pas la province du dossier.";
function tauxCnss(moisDePaie, versionsDossier = []) {
    return baremeDuMois(fusionner(exports.BAREMES_CNSS, versionsDossier), moisDePaie);
}
exports.RESERVE_BAREME_CABINET = "BARÈME SAISI PAR LE CABINET · OmegaX n'a pas lu ce texte. Le taux et sa référence sont ceux que le cabinet a déclarés, et c'est à lui d'en répondre.";
const fusionner = (livrees, dossier) => [...livrees, ...(dossier ?? []).map((v) => ({ ...v, saisieCabinet: true }))].sort((a, b) => a.aPartirDu < b.aPartirDu ? -1 : a.aPartirDu > b.aPartirDu ? 1 : 0);
const SOURCES_PLANCHER = 'décret n° 18/041, art. 8 · loi n° 16/009, art. 13 · SMIG journalier du manœuvre ordinaire, décret n° 25/22, art. 2 et 7';
function plancherCnss(moisDePaie, assietteSocialeFc, joursPayes, annexesSmig = []) {
    return plancherCnssExact(moisDePaie, (0, decimal_exact_1.depuisNombre)(assietteSocialeFc), joursPayes, annexesSmig).plancher;
}
function plancherCnssExact(moisDePaie, assietteSociale, joursPayes, annexesSmig = []) {
    const assietteExacte = (0, decimal_exact_1.maximum)(decimal_exact_1.ZERO, assietteSociale);
    const assiette = (0, decimal_exact_1.versNombre)(assietteExacte);
    const sur = (plancher, baseExacte) => ({ plancher, baseExacte });
    const applicable = (0, bareme_smig_1.annexeApplicable)(moisDePaie, annexesSmig);
    const annexe = applicable.annexe;
    if (!annexe) {
        return sur({
            baseFc: assiette,
            plancherFc: null,
            applique: false,
            message: `PLANCHER NON VÉRIFIÉ · ${applicable.explication} (${SOURCES_PLANCHER}).`,
        }, assietteExacte);
    }
    const jours = joursPayes ?? bareme_smig_1.MULTIPLICATEURS_ARTICLE_7.MOIS;
    const plancherExact = (0, decimal_exact_1.fois)((0, decimal_exact_1.depuisNombre)(annexe.smigJournalierFc), (0, decimal_exact_1.depuisNombre)(jours));
    const plancher = (0, decimal_exact_1.versNombre)(plancherExact);
    if ((0, au_centime_1.enCentimes)(assiette) >= (0, au_centime_1.enCentimes)(plancher)) {
        return sur({ baseFc: assiette, plancherFc: plancher, applique: false, message: null }, assietteExacte);
    }
    if (joursPayes === undefined || joursPayes === null) {
        return sur({
            baseFc: null,
            plancherFc: null,
            applique: false,
            message: `ASSIETTE SOUS LE PLANCHER · ${assiette} FC contre ${plancher} FC pour un mois entier. Mois incomplet ` +
                `ou rémunération sous le minimum : déclarez les jours payés du mois, et le plancher sera celui de ces ` +
                `jours (${SOURCES_PLANCHER}).`,
        }, null);
    }
    return sur({
        baseFc: plancher,
        plancherFc: plancher,
        applique: true,
        message: `PLANCHER APPLIQUÉ · la base de la CNSS est relevée de ${assiette} FC au SMIG de ${jours} jour(s) payé(s), ` +
            `${plancher} FC (${SOURCES_PLANCHER}). Le relèvement porte sur la base, les taux restent ceux du décret.`,
    }, plancherExact);
}
function cotisations(assietteSocialeFc, parametres) {
    return cotisationsExactes((0, decimal_exact_1.depuisNombre)(assietteSocialeFc), parametres).verdict;
}
function cotisationsExactes(assietteSociale, parametres) {
    const lignes = [];
    const montantsExacts = [];
    const abstentions = [];
    const reserves = [];
    const assietteExacte = (0, decimal_exact_1.maximum)(decimal_exact_1.ZERO, assietteSociale);
    const { plancher, baseExacte: baseCnssExacte } = plancherCnssExact(parametres.moisDePaie, assietteExacte, parametres.joursPayes, parametres.annexesSmig);
    const sourceCnss = "Assiette routée par l'article 13 de la loi n° 16/009 vers l'article 7, litera h du Code du travail, et recopiée à l'article 17, point 1 de l'arrêté n° 146/2018.";
    const poser = (cle, libelle, organisme, charge, tauxPourCent, source, reserve, base = assietteExacte) => {
        const montantExact = (0, decimal_exact_1.pourCent)(base, (0, decimal_exact_1.depuisNombre)(tauxPourCent));
        montantsExacts.push(montantExact);
        lignes.push({
            cle,
            libelle,
            organisme,
            charge,
            tauxPourCent,
            assietteFc: (0, decimal_exact_1.versNombre)(base),
            montantFc: (0, decimal_exact_1.versNombre)(montantExact),
            source,
            reserve,
        });
    };
    const v = parametres.versionsDossier;
    const cnss = tauxCnss(parametres.moisDePaie, v?.cnss);
    let quotePartOuvriereNonChiffree = null;
    if (cnss && plancher.baseFc === null) {
        const motif = `CNSS · ${plancher.message}`;
        abstentions.push(motif);
        quotePartOuvriereNonChiffree = motif;
    }
    else if (!cnss) {
        const motif = `CNSS · aucun barème lu pour le mois ${parametres.moisDePaie} · OmegaX n'en tient aucun avant le 24 novembre 2018 (décret n° 18/041, art. 11).`;
        abstentions.push(motif);
        quotePartOuvriereNonChiffree = motif;
    }
    else {
        const srcCnss = cnss.saisieCabinet ? `${cnss.reference} (saisi par le cabinet).` : `${cnss.reference}. ${sourceCnss}`;
        const reserveCnss = cnss.saisieCabinet ? exports.RESERVE_BAREME_CABINET : null;
        const baseCnss = baseCnssExacte;
        if (plancher.message)
            reserves.push(`CNSS · ${plancher.message}`);
        const apprenti = parametres.regimeCnss === 'APPRENTI';
        if (parametres.regimeCnss === null || parametres.regimeCnss === undefined) {
            reserves.push(exports.RESERVE_REGIME_CNSS_INCONNU);
        }
        if (apprenti) {
            reserves.push(exports.NON_DUES_APPRENTI);
        }
        else {
            if (cnss.prestationsAuxFamilles === null) {
                abstentions.push(exports.ABSTENTION_CNSS_TRANSITOIRE);
            }
            else {
                poser('cnss-pf', 'CNSS · prestations aux familles', 'CNSS', 'EMPLOYEUR', cnss.prestationsAuxFamilles, srcCnss, reserveCnss, baseCnss);
            }
            poser('cnss-pension-employeur', 'CNSS · pensions, part employeur', 'CNSS', 'EMPLOYEUR', cnss.pensionsEmployeur, srcCnss, reserveCnss, baseCnss);
            poser('cnss-pension-travailleur', 'CNSS · pensions, quote-part ouvrière', 'CNSS', 'TRAVAILLEUR', cnss.pensionsTravailleur, srcCnss, reserveCnss ?? "C'est la SEULE cotisation retenue sur la paie, et la seule que l'article 71 de la loi n° 23/053 laisse déduire du brut imposable.", baseCnss);
        }
        const majoration = parametres.majorationRisquesProfessionnelsPourCent ?? null;
        if (majoration !== null && !exports.MAJORATIONS_RISQUES_PROFESSIONNELS_POUR_CENT.includes(majoration)) {
            throw new RangeError(`Majoration des risques professionnels de ${majoration} % · l'arrêté n° 140/2018 n'en connaît que deux, 50 % (art. 22) et 100 % en récidive (art. 24), le double étant le plafond (décret n° 18/041, art. 5).`);
        }
        const coefficient = 1 + (majoration ?? 0) / 100;
        if (coefficient > exports.MAJORATION_RISQUES_PROFESSIONNELS_MAXIMUM)
            throw new RangeError('Majoration au-delà du double.');
        const tauxRp = (0, decimal_exact_1.versNombre)((0, decimal_exact_1.fois)((0, decimal_exact_1.depuisNombre)(cnss.risquesProfessionnels), (0, decimal_exact_1.depuisNombre)(coefficient)));
        const reservesRp = [
            reserveCnss,
            majoration !== null ? reserveMajorationRisquesProfessionnels(majoration) : null,
            apprenti ? exports.RESERVE_ASSIETTE_ASSIMILE : null,
        ].filter((r) => r !== null);
        poser('cnss-rp', 'CNSS · risques professionnels', 'CNSS', 'EMPLOYEUR', tauxRp, srcCnss, reservesRp.length ? reservesRp.join(' ') : null, baseCnss);
    }
    const nature = parametres.natureEmployeurInpp ?? null;
    if (nature === null) {
        abstentions.push("INPP · le taux dépend d'abord de la NATURE de l'employeur, public ou privé. Elle n'est pas renseignée, et OmegaX ne la présume pas.");
    }
    else {
        const dateVersement = parametres.dateMiseADisposition ?? null;
        const inpp = tauxInpp(parametres.moisDePaie, nature, parametres.effectif ?? null, v?.inpp, dateVersement);
        const reduction = parametres.reductionTauxInppPoints ?? null;
        const referenceReduction = parametres.referenceReductionInpp?.trim() || null;
        const motifReduction = inpp.tauxPourCent === null || reduction === null
            ? null
            : referenceReduction === null
                ? "La réduction du taux INPP se déclare avec la référence de l'acte du ministère du Travail qui l'accorde (ordonnance n° 84/186, art. 1er, al. 2) · elle ne se présume pas."
                : (0, inpp_trimestriel_1.motifRefusReductionInpp)(inpp.tauxPourCent, reduction);
        if (inpp.tauxPourCent === null) {
            abstentions.push(`INPP · ${inpp.motifAbstention}`);
        }
        else if (motifReduction !== null) {
            abstentions.push(`INPP · ${motifReduction}`);
        }
        else {
            const changement = dateVersement ? null : changementAuCoursDuMois(fusionner(exports.BAREMES_INPP, v?.inpp), parametres.moisDePaie);
            const reserveInpp = [
                inpp.saisieCabinet ? exports.RESERVE_BAREME_CABINET : null,
                exports.RESERVE_ASSIETTE_INPP,
                changement ? (0, exports.reserveBaremeInppAuMois)(parametres.moisDePaie, changement.aPartirDu) : null,
                reduction !== null && referenceReduction !== null
                    ? (0, inpp_trimestriel_1.reserveReductionInpp)(reduction, referenceReduction, inpp.tauxPourCent)
                    : null,
            ]
                .filter((r) => r !== null)
                .join(' ');
            const tauxApplique = reduction !== null ? Math.round((inpp.tauxPourCent - reduction) * 1000) / 1000 : inpp.tauxPourCent;
            poser('inpp', 'INPP · contribution patronale', 'INPP', 'EMPLOYEUR', tauxApplique, `Code du travail, art. 15 b) · ${inpp.source}`, reserveInpp);
        }
    }
    const onem = tauxOnem(parametres.moisDePaie, v?.onem);
    if (onem.tauxPourCent === null) {
        abstentions.push(`ONEM · aucun barème lu pour le mois ${parametres.moisDePaie}.`);
    }
    else {
        const reserveOnem = [
            onem.saisieCabinet ? exports.RESERVE_BAREME_CABINET : null,
            RESERVE_ASSIETTE_EMPRUNTEE,
            parametres.moisDePaie.slice(0, 7) < '2025-09' ? exports.RESERVE_ONEM_ARTICLE_6 : null,
        ]
            .filter((r) => r !== null)
            .join(' ');
        poser('onem', 'ONEM · contribution patronale', 'ONEM', 'EMPLOYEUR', onem.tauxPourCent, onem.source, reserveOnem);
    }
    const totalExact = (charge) => (0, decimal_exact_1.somme)(montantsExacts.filter((_, i) => lignes[i].charge === charge));
    const totalEmployeurFc = (0, decimal_exact_1.versNombre)(totalExact('EMPLOYEUR'));
    const totalTravailleurExact = totalExact('TRAVAILLEUR');
    return {
        verdict: {
            lignes,
            totalEmployeurFc,
            totalTravailleurFc: (0, decimal_exact_1.versNombre)(totalTravailleurExact),
            coutEmployeurSupplementaireFc: totalEmployeurFc,
            abstentions,
            quotePartOuvriereNonChiffree,
            plancherCnss: plancher,
            reserves,
        },
        totalTravailleurExact,
    };
}
exports.RESERVE_SAISIES_ET_CESSIONS = "Restent hors du net les indemnités compensatoires de l'article 52 et le cautionnement, qui supposent un acte " +
    "propre. LA SAISIE-ARRÊT NOTIFIÉE PAR LE GREFFIER se tient au registre des avances et se retient sur le " +
    "bulletin, du 422 au 42320000 « Personnel, saisies-arrêts » (Guide d'application SYSCOHADA, Partie 1 ch. 3, " +
    "§ 4.3) · l'acte notifié porte le mode de calcul et le montant de la retenue (AUPSRVE, art. 184, 3° et 206), " +
    "la quotité est indisponible dès la notification (art. 187), l'employeur verse chaque mois au greffe ou au " +
    "cessionnaire (art. 188 et 207) et, s'il omet de le faire, il en est déclaré personnellement débiteur " +
    "(art. 189). LA CESSION NOTIFIÉE n'est pas tenue au registre · elle se passe à la main, et le net de ce " +
    "bulletin est à diminuer d'autant.";
function netAPayer(totalVerseFc, quotePartOuvriereFc, irppFc, retenuesAvancesFc = 0) {
    return netAPayerExact((0, decimal_exact_1.depuisNombre)(totalVerseFc), quotePartOuvriereFc === null ? null : (0, decimal_exact_1.depuisNombre)(quotePartOuvriereFc), irppFc, (0, decimal_exact_1.depuisNombre)(retenuesAvancesFc)).verdict;
}
function netAPayerExact(totalVerse, quotePartOuvriere, irppFc, retenuesAvances = decimal_exact_1.ZERO) {
    const totalVerseFc = (0, decimal_exact_1.versNombre)(totalVerse);
    const quotePartOuvriereFc = quotePartOuvriere === null ? null : (0, decimal_exact_1.versNombre)(quotePartOuvriere);
    const avecAvances = (0, decimal_exact_1.comparer)(retenuesAvances, decimal_exact_1.ZERO) > 0;
    const reserves = [
        "LE NET PART DU TOTAL VERSÉ · les cinq exclusions de l'article 7, point 8 du Code du travail sortent de l'ASSIETTE des cotisations, pas de ce que l'employeur paie. Le logement et le transport sont bien versés au travailleur, sauf ceux qu'il reçoit EN NATURE, qui ne sont ni dans ce total ni au 422.",
        avecAvances
            ? `NET APRÈS LES RETENUES DU REGISTRE DES AVANCES (article 112, c, f et g · avances, prêts, saisies-arrêts). ${exports.RESERVE_SAISIES_ET_CESSIONS}`
            : `NET AVANT LES RETENUES DE L'ARTICLE 112 · aucune avance ni aucun prêt n'est retenu sur ce bulletin. ${exports.RESERVE_SAISIES_ET_CESSIONS}`,
        "LA QUOTITÉ SAISISSABLE DE L'ARTICLE 114 EST CALCULÉE À PART · sur le minimum de la classe (décret n° 25/22) et après la défalcation du logement fourni en nature (arrêté n° 12/CAB.MIN/TPS/110/2005, art. 10). Elle dit ce qu'une saisie-arrêt ou une cession pourrait atteindre, et n'est retenue sur aucun bulletin.",
    ];
    const netExact = irppFc === null || quotePartOuvriere === null
        ? null
        : (0, decimal_exact_1.moins)((0, decimal_exact_1.maximum)(decimal_exact_1.ZERO, (0, decimal_exact_1.moins)((0, decimal_exact_1.moins)(totalVerse, quotePartOuvriere), (0, decimal_exact_1.depuisNombre)(irppFc))), retenuesAvances);
    return {
        verdict: {
            totalVerseFc,
            quotePartOuvriereFc,
            irppFc,
            netAPayerFc: netExact === null ? null : (0, decimal_exact_1.versNombre)(netExact),
            reserves,
        },
        netExact,
    };
}
function netNegatifAuCentime(net) {
    return (0, decimal_exact_1.centimesLoinDeZero)(net) < 0n;
}
//# sourceMappingURL=cotisations-paie.js.map