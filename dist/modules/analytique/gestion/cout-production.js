"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusDonnees = motifRefusDonnees;
exports.coutDeProduction = coutDeProduction;
const comportement_gestion_1 = require("./comportement-gestion");
const c = (n) => Math.round(n * 100);
function motifRefusDonnees(d) {
    if (!d.unite || d.unite.trim().length === 0)
        return "L'unité de mesure de l'activité est exigée (heures-machine, tonnes, pièces).";
    if (!d.source || d.source.trim().length < 3)
        return "La source de la capacité normale et de l'activité réelle est exigée.";
    if (!Number.isFinite(d.capaciteNormale) || d.capaciteNormale <= 0)
        return 'La capacité normale est strictement positive.';
    if (!Number.isFinite(d.activiteReelle) || d.activiteReelle < 0)
        return "L'activité réelle est positive ou nulle.";
    if (d.quantiteProduite !== null && (!Number.isFinite(d.quantiteProduite) || d.quantiteProduite <= 0)) {
        return 'La quantité produite, si elle est déclarée, est strictement positive.';
    }
    return null;
}
function coutDeProduction(charges, d) {
    let variables = 0;
    let fixes = 0;
    const horsCalcul = [];
    const nonDeclares = [];
    for (const ch of charges) {
        if (c(ch.montant) === 0)
            continue;
        const ligne = { numero: ch.numero, intitule: ch.intitule, montant: ch.montant };
        if (ch.comportement === null) {
            nonDeclares.push(ligne);
            continue;
        }
        if (ch.comportement === 'HORS_CALCUL' || ch.comportement === 'PRODUIT_ACTIVITE') {
            horsCalcul.push(ligne);
            continue;
        }
        const p = (0, comportement_gestion_1.partageFixeVariable)(ch.montant, ch.comportement, ch.partVariablePct);
        variables += c(p.variable);
        fixes += c(p.fixe);
    }
    const brut = d.activiteReelle / d.capaciteNormale;
    const coefficient = Math.round(Math.min(brut, 1) * 10000) / 10000;
    const imputees = Math.round(fixes * Math.min(brut, 1));
    const sousActivite = fixes - imputees;
    const complet = nonDeclares.length === 0;
    const cout = complet ? (variables + imputees) / 100 : null;
    return {
        chargesVariables: variables / 100,
        chargesFixes: fixes / 100,
        coefficient,
        suractivite: brut > 1,
        chargesFixesImputees: imputees / 100,
        sousActivite: sousActivite / 100,
        coutProduction: cout,
        coutUnitaire: cout !== null && d.quantiteProduite ? Math.round((cout / d.quantiteProduite) * 10000) / 10000 : null,
        horsCalcul,
        nonDeclares,
    };
}
//# sourceMappingURL=cout-production.js.map