"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const monnaie_de_tenue_1 = require("./monnaie-de-tenue");
const RACINE = (0, node_path_1.join)(__dirname, '..', '..');
function fichiers(dossier) {
    const sortie = [];
    for (const entree of (0, node_fs_1.readdirSync)((0, node_path_1.join)(RACINE, dossier))) {
        const relatif = `${dossier}/${entree}`;
        if ((0, node_fs_1.statSync)((0, node_path_1.join)(RACINE, relatif)).isDirectory())
            sortie.push(...fichiers(relatif));
        else if (relatif.endsWith('.ts') && !relatif.endsWith('.spec.ts'))
            sortie.push(relatif);
    }
    return sortie;
}
describe('la monnaie de tenue', () => {
    it('vaut le franc congolais, et le cartouche s’y replie', () => {
        expect(monnaie_de_tenue_1.MONNAIE_DE_TENUE).toBe('CDF');
        expect((0, monnaie_de_tenue_1.monnaieDuJeuLegal)('CDF')).toBe('CDF');
        expect((0, monnaie_de_tenue_1.monnaieDuJeuLegal)(null)).toBe('CDF');
        expect((0, monnaie_de_tenue_1.monnaieDuJeuLegal)(undefined)).toBe('CDF');
    });
    it('n’est écrite par AUCUN service', () => {
        const coupables = fichiers('src').filter((f) => {
            const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, f), 'utf8');
            return /^\s*devise:\s*(dto|params)\./m.test(source);
        });
        expect(coupables).toEqual([]);
    });
    it('ne figure dans aucun DTO d’entrée', () => {
        const coupables = fichiers('src')
            .filter((f) => f.includes('/dto/'))
            .filter((f) => /^\s*devise\?:\s*string;/m.test((0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, f), 'utf8')));
        expect(coupables).toEqual([]);
    });
    it('n’est plus modifiable depuis l’écran des paramètres', () => {
        const page = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'client/src/pages/ParametresDossierPage.tsx'), 'utf8');
        const bloc = page.slice(page.indexOf('label="Monnaie de tenue"'));
        const champ = bloc.slice(0, bloc.indexOf('</Ligne>'));
        expect(champ).toContain('readOnly');
        expect(champ).not.toContain('setDevise(');
        expect(page.replace(/\s+/g, ' ')).toContain('La monnaie de tenue ne se choisit pas');
        expect(page).toContain('art. 141');
    });
});
describe('Passe F6 · la loi n° 23/053 est datée du 30 novembre 2023', () => {
    const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'monnaie-de-tenue.ts'), 'utf8');
    it('porte la date du texte à côté de son numéro', () => {
        expect(source).toContain('Loi n° 23/053 du 30 novembre 2023, art. 141, 1°');
    });
    it('dit pourquoi la migration qui porte encore l’ancienne date n’est pas retouchée', () => {
        expect(source).toContain('empreinte');
        expect(source).toContain('20260918120000_monnaie_fonctionnelle');
    });
});
//# sourceMappingURL=monnaie-de-tenue.spec.js.map