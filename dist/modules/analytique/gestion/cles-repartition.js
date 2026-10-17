"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusCle = motifRefusCle;
exports.repartirAuCentime = repartirAuCentime;
exports.propositionRepartition = propositionRepartition;
const centimes = (n) => Math.round(n * 100);
function motifRefusCle(params) {
    const { planId, sectionSourceId, mode, lignes, sections, source } = params;
    if (!source || source.trim().length < 3) {
        return "La source de la clé est exigée (relevé, plan des surfaces, feuille de temps) · une clé sans fondement ne se justifie pas.";
    }
    const sourceSection = sections.find((s) => s.id === sectionSourceId);
    if (!sourceSection || sourceSection.planId !== planId)
        return "La section à répartir n'appartient pas au plan de la clé.";
    if (sourceSection.estTotal) {
        return `${sourceSection.code} est une rubrique (section Total) · elle ne porte rien à répartir, ses sections Détail si.`;
    }
    if (lignes.length === 0)
        return 'Une clé répartit sur au moins une section.';
    const vues = new Set();
    let total = 0;
    for (const [i, l] of lignes.entries()) {
        const rang = i + 1;
        if (!Number.isFinite(l.valeur) || l.valeur <= 0)
            return `Ligne ${rang} · la valeur de la clé est strictement positive.`;
        if (l.sectionCibleId === sectionSourceId)
            return `Ligne ${rang} · une section ne se répartit pas sur elle-même.`;
        if (vues.has(l.sectionCibleId))
            return `Ligne ${rang} · la section figure deux fois dans la clé.`;
        vues.add(l.sectionCibleId);
        const s = sections.find((x) => x.id === l.sectionCibleId);
        if (!s || s.planId !== planId)
            return `Ligne ${rang} · la section n'appartient pas au plan de la clé.`;
        if (s.estTotal)
            return `Ligne ${rang} · ${s.code} est une rubrique (section Total) · elle totalise ses sections, elle ne reçoit rien.`;
        if (!s.estActive)
            return `Ligne ${rang} · la section ${s.code} est en sommeil.`;
        total += l.valeur;
    }
    if (mode === 'POURCENTAGE' && centimes(total) !== 10000) {
        return `Les pourcentages de la clé totalisent ${total.toFixed(2)} % · ils doivent faire 100 %.`;
    }
    return null;
}
function repartirAuCentime(montant, poids) {
    const total = poids.reduce((t, p) => t + p, 0);
    if (total <= 0)
        throw new Error('Poids de répartition nuls.');
    const c = Math.round(montant * 100);
    const brutes = poids.map((p) => (c * p) / total);
    const parts = brutes.map((b) => Math.floor(b));
    let reste = c - parts.reduce((t, p) => t + p, 0);
    const ordre = brutes
        .map((b, i) => ({ i, fraction: b - Math.floor(b) }))
        .sort((a, b) => (b.fraction !== a.fraction ? b.fraction - a.fraction : a.i - b.i));
    for (const { i } of ordre) {
        if (reste <= 0)
            break;
        parts[i] += 1;
        reste -= 1;
    }
    return parts.map((p) => p / 100);
}
function propositionRepartition(cumuls, sectionSourceId, lignes) {
    const poids = lignes.map((l) => l.valeur);
    const ods = [];
    for (const c of [...cumuls].sort((a, b) => a.numero.localeCompare(b.numero))) {
        const solde = (centimes(c.debit) - centimes(c.credit)) / 100;
        if (centimes(solde) === 0)
            continue;
        const absolu = Math.abs(solde);
        const parts = repartirAuCentime(absolu, poids);
        const debiteur = solde > 0;
        ods.push({
            compteId: c.compteId,
            numero: c.numero,
            intitule: c.intitule,
            solde,
            lignes: [
                { sectionId: sectionSourceId, debit: debiteur ? 0 : absolu, credit: debiteur ? absolu : 0 },
                ...lignes
                    .map((l, i) => ({ sectionId: l.sectionCibleId, debit: debiteur ? parts[i] : 0, credit: debiteur ? 0 : parts[i] }))
                    .filter((l) => l.debit > 0 || l.credit > 0),
            ],
        });
    }
    return ods;
}
//# sourceMappingURL=cles-repartition.js.map