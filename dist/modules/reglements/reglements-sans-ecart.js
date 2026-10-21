"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_LIGNES_EXAMINEES = void 0;
exports.reglementsSansEcart = reglementsSansEcart;
const ecart_change_realise_1 = require("./ecart-change-realise");
exports.PLAFOND_LIGNES_EXAMINEES = 20_000;
const centimes = (x) => Math.round(x * 100) / 100;
async function reglementsSansEcart(prisma, p) {
    const lignes = await prisma.ligneEcriture.findMany({
        where: {
            lettrageId: { not: null },
            lettre: null,
            deviseId: { not: null },
            lettrage: { statut: 'PARTIEL' },
            ecriture: { tenantId: p.tenantId, exerciceId: p.exerciceId },
            compte: { OR: [{ numero: { startsWith: '40' } }, { numero: { startsWith: '41' } }] },
        },
        select: {
            id: true,
            ecritureId: true,
            lettrageId: true,
            debit: true,
            credit: true,
            montantDevise: true,
            compte: { select: { numero: true } },
            ecriture: {
                select: {
                    date: true,
                    numeroPiece: true,
                    estGenereeParCloture: true,
                    estANouveauProvisoire: true,
                    journal: { select: { code: true, type: true } },
                    lignes: { where: { compte: { numero: { startsWith: '5' } } }, select: { id: true }, take: 1 },
                },
            },
        },
        orderBy: { id: 'asc' },
        take: exports.PLAFOND_LIGNES_EXAMINEES + 1,
    });
    const tronque = lignes.length > exports.PLAFOND_LIGNES_EXAMINEES;
    const parGroupe = new Map();
    for (const l of lignes.slice(0, exports.PLAFOND_LIGNES_EXAMINEES)) {
        parGroupe.set(l.lettrageId, [...(parGroupe.get(l.lettrageId) ?? []), l]);
    }
    const candidats = [];
    let nonReconnaissables = 0;
    for (const groupe of parGroupe.values()) {
        const signe = (l) => (Number(l.debit) - Number(l.credit) >= 0 ? 1 : -1);
        const soldeDevise = groupe.reduce((t, l) => t + signe(l) * Number(l.montantDevise ?? 0), 0);
        if (Math.abs(soldeDevise) < 0.005)
            continue;
        const estReglement = (l) => !l.ecriture.estGenereeParCloture &&
            !l.ecriture.estANouveauProvisoire &&
            (l.ecriture.journal.type === 'TRESORERIE' || l.ecriture.lignes.length > 0);
        const reglements = groupe.filter(estReglement);
        const factures = groupe.filter((l) => !estReglement(l));
        const premiereFacture = Math.min(...factures.map((l) => l.ecriture.date.getTime()));
        const cote = factures.length > 0 ? signe(factures[0]) : 0;
        if (factures.length === 0 ||
            reglements.length === 0 ||
            factures.some((l) => signe(l) !== cote) ||
            reglements.some((l) => signe(l) === cote || l.ecriture.date.getTime() < premiereFacture)) {
            nonReconnaissables += 1;
            continue;
        }
        const devisesFactures = factures.reduce((t, l) => t + Number(l.montantDevise ?? 0), 0);
        const devisesReglees = reglements.reduce((t, l) => t + Number(l.montantDevise ?? 0), 0);
        if (!(devisesFactures > 0) || devisesReglees > devisesFactures + 0.005) {
            nonReconnaissables += 1;
            continue;
        }
        const enOrdre = (l) => ({ id: l.id, date: l.ecriture.date });
        const reglementsEnOrdre = [...reglements].sort((a, b) => (0, ecart_change_realise_1.ordreDeReglement)(enOrdre(a), enOrdre(b)));
        const couts = (0, ecart_change_realise_1.coutsHistoriquesSuccessifs)(factures.map((l) => ({ id: l.id, date: l.ecriture.date, francs: Math.abs(Number(l.debit) - Number(l.credit)), montantDevise: Number(l.montantDevise ?? 0) })), reglementsEnOrdre.map((l) => Number(l.montantDevise ?? 0)));
        for (const [i, r] of reglementsEnOrdre.entries()) {
            const devise = Number(r.montantDevise ?? 0);
            const portes = centimes(Math.abs(Number(r.debit) - Number(r.credit)));
            const historiques = couts[i];
            if (Math.abs(portes - historiques) <= 0.01 + devise * 1e-6)
                continue;
            const ecart = centimes(cote < 0 ? portes - historiques : historiques - portes);
            candidats.push({
                ecritureId: r.ecritureId,
                compteNumero: r.compte.numero,
                piece: `${r.ecriture.journal.code} n° ${r.ecriture.numeroPiece ?? ''}`.trim(),
                date: r.ecriture.date,
                montantDevise: devise,
                francsPortes: portes,
                francsHistoriques: historiques,
                ecart,
            });
        }
    }
    if (candidats.length === 0)
        return { elements: [], tronque, nonReconnaissables };
    const racines = [...(0, ecart_change_realise_1.racinesAdmises)(p.referentiel, null, 'PERTE'), ...(0, ecart_change_realise_1.racinesAdmises)(p.referentiel, null, 'GAIN')];
    const lignesDesPieces = await prisma.ligneEcriture.findMany({
        where: { ecritureId: { in: [...new Set(candidats.map((c) => c.ecritureId))] }, ecriture: { tenantId: p.tenantId } },
        select: { ecritureId: true, compte: { select: { numero: true } } },
    });
    const avecChange = new Set(lignesDesPieces.filter((l) => (0, ecart_change_realise_1.compteAdmisPourEcart)(racines, l.compte.numero)).map((l) => l.ecritureId));
    const elements = candidats
        .filter((c) => !avecChange.has(c.ecritureId))
        .map(({ ecritureId: _e, ...reste }) => reste)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    return { elements, tronque, nonReconnaissables };
}
//# sourceMappingURL=reglements-sans-ecart.js.map