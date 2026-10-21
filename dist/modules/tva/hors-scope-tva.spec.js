"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'taux-tva.service.ts'), 'utf8');
describe('le module TVA nomme exactement ce qu’il ne traite pas', () => {
    it('déclare hors scope les régularisations des articles 50 et 51', () => {
        expect(service).toContain('LES RÉGULARISATIONS DES ART. 50 ET 51');
        expect(service).toContain("sortie d'actif");
        expect(service).toContain('attestation à');
    });
    it('déclare hors scope la récupération sur ventes IMPAYÉES (art. 52, al. 3)', () => {
        const horsScope = service.slice(service.indexOf('RESTE HORS SCOPE'), service.indexOf('@Injectable()'));
        expect(horsScope).toContain('VENTES IMPAYÉES');
        expect(horsScope).toContain('art. 127');
        expect(horsScope).toContain('irrécouvrable');
    });
    it('n’annonce PLUS hors scope la récupération sur ventes ANNULÉES ou RÉSILIÉES, désormais traitée', () => {
        const horsScope = service.slice(service.indexOf('RESTE HORS SCOPE'), service.indexOf('@Injectable()'));
        expect(horsScope).toContain('Les ventes ANNULÉES et RÉSILIÉES sont traitées');
        expect(service).toContain('art. 126');
    });
    it('garde les hors-scope déjà déclarés · art. 46 et 49', () => {
        expect(service).toContain('art. 49');
        expect(service).toContain('art. 46');
    });
    const puces = () => {
        const horsScope = service.slice(service.indexOf('RESTE HORS SCOPE'), service.indexOf('@Injectable()'));
        return horsScope
            .split('\n')
            .filter((l) => l.includes(' · '))
            .map((l) => l.replace(/^\s*\*\s*·\s*/, '').slice(0, 90));
    };
    it('aucune puce du hors-scope ne prend pour SUJET un article désormais traité', () => {
        for (const article of ['art. 37', 'art. 63', 'art. 43', 'art. 41']) {
            for (const puce of puces())
                expect(puce).not.toContain(article);
        }
    });
    it('les manques nommés par la passe F2b ont bien leur puce', () => {
        const horsScope = service.slice(service.indexOf('RESTE HORS SCOPE'), service.indexOf('@Injectable()'));
        for (const attendu of [
            'LA RETENUE À LA SOURCE DE LA TVA (art. 53',
            'LE CRÉDIT DONT LE REMBOURSEMENT A ÉTÉ DEMANDÉ (art. 66)',
            "L'ARTICLE 40, ALINÉA 2",
            "L'ARTICLE 42, POINTS 3 ET 4",
            "L'ARTICLE 43, ALINÉA 3",
            "L'ARTICLE 45, ALINÉA 1",
            "L'ARTICLE 36, POINT 4",
        ]) {
            expect(horsScope).toContain(attendu);
        }
        expect(horsScope).toContain('1.000.000,00 de Francs congolais');
        expect(horsScope).toContain('dix\n *    places assises ou plus');
    });
    it('borne l’article 25 à ses points 1 et 2, à l’annonce comme au hors-scope', () => {
        const perimetre = service.slice(0, service.indexOf('RESTE HORS SCOPE'));
        expect(perimetre).toContain('POINTS 1 ET 2 SEULEMENT');
        const horsScope = service.slice(service.indexOf('RESTE HORS SCOPE'), service.indexOf('@Injectable()'));
        expect(horsScope).toContain('LES POINTS 3 À 7 DE L’ARTICLE 25'.replace('’', "'"));
        for (const indice of ['zone franche', 'escompte', 'crédit-bail', 'PRÉFINANCEMENT', 'habitat social']) {
            expect(horsScope).toContain(indice);
        }
    });
    it('déclare hors scope la territorialité (art. 22) et le client rendu redevable (art. 23)', () => {
        const horsScope = service.slice(service.indexOf('RESTE HORS SCOPE'), service.indexOf('@Injectable()'));
        expect(horsScope).toContain('art. 22');
        expect(horsScope).toContain('utilisés ou exploités au');
        expect(horsScope).toContain('la personne cliente');
    });
    it('déclare hors scope les bases particulières, SANS trancher la contradiction du texte', () => {
        const horsScope = service.slice(service.indexOf('RESTE HORS SCOPE'), service.indexOf('@Injectable()'));
        expect(horsScope).toContain('ART. 27 POINT 10, 31, 32, 33 ET 34');
        expect(horsScope).toContain("prix d'achat");
        expect(horsScope).toContain('prix de revient');
        expect(horsScope).toContain('non-assujettis');
    });
    it('déclare hors scope la TVA COLLECTÉE sur les cessions d’éléments d’actifs (art. 6)', () => {
        const horsScope = service.slice(service.indexOf('RESTE HORS SCOPE'), service.indexOf('@Injectable()'));
        expect(horsScope).toContain("CESSIONS D'ÉLÉMENTS D'ACTIFS");
        expect(horsScope).toContain('art. 6');
        expect(horsScope).toContain('ANTÉRIEURE aux');
    });
});
//# sourceMappingURL=hors-scope-tva.spec.js.map