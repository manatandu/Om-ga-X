"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jourDeKinshasa = jourDeKinshasa;
exports.jourDeKinshasaIso = jourDeKinshasaIso;
exports.jourUtc = jourUtc;
exports.echeanceDepassee = echeanceDepassee;
const DECALAGE_KINSHASA_MS = 60 * 60 * 1000;
function jourDeKinshasa(instant) {
    const local = new Date(instant.getTime() + DECALAGE_KINSHASA_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}
function jourDeKinshasaIso(instant) {
    return jourDeKinshasa(instant).toISOString().slice(0, 10);
}
function jourUtc(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function echeanceDepassee(echeance, aujourdhui) {
    return jourUtc(echeance).getTime() < jourUtc(aujourdhui).getTime();
}
//# sourceMappingURL=echeance.js.map