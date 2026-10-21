"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const correspondance_notes_associations_1 = require("./correspondance-notes-associations");
const correspondance_notes_projets_1 = require("./correspondance-notes-projets");
const intitules_notes_sycebnl_1 = require("./intitules-notes-sycebnl");
const JEUX = [
    ['associations', correspondance_notes_associations_1.NOTES_ASSOCIATIONS, intitules_notes_sycebnl_1.INTITULES_FICHE_ASSOCIATIONS, intitules_notes_sycebnl_1.TITRES_DE_NOTE_ASSOCIATIONS],
    ['projets', correspondance_notes_projets_1.NOTES_PROJETS, intitules_notes_sycebnl_1.INTITULES_FICHE_PROJETS, intitules_notes_sycebnl_1.TITRES_DE_NOTE_PROJETS],
];
describe.each(JEUX)('Intitulés des notes · jeu %s', (_nom, notes, fiche, titres) => {
    const codes = [...new Set(notes.map((n) => n.code))].sort();
    it('la fiche et les titres couvrent exactement les notes du jeu', () => {
        expect(Object.keys(fiche).sort()).toEqual(codes);
        expect(Object.keys(titres).sort()).toEqual(codes);
    });
    it('une note à un seul tableau porte, en tête, le titre de ce tableau', () => {
        const seuls = codes.filter((c) => notes.filter((n) => n.code === c).length === 1);
        const ecarts = seuls.filter((c) => notes.find((n) => n.code === c).titre !== titres[c]);
        expect(ecarts).toEqual([]);
    });
});
describe('Intitulés des notes · les notes à plusieurs tableaux (passe R6)', () => {
    it('la fiche imprime l’intitulé officiel, pas celui d’un tableau', () => {
        const A = client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS;
        expect((0, intitules_notes_sycebnl_1.intituleSurLaFiche)(A, '1', 'x')).toBe('Dettes garanties par des sûretés réelles, engagements financiers et contributions volontaires en nature');
        expect((0, intitules_notes_sycebnl_1.intituleSurLaFiche)(A, '7', 'x')).toBe('Actif circulant et dettes circulantes HAO');
        expect((0, intitules_notes_sycebnl_1.intituleSurLaFiche)(A, '29B', 'x')).toBe('Effectifs, masse salariale et personnel extérieur');
        expect((0, intitules_notes_sycebnl_1.intituleSurLaFiche)(client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT, '20B', 'x')).toBe('EFFECTIFS, MASSE SALARIALE ET PERSONNEL EXTERIEUR');
    });
    it('la tête de la note porte le titre du modèle', () => {
        const P = client_1.JeuNotesAnnexes.PROJETS_DEVELOPPEMENT;
        expect((0, intitules_notes_sycebnl_1.titreDeLaNote)(P, '4', 'x')).toBe('ACTIF CIRCULANT ET DETTES CIRCULANTES HAO');
        expect((0, intitules_notes_sycebnl_1.titreDeLaNote)(P, '20B', 'x')).toBe('EFFECTIFS, MASSE SALARIALE ET PERSONNEL');
    });
    it('le SYSCOHADA garde le titre de son premier tableau', () => {
        expect((0, intitules_notes_sycebnl_1.intituleSurLaFiche)(client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL, '3A', 'IMMOBILISATION BRUTE')).toBe('IMMOBILISATION BRUTE');
    });
});
//# sourceMappingURL=intitules-notes-sycebnl.spec.js.map