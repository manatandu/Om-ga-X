"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATURES_DES_RUBRIQUES = void 0;
exports.motifRefusRubrique = motifRefusRubrique;
const assiettes_paie_1 = require("./assiettes-paie");
const passation_paie_1 = require("./passation-paie");
exports.NATURES_DES_RUBRIQUES = [
    'SALAIRE_OU_TRAITEMENT',
    'COMMISSION',
    'INDEMNITE_DE_VIE_CHERE',
    'PRIME',
    'PARTICIPATION_AUX_BENEFICES',
    'GRATIFICATION_OU_MOIS_COMPLEMENTAIRE',
    'PRESTATION_SUPPLEMENTAIRE',
    'AVANTAGE_EN_NATURE',
    'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE',
    'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT',
].filter((n) => !passation_paie_1.NATURES_SANS_IMPUTATION[n]);
function motifRefusRubrique(r) {
    if (!r.code?.trim())
        return 'Le code de la rubrique est obligatoire.';
    if (!r.libelle?.trim())
        return 'Le libellé de la rubrique est obligatoire.';
    if (!r.fondement?.trim()) {
        return "Le fondement est obligatoire (article de la convention collective, clause du contrat, décision de l'employeur) · c'est lui qu'un réviseur demandera avant le montant.";
    }
    const nature = r.nature;
    if (assiettes_paie_1.HORS_REMUNERATION_ARTICLE_7.includes(nature)) {
        return ("Cette nature fait partie des cinq exclusions de l'article 7, point 8 du Code du travail · une rubrique du cabinet ne peut pas " +
            "sortir un montant de l'assiette sociale par son seul nom. Saisissez une vraie indemnité de cette nature avec l'élément du catalogue.");
    }
    if (passation_paie_1.NATURES_SANS_IMPUTATION[nature])
        return `Nature refusée à une rubrique · ${passation_paie_1.NATURES_SANS_IMPUTATION[nature]}`;
    if (!exports.NATURES_DES_RUBRIQUES.includes(nature))
        return 'Nature de rubrique inconnue.';
    return null;
}
//# sourceMappingURL=rubriques-paie.js.map