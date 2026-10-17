"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const RACINE = (0, path_1.join)(__dirname, '..', '..');
const DOSSIER = (0, path_1.join)(RACINE, 'docs', 'historique');
const LIGNES_DE_TETE = 6;
const BANDEAU_DATE = /HISTORIQUE · bandeau posé le \d{4}-\d{2}-\d{2}/;
describe('docs/historique · chaque document se dit historique (audit final F267)', () => {
    const documents = (0, fs_1.readdirSync)(DOSSIER).filter((f) => f.endsWith('.md') && f !== 'README.md');
    const readme = (0, fs_1.readFileSync)((0, path_1.join)(DOSSIER, 'README.md'), 'utf8');
    it('le recensement trouve encore les deux documents rangés le 2026-09-28', () => {
        expect(documents).toEqual(expect.arrayContaining(['ecarts-sage-omegax.md', 'audit-complet-2026-08.md']));
    });
    it('chaque document porte en tête son bandeau daté', () => {
        for (const f of documents) {
            const tete = (0, fs_1.readFileSync)((0, path_1.join)(DOSSIER, f), 'utf8').split('\n').slice(0, LIGNES_DE_TETE).join('\n');
            expect({ f, bandeau: BANDEAU_DATE.test(tete) }).toEqual({ f, bandeau: true });
        }
    });
    it('chaque document a sa ligne dans la table du README', () => {
        for (const f of documents) {
            expect({ f, dansLaTable: readme.includes(`| \`${f}\` |`) }).toEqual({ f, dansLaTable: true });
        }
    });
    it('aucun double ne reste à l’ancienne adresse dans docs/', () => {
        for (const f of documents) {
            expect({ f, double: (0, fs_1.existsSync)((0, path_1.join)(RACINE, 'docs', f)) }).toEqual({ f, double: false });
        }
    });
});
//# sourceMappingURL=documents-historiques.spec.js.map