"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateEcheanceDuModele = dateEcheanceDuModele;
exports.echeancierDuModele = echeancierDuModele;
exports.motifSansEcheancierDuModele = motifSansEcheancierDuModele;
const client_1 = require("@prisma/client");
function dateEcheanceDuModele(dateFacture, delaiJours, condition) {
    if (condition === client_1.ConditionEcheance.NET) {
        const d = new Date(Date.UTC(dateFacture.getUTCFullYear(), dateFacture.getUTCMonth(), dateFacture.getUTCDate()));
        d.setUTCDate(d.getUTCDate() + delaiJours);
        return d;
    }
    const finDeMois = new Date(Date.UTC(dateFacture.getUTCFullYear(), dateFacture.getUTCMonth() + 1, 0));
    finDeMois.setUTCDate(finDeMois.getUTCDate() + delaiJours);
    return finDeMois;
}
const enCentimes = (x) => Math.round(x * 100);
function echeancierDuModele(modele, echeances, dateFacture, montantTotal, modeHabituel = null) {
    const total = enCentimes(montantTotal);
    if (echeances.length === 0) {
        return [
            {
                ordre: 1,
                type: null,
                montant: total / 100,
                dateEcheance: dateEcheanceDuModele(dateFacture, modele.delaiJours, modele.echeance),
                modeReglementId: modele.modeReglementId ?? modeHabituel,
            },
        ];
    }
    const triees = [...echeances].sort((a, b) => a.ordre - b.ordre);
    const equilibre = triees.find((e) => e.type === client_1.TypeEcheance.EQUILIBRE);
    const ordreDeCalcul = equilibre ? [...triees.filter((e) => e !== equilibre), equilibre] : triees;
    const montants = new Map();
    let reste = total;
    ordreDeCalcul.forEach((e, i) => {
        let centimes;
        if (e.type === client_1.TypeEcheance.EQUILIBRE || i === ordreDeCalcul.length - 1) {
            centimes = reste;
        }
        else if (e.type === client_1.TypeEcheance.POURCENTAGE) {
            centimes = Math.min(Math.round((total * Number(e.valeur ?? 0)) / 100), reste);
        }
        else {
            centimes = Math.min(enCentimes(Number(e.valeur ?? 0)), reste);
        }
        centimes = Math.max(centimes, 0);
        reste -= centimes;
        montants.set(e, centimes);
    });
    return triees.map((e) => ({
        ordre: e.ordre,
        type: e.type,
        montant: (montants.get(e) ?? 0) / 100,
        dateEcheance: dateEcheanceDuModele(dateFacture, e.delaiJours, e.echeance),
        modeReglementId: e.modeReglementId ?? modeHabituel,
    }));
}
function motifSansEcheancierDuModele(p) {
    const n = p.numero;
    if (!n.startsWith('40') && !n.startsWith('41'))
        return 'Le modèle de règlement ne s’applique qu’à un compte de fournisseur (40) ou de client (41).';
    for (const r of ['408', '409', '416', '418', '419']) {
        if (n.startsWith(r))
            return `Le compte ${n} (${r}) ne reçoit pas d’échéance tirée d’un modèle de règlement.`;
    }
    if (p.typeJournal === client_1.TypeJournal.TRESORERIE)
        return 'Un journal de trésorerie enregistre un règlement · l’échéance d’une facture ne s’y calcule pas.';
    const sensDeLaFacture = n.startsWith('40') ? 'CREDIT' : 'DEBIT';
    if (p.sens !== sensDeLaFacture)
        return 'Une ligne au sens inverse de la facture (avoir, règlement) ne reçoit pas d’échéance tirée du modèle.';
    return null;
}
//# sourceMappingURL=echeancier-modele.js.map