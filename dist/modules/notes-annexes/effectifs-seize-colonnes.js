"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_RETRAIT_MAX = exports.MOTIF_RETRAIT_MIN = exports.SOUS_TABLEAU_PERSONNEL_PROPRE = exports.NOTES_EFFECTIFS_SEIZE_COLONNES = exports.LIBELLES_FORMAT_HUIT_COLONNES = exports.RANG_FORMAT_ANTERIEUR = void 0;
exports.colonnesEffectifsSycebnl = colonnesEffectifsSycebnl;
exports.estTableauEffectifsSeizeColonnes = estTableauEffectifsSeizeColonnes;
exports.natureColonneAnterieure = natureColonneAnterieure;
const client_1 = require("@prisma/client");
exports.RANG_FORMAT_ANTERIEUR = 100;
exports.LIBELLES_FORMAT_HUIT_COLONNES = [
    'EFFECTIFS · Nationaux (M / F)',
    'EFFECTIFS · Autres Etats de la Région (M / F)',
    'EFFECTIFS · Hors Région (M / F)',
    'EFFECTIFS · Total (M / F)',
    'MASSE SALARIALE · Nationaux (M / F)',
    'MASSE SALARIALE · Autres Etats de la Région (M / F)',
    'MASSE SALARIALE · Hors Région (M / F)',
    'MASSE SALARIALE · Total (M / F)',
];
function colonnesEffectifsSycebnl() {
    const zones = ['Nationaux', 'Autres Etats de la Région', 'Hors Région', 'Total'];
    const bloc = (tableau) => zones.flatMap((zone) => ['M', 'F'].map((sexe) => ({ type: 'LIBRE', libelle: `${tableau} · ${zone} · ${sexe}` })));
    return [...bloc('EFFECTIFS'), ...bloc('MASSE SALARIALE')];
}
exports.NOTES_EFFECTIFS_SEIZE_COLONNES = [
    { jeu: client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS, code: '29B' },
    { jeu: client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT, code: '20B' },
];
exports.SOUS_TABLEAU_PERSONNEL_PROPRE = 'PERSONNEL PROPRE';
function estTableauEffectifsSeizeColonnes(jeu, code, sousTableau) {
    return (sousTableau === exports.SOUS_TABLEAU_PERSONNEL_PROPRE && exports.NOTES_EFFECTIFS_SEIZE_COLONNES.some((n) => n.jeu === jeu && n.code === code));
}
function natureColonneAnterieure(rang) {
    return rang < 4 ? 'EFFECTIF' : 'MASSE_SALARIALE';
}
exports.MOTIF_RETRAIT_MIN = 3;
exports.MOTIF_RETRAIT_MAX = 500;
//# sourceMappingURL=effectifs-seize-colonnes.js.map