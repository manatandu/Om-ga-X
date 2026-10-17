"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const adresse_courriel_1 = require("./adresse-courriel");
describe('adresse de destinataire · ce qui est refusé à l’écriture', () => {
    it('refuse le vide et l’espace seule', () => {
        expect((0, adresse_courriel_1.adresseAcceptable)((0, adresse_courriel_1.normaliserAdresse)(''))).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)((0, adresse_courriel_1.normaliserAdresse)('   '))).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)((0, adresse_courriel_1.normaliserAdresse)(null))).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)((0, adresse_courriel_1.normaliserAdresse)(undefined))).toBe(false);
    });
    it('refuse ce qui n’a pas exactement une arobase', () => {
        expect((0, adresse_courriel_1.adresseAcceptable)('comptable.vmg.cd')).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)('a@b@vmg.cd')).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)('@vmg.cd')).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)('comptable@')).toBe(false);
    });
    it('refuse un domaine qu’aucun réseau ne joint', () => {
        expect((0, adresse_courriel_1.adresseAcceptable)('comptable@intranet')).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)('comptable@.cd')).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)('comptable@vmg.')).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)('comptable@vmg..cd')).toBe(false);
    });
    it('refuse une espace ou un retour à la ligne au milieu', () => {
        expect((0, adresse_courriel_1.adresseAcceptable)('comp table@vmg.cd')).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)('comptable@vmg.cd\nBcc: ailleurs@ext.cd')).toBe(false);
    });
    it('refuse une LISTE glissée dans un champ qui n’en attend qu’une', () => {
        expect((0, adresse_courriel_1.adresseAcceptable)('a@vmg.cd,b@vmg.cd')).toBe(false);
        expect((0, adresse_courriel_1.adresseAcceptable)('a@vmg.cd;b@vmg.cd')).toBe(false);
    });
    it('accepte les formes réelles, y compris celles qu’un filtre trop zélé rejette', () => {
        expect((0, adresse_courriel_1.adresseAcceptable)('jean-pierre.mukendi+omegax@vmg-consulting.cd')).toBe(true);
        expect((0, adresse_courriel_1.adresseAcceptable)('contact@ong.example.org')).toBe(true);
        expect((0, adresse_courriel_1.adresseAcceptable)((0, adresse_courriel_1.normaliserAdresse)('  contact@ong.cd  '))).toBe(true);
    });
    it('refuse au-delà de 254 caractères', () => {
        expect((0, adresse_courriel_1.adresseAcceptable)(`${'a'.repeat(250)}@vmg.cd`)).toBe(false);
    });
});
//# sourceMappingURL=adresse-courriel.spec.js.map