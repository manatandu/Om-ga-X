"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appartientALaRubrique = appartientALaRubrique;
exports.feuillesDeLaRubrique = feuillesDeLaRubrique;
exports.valeurDeLaLigne = valeurDeLaLigne;
exports.totalDesFeuilles = totalDesFeuilles;
const client_1 = require("@prisma/client");
function appartientALaRubrique(section, rubrique) {
    return section.type === client_1.TypeCompteDetailTotal.DETAIL && section.code.startsWith(rubrique.code);
}
function feuillesDeLaRubrique(rubrique, sections) {
    if (rubrique.type !== client_1.TypeCompteDetailTotal.TOTAL)
        return [];
    return sections.filter((s) => appartientALaRubrique(s, rubrique)).map((s) => s.id);
}
function valeurDeLaLigne(section, sections, mesure) {
    if (section.type !== client_1.TypeCompteDetailTotal.TOTAL)
        return mesure(section.id);
    return feuillesDeLaRubrique(section, sections).reduce((t, id) => t + mesure(id), 0);
}
function totalDesFeuilles(sections, mesure) {
    return sections
        .filter((s) => s.type === client_1.TypeCompteDetailTotal.DETAIL)
        .reduce((t, s) => t + mesure(s.id), 0);
}
//# sourceMappingURL=rubriques-budgetaires.js.map