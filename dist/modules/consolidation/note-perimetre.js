"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noteDuPerimetre = noteDuPerimetre;
const versNote = (m) => (m === 'EXCLUE' ? 'NC' : m);
function noteDuPerimetre(n, secteurs, n1, controleHorsOhada = null) {
    const parNom = new Map((n1 ?? []).map((r) => [r.nom, r]));
    const lignes = n.map((r) => {
        const a = parNom.get(r.nom);
        return {
            denomination: r.nom,
            estConsolidante: r.estConsolidante,
            secteurActivite: secteurs.get(r.id) ?? null,
            pctControleN: r.pctControle,
            pctControleN1: a ? a.pctControle : null,
            methodeN: versNote(r.methode),
            methodeN1: a ? versNote(a.methode) : null,
            pctInteretN: r.pctInteret,
            pctInteretN1: a ? a.pctInteret : null,
            entree: n1 != null && !a,
        };
    });
    const nomsN = new Set(n.map((r) => r.nom));
    return {
        lignes,
        sorties: (n1 ?? []).filter((r) => !nomsN.has(r.nom)).map((r) => r.nom),
        justifications: n
            .filter((r) => !r.estConsolidante)
            .map((r) => ({
            denomination: r.nom,
            fondement: r.fondement,
            aJustifier: r.aJustifierEnNotes,
            exclusion: r.exclusion ? { libelle: r.exclusion.libelle, justification: r.exclusion.justification } : null,
        })),
        comparatifDisponible: n1 != null,
        controleHorsOhada: controleHorsOhada?.trim() || null,
    };
}
//# sourceMappingURL=note-perimetre.js.map