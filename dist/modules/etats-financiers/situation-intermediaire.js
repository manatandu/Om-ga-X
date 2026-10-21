"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVE_JEU_INCOMPLET = exports.DECLARATION_METHODES_IDENTIQUES = void 0;
exports.motifRefusDateArrete = motifRefusDateArrete;
exports.memePeriodeExercicePrecedent = memePeriodeExercicePrecedent;
exports.finDeJournee = finDeJournee;
exports.DECLARATION_METHODES_IDENTIQUES = 'Les méthodes comptables et les modalités de calcul adoptées sont identiques à celles utilisées dans les ' +
    "comptes de l'exercice les plus récents (AUDCIF, Titre VIII ch. 39 § 2.1.1). Si elles ont changé, la nature de " +
    'ces changements et leur incidence doivent être décrites, et l’information comparative retraitée pro-forma.';
exports.RESERVE_JEU_INCOMPLET = 'Situation intermédiaire · elle n’est pas un jeu complet de comptes intermédiaires au sens du ch. 39 : les ' +
    'mentions du § 2.1.1 qui ne se déduisent d’aucun solde (éléments exceptionnels, changements d’estimation, ' +
    'transactions avec les parties liées, caractère saisonnier de l’activité) restent à rédiger.';
function motifRefusDateArrete(arreteAu, exercice) {
    if (arreteAu < exercice.dateDebut) {
        return (`Une situation ne s’arrête pas avant l’ouverture de l’exercice (${jour(exercice.dateDebut)}) · en deçà, ` +
            'le report à-nouveau sort de la lecture et les soldes seraient amputés du bilan d’ouverture sans qu’aucun ' +
            'total ne le signale.');
    }
    if (arreteAu > finDeJournee(exercice.dateFin)) {
        return (`Une situation ne s’arrête pas après la clôture de l’exercice (${jour(exercice.dateFin)}) · au-delà, la ` +
            'borne ne retient rien de plus que l’exercice entier, et la mention « arrêté au » du document serait fausse.');
    }
    return null;
}
function memePeriodeExercicePrecedent(arreteAu, exerciceN1) {
    if (!exerciceN1)
        return null;
    const equivalent = new Date(Date.UTC(exerciceN1.dateFin.getUTCFullYear(), arreteAu.getUTCMonth(), arreteAu.getUTCDate(), 23, 59, 59, 999));
    if (equivalent < exerciceN1.dateDebut || equivalent > exerciceN1.dateFin)
        return null;
    return equivalent;
}
function finDeJournee(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}
const jour = (d) => d.toISOString().slice(0, 10);
//# sourceMappingURL=situation-intermediaire.js.map