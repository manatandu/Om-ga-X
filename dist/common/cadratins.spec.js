"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const CADRATIN = '\u2014';
const RACINE = (0, path_1.join)(__dirname, '..', '..');
const EXCEPTIONS = {
    'prisma/migrations/20260829033943_retire_cadratins/migration.sql': {
        occurrences: 39,
        nomAuParagraphe4: '20260829033943_retire_cadratins',
        motif: 'la migration qui remplace le caractère en base le porte comme donnée ; appliquée, elle ne se modifie plus',
    },
    'src/modules/controles/regles-comptes-sycebnl.ts': {
        occurrences: 174,
        nomAuParagraphe4: 'regles-comptes-sycebnl.ts',
        nombreImprime: true,
        motif: 'table engendrée, transcription verbatim du SYCEBNL',
    },
    'src/modules/controles/regles-comptes-syscohada.ts': {
        occurrences: 3,
        nomAuParagraphe4: 'regles-comptes-syscohada.ts',
        nombreImprime: true,
        motif: 'table engendrée, transcription verbatim de l’AUDCIF Titre VII',
    },
    'src/modules/controles/regles-comptes.spec.ts': {
        occurrences: 1,
        nomAuParagraphe4: 'regles-comptes.spec.ts',
        motif: 'le test qui gèle mot pour mot une citation du SYCEBNL',
    },
    'src/modules/questionnaire/catalogue-questionnaire.ts': {
        occurrences: 2,
        nomAuParagraphe4: 'catalogue-questionnaire.ts',
        motif: 'item CPCC-PRO-5, impératif du séminaire cité tel qu’il est écrit',
    },
    'src/modules/questionnaire/questionnaire.spec.ts': {
        occurrences: 1,
        nomAuParagraphe4: 'questionnaire.spec.ts',
        motif: 'le test qui gèle mot pour mot la citation de CPCC-PRO-5',
    },
    'scripts/extraire-schemas-guides.cjs': {
        occurrences: 2,
        nomAuParagraphe4: 'scripts/extraire-schemas-guides.cjs',
        motif: 'deux motifs qui reconnaissent le séparateur des titres des guides d’application',
    },
    'CLAUDE.md': {
        occurrences: 3,
        nomAuParagraphe4: 'ce fichier-ci',
        motif: 'la règle qui montre le caractère pour l’interdire, et les citations qui le reprennent',
    },
};
const RESTENT_A_ECHAPPER = {
    'src/modules/etats-financiers/correspondance-smt.spec.ts': 3,
    'src/modules/etats-financiers/correspondance-tft.spec.ts': 3,
    'src/modules/etats-financiers/correspondance-projet-emplois-ressources.spec.ts': 4,
};
const DOSSIERS_IGNORES = new Set(['.git', 'node_modules', 'dist', 'dist-e2e', 'test-results', 'playwright-report', '__pycache__', 'coverage']);
const CHEMINS_IGNORES = new Set(['.claude/worktrees', '.claude/amont']);
const EXTENSIONS_IGNOREES = new Set(['.woff', '.woff2', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.pdf', '.xlsx', '.docx', '.zip', '.exe', '.tsbuildinfo', '.log']);
const FICHIERS_IGNORES = new Set(['.env', '.env.local']);
function fichiersDuDepot(dossier) {
    return (0, fs_1.readdirSync)(dossier).flatMap((nom) => {
        const chemin = (0, path_1.join)(dossier, nom);
        const rel = (0, path_1.relative)(RACINE, chemin).split('\\').join('/');
        if ((0, fs_1.statSync)(chemin).isDirectory()) {
            return DOSSIERS_IGNORES.has(nom) || CHEMINS_IGNORES.has(rel) ? [] : fichiersDuDepot(chemin);
        }
        return EXTENSIONS_IGNOREES.has((0, path_1.extname)(nom).toLowerCase()) || FICHIERS_IGNORES.has(nom) ? [] : [rel];
    });
}
const occurrences = (texte) => texte.split(CADRATIN).length - 1;
function paragraphe4() {
    const reglement = (0, fs_1.readFileSync)((0, path_1.join)(RACINE, 'CLAUDE.md'), 'utf8');
    const debut = reglement.indexOf('## 4. Ce qui est interdit');
    const fin = reglement.indexOf('## 5. ', debut);
    if (debut < 0 || fin < 0)
        throw new Error('§ 4 introuvable dans CLAUDE.md');
    return reglement.slice(debut, fin);
}
describe('tiret cadratin · le dépôt entier contre la liste fermée du § 4', () => {
    const fichiers = fichiersDuDepot(RACINE);
    const trouves = {};
    for (const f of fichiers) {
        const texte = (0, fs_1.readFileSync)((0, path_1.join)(RACINE, f), 'utf8');
        if (texte.includes('\u0000'))
            continue;
        const n = occurrences(texte);
        if (n > 0)
            trouves[f] = n;
    }
    it('le relevé lit encore le dépôt · un parcours vide ne vérifierait rien', () => {
        expect(fichiers.length).toBeGreaterThan(1000);
        expect(fichiers).toContain('CLAUDE.md');
        expect(fichiers).toContain('src/modules/import/lecture-fichier.ts');
        expect(fichiers).toContain('scripts/extraire-schemas-guides.cjs');
        expect(fichiers.some((f) => f.startsWith('docs/'))).toBe(true);
        expect(fichiers.some((f) => f.startsWith('.github/workflows/'))).toBe(true);
    });
    it('seules les exceptions déclarées portent le caractère, chacune son nombre exact', () => {
        const attendus = { ...RESTENT_A_ECHAPPER };
        for (const [f, e] of Object.entries(EXCEPTIONS))
            attendus[f] = e.occurrences;
        expect(trouves).toEqual(attendus);
    });
    it('les deux commentaires relevés par l’audit sont écrits sans lui', () => {
        for (const f of ['src/modules/import/lecture-fichier.ts', 'src/common/cloisonnement/extension-cloisonnement.ts']) {
            expect({ f, n: occurrences((0, fs_1.readFileSync)((0, path_1.join)(RACINE, f), 'utf8')) }).toEqual({ f, n: 0 });
        }
    });
    it('chaque exception est déclarée au § 4 de CLAUDE.md, sous le nom qu’elle y porte', () => {
        const texte = paragraphe4();
        for (const [f, e] of Object.entries(EXCEPTIONS)) {
            expect({ f, declare: texte.includes(e.nomAuParagraphe4) }).toEqual({ f, declare: true });
        }
        expect(texte).toContain('cadratins.spec.ts');
    });
    it('le nombre que le § 4 imprime pour une table engendrée est celui du fichier', () => {
        const texte = paragraphe4().replace(/\s+/g, ' ');
        for (const [f, e] of Object.entries(EXCEPTIONS)) {
            if (!e.nombreImprime)
                continue;
            const nom = e.nomAuParagraphe4.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const imprime = texte.match(new RegExp(`${nom}\` en porte (\\d+)`))?.[1];
            expect({ f, imprime: Number(imprime) }).toEqual({ f, imprime: e.occurrences });
        }
    });
    it('une exception engendrée ne se corrige pas à la main · son en-tête le dit', () => {
        for (const f of ['src/modules/controles/regles-comptes-sycebnl.ts', 'src/modules/controles/regles-comptes-syscohada.ts']) {
            const texte = (0, fs_1.readFileSync)((0, path_1.join)(RACINE, f), 'utf8');
            expect({ f, engendre: texte.includes('FICHIER ENGENDRÉ'), verbatim: texte.includes('VERBATIM') }).toEqual({
                f,
                engendre: true,
                verbatim: true,
            });
        }
    });
});
//# sourceMappingURL=cadratins.spec.js.map