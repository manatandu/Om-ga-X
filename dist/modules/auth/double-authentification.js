"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SANS_DOUBLE_AUTH = exports.NOMBRE_CODES_SECOURS = exports.FENETRE_PAS = exports.CHIFFRES = exports.PAS_SECONDES = void 0;
exports.base32 = base32;
exports.depuisBase32 = depuisBase32;
exports.genererSecret = genererSecret;
exports.codeHotp = codeHotp;
exports.pasDe = pasDe;
exports.verifierCodeTotp = verifierCodeTotp;
exports.uriOtpauth = uriOtpauth;
exports.normaliserCodeSecours = normaliserCodeSecours;
exports.empreinteCodeSecours = empreinteCodeSecours;
exports.genererCodesSecours = genererCodesSecours;
exports.consommerCodeSecours = consommerCodeSecours;
exports.secondFacteurAccepte = secondFacteurAccepte;
const crypto_1 = require("crypto");
exports.PAS_SECONDES = 30;
exports.CHIFFRES = 6;
exports.FENETRE_PAS = 1;
exports.NOMBRE_CODES_SECOURS = 8;
const ALPHABET_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(octets) {
    let bits = 0;
    let valeur = 0;
    let sortie = '';
    for (const octet of octets) {
        valeur = (valeur << 8) | octet;
        bits += 8;
        while (bits >= 5) {
            sortie += ALPHABET_BASE32[(valeur >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0)
        sortie += ALPHABET_BASE32[(valeur << (5 - bits)) & 31];
    return sortie;
}
function depuisBase32(texte) {
    const propre = texte.toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0;
    let valeur = 0;
    const octets = [];
    for (const c of propre) {
        const i = ALPHABET_BASE32.indexOf(c);
        if (i < 0)
            throw new Error('Secret illisible.');
        valeur = (valeur << 5) | i;
        bits += 5;
        if (bits >= 8) {
            octets.push((valeur >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(octets);
}
function genererSecret() {
    return base32((0, crypto_1.randomBytes)(20));
}
function codeHotp(cle, compteur, chiffres = exports.CHIFFRES) {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(compteur));
    const hmac = (0, crypto_1.createHmac)('sha1', cle).update(message).digest();
    const decalage = hmac[hmac.length - 1] & 0x0f;
    const binaire = hmac.readUInt32BE(decalage) & 0x7fffffff;
    return String(binaire % 10 ** chiffres).padStart(chiffres, '0');
}
function pasDe(instantMs) {
    return Math.floor(instantMs / 1000 / exports.PAS_SECONDES);
}
function verifierCodeTotp(secret, code, instantMs, dernierPas) {
    const propre = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(propre))
        return null;
    const cle = depuisBase32(secret);
    const courant = pasDe(instantMs);
    for (let d = -exports.FENETRE_PAS; d <= exports.FENETRE_PAS; d++) {
        const pas = courant + d;
        if (dernierPas !== null && pas <= dernierPas)
            continue;
        const attendu = codeHotp(cle, pas);
        if ((0, crypto_1.timingSafeEqual)(Buffer.from(attendu), Buffer.from(propre)))
            return pas;
    }
    return null;
}
function uriOtpauth(secret, compte, emetteur = 'OmegaX') {
    const etiquette = encodeURIComponent(`${emetteur}:${compte}`);
    return `otpauth://totp/${etiquette}?secret=${secret}&issuer=${encodeURIComponent(emetteur)}&algorithm=SHA1&digits=${exports.CHIFFRES}&period=${exports.PAS_SECONDES}`;
}
function normaliserCodeSecours(code) {
    return code.toUpperCase().replace(/[\s-]/g, '');
}
function empreinteCodeSecours(code) {
    return (0, crypto_1.createHash)('sha256').update(normaliserCodeSecours(code)).digest('hex');
}
function genererCodesSecours(n = exports.NOMBRE_CODES_SECOURS) {
    const codes = Array.from({ length: n }, () => {
        const brut = base32((0, crypto_1.randomBytes)(7)).slice(0, 10);
        return `${brut.slice(0, 5)}-${brut.slice(5)}`;
    });
    return { codes, empreintes: codes.map(empreinteCodeSecours) };
}
function consommerCodeSecours(code, empreintes) {
    if (normaliserCodeSecours(code).length !== 10)
        return null;
    const e = empreinteCodeSecours(code);
    const i = empreintes.indexOf(e);
    return i < 0 ? null : [...empreintes.slice(0, i), ...empreintes.slice(i + 1)];
}
function secondFacteurAccepte(u, code, instantMs) {
    if (!u.secretDoubleAuth)
        return null;
    const pas = verifierCodeTotp(u.secretDoubleAuth, code, instantMs, u.dernierPasDoubleAuth);
    if (pas !== null)
        return { dernierPasDoubleAuth: pas };
    const reste = consommerCodeSecours(code, u.codesSecoursDoubleAuth);
    return reste ? { codesSecoursDoubleAuth: reste } : null;
}
exports.SANS_DOUBLE_AUTH = {
    secretDoubleAuth: null,
    doubleAuthActiveDepuis: null,
    dernierPasDoubleAuth: null,
    codesSecoursDoubleAuth: [],
};
//# sourceMappingURL=double-authentification.js.map