"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionJournalisee = transactionJournalisee;
const contexte_audit_1 = require("./contexte-audit");
function transactionJournalisee(prisma, fn, options) {
    const acte = (tx) => (0, contexte_audit_1.journaliserDansTransaction)(tx, () => fn(tx));
    return options === undefined ? prisma.$transaction(acte) : prisma.$transaction(acte, options);
}
//# sourceMappingURL=transaction-journalisee.js.map