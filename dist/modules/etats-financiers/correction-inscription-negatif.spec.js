"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
const correspondance_tft_1 = require("./correspondance-tft");
function cumuls(lignes, numero) {
    const duCompte = lignes.filter((l) => l.numero === numero);
    return {
        cumulDebit: duCompte.reduce((s, l) => s + l.debit, 0),
        cumulCredit: duCompte.reduce((s, l) => s + l.credit, 0),
        solde: duCompte.reduce((s, l) => s + l.debit - l.credit, 0),
    };
}
const ERREUR = [
    { numero: '60400000', debit: 1000, credit: 0 },
    { numero: '40110000', debit: 0, credit: 1000 },
];
const INSCRIPTION_EN_NEGATIF = [
    { numero: '60400000', debit: -1000, credit: 0 },
    { numero: '40110000', debit: 0, credit: -1000 },
];
const CONTRE_PASSATION = [
    { numero: '60400000', debit: 0, credit: 1000 },
    { numero: '40110000', debit: 1000, credit: 0 },
];
describe('Art. 20 AUDCIF · pourquoi « exclusivement » l’inscription en négatif', () => {
    it('les deux techniques donnent le même SOLDE · c’est ce qui les fait confondre', () => {
        expect(cumuls([...ERREUR, ...INSCRIPTION_EN_NEGATIF], '60400000').solde).toBe(0);
        expect(cumuls([...ERREUR, ...CONTRE_PASSATION], '60400000').solde).toBe(0);
    });
    it('mais la contre-passation GONFLE les deux cumuls que la balance doit publier', () => {
        expect(cumuls([...ERREUR, ...CONTRE_PASSATION], '60400000')).toEqual({
            cumulDebit: 1000,
            cumulCredit: 1000,
            solde: 0,
        });
        expect(cumuls([...ERREUR, ...INSCRIPTION_EN_NEGATIF], '60400000')).toEqual({
            cumulDebit: 0,
            cumulCredit: 0,
            solde: 0,
        });
    });
    it('la contre-passation d’une acquisition erronée invente une CESSION au tableau des flux', () => {
        const fi = correspondance_tft_1.TOUS_LES_POSTES_FLUX.find((p) => p.ref === 'FI');
        expect(fi.lectureFlux).toBe('DEBIT_SEUL');
        expect((0, etats_financiers_communs_1.correspond)('23110000', fi.comptesFlux, fi.exclusionsFlux)).toBe(true);
        const acquisitionErronee = [
            { numero: '23110000', debit: 5000, credit: 0 },
            { numero: '52110000', debit: 0, credit: 5000 },
        ];
        const lectureDebitSeul = (lignes) => lignes.filter((l) => l.numero === '23110000').reduce((s, l) => s + l.debit, 0);
        const lectureCreditSeul = (lignes) => lignes.filter((l) => l.numero === '23110000').reduce((s, l) => s + l.credit, 0);
        const contrePassee = [...acquisitionErronee, { numero: '23110000', debit: 0, credit: 5000 }, { numero: '52110000', debit: 5000, credit: 0 }];
        expect(lectureDebitSeul(contrePassee)).toBe(5000);
        expect(lectureCreditSeul(contrePassee)).toBe(5000);
        const enNegatif = [...acquisitionErronee, { numero: '23110000', debit: -5000, credit: 0 }, { numero: '52110000', debit: 0, credit: -5000 }];
        expect(lectureDebitSeul(enNegatif)).toBe(0);
        expect(lectureCreditSeul(enNegatif)).toBe(0);
    });
    it('l’écriture de correction reste ÉQUILIBRÉE · un négatif de chaque côté', () => {
        const d = INSCRIPTION_EN_NEGATIF.reduce((s, l) => s + l.debit, 0);
        const c = INSCRIPTION_EN_NEGATIF.reduce((s, l) => s + l.credit, 0);
        expect(d).toBe(-1000);
        expect(Math.abs(d - c)).toBeLessThan(0.005);
    });
});
describe('Le signe ne décide pas du sens d’une ligne', () => {
    const estDebit = (l) => Math.abs(l.debit) > 0.005;
    it('un débit NÉGATIF reste une ligne de débit', () => {
        expect(estDebit({ debit: 1000 })).toBe(true);
        expect(estDebit({ debit: -1000 })).toBe(true);
        expect(estDebit({ debit: 0 })).toBe(false);
    });
    it('le lettrage lit l’EFFET NET, identique sur toute ligne ordinaire', () => {
        const net = (l) => l.debit - l.credit;
        expect(net({ numero: 'x', debit: 1000, credit: 0 })).toBe(1000);
        expect(net({ numero: 'x', debit: 0, credit: 1000 })).toBe(-1000);
        expect(net({ numero: 'x', debit: -1000, credit: 0 })).toBe(-1000);
    });
    it('un crédit NÉGATIF est une augmentation négative, pas une diminution nulle', () => {
        const ventiler = (ligne) => {
            const estCredit = Math.abs(ligne.credit) > 0.005;
            return {
                sens: estCredit ? 'augmentation' : 'diminution',
                montant: estCredit ? ligne.credit : ligne.debit,
            };
        };
        expect(ventiler({ debit: 0, credit: 500 })).toEqual({ sens: 'augmentation', montant: 500 });
        expect(ventiler({ debit: 0, credit: -500 })).toEqual({ sens: 'augmentation', montant: -500 });
        expect(ventiler({ debit: 500, credit: 0 })).toEqual({ sens: 'diminution', montant: 500 });
        const ancienne = (ligne) => ({
            sens: ligne.credit > 0 ? 'augmentation' : 'diminution',
            montant: ligne.credit > 0 ? ligne.credit : ligne.debit,
        });
        expect(ancienne({ debit: 0, credit: -500 })).toEqual({ sens: 'diminution', montant: 0 });
    });
});
describe('Effet sur la balance générale', () => {
    it('un compte mouvementé par erreur puis corrigé disparaît de la balance', () => {
        const ligne = (numero, d, c) => ({
            numero,
            classe: client_1.ClasseCompte.CLASSE_6,
            typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
            totalDebit: d,
            totalCredit: c,
        });
        const balance = [ligne('60400000', 0, 0), ligne('60500000', 300, 0)]
            .filter((l) => l.totalDebit !== 0 || l.totalCredit !== 0);
        expect(balance.map((l) => l.numero)).toEqual(['60500000']);
    });
});
//# sourceMappingURL=correction-inscription-negatif.spec.js.map