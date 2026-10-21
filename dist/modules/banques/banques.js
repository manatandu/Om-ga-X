"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliserIban = normaliserIban;
exports.ibanValide = ibanValide;
exports.motifRefusJournalBanque = motifRefusJournalBanque;
const client_1 = require("@prisma/client");
function normaliserIban(iban) {
    return iban.replace(/\s+/g, '').toUpperCase();
}
function ibanValide(brut) {
    const iban = normaliserIban(brut);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban))
        return false;
    const reordonne = iban.slice(4) + iban.slice(0, 4);
    let reste = 0;
    for (const c of reordonne) {
        const v = c >= 'A' && c <= 'Z' ? String(c.charCodeAt(0) - 55) : c;
        for (const chiffre of v)
            reste = (reste * 10 + Number(chiffre)) % 97;
    }
    return reste === 1;
}
function motifRefusJournalBanque(journal) {
    if (!journal)
        return 'Journal introuvable dans ce dossier.';
    if (journal.type !== client_1.TypeJournal.TRESORERIE) {
        return `Le journal ${journal.code} n'est pas un journal de trésorerie · un RIB ne se rattache qu'à un journal de banque.`;
    }
    if (journal.compteTresorerie?.numero.startsWith('57')) {
        return `Le journal ${journal.code} porte une caisse (${journal.compteTresorerie.numero}) · un RIB ne se rattache qu'à un journal de banque.`;
    }
    return null;
}
//# sourceMappingURL=banques.js.map