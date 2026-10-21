"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tauxTvaDefaut = tauxTvaDefaut;
const client_1 = require("@prisma/client");
function tauxTvaDefaut(referentiel) {
    const deductible = referentiel === client_1.Referentiel.SYSCOHADA ? '44520000' : '44510000';
    return [
        { code: 'TVA16', intitule: 'Taux normal 16 %', taux: 16, numeroCompteCollecte: '44310000', numeroCompteDeductible: deductible },
        { code: 'TVA1', intitule: 'Taux réduit 1 %', taux: 1, numeroCompteCollecte: '44310000', numeroCompteDeductible: deductible },
        { code: 'TVA5', intitule: 'Taux réduit 5 % (billets d’avion, trafic aérien national)', taux: 5, numeroCompteCollecte: '44310000', numeroCompteDeductible: deductible },
        { code: 'TVA0', intitule: 'Taux zéro (exportations)', taux: 0, numeroCompteCollecte: '44310000' },
    ];
}
//# sourceMappingURL=taux-tva-seed.js.map