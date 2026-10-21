"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifExerciceCloture = motifExerciceCloture;
const client_1 = require("@prisma/client");
function motifExerciceCloture(referentiel) {
    const source = referentiel === client_1.Referentiel.SYCEBNL
        ? 'SYCEBNL, cadre conceptuel § 3.3.1.2.4'
        : 'AUDCIF, Titre V, correspondance du bilan de clôture et du bilan d’ouverture';
    return ("Impossible d'enregistrer une écriture sur un exercice clôturé. Une charge ou un produit omis se passe " +
        "dans l'exercice ouvert suivant, par son compte de résultat ; seuls un changement de méthode à impact " +
        "fort significatif et la correction d'une erreur significative vont aux capitaux propres d'ouverture " +
        `(fenêtre Exercices) · ${source}.`);
}
//# sourceMappingURL=exercice-cloture.js.map