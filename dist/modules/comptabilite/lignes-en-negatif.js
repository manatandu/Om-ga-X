"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lignesEnNegatif = lignesEnNegatif;
function lignesEnNegatif(lignes) {
    return lignes.map((l) => ({
        compteId: l.compteId,
        libelle: l.libelle,
        debit: l.debit.negated(),
        credit: l.credit.negated(),
        tauxTvaId: l.tauxTvaId,
        dateEcheance: l.dateEcheance,
        dateVersement: l.dateVersement,
        modeReglementId: l.modeReglementId,
        deviseId: l.deviseId,
        montantDevise: l.montantDevise,
        coursApplique: l.coursApplique,
        ventilations: {
            create: l.ventilations.map((v) => ({
                sectionId: v.sectionId,
                planId: v.planId,
                debit: v.debit.negated(),
                credit: v.credit.negated(),
            })),
        },
    }));
}
//# sourceMappingURL=lignes-en-negatif.js.map