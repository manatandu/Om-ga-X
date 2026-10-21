"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTEUR_SYSTEME = void 0;
exports.journaliserDansTransaction = journaliserDansTransaction;
exports.transactionAuditee = transactionAuditee;
exports.dansContexteAudit = dansContexteAudit;
exports.acteurCourant = acteurCourant;
const node_async_hooks_1 = require("node:async_hooks");
const stockage = new node_async_hooks_1.AsyncLocalStorage();
const transactions = new node_async_hooks_1.AsyncLocalStorage();
function journaliserDansTransaction(tx, suite) {
    return transactions.run(tx, suite);
}
function transactionAuditee() {
    return transactions.getStore();
}
function dansContexteAudit(acteur, suite) {
    return stockage.run(acteur, suite);
}
function acteurCourant() {
    return stockage.getStore();
}
exports.ACTEUR_SYSTEME = 'systeme@omegax';
//# sourceMappingURL=contexte-audit.js.map