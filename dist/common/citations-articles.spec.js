"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const DERNIER_ARTICLE = {
    AUDCIF: 113,
    SYCEBNL: 28,
    AUSCGIE: 920,
    AUSCOOP: 397,
    AUDCG: 307,
};
const HORS_PERIMETRE = /n°\s?\d{2,3}[/-]\d{3,4}|écart[ée]|exclu|n'écarte pas|liste d'exclusion/i;
const CORPUS = Object.keys(DERNIER_ARTICLE);
function lignesDuDepot() {
    const sortie = (0, child_process_1.execSync)("grep -rn --include=*.ts --include=*.tsx --include=*.prisma " +
        "-E '(AUDCIF|SYCEBNL|AUSCGIE|AUSCOOP|AUDCG)' src client/src prisma || true", { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return sortie
        .split('\n')
        .filter(Boolean)
        .map((l) => {
        const m = l.match(/^([^:]+):(\d+):(.*)$/s);
        return m ? { fichier: m[1], no: Number(m[2]), texte: m[3] } : null;
    })
        .filter((x) => x !== null);
}
describe('Citations d’articles · le corpus nommé porte-t-il l’article cité ?', () => {
    it('aucun article cité ne dépasse le dernier article de son corpus', () => {
        const fautifs = [];
        const cache = new Map();
        const voisinage = (fichier, no) => {
            if (!cache.has(fichier))
                cache.set(fichier, (0, fs_1.readFileSync)(fichier, 'utf8').split('\n'));
            const l = cache.get(fichier);
            return l.slice(Math.max(0, no - 5), no + 4).join(' ');
        };
        for (const { fichier, no, texte } of lignesDuDepot()) {
            const presents = CORPUS.filter((c) => new RegExp(`\\b${c}\\b`).test(texte));
            if (presents.length !== 1)
                continue;
            if (HORS_PERIMETRE.test(texte))
                continue;
            if (fichier.endsWith('citations-articles.spec.ts'))
                continue;
            const autour = voisinage(fichier, no);
            if (CORPUS.filter((c) => new RegExp(`\\b${c}\\b`).test(autour)).length > 1)
                continue;
            if (HORS_PERIMETRE.test(autour))
                continue;
            const corpus = presents[0];
            const articles = [...texte.matchAll(/\bart(?:icles?)?\.?\s*(\d+)/gi)].map((m) => Number(m[1]));
            for (const a of articles) {
                if (a > DERNIER_ARTICLE[corpus]) {
                    fautifs.push(`${fichier}:${no} · « ${corpus} art. ${a} » (ce corpus s’arrête à ${DERNIER_ARTICLE[corpus]})`);
                }
            }
        }
        expect(fautifs).toEqual([]);
    });
    it('tout message servi à l’écran par le module fiscal nomme la loi de son art. 57', () => {
        const lignes = (0, fs_1.readFileSync)('src/modules/fiscalite/fiscalite.service.ts', 'utf8').split('\n');
        const nommeSaLoi = /loi n° 23\/053|[Ll]oi de procédures fiscales|même loi|LPF/;
        const muettes = [];
        lignes.forEach((l, i) => {
            if (/^\s*(\/\/|\*|\/\*)/.test(l))
                return;
            if (!/^\s*[?:]?\s*[`"']|[`"']\s*\+\s*$|return \[|baseImpot:|explication:/.test(l))
                return;
            if (!/[Aa]rt\.\s*5[67]\b(?!\s*(?:bis|ter|quater|quinquies))/.test(l))
                return;
            let bloc = l;
            for (let j = i - 1; j >= 0 && /[+]\s*$/.test(lignes[j]); j--)
                bloc = lignes[j] + ' ' + bloc;
            if (!nommeSaLoi.test(bloc))
                muettes.push(l.trim().slice(0, 120));
        });
        expect(muettes).toEqual([]);
    });
    it('la définition de l’entité à but non lucratif renvoie à l’art. 2, jamais à l’art. premier', () => {
        const texte = (0, fs_1.readFileSync)('src/modules/affectation/regles-affectation.ts', 'utf8');
        expect(texte).toContain('but désintéressé');
        expect(texte).toContain('SYCEBNL, art. 2');
        expect(texte).not.toContain('c’est ce qui la définit (SYCEBNL, art. premier)');
    });
    it('le renvoi de l’art. 4, e) de la loi 004/2001 porte sa réserve, et ne conclut pas à la sanction', () => {
        const texte = (0, fs_1.readFileSync)('src/modules/exercice/planning-cloture.ts', 'utf8');
        expect(texte).toContain('sous peine d’application de l’article 19');
        expect(texte).toContain('dissolution VOLONTAIRE');
        expect(texte).toContain('c’est l’article 20 qui porte la dissolution JUDICIAIRE');
        expect(texte).not.toContain('sanctionné par l’article 19, c’est-à-dire par la dissolution');
    });
});
//# sourceMappingURL=citations-articles.spec.js.map