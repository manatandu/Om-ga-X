"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rattachement_ecriture_1 = require("./rattachement-ecriture");
describe('lignesManquantes', () => {
    const ouverture = [
        { compte: '41110001', sens: 'DEBIT', montant: 12000 },
        { compte: '4194', sens: 'CREDIT', montant: 12000 },
    ];
    it('une écriture qui porte chaque ligne proposée, sur une subdivision semée, couvre la proposition', () => {
        const lignes = [
            { numero: '41110001', debit: 12000, credit: 0 },
            { numero: '41940000', debit: 0, credit: 12000 },
        ];
        expect((0, rattachement_ecriture_1.lignesManquantes)(ouverture, lignes)).toEqual([]);
    });
    it('des lignes en plus sont admises (une TVA saisie à la main)', () => {
        const lignes = [
            { numero: '41110001', debit: 13920, credit: 0 },
            { numero: '41940000', debit: 0, credit: 12000 },
            { numero: '44310000', debit: 0, credit: 1920 },
        ];
        expect((0, rattachement_ecriture_1.lignesManquantes)(ouverture, lignes)).toEqual([ouverture[0]]);
    });
    it('le sens compte · un 4194 débité ne passe pas une consignation émise', () => {
        const lignes = [
            { numero: '41940000', debit: 12000, credit: 0 },
            { numero: '41110001', debit: 0, credit: 12000 },
        ];
        expect((0, rattachement_ecriture_1.lignesManquantes)(ouverture, lignes)).toEqual(ouverture);
    });
    it('le montant compte au centime', () => {
        const lignes = [
            { numero: '41110001', debit: 12000, credit: 0 },
            { numero: '41940000', debit: 0, credit: 11999.99 },
        ];
        expect((0, rattachement_ecriture_1.lignesManquantes)(ouverture, lignes)).toEqual([ouverture[1]]);
    });
    it('une ligne de l’écriture ne sert qu’une fois', () => {
        const deux = [
            { compte: '4194', sens: 'CREDIT', montant: 500 },
            { compte: '4194', sens: 'CREDIT', montant: 500 },
        ];
        expect((0, rattachement_ecriture_1.lignesManquantes)(deux, [{ numero: '41940000', debit: 0, credit: 500 }])).toEqual([deux[1]]);
    });
    it('le message nomme le compte, le sens et le montant', () => {
        expect((0, rattachement_ecriture_1.decrireLigne)({ compte: '4194', sens: 'CREDIT', montant: 12000 })).toMatch(/^4194 au crédit pour 12\s000,00$/);
    });
});
//# sourceMappingURL=rattachement-ecriture.spec.js.map