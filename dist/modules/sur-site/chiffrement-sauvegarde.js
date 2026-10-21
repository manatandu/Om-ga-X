"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LONGUEUR_PHRASE_MIN = exports.ENTETE_CHIFFREE = void 0;
exports.motifRefusPhrase = motifRefusPhrase;
exports.nouveauSel = nouveauSel;
exports.deriverCle = deriverCle;
exports.chiffrerFichier = chiffrerFichier;
exports.dechiffrerFichier = dechiffrerFichier;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("stream/promises");
exports.ENTETE_CHIFFREE = Buffer.from('OMXSAV01', 'ascii');
const LONGUEUR_SEL = 16;
const LONGUEUR_VECTEUR = 12;
const LONGUEUR_ETIQUETTE = 16;
const DEBUT_CHIFFRE = exports.ENTETE_CHIFFREE.length + LONGUEUR_SEL + LONGUEUR_VECTEUR;
exports.LONGUEUR_PHRASE_MIN = 12;
function motifRefusPhrase(phrase) {
    if (!phrase || phrase.length < exports.LONGUEUR_PHRASE_MIN) {
        return `La phrase de chiffrement doit compter au moins ${exports.LONGUEUR_PHRASE_MIN} caractères · c'est elle, et elle seule, qui relira la copie externe si le disque de ce poste lâche.`;
    }
    return null;
}
function nouveauSel() {
    return (0, crypto_1.randomBytes)(LONGUEUR_SEL);
}
function deriverCle(phrase, sel) {
    return (0, crypto_1.scryptSync)(phrase.normalize('NFC'), sel, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
async function chiffrerFichier(source, cible, cle, sel) {
    const vecteur = (0, crypto_1.randomBytes)(LONGUEUR_VECTEUR);
    const chiffreur = (0, crypto_1.createCipheriv)('aes-256-gcm', cle, vecteur);
    const provisoire = `${cible}.partiel`;
    try {
        await (0, promises_1.pipeline)((0, fs_1.createReadStream)(source), async function* (entree) {
            yield Buffer.concat([exports.ENTETE_CHIFFREE, sel, vecteur]);
            for await (const morceau of entree)
                yield chiffreur.update(morceau);
            yield chiffreur.final();
            yield chiffreur.getAuthTag();
        }, (0, fs_1.createWriteStream)(provisoire));
        (0, fs_1.renameSync)(provisoire, cible);
    }
    catch (e) {
        retirerSansErreur(provisoire);
        throw e;
    }
}
async function dechiffrerFichier(source, cible, phrase) {
    const taille = (0, fs_1.statSync)(source).size;
    if (taille < DEBUT_CHIFFRE + LONGUEUR_ETIQUETTE)
        throw new Error('Fichier trop court pour une copie chiffrée d’OmegaX.');
    const tete = lireOctets(source, 0, DEBUT_CHIFFRE);
    if (!tete.subarray(0, exports.ENTETE_CHIFFREE.length).equals(exports.ENTETE_CHIFFREE)) {
        throw new Error('Ce fichier n’est pas une copie chiffrée d’OmegaX.');
    }
    const sel = tete.subarray(exports.ENTETE_CHIFFREE.length, exports.ENTETE_CHIFFREE.length + LONGUEUR_SEL);
    const vecteur = tete.subarray(exports.ENTETE_CHIFFREE.length + LONGUEUR_SEL, DEBUT_CHIFFRE);
    const etiquette = lireOctets(source, taille - LONGUEUR_ETIQUETTE, LONGUEUR_ETIQUETTE);
    const dechiffreur = (0, crypto_1.createDecipheriv)('aes-256-gcm', deriverCle(phrase, sel), vecteur);
    dechiffreur.setAuthTag(etiquette);
    const provisoire = `${cible}.partiel`;
    try {
        const fin = taille - LONGUEUR_ETIQUETTE - 1;
        const entree = fin >= DEBUT_CHIFFRE ? (0, fs_1.createReadStream)(source, { start: DEBUT_CHIFFRE, end: fin }) : vide();
        await (0, promises_1.pipeline)(entree, dechiffreur, (0, fs_1.createWriteStream)(provisoire));
        (0, fs_1.renameSync)(provisoire, cible);
    }
    catch (e) {
        retirerSansErreur(provisoire);
        if (/unable to authenticate|auth/i.test(e.message)) {
            throw new Error('Phrase de chiffrement fausse, ou fichier altéré · rien n’a été écrit.');
        }
        throw e;
    }
}
async function* vide() {
}
function lireOctets(fichier, position, longueur) {
    const fd = (0, fs_1.openSync)(fichier, 'r');
    try {
        const b = Buffer.alloc(longueur);
        (0, fs_1.readSync)(fd, b, 0, longueur, position);
        return b;
    }
    finally {
        (0, fs_1.closeSync)(fd);
    }
}
function retirerSansErreur(fichier) {
    try {
        (0, fs_1.unlinkSync)(fichier);
    }
    catch {
    }
}
//# sourceMappingURL=chiffrement-sauvegarde.js.map