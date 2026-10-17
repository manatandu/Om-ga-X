"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const double_authentification_1 = require("./double-authentification");
const CLE_RFC = Buffer.from('12345678901234567890');
const SECRET_RFC = (0, double_authentification_1.base32)(CLE_RFC);
describe('HOTP · vecteurs de la RFC 4226, annexe D', () => {
    it.each([
        [0, '755224'],
        [1, '287082'],
        [2, '359152'],
        [9, '520489'],
    ])('compteur %i → %s', (c, attendu) => expect((0, double_authentification_1.codeHotp)(CLE_RFC, c)).toBe(attendu));
});
describe('TOTP · vecteurs SHA-1 de la RFC 6238, annexe B (six derniers chiffres)', () => {
    it.each([
        [59, '287082'],
        [1111111109, '081804'],
        [1234567890, '005924'],
        [2000000000, '279037'],
    ])('T = %i s → %s', (t, attendu) => expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, attendu, t * 1000, null)).not.toBeNull());
});
describe('vérification', () => {
    const t = 1111111109 * 1000;
    it('un pas d’écart est admis, deux ne le sont pas', () => {
        expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, '081804', t + 30_000, null)).not.toBeNull();
        expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, '081804', t + 60_000, null)).toBeNull();
        expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, '081804', t - 30_000, null)).not.toBeNull();
    });
    it('un code déjà servi ne resert pas', () => {
        const pas = (0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, '081804', t, null);
        expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, '081804', t, pas)).toBeNull();
        expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, '081804', t, pas - 1)).toBe(pas);
    });
    it('un code faux ou mal formé est refusé', () => {
        expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, '081805', t, null)).toBeNull();
        expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, '81804', t, null)).toBeNull();
        expect((0, double_authentification_1.verifierCodeTotp)(SECRET_RFC, 'abcdef', t, null)).toBeNull();
    });
});
describe('secret et adresse', () => {
    it('base32 aller-retour, et un secret de vingt octets', () => {
        const s = (0, double_authentification_1.genererSecret)();
        expect(s).toMatch(/^[A-Z2-7]{32}$/);
        expect((0, double_authentification_1.depuisBase32)(s)).toHaveLength(20);
        expect((0, double_authentification_1.depuisBase32)((0, double_authentification_1.base32)(CLE_RFC)).equals(CLE_RFC)).toBe(true);
    });
    it('l’URI nomme l’émetteur et le compte', () => {
        expect((0, double_authentification_1.uriOtpauth)('ABC', 'admin@vmg.cd')).toBe('otpauth://totp/OmegaX%3Aadmin%40vmg.cd?secret=ABC&issuer=OmegaX&algorithm=SHA1&digits=6&period=30');
    });
});
describe('codes de secours', () => {
    it('chacun sert une fois, quelle que soit la casse ou le tiret', () => {
        const { codes, empreintes } = (0, double_authentification_1.genererCodesSecours)();
        expect(codes).toHaveLength(8);
        expect(new Set(codes).size).toBe(8);
        expect(empreintes.some((e) => codes.includes(e))).toBe(false);
        const reste = (0, double_authentification_1.consommerCodeSecours)(codes[3].toLowerCase().replace('-', ' '), empreintes);
        expect(reste).toHaveLength(7);
        expect((0, double_authentification_1.consommerCodeSecours)(codes[3], reste)).toBeNull();
        expect((0, double_authentification_1.consommerCodeSecours)('ZZZZZ-ZZZZZ', empreintes)).toBeNull();
    });
});
//# sourceMappingURL=double-authentification.spec.js.map