"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const SANS_APPELANT_DE_PRODUCTION = {
    'modules/comptabilite/detenteurs-ecriture.ts': 'table de décision confrontée par son spec à detenteursDe et au schéma',
    'modules/conditions-licence/delais-article-34.ts': 'délais de l’art. 34 du Code du numérique, confrontés par versions-publiees.spec.ts aux versions publiées, en attente de la bascule de version',
    'modules/controles/rapprochement-guide-plan.ts': 'rapprochement des guides, en attente du contrôle des schémas d’écriture',
    'modules/controles/schemas-guide-sycebnl.ts': 'table engendrée du guide SYCEBNL, en attente du même contrôle',
    'modules/controles/schemas-guide-syscohada.ts': 'table engendrée du guide SYSCOHADA, en attente du même contrôle',
    'modules/exports/relecture-balances-liasse.ts': 'outil des deux specs de liasse, qui relit les formules visant BALANCE N et N-1',
    'modules/notes-annexes/notes-sycebnl.commun.ts': 'outil partagé des deux balayages de notes SYCEBNL',
};
const RACINE = (0, path_1.join)(__dirname, '..');
function fichiersTs(dossier) {
    return (0, fs_1.readdirSync)(dossier).flatMap((nom) => {
        const chemin = (0, path_1.join)(dossier, nom);
        if ((0, fs_1.statSync)(chemin).isDirectory())
            return fichiersTs(chemin);
        return nom.endsWith('.ts') ? [chemin] : [];
    });
}
describe('fichiers de src/ sans appelant de production', () => {
    const tous = fichiersTs(RACINE);
    const connus = new Set(tous.map((f) => (0, path_1.normalize)(f)));
    const importes = (f) => {
        const src = (0, fs_1.readFileSync)(f, 'utf8');
        const cibles = [];
        for (const m of src.matchAll(/(?:from|import|require\()\s*['"](\.[^'"]+)['"]/g)) {
            const base = (0, path_1.normalize)((0, path_1.join)((0, path_1.dirname)(f), m[1]));
            for (const c of [`${base}.ts`, (0, path_1.join)(base, 'index.ts')])
                if (connus.has(c))
                    cibles.push(c);
        }
        return cibles;
    };
    const production = tous.filter((f) => !f.endsWith('.spec.ts'));
    const atteints = new Set(production.flatMap(importes));
    const orphelins = production
        .filter((f) => !atteints.has((0, path_1.normalize)(f)) && !f.endsWith('main.ts'))
        .map((f) => (0, path_1.relative)(RACINE, f).split('\\').join('/'))
        .sort();
    it('le relevé trouve encore des fichiers importés · un graphe vide ne vérifierait rien', () => {
        expect(atteints.size).toBeGreaterThan(400);
    });
    it('seuls les fichiers nommés, avec leur motif, échappent à tout appel de production', () => {
        expect(orphelins).toEqual(Object.keys(SANS_APPELANT_DE_PRODUCTION).sort());
    });
    it('chaque exception le dit dans son propre en-tête', () => {
        for (const f of Object.keys(SANS_APPELANT_DE_PRODUCTION)) {
            expect({ f, dit: (0, fs_1.readFileSync)((0, path_1.join)(RACINE, f), 'utf8').includes('fichiers-sans-appelant.spec.ts') }).toEqual({ f, dit: true });
        }
    });
});
//# sourceMappingURL=fichiers-sans-appelant.spec.js.map