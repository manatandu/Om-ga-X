"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_FORMAT_LETTRE = exports.FORMAT_LETTRE_CHOISIE = void 0;
exports.normaliserLettre = normaliserLettre;
exports.lettreBienFormee = lettreBienFormee;
exports.motifLettreDejaEmployee = motifLettreDejaEmployee;
exports.FORMAT_LETTRE_CHOISIE = /^[A-Za-z]{1,4}$/;
exports.MOTIF_FORMAT_LETTRE = 'La lettre de lettrage se compose d’une à quatre lettres, sans chiffre, accent ni signe (A, B, ..., Z, AA, ...).';
function normaliserLettre(lettre) {
    return lettre.trim().toUpperCase();
}
function lettreBienFormee(lettre) {
    return exports.FORMAT_LETTRE_CHOISIE.test(lettre.trim());
}
function motifLettreDejaEmployee(p) {
    const groupe = p.statutGroupe === 'SOLDE'
        ? 'par un lettrage soldé'
        : p.statutGroupe === 'PARTIEL'
            ? `par un lettrage partiel (affiché « ${p.lettre.toLowerCase()} »)`
            : 'sur des lignes déjà lettrées';
    return (`La lettre « ${p.lettre} » est déjà employée sur le compte ${p.compteNumero} ${groupe} · un repère ne réunit qu'un ` +
        `seul groupe. Choisissez une autre lettre, ou laissez la lettre proposée (« ${p.lettreProposee} »).`);
}
//# sourceMappingURL=lettre-choisie.js.map