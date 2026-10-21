"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NUMEROTATION_PAR_DEFAUT = exports.NUMEROTATION_DU_FICHIER = void 0;
exports.porteLaSequenceDuFichier = porteLaSequenceDuFichier;
exports.journauxDeLaSequenceDuFichier = journauxDeLaSequenceDuFichier;
exports.modeEffectif = modeEffectif;
exports.prochainNumeroPiece = prochainNumeroPiece;
exports.numeroteurDeLot = numeroteurDeLot;
const client_1 = require("@prisma/client");
exports.NUMEROTATION_DU_FICHIER = client_1.NumerotationPiece.CONTINUE_FICHIER;
exports.NUMEROTATION_PAR_DEFAUT = client_1.NumerotationPiece.CONTINUE_JOURNAL;
function porteLaSequenceDuFichier(journal) {
    return journal.numerotation === exports.NUMEROTATION_DU_FICHIER && journal.type !== client_1.TypeJournal.SITUATION;
}
function journauxDeLaSequenceDuFichier(journaux) {
    return journaux.filter(porteLaSequenceDuFichier);
}
function modeEffectif(journal) {
    return journal.numerotation === exports.NUMEROTATION_DU_FICHIER && !porteLaSequenceDuFichier(journal)
        ? client_1.NumerotationPiece.CONTINUE_JOURNAL
        : journal.numerotation;
}
async function prochainNumeroPiece(tx, tenantId, journal, exerciceId, date) {
    switch (modeEffectif(journal)) {
        case client_1.NumerotationPiece.MANUELLE:
            return null;
        case client_1.NumerotationPiece.CONTINUE_JOURNAL: {
            const max = await tx.ecriture.aggregate({
                where: { tenantId, journalId: journal.id, exerciceId },
                _max: { numeroPiece: true },
            });
            return (max._max.numeroPiece ?? 0) + 1;
        }
        case client_1.NumerotationPiece.CONTINUE_FICHIER: {
            const max = await tx.ecriture.aggregate({
                where: { tenantId, exerciceId, journal: { numerotation: exports.NUMEROTATION_DU_FICHIER, type: { not: client_1.TypeJournal.SITUATION } } },
                _max: { numeroPiece: true },
            });
            return (max._max.numeroPiece ?? 0) + 1;
        }
        case client_1.NumerotationPiece.MENSUELLE: {
            const debutMois = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
            const debutMoisSuivant = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
            const max = await tx.ecriture.aggregate({
                where: { tenantId, journalId: journal.id, date: { gte: debutMois, lt: debutMoisSuivant } },
                _max: { numeroPiece: true },
            });
            return (max._max.numeroPiece ?? 0) + 1;
        }
    }
}
function numeroteurDeLot(tx, tenantId, exerciceId) {
    const prochains = new Map();
    return async (journal, date) => {
        const cle = serieDeNumerotation(journal, date);
        if (cle === null)
            return null;
        const numero = prochains.get(cle) ?? (await prochainNumeroPiece(tx, tenantId, journal, exerciceId, date));
        if (numero === null)
            return null;
        prochains.set(cle, numero + 1);
        return numero;
    };
}
function serieDeNumerotation(journal, date) {
    switch (modeEffectif(journal)) {
        case client_1.NumerotationPiece.MANUELLE:
            return null;
        case client_1.NumerotationPiece.CONTINUE_JOURNAL:
            return `journal:${journal.id}`;
        case client_1.NumerotationPiece.CONTINUE_FICHIER:
            return 'fichier';
        case client_1.NumerotationPiece.MENSUELLE:
            return `mois:${journal.id}:${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
    }
}
//# sourceMappingURL=numerotation-piece.js.map