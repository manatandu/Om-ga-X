"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBSERVATION_PERTE_PERIODE_CREATION = exports.OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE = void 0;
exports.periodeDeCreation = periodeDeCreation;
exports.deductionPeriodeCreation = deductionPeriodeCreation;
exports.chiffreAffairesMinimumPremierExercice = chiffreAffairesMinimumPremierExercice;
exports.sourceChiffreAffairesPeriode = sourceChiffreAffairesPeriode;
const entree_en_vigueur_loi_23_053_1 = require("../../common/entree-en-vigueur-loi-23-053");
function periodeDeCreation(exercice, premierExerciceDuDossier) {
    if (!premierExerciceDuDossier)
        return null;
    const annee = exercice.dateDebut.getUTCFullYear();
    if (exercice.dateDebut.getUTCMonth() < 6)
        return null;
    const fin = exercice.dateFin;
    const closLe31DecembreSuivant = fin.getUTCFullYear() === annee + 1 && fin.getUTCMonth() === 11 && fin.getUTCDate() === 31;
    if (!closLe31DecembreSuivant)
        return null;
    const dateFin = new Date(Date.UTC(annee, 11, 31));
    return {
        dateDebut: exercice.dateDebut,
        dateFin,
        annee,
        sousLaLoi: new Date(Date.UTC(annee, 0, 1)).getTime() >= entree_en_vigueur_loi_23_053_1.ENTREE_EN_VIGUEUR_LOI_23_053.getTime(),
    };
}
function deductionPeriodeCreation(resultatPeriode) {
    return Math.max(resultatPeriode, 0);
}
function chiffreAffairesMinimumPremierExercice(chiffreAffairesExercice, chiffreAffairesPeriode) {
    return Math.max(0, Math.round((chiffreAffairesExercice - chiffreAffairesPeriode) * 100) / 100);
}
exports.OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE = "CHIFFRE D'AFFAIRES DU MINIMUM DU PREMIER EXERCICE CLOS · l'impôt est établi chaque année (loi n° 23/053, art. 12, al. 1 et 4), et l'art. 12, al. 3 découpe le premier exercice long en deux impositions. Le minimum de l'art. 57, assis sur le chiffre d'affaires « déclaré », se calcule donc pour le premier exercice clos sur le chiffre d'affaires de l'année qui suit la création · celui de l'exercice MOINS celui de la période de création, qui a porté son propre minimum dans la déclaration de l'année de création (LPF, art. 12 et 13, al. 3 ; loi n° 23/053, art. 151). Le compter deux fois serait la double imposition que l'art. 55 écarte, et, pour une période de création antérieure au 1er janvier 2026, ferait porter le minimum sur des ventes d'avant l'entrée en vigueur de la loi (art. 153).";
function sourceChiffreAffairesPeriode(e) {
    if (e.chiffreAffairesDeclare)
        return "Le chiffre d'affaires retranché est celui que le cabinet DÉCLARE pour la période, d'après ses comptes intermédiaires.";
    return ("Le chiffre d'affaires retranché est celui de la période, lu au livre-journal au 31 décembre de l'année de création" +
        (e.beneficeDeclare
            ? " · le bénéfice de la période est déclaré, son chiffre d'affaires ne l'est pas · déclarez-le s'il diffère de cette lecture."
            : '.'));
}
exports.OBSERVATION_PERTE_PERIODE_CREATION = "PERTE DE LA PÉRIODE DE CRÉATION · elle n'est ni déduite ni reportée à part · l'art. 12, al. 3 ne fait venir en déduction que « ces bénéfices », et l'art. 51 ne reporte que « les pertes constatées au cours d'un exercice », la période n'en étant pas un. Elle reste dans les résultats du premier exercice clos et en diminue la base. Si celui-ci est déficitaire, c'est sa perte qui se reporte (art. 51), son caractère s'appréciant sur son résultat fiscal (art. 52, 2°) ; l'impôt minimum payé sur la période ne s'impute sur rien (art. 51 et 52).";
//# sourceMappingURL=periode-creation.js.map