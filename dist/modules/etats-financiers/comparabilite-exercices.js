"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moisCouverts = moisCouverts;
exports.articleComparabilite = articleComparabilite;
exports.evaluerComparabilite = evaluerComparabilite;
const client_1 = require("@prisma/client");
const mois_entre_1 = require("../../common/mois-entre");
function moisCouverts(borne) {
    return (0, mois_entre_1.moisEntre)(borne.dateDebut, borne.dateFin);
}
function articleComparabilite(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL
        ? "SYCEBNL art. 16, 7°, deuxième alinéa · l'art. 34 de l'AUDCIF, qui porte la même règle côté SYSCOHADA, " +
            "fait partie des articles 25 à 34 que l'art. 3 du SYCEBNL écarte expressément"
        : 'AUDCIF art. 34, dernier alinéa';
}
function evaluerComparabilite(referentiel, courant, precedent) {
    const article = articleComparabilite(referentiel);
    if (!precedent)
        return { disponible: false, comparable: true, motifs: [], article };
    const motifs = [];
    const moisN = moisCouverts(courant);
    const moisN1 = moisCouverts(precedent);
    if (moisN !== moisN1) {
        motifs.push({
            code: 'DUREE_DIFFERENTE',
            phrase: `L’exercice couvre ${moisN} mois et le précédent ${moisN1}. Les charges et les produits d’une ` +
                'période plus courte ne se comparent pas terme à terme à ceux d’une période plus longue.',
        });
    }
    return { disponible: true, comparable: motifs.length === 0, motifs, article };
}
//# sourceMappingURL=comparabilite-exercices.js.map