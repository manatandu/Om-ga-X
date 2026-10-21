"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSIONS_PUBLIEES = void 0;
exports.versionPubliee = versionPubliee;
exports.empreinteEnVigueur = empreinteEnVigueur;
const conditions_de_licence_1 = require("./conditions-de-licence");
const empreinte_1 = require("./empreinte");
const version_1_1 = require("./versions/version-1");
exports.VERSIONS_PUBLIEES = [
    {
        numero: 1,
        date: '2026-10-15',
        dateLisible: '15 octobre 2026',
        communiqueeLe: null,
        enVigueurLe: '2026-10-15',
        empreinte: '1a878fe68d79ec76fa40173395750ab68cbf8a1a581c91397e45b30815dac75d',
        texte: version_1_1.TEXTE_VERSION_1,
    },
];
function versionPubliee(numero) {
    return exports.VERSIONS_PUBLIEES.find((v) => v.numero === numero) ?? null;
}
let empreinteMemorisee = null;
function empreinteEnVigueur() {
    if (empreinteMemorisee === null)
        empreinteMemorisee = (0, empreinte_1.sha256Hex)((0, conditions_de_licence_1.texteBrutDesConditions)());
    return empreinteMemorisee;
}
//# sourceMappingURL=versions-publiees.js.map