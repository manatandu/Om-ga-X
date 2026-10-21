"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.premierJourNonCloture = premierJourNonCloture;
const client_1 = require("@prisma/client");
function bloque(c, journalId, date) {
    if (c.granularite === client_1.GranulariteCloture.TOTALE)
        return c.journalId === journalId && date <= c.dateLimite;
    if (c.granularite === client_1.GranulariteCloture.PARTIELLE)
        return c.journalId === journalId && date <= c.dateLimite;
    return date <= c.dateLimite;
}
const JOUR = 24 * 60 * 60 * 1000;
function lendemain(d) {
    const debut = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return new Date(debut + JOUR);
}
function premierJourNonCloture(clotures, journalId, date) {
    let d = date;
    for (let garde = 0; garde <= clotures.length; garde++) {
        const bloquantes = clotures.filter((c) => bloque(c, journalId, d));
        if (bloquantes.length === 0)
            return d;
        const limite = bloquantes.reduce((m, c) => (c.dateLimite > m ? c.dateLimite : m), bloquantes[0].dateLimite);
        d = lendemain(limite);
    }
    return d;
}
//# sourceMappingURL=report-periode-close.js.map