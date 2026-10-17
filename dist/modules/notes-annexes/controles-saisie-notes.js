"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nombreSaisi = nombreSaisi;
exports.ecartsDesSaisies = ecartsDesSaisies;
function nombreSaisi(v) {
    if (v === null || v === undefined)
        return null;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : Number.NaN;
    const t = v.replace(/[\s  ]/g, '');
    if (t === '')
        return null;
    if (!/^-?\d+([.,]\d+)?$/.test(t))
        return Number.NaN;
    return Number(t.replace(',', '.'));
}
const ecartSignificatif = (a, b) => Math.abs(a - b) > 0.005;
function ecartsDesSaisies(spec, cellules) {
    const lu = (i, ci) => nombreSaisi(cellules[i]?.[ci]);
    return spec.rubriques.map((rubrique, i) => {
        if (!rubrique.saisie || !cellules[i])
            return undefined;
        const ecarts = new Map();
        if (rubrique.sommeDesSaisies) {
            spec.colonnes.forEach((_, ci) => {
                const operandes = rubrique.sommeDesSaisies.map((j) => lu(j, ci));
                if (operandes.some((x) => Number.isNaN(x)))
                    return;
                if (operandes.every((x) => x === null))
                    return;
                const attendu = operandes.reduce((s, x) => s + (x ?? 0), 0);
                const saisi = lu(i, ci);
                if (saisi !== null && Number.isNaN(saisi))
                    return;
                if (saisi === null || ecartSignificatif(saisi, attendu))
                    ecarts.set(ci, { colonne: ci, saisi, attendu });
            });
        }
        spec.colonnes.forEach((c, ci) => {
            if (!c.formuleSaisie || ecarts.has(ci))
                return;
            const plus = c.formuleSaisie.plus.map((k) => lu(i, k));
            const moins = c.formuleSaisie.moins.map((k) => lu(i, k));
            const operandes = [...plus, ...moins];
            if (operandes.some((x) => x === null || Number.isNaN(x)))
                return;
            const attendu = plus.reduce((s, x) => s + x, 0) - moins.reduce((s, x) => s + x, 0);
            const saisi = lu(i, ci);
            if (saisi !== null && Number.isNaN(saisi))
                return;
            if (saisi === null || ecartSignificatif(saisi, attendu))
                ecarts.set(ci, { colonne: ci, saisi, attendu });
        });
        return ecarts.size > 0 ? [...ecarts.values()].sort((a, b) => a.colonne - b.colonne) : undefined;
    });
}
//# sourceMappingURL=controles-saisie-notes.js.map