"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPLICATION_PERIMETRE = void 0;
exports.perimetreDeLaSequence = perimetreDeLaSequence;
exports.trousDeLaSequence = trousDeLaSequence;
exports.compterManquants = compterManquants;
exports.trousHorsNumerosRattaches = trousHorsNumerosRattaches;
const client_1 = require("@prisma/client");
function perimetreDeLaSequence(numerotation) {
    switch (numerotation) {
        case client_1.NumerotationPiece.CONTINUE_JOURNAL:
            return 'JOURNAL_EXERCICE';
        case client_1.NumerotationPiece.CONTINUE_FICHIER:
            return 'DOSSIER_EXERCICE';
        case client_1.NumerotationPiece.MENSUELLE:
            return 'JOURNAL_MOIS';
        case client_1.NumerotationPiece.MANUELLE:
            return 'AUCUN';
    }
}
exports.EXPLICATION_PERIMETRE = {
    JOURNAL_EXERCICE: "Numérotation continue par journal : la séquence est vérifiée sur ce journal, pour l'exercice entier.",
    DOSSIER_EXERCICE: "Numérotation continue sur le fichier : la séquence court sur TOUS les journaux du dossier. Elle n'est donc pas vérifiable journal par journal, et le contrôle porte sur le dossier · voir la ligne de synthèse.",
    JOURNAL_MOIS: "Numérotation mensuelle : la séquence repart de 1 chaque mois civil. Les trous sont cherchés mois par mois · lus sur l'exercice entier, les numéros d'un mois boucheraient les manques d'un autre et le contrôle se tairait à tort.",
    AUCUN: "Numérotation manuelle : aucune séquence n'est imposée par le journal, il n'y a donc aucun trou à chercher. Le logiciel ne se prononce pas.",
};
function trousDeLaSequence(numeros) {
    const tries = [...new Set(numeros)].sort((a, b) => a - b);
    const trous = [];
    for (let i = 1; i < tries.length; i++) {
        if (tries[i] === tries[i - 1] + 1)
            continue;
        trous.push({ de: tries[i - 1] + 1, a: tries[i] - 1 });
    }
    return trous;
}
function compterManquants(trous) {
    return trous.reduce((t, i) => t + (i.a - i.de + 1), 0);
}
function trousHorsNumerosRattaches(trous, ailleurs) {
    const presents = new Set(ailleurs);
    if (presents.size === 0)
        return { trous, rattaches: 0 };
    const restants = [];
    let rattaches = 0;
    for (const t of trous) {
        let debut = null;
        for (let n = t.de; n <= t.a; n++) {
            if (presents.has(n)) {
                rattaches++;
                if (debut !== null) {
                    restants.push({ de: debut, a: n - 1 });
                    debut = null;
                }
            }
            else if (debut === null) {
                debut = n;
            }
        }
        if (debut !== null)
            restants.push({ de: debut, a: t.a });
    }
    return { trous: restants, rattaches };
}
//# sourceMappingURL=sequence-pieces.js.map