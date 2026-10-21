"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.journauxDefaut = journauxDefaut;
const client_1 = require("@prisma/client");
function journauxDefaut(referentiel) {
    const caisse = referentiel === client_1.Referentiel.SYSCOHADA ? '57110000' : '57100000';
    return [
        { code: 'ACH', intitule: 'Achats', type: client_1.TypeJournal.ACHATS, numerotation: client_1.NumerotationPiece.CONTINUE_JOURNAL },
        { code: 'VEN', intitule: 'Ventes', type: client_1.TypeJournal.VENTES, numerotation: client_1.NumerotationPiece.CONTINUE_JOURNAL },
        {
            code: 'BQ',
            intitule: 'Banque',
            type: client_1.TypeJournal.TRESORERIE,
            numerotation: client_1.NumerotationPiece.MENSUELLE,
            numeroCompteTresorerie: '52110000',
        },
        {
            code: 'CA',
            intitule: 'Caisse',
            type: client_1.TypeJournal.TRESORERIE,
            numerotation: client_1.NumerotationPiece.MENSUELLE,
            numeroCompteTresorerie: caisse,
        },
        { code: 'OD', intitule: 'Opérations diverses', type: client_1.TypeJournal.GENERAL, numerotation: client_1.NumerotationPiece.CONTINUE_FICHIER },
    ];
}
//# sourceMappingURL=journal-seed.js.map