"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVERTISSEMENT_DEPENSES_RENOUVELLEMENT = exports.LIBELLE_METHODE_PARTIE = void 0;
exports.detacherPartieRemplacee = detacherPartieRemplacee;
exports.amortissementsHorsDotations = amortissementsHorsDotations;
const centimes = (x) => Math.round(x * 100) / 100;
exports.LIBELLE_METHODE_PARTIE = {
    COUT_ACTUEL_A_NEUF: 'répartition du coût actuel à neuf selon les données techniques',
    POURCENTAGE_IMMOBILISATIONS_RECENTES: 'pourcentage constaté sur des immobilisations récentes ou rénovées',
    INFORMATIONS_FOURNISSEURS: 'informations obtenues des fournisseurs',
    DEPENSES_DE_RENOUVELLEMENT: 'pièces des dépenses effectives de renouvellement',
};
exports.AVERTISSEMENT_DEPENSES_RENOUVELLEMENT = "Estimée sur la dépense de renouvellement, la partie remplacée « pourrait » être surévaluée (AUDCIF Titre VIII ch. 4 § 3.1.2) · vérifiez que la structure garde une valeur cohérente avec ce qu'elle porte encore.";
function detacherPartieRemplacee(s, o) {
    if (!s.enService)
        return { motif: 'La structure est sortie · elle ne reçoit plus de remplacement.' };
    if (s.estComposant) {
        return {
            motif: "Ce bien est déjà un composant · son remplacement se passe par le renouvellement du composant (AUDCIF Titre VIII ch. 4 § 4.1), pas par une nouvelle décomposition.",
        };
    }
    if (!s.modeLineaire) {
        return { motif: "La partie remplacée se détache d'une structure amortie en linéaire · aux unités d'œuvre, le prorata du cumul n'a pas de sens. Passez l'opération à la main." };
    }
    if (s.cumulDepreciation > 0.005) {
        return { motif: 'La structure porte une dépréciation (29) · la part de la partie remplacée ne se répartit pas d\'office. Passez l\'opération à la main.' };
    }
    if (s.degressifOuDerogatoire) {
        return { motif: "La structure est au dégressif fiscal ou porte un amortissement dérogatoire (151) · sa part ne se répartit pas d'office. Passez l'opération à la main." };
    }
    if (s.financeeParUnFonds) {
        return { motif: "La structure est financée par un fonds ou une subvention rattachée · la reprise de la part sortie ne se répartit pas d'office. Passez l'opération à la main." };
    }
    if (s.dotationDejaPassee) {
        return {
            motif: "La dotation de l'exercice du remplacement est déjà passée sur la structure · la partie remplacée doit sortir avant, sinon son annuité serait comptée deux fois.",
        };
    }
    if (!o.source?.trim()) {
        return { motif: "Indiquez la source de l'estimation (données techniques, immobilisation de référence, fournisseur, pièce de renouvellement) · AUDCIF Titre VIII ch. 4 § 3.1.2." };
    }
    const valeurPartie = centimes(o.valeurEstimee);
    if (!(valeurPartie > 0))
        return { motif: 'La valeur d\'origine estimée de la partie remplacée est positive.' };
    if (valeurPartie >= centimes(s.valeurOrigine - s.valeurResiduelle)) {
        return {
            motif: "L'estimation absorbe toute la base de la structure · « une \"structure\" de l'immobilisation principale de valeur nulle » appelle des correctifs (AUDCIF Titre VIII ch. 4 § 3.1.2). Revoyez l'estimation.",
        };
    }
    const amortissementsPartie = s.valeurOrigine > 0 ? centimes((Math.max(0, s.cumulOuverture) * valeurPartie) / s.valeurOrigine) : 0;
    return {
        valeurPartie,
        amortissementsPartie,
        avertissement: o.methode === 'DEPENSES_DE_RENOUVELLEMENT' ? exports.AVERTISSEMENT_DEPENSES_RENOUVELLEMENT : null,
    };
}
function amortissementsHorsDotations(i) {
    return (Math.max(0, Number(i.amortissementAnterieur ?? 0)) -
        Number(i.amortissementsDetaches ?? 0) -
        Number(i.reprisesAmortissement ?? 0) +
        Number(i.amortissementsReevaluation ?? 0));
}
//# sourceMappingURL=partie-remplacee.js.map