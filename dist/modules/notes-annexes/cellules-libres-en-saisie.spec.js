"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cellules_libres_en_saisie_1 = require("./cellules-libres-en-saisie");
const tableau = (rubriques) => ({
    code: '1',
    sousTableau: 'ESSAI',
    titre: 'ESSAI',
    colonnes: [
        { type: 'LIBRE', libelle: 'Note' },
        { type: 'EXERCICE_N', libelle: 'Montant brut' },
        { type: 'LIBRE', libelle: 'Hypothèques', saisieSurLigneChiffree: true },
    ],
    rubriques,
});
describe('cellules LIBRE d’une rubrique chiffrée', () => {
    it('une colonne s’ouvre si elle est LIBRE ET déclarée · jamais une colonne de montant, même qualifiée', () => {
        expect((0, cellules_libres_en_saisie_1.colonneLibreEnSaisie)({ type: 'LIBRE', libelle: 'Hypothèques', saisieSurLigneChiffree: true })).toBe(true);
        expect((0, cellules_libres_en_saisie_1.colonneLibreEnSaisie)({ type: 'LIBRE', libelle: 'Note' })).toBe(false);
        expect((0, cellules_libres_en_saisie_1.colonneLibreEnSaisie)({ type: 'EXERCICE_N', libelle: 'Montant brut', saisieSurLigneChiffree: true })).toBe(false);
    });
    it('une ligne de dette à clé s’ouvre ; sans clé, elle n’a pas d’ancre', () => {
        const dette = { cle: 'dette', libelle: 'Dette', comptes: ['162'] };
        const sansCle = { libelle: 'Dette', comptes: ['162'] };
        expect((0, cellules_libres_en_saisie_1.celluleLibreEnSaisie)(tableau([dette]), dette)).toBe(true);
        expect((0, cellules_libres_en_saisie_1.celluleLibreEnSaisie)(tableau([sansCle]), sansCle)).toBe(false);
    });
    it('un total ne s’ouvre JAMAIS, même pourvu d’une clé · un texte ne s’additionne pas', () => {
        const dette = { cle: 'dette', libelle: 'Dette', comptes: ['162'] };
        const total = { cle: 'total', libelle: 'TOTAL', totalDeRubriques: [0] };
        expect((0, cellules_libres_en_saisie_1.celluleLibreEnSaisie)(tableau([dette, total]), total)).toBe(false);
    });
    it('une rubrique entièrement en saisie ne passe pas par cette règle · elle ouvre déjà tout', () => {
        const enSaisie = { cle: 'libre', libelle: 'Libre', saisie: true };
        expect((0, cellules_libres_en_saisie_1.celluleLibreEnSaisie)(tableau([enSaisie]), enSaisie)).toBe(false);
    });
    it('un tableau sans colonne déclarée n’ouvre rien', () => {
        const dette = { cle: 'dette', libelle: 'Dette', comptes: ['162'] };
        const sansColonne = { ...tableau([dette]), colonnes: [{ type: 'LIBRE', libelle: 'Note' }] };
        expect((0, cellules_libres_en_saisie_1.celluleLibreEnSaisie)(sansColonne, dette)).toBe(false);
    });
});
//# sourceMappingURL=cellules-libres-en-saisie.spec.js.map