"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const RACINE = (0, path_1.join)(__dirname, '..', '..');
const lire = (chemin) => (0, fs_1.readFileSync)((0, path_1.join)(RACINE, chemin), 'utf8');
function sourcesServeur(dossier) {
    return (0, fs_1.readdirSync)(dossier).flatMap((nom) => {
        const chemin = (0, path_1.join)(dossier, nom);
        if ((0, fs_1.statSync)(chemin).isDirectory())
            return sourcesServeur(chemin);
        if (!nom.endsWith('.ts') || nom.endsWith('.spec.ts'))
            return [];
        return [(0, path_1.relative)(RACINE, chemin).split('\\').join('/')];
    });
}
const DECORATEUR_APPLIQUE = /^\s*@Throttle\(/m;
function paragraphe7() {
    const doc = lire('docs/connexions-et-plafonds.md');
    const debut = doc.indexOf('## 7. ');
    if (debut < 0)
        throw new Error('Le § 7 de docs/connexions-et-plafonds.md est introuvable');
    const fin = doc.indexOf('\n## ', debut + 1);
    return doc.slice(debut, fin < 0 ? undefined : fin);
}
describe('limitation de débit · le § 7 de connexions-et-plafonds contre les contrôleurs (audit final F268)', () => {
    const limites = sourcesServeur((0, path_1.join)(RACINE, 'src')).filter((f) => DECORATEUR_APPLIQUE.test(lire(f)));
    const texte = paragraphe7();
    it('le recensement trouve encore les deux contrôleurs de l’audit · un parcours vide ne vérifierait rien', () => {
        expect(limites).toEqual(expect.arrayContaining(['src/modules/auth/auth.controller.ts', 'src/modules/sur-site/sur-site.controller.ts']));
    });
    it('chaque fichier qui pose un @Throttle est nommé dans le § 7, chemin complet', () => {
        for (const f of limites) {
            expect({ f, nomme: texte.includes(`\`${f}\``) }).toEqual({ f, nomme: true });
        }
    });
    it('le plafond commun écrit au § 7 est celui que pose app.module.ts', () => {
        const module = lire('src/app.module.ts');
        const m = /throttlers:\s*\[\{\s*ttl:\s*([\d_]+),\s*limit:\s*([\d_]+)\s*\}\]/.exec(module);
        expect(m).not.toBeNull();
        const ttl = Number(m[1].split('_').join(''));
        const limite = Number(m[2].split('_').join(''));
        expect(ttl).toBe(60_000);
        expect(texte).toContain(`${limite} requêtes par minute et par adresse`);
        expect(texte).toContain('`src/app.module.ts`');
    });
    it('le § 7 dit où se lisent la liste et les chiffres, au lieu de les recompter', () => {
        expect(texte).toContain("grep -rn '@Throttle' src");
        expect(texte).toContain('src/common/limitation-debit-documentee.spec.ts');
    });
});
//# sourceMappingURL=limitation-debit-documentee.spec.js.map