"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_DIX_SEQUENCES = exports.LONGUEUR_MAX_INTITULE_SEQUENCE = exports.NOMBRE_MAX_SEQUENCES = void 0;
exports.premierRangLibre = premierRangLibre;
exports.motifRefusIntituleSequence = motifRefusIntituleSequence;
exports.motifSequenceOccupee = motifSequenceOccupee;
exports.NOMBRE_MAX_SEQUENCES = 10;
exports.LONGUEUR_MAX_INTITULE_SEQUENCE = 35;
function premierRangLibre(pris) {
    const occupes = new Set(pris);
    for (let n = 1; n <= exports.NOMBRE_MAX_SEQUENCES; n++)
        if (!occupes.has(n))
            return n;
    return null;
}
function motifRefusIntituleSequence(intitule) {
    const t = intitule.trim();
    if (!t)
        return "L'intitulé de la séquence est obligatoire.";
    if (t.length > exports.LONGUEUR_MAX_INTITULE_SEQUENCE) {
        return `L'intitulé d'une séquence tient en ${exports.LONGUEUR_MAX_INTITULE_SEQUENCE} caractères au plus (${t.length} tapés).`;
    }
    return null;
}
exports.MOTIF_DIX_SEQUENCES = `Le dossier compte déjà ${exports.NOMBRE_MAX_SEQUENCES} séquences de saisie, le nombre maximal · renommez-en une, ou ` +
    "retirez celle qui ne sert plus.";
function motifSequenceOccupee(intitule, nombreModeles) {
    return (`La séquence « ${intitule} » range ${nombreModeles} modèle(s) de saisie · retirez-les d'abord de la séquence ` +
        '(Modèles de saisie), ou renommez-la.');
}
//# sourceMappingURL=sequences-saisie.js.map