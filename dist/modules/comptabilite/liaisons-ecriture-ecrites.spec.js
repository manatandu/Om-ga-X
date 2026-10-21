"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const RACINE = (0, path_1.join)(__dirname, '..', '..', '..');
function colonnesFacultatives() {
    const schema = (0, fs_1.readFileSync)((0, path_1.join)(RACINE, 'prisma', 'schema.prisma'), 'utf8');
    const colonnes = [];
    let modele = null;
    for (const ligne of schema.split('\n')) {
        const debut = ligne.match(/^model (\w+) \{/);
        if (debut) {
            modele = debut[1];
            continue;
        }
        if (ligne.startsWith('}'))
            modele = null;
        const col = ligne.match(/^\s+(ecriture\w*Id)\s+String\?/);
        if (modele && col)
            colonnes.push({ modele, colonne: col[1] });
    }
    return colonnes;
}
function sourcesDuServeur() {
    const sources = [];
    const parcourir = (dossier) => {
        for (const nom of (0, fs_1.readdirSync)(dossier)) {
            const chemin = (0, path_1.join)(dossier, nom);
            if ((0, fs_1.statSync)(chemin).isDirectory())
                parcourir(chemin);
            else if (chemin.endsWith('.ts') && !chemin.endsWith('.spec.ts'))
                sources.push((0, fs_1.readFileSync)(chemin, 'utf8'));
        }
    };
    parcourir((0, path_1.join)(RACINE, 'src'));
    return sources;
}
function argument(source, ouvrante) {
    let profondeur = 0;
    for (let j = ouvrante; j < source.length; j++) {
        if (source[j] === '(')
            profondeur++;
        else if (source[j] === ')' && --profondeur === 0)
            return source.slice(ouvrante, j + 1);
    }
    return '';
}
function sitesDEcriture(sources, modele, colonne) {
    const nomClient = modele[0].toLowerCase() + modele.slice(1);
    const appel = new RegExp(`\\.${nomClient}\\.(create|createMany|update|updateMany|upsert)\\(`, 'g');
    const nommee = new RegExp(`\\b${colonne}\\b`);
    let sites = 0;
    for (const source of sources) {
        for (const m of source.matchAll(appel)) {
            const arg = argument(source, (m.index ?? 0) + m[0].length - 1);
            const data = arg.indexOf('data');
            if (data >= 0 && nommee.test(arg.slice(data)))
                sites++;
        }
    }
    return sites;
}
describe('liaisons vers une écriture · chacune a un site d’écriture', () => {
    const colonnes = colonnesFacultatives();
    const sources = sourcesDuServeur();
    it('le recensement trouve les colonnes du constat', () => {
        const noms = colonnes.map((c) => `${c.modele}.${c.colonne}`);
        expect(noms).toEqual(expect.arrayContaining([
            'EcartInventaire.ecritureId',
            'Consignation.ecritureConsignationId',
            'Consignation.ecritureDenouementId',
        ]));
    });
    it.each(colonnesFacultatives().map((c) => [`${c.modele}.${c.colonne}`, c.modele, c.colonne]))('%s', (nom, modele, colonne) => {
        expect([nom, sitesDEcriture(sources, modele, colonne) > 0]).toEqual([nom, true]);
    });
});
//# sourceMappingURL=liaisons-ecriture-ecrites.spec.js.map