"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_REGIME_NON_DECLARE = exports.REGIMES_SALARIAUX = exports.FORFAITS_ARRETE_019_2025 = exports.TRANCHES_IRPP_MENSUELLES = exports.MOIS_PAR_AN = exports.TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT = exports.IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC = exports.BORNE_TROISIEME_TRANCHE = exports.SEUIL_OU_LE_PLAFOND_MORD = exports.arrondirAuMillierInferieur = exports.PAS_D_ARRONDI_ASSIETTE_FC = exports.MAXIMUM_PERSONNES_A_CHARGE = exports.QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT = exports.PLAFOND_IMPOT_POUR_CENT = exports.TRANCHES_IRPP = exports.LOI_IRPP = exports.PREMIER_EXERCICE_IRPP = void 0;
exports.impotDuBareme = impotDuBareme;
exports.impotAnnuel = impotAnnuel;
exports.detailMensuel = detailMensuel;
exports.retenueMensuelle = retenueMensuelle;
exports.regimeApplicable = regimeApplicable;
exports.baremeApplicableAuMois = baremeApplicableAuMois;
const arrondi_article_150_1 = require("../fiscalite/arrondi-article-150");
const decimal_exact_1 = require("../../common/decimal-exact");
exports.PREMIER_EXERCICE_IRPP = 2026;
exports.LOI_IRPP = {
    reference: 'Loi n° 23/053 du 30 novembre 2023',
    articleBareme: 'article 118',
    entreeEnVigueur: '2026-01-01',
    regimeAnterieur: "OmegaX ne calcule pas l'impôt sur les rémunérations avant cette date.",
};
exports.TRANCHES_IRPP = [
    { jusqua: 1_944_000, tauxPourCent: 3 },
    { jusqua: 21_600_000, tauxPourCent: 15 },
    { jusqua: 43_200_000, tauxPourCent: 30 },
    { jusqua: null, tauxPourCent: 40 },
];
exports.PLAFOND_IMPOT_POUR_CENT = 30;
exports.QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT = 2;
exports.MAXIMUM_PERSONNES_A_CHARGE = 9;
exports.PAS_D_ARRONDI_ASSIETTE_FC = 1_000;
const arrondirAuMillierInferieur = (montantFc) => (0, decimal_exact_1.plancherAuMultiple)((0, decimal_exact_1.exact)(montantFc), exports.PAS_D_ARRONDI_ASSIETTE_FC);
exports.arrondirAuMillierInferieur = arrondirAuMillierInferieur;
exports.SEUIL_OU_LE_PLAFOND_MORD = 77_932_800;
exports.BORNE_TROISIEME_TRANCHE = 43_200_000;
function impotDuBareme(assietteArrondieFc) {
    if (assietteArrondieFc <= 0)
        return { impotFc: 0, parTranche: [] };
    const parTranche = [];
    let borneBasse = 0;
    let impotFc = 0;
    for (const tranche of exports.TRANCHES_IRPP) {
        const borneHaute = tranche.jusqua ?? Number.POSITIVE_INFINITY;
        const baseFc = Math.max(0, Math.min(assietteArrondieFc, borneHaute) - borneBasse);
        if (baseFc > 0) {
            const impotTranche = (baseFc * tranche.tauxPourCent) / 100;
            impotFc += impotTranche;
            parTranche.push({ tauxPourCent: tranche.tauxPourCent, baseFc, impotFc: impotTranche });
        }
        borneBasse = borneHaute;
        if (assietteArrondieFc <= borneHaute)
            break;
    }
    return { impotFc, parTranche };
}
exports.IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC = impotDuBareme(exports.BORNE_TROISIEME_TRANCHE).impotFc;
exports.TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT = (exports.IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC / exports.BORNE_TROISIEME_TRANCHE) * 100;
function impotAnnuel(revenuNetGlobalFc, personnesACharge = 0) {
    const reserves = [];
    const assietteArrondieFc = (0, exports.arrondirAuMillierInferieur)((0, decimal_exact_1.maximum)(decimal_exact_1.ZERO, (0, decimal_exact_1.exact)(revenuNetGlobalFc)));
    const { impotFc: impotDuBaremeFc, parTranche } = impotDuBareme(assietteArrondieFc);
    const plafondFc = (assietteArrondieFc * exports.PLAFOND_IMPOT_POUR_CENT) / 100;
    const plafondApplique = impotDuBaremeFc > plafondFc;
    const impotArticle118Fc = plafondApplique ? plafondFc : impotDuBaremeFc;
    if (plafondApplique) {
        reserves.push(`PLAFOND DE L'ARTICLE 118, ALINÉA 2 · le barème rendait ${impotDuBaremeFc.toFixed(2)} FC, ` +
            `l'impôt total ne pouvant excéder 30 % du revenu imposable, il est ramené à ${plafondFc.toFixed(2)} FC.`);
    }
    const personnesAChargeRetenues = Math.min(Math.max(0, Math.trunc(personnesACharge)), exports.MAXIMUM_PERSONNES_A_CHARGE);
    if (personnesACharge > exports.MAXIMUM_PERSONNES_A_CHARGE) {
        reserves.push(`ARTICLE 123 · ${personnesACharge} personnes déclarées à charge, la quotité est plafonnée ` +
            `à ${exports.MAXIMUM_PERSONNES_A_CHARGE}.`);
    }
    const quotitePourCent = personnesAChargeRetenues * exports.QUOTITE_PAR_PERSONNE_A_CHARGE_POUR_CENT;
    const impotSurLaPartBasseFc = impotDuBareme(Math.min(assietteArrondieFc, exports.BORNE_TROISIEME_TRANCHE)).impotFc;
    const baseDeLaQuotiteFc = Math.min(impotSurLaPartBasseFc, impotArticle118Fc);
    if (assietteArrondieFc > exports.BORNE_TROISIEME_TRANCHE) {
        reserves.push("ARTICLE 123, ALINÉA 2 · aucune réduction n'est accordée sur l'impôt qui se rapporte à la " +
            `partie du revenu imposable qui excède la troisième tranche (${exports.BORNE_TROISIEME_TRANCHE.toLocaleString('fr-FR')} FC). ` +
            `La quotité ne joue que sur ${baseDeLaQuotiteFc.toFixed(2)} FC.`);
    }
    const reductionFc = (baseDeLaQuotiteFc * quotitePourCent) / 100;
    if (plafondApplique && quotitePourCent > 0) {
        reserves.push("ARTICLE 123 SUR UN IMPÔT PLAFONNÉ · la réduction opérée par le plafond de l'article 118, alinéa 2 se rapporte " +
            "à la seule part du revenu imposable qui excède la troisième tranche · l'impôt du barème sur les trois premières " +
            `tranches plafonne à ${exports.TAUX_EFFECTIF_DES_TROIS_PREMIERES_TRANCHES_POUR_CENT.toFixed(2).replace('.', ',')} % ` +
            `(${exports.IMPOT_DES_TROIS_PREMIERES_TRANCHES_FC.toFixed(2)} FC sur ${exports.BORNE_TROISIEME_TRANCHE.toFixed(2)} FC), ` +
            `sous les ${exports.PLAFOND_IMPOT_POUR_CENT} %, et le plafond ne mord qu'à cause de la quatrième. L'impôt qui se rapporte ` +
            `aux trois premières tranches reste celui du barème, ${baseDeLaQuotiteFc.toFixed(2)} FC, et la quotité de ` +
            `l'article 123, alinéas 1er et 2, s'applique sur lui · réduction annuelle de ${reductionFc.toFixed(2)} FC.`);
    }
    const impotDuFc = impotArticle118Fc - reductionFc;
    return {
        assietteArrondieFc,
        impotDuBaremeFc,
        parTranche,
        plafondFc,
        plafondApplique,
        impotArticle118Fc,
        personnesACharge,
        personnesAChargeRetenues,
        baseDeLaQuotiteFc,
        quotitePourCent,
        reductionFc,
        impotDuFc,
        reserves,
    };
}
exports.MOIS_PAR_AN = 12;
exports.TRANCHES_IRPP_MENSUELLES = exports.TRANCHES_IRPP.map((t, i) => ({
    tauxPourCent: t.tauxPourCent,
    deFc: i === 0 ? 0 : exports.TRANCHES_IRPP[i - 1].jusqua / exports.MOIS_PAR_AN,
    aFc: t.jusqua === null ? null : t.jusqua / exports.MOIS_PAR_AN,
}));
function detailMensuel(annuel) {
    const m = (x) => x / exports.MOIS_PAR_AN;
    const avantArrondi = m(annuel.impotDuFc);
    const retenue = (0, arrondi_article_150_1.arrondirImpotArt150)(avantArrondi);
    return {
        revenuRetenuFc: m(annuel.assietteArrondieFc),
        parTranche: annuel.parTranche.map((t) => {
            const tranche = exports.TRANCHES_IRPP_MENSUELLES.find((x) => x.tauxPourCent === t.tauxPourCent);
            return { ...tranche, baseFc: m(t.baseFc), impotFc: m(t.impotFc) };
        }),
        impotDuBaremeFc: m(annuel.impotDuBaremeFc),
        plafondFc: m(annuel.plafondFc),
        plafondApplique: annuel.plafondApplique,
        impotArticle118Fc: m(annuel.impotArticle118Fc),
        quotitePourCent: annuel.quotitePourCent,
        reductionFc: m(annuel.reductionFc),
        retenueAvantArrondiFc: avantArrondi,
        arrondiArticle150Fc: retenue - avantArrondi,
        retenueFc: retenue,
    };
}
function retenueMensuelle(moisDePaie, revenuImposableDuMoisFc, personnesACharge = 0) {
    const revenuDuMois = (0, decimal_exact_1.exact)(revenuImposableDuMoisFc);
    const revenuAnnualise = (0, decimal_exact_1.foisEntier)((0, decimal_exact_1.maximum)(decimal_exact_1.ZERO, revenuDuMois), exports.MOIS_PAR_AN);
    const revenuAnnualiseFc = (0, decimal_exact_1.versNombre)(revenuAnnualise);
    const annuel = impotAnnuel(revenuAnnualise, personnesACharge);
    const mensuel = detailMensuel(annuel);
    const reserves = [
        "MENSUALISATION · l'article 119 impose une retenue mensuelle et renvoie au barème annuel de " +
            "l'article 118, sans dire comment passer de l'un à l'autre. OmegaX porte le revenu du mois à " +
            "l'année, applique l'article 118, puis ramène au mois : c'est le barème annuel divisé par douze " +
            "(162 000, 1 800 000 et 3 600 000 FC par mois). L'arrondi au millier se prend sur l'année, " +
            "comme l'article 118 l'écrit. La convention est de l'éditeur.",
        "ACOMPTE · l'article 116 assied l'IRPP sur le revenu net global annuel et l'article 121 y impute " +
            "les retenues de l'exercice. Cette ligne est une retenue à la source, jamais l'impôt définitif du salarié.",
        "ARRONDI · la retenue du mois est arrondie selon l'article 150 (à l'unité, puis à la centaine de francs, " +
            "supérieure dès 50 FC), qui nomme l'IRPP · c'est le montant retenu (art. 119) qui est arrondi, jamais " +
            "l'impôt annuel dont la mensualisation le tire. La lecture est de l'éditeur.",
        ...annuel.reserves,
    ];
    return {
        moisDePaie,
        revenuImposableDuMoisFc: typeof revenuImposableDuMoisFc === 'number' ? revenuImposableDuMoisFc : (0, decimal_exact_1.versNombre)(revenuDuMois),
        revenuAnnualiseFc,
        annuel,
        mensuel,
        retenueFc: mensuel.retenueFc,
        reserves,
    };
}
exports.FORFAITS_ARRETE_019_2025 = "L'arrêté ministériel n° 019/CAB/MIN/FINANCES/2025 du 19 février 2025, en vigueur depuis le 1er janvier 2026, fixe ces forfaits ANNUELS à l'équivalent en francs congolais de 24 dollars par salarié domestique et de 36 dollars par salarié de micro-entreprise, retenus à la source par l'employeur et reversés par quotité trimestrielle (6 et 9 dollars) au plus tard le 15 du mois qui suit la fin de chaque trimestre, tout trimestre commencé étant dû en entier (art. 2). Le cours de conversion est renvoyé à la circulaire sur les canaux digitaux, absente du corpus · OmegaX ne chiffre donc aucune quotité en francs.";
exports.REGIMES_SALARIAUX = {
    BAREME_ARTICLE_118: "Régime de droit commun · barème progressif de l'article 118, retenu mensuellement par l'employeur (art. 119) et imputable sur l'impôt annuel (art. 121, alinéa 1er). C'est le seul régime que ce fichier calcule.",
    FORFAIT_PERSONNEL_DOMESTIQUE: "Taux forfaitaires fixés par arrêté du Ministre des Finances (art. 70, alinéa 2). La retenue est LIBÉRATOIRE pour autant que ces rémunérations constituent un revenu unique (art. 121, alinéa 2). " +
        exports.FORFAITS_ARRETE_019_2025,
    FORFAIT_SALARIE_DE_MICRO_ENTREPRISE: "Même arrêté n° 019/CAB/MIN/FINANCES/2025, même caractère libératoire (art. 121, alinéa 2). À ne pas confondre avec le forfait de la micro-entreprise ELLE-MÊME (art. 128, arrêté n° 015/2025) · deux redevables, deux bases, deux arrêtés. " +
        exports.FORFAITS_ARRETE_019_2025,
};
exports.RESERVE_REGIME_NON_DECLARE = "RÉGIME NON DÉCLARÉ · le barème de droit commun de l'article 118 est retenu. Un personnel domestique ou un salarié de micro-entreprise relève d'une retenue forfaitaire libératoire (art. 121, alinéa 2), que OmegaX ne chiffre pas · le déclarer abstient la retenue.";
function regimeApplicable(regime) {
    return {
        calculable: regime === 'BAREME_ARTICLE_118',
        motif: exports.REGIMES_SALARIAUX[regime],
    };
}
function baremeApplicableAuMois(moisDePaie) {
    const annee = Number.parseInt(moisDePaie.slice(0, 4), 10);
    if (!Number.isFinite(annee)) {
        return { applicable: false, motif: 'Mois de paie illisible.' };
    }
    if (annee < exports.PREMIER_EXERCICE_IRPP) {
        return {
            applicable: false,
            motif: `Le barème de l'article 118 de la loi n° 23/053 n'entre en vigueur que le 1er janvier ${exports.PREMIER_EXERCICE_IRPP}. ` +
                exports.LOI_IRPP.regimeAnterieur,
        };
    }
    return { applicable: true, motif: null };
}
//# sourceMappingURL=bareme-irpp.js.map