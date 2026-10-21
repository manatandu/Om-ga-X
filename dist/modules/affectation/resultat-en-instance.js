"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partsAuResultatEnInstance = partsAuResultatEnInstance;
function partsAuResultatEnInstance(lignes, estBenefice, montant) {
    const racine = estBenefice ? '1301' : '1309';
    const parts = [];
    let reste = Math.round(montant * 100);
    const candidates = lignes.filter((l) => l.numero.startsWith(racine)).sort((a, b) => a.numero.localeCompare(b.numero));
    for (const l of candidates) {
        if (reste <= 0)
            break;
        const disponible = Math.round((estBenefice ? -l.solde : l.solde) * 100);
        if (disponible <= 0)
            continue;
        const pris = Math.min(disponible, reste);
        parts.push({ compteId: l.compteId, numero: l.numero, montant: pris / 100 });
        reste -= pris;
    }
    return { parts, reste: reste / 100 };
}
//# sourceMappingURL=resultat-en-instance.js.map