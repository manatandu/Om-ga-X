"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const libelle_exercice_1 = require("./libelle-exercice");
const jour = (iso) => new Date(`${iso}T00:00:00.000Z`);
describe('libelleExercice (serveur)', () => {
    it('un exercice civil se lit sur son année', () => {
        expect((0, libelle_exercice_1.libelleExercice)({ dateDebut: jour('2026-01-01'), dateFin: jour('2026-12-31') })).toBe('2026');
    });
    it('un premier exercice long se lit « début-fin »', () => {
        expect((0, libelle_exercice_1.libelleExercice)({ dateDebut: jour('2026-07-01'), dateFin: jour('2027-12-31') })).toBe('2026-2027');
    });
    it('l’année se lit en UTC · minuit UTC du 1er janvier reste dans son année', () => {
        expect((0, libelle_exercice_1.libelleExercice)({ dateDebut: jour('2027-01-01'), dateFin: jour('2027-12-31') })).toBe('2027');
    });
});
describe('aucun libellé d’exercice composé à la main côté serveur', () => {
    const RACINE = (0, node_path_1.join)(__dirname, '..');
    const sources = [];
    const parcourir = (dossier) => {
        for (const nom of (0, node_fs_1.readdirSync)(dossier)) {
            const chemin = (0, node_path_1.join)(dossier, nom);
            if ((0, node_fs_1.statSync)(chemin).isDirectory())
                parcourir(chemin);
            else if (nom.endsWith('.ts') && !nom.endsWith('.spec.ts'))
                sources.push(chemin);
        }
    };
    parcourir(RACINE);
    const COMPOSITION = /\$\{[^}]*\b(dateDebut|dateFin)\.get(UTC)?FullYear\(\)[^}]*\}/;
    it('le recensement lit bien le serveur, et le motif reconnaît la forme visée', () => {
        expect(sources.some((f) => f.endsWith((0, node_path_1.join)('exercice', 'exercice.service.ts')))).toBe(true);
        expect(COMPOSITION.test('`exercice ${exercice.dateDebut.getUTCFullYear()}`')).toBe(true);
        expect(COMPOSITION.test('`-${e.dateFin.getFullYear()}`')).toBe(true);
        expect(COMPOSITION.test('Date.UTC(dateDebut.getUTCFullYear(), 11, 31)')).toBe(false);
    });
    it('seul le porteur écrit l’exercice', () => {
        const fautifs = sources
            .filter((f) => COMPOSITION.test((0, node_fs_1.readFileSync)(f, 'utf8')))
            .map((f) => (0, node_path_1.relative)(RACINE, f));
        expect(fautifs).toEqual([]);
    });
    it('les libellés des écritures de clôture, de report et d’affectation l’appellent', () => {
        const exercice = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'modules', 'exercice', 'exercice.service.ts'), 'utf8');
        expect(exercice).toContain('`Clôture des charges/produits · exercice ${libelleExercice(exercice)}`');
        expect(exercice).toContain('`Report à-nouveau · ouverture exercice ${libelleExercice(exerciceSuivant)}`');
        expect(exercice).toContain('`Report à-nouveau PROVISOIRE · ouverture exercice ${libelleExercice(exerciceSuivant)}`');
        const affectation = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'modules', 'affectation', 'affectation.service.ts'), 'utf8');
        expect(affectation).toContain("`Affectation du résultat de l'exercice ${libelleExercice(exercice)} · ${dto.organe}`");
    });
});
//# sourceMappingURL=libelle-exercice.spec.js.map