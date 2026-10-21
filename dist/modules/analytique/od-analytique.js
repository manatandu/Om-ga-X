"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusClasseVentilee = motifRefusClasseVentilee;
exports.motifRefusMontantAnalytique = motifRefusMontantAnalytique;
exports.motifRefusOd = motifRefusOd;
exports.fusionnerCumuls = fusionnerCumuls;
const centimes = (n) => Math.round(n * 100);
function motifRefusClasseVentilee(classeCompte, classesVentilees) {
    const classes = classesVentilees.split(',').map((c) => c.trim());
    if (classes.includes(classeCompte))
        return null;
    return (`Le plan ne ventile pas la classe ${classeCompte} (classes ventilées : ${classes.join(', ')}) · ` +
        "une ventilation ne se pose pas sur un compte que le plan ne suit pas.");
}
function motifRefusMontantAnalytique(rang, debit, credit) {
    if (debit < 0 || credit < 0)
        return `Ligne ${rang} · un montant ne peut pas être négatif.`;
    if ((debit > 0) === (credit > 0))
        return `Ligne ${rang} · porter un montant au débit OU au crédit.`;
    return null;
}
function motifRefusOd(params) {
    const { planId, lignes, sections, classeCompte, classesVentilees } = params;
    const refusClasse = motifRefusClasseVentilee(classeCompte, classesVentilees);
    if (refusClasse)
        return refusClasse;
    if (lignes.length < 2) {
        return 'Une OD analytique a au moins deux lignes · ce qui sort d’une section entre dans une autre.';
    }
    let debit = 0;
    let credit = 0;
    for (const [i, l] of lignes.entries()) {
        const d = l.debit ?? 0;
        const c = l.credit ?? 0;
        const refusMontant = motifRefusMontantAnalytique(i + 1, d, c);
        if (refusMontant)
            return refusMontant;
        const s = sections.find((x) => x.id === l.sectionId);
        if (!s || s.planId !== planId)
            return `Ligne ${i + 1} · la section n'appartient pas au plan de l'OD.`;
        if (s.estTotal) {
            return `Ligne ${i + 1} · ${s.code} est une rubrique (section Total) · elle totalise ses sections, elle ne reçoit rien.`;
        }
        debit += d;
        credit += c;
    }
    if (centimes(debit) !== centimes(credit)) {
        return (`L'OD ne s'équilibre pas (débit ${debit.toFixed(2)}, crédit ${credit.toFixed(2)}) · ` +
            "une OD qui ne se solde pas ferait diverger l'analytique du grand livre.");
    }
    return null;
}
function fusionnerCumuls(ventilations, od) {
    const r = new Map(ventilations);
    for (const [id, v] of od) {
        const a = r.get(id) ?? { debit: 0, credit: 0 };
        r.set(id, { debit: a.debit + v.debit, credit: a.credit + v.credit });
    }
    return r;
}
//# sourceMappingURL=od-analytique.js.map