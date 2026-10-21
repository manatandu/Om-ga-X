"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const RACINE = (0, path_1.join)(__dirname, '..', '..', '..');
const lire = (chemin) => (0, fs_1.readFileSync)((0, path_1.join)(RACINE, chemin), 'utf8');
function sources(dossier) {
    return (0, fs_1.readdirSync)((0, path_1.join)(RACINE, dossier)).flatMap((n) => {
        const p = (0, path_1.join)(dossier, n);
        if ((0, fs_1.statSync)((0, path_1.join)(RACINE, p)).isDirectory())
            return sources(p);
        return p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
    });
}
function declarationDocumentee(source, marque) {
    const debut = source.lastIndexOf('/**', source.indexOf(marque));
    expect(debut).toBeGreaterThan(-1);
    const fin = source.indexOf('*/', debut) + 2;
    return source
        .slice(fin)
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0);
}
describe('F245 · un commentaire de documentation précède SA déclaration', () => {
    const fichiers = ['src/modules/plateforme', 'src/modules/relances', 'src/modules/courrier'].flatMap(sources);
    it('le relevé trouve encore les sources du groupe', () => {
        expect(fichiers).toEqual(expect.arrayContaining(['src/modules/plateforme/plateforme.controller.ts', 'src/modules/plateforme/plateforme.service.ts']));
    });
    it('aucun bloc de documentation n’est suivi d’un autre bloc', () => {
        const empiles = fichiers.flatMap((f) => {
            const lignes = lire(f).split('\n');
            return lignes.flatMap((l, i) => (l.trim() === '*/' && (lignes[i + 1] ?? '').trim().startsWith('/**') ? [`${f}:${i + 1}`] : []));
        });
        expect(empiles).toEqual([]);
    });
    it('les routes de la console portent chacune leur commentaire', () => {
        const c = lire('src/modules/plateforme/plateforme.controller.ts');
        expect(declarationDocumentee(c, 'DERNIER RECOURS')).toBe("@Post('cabinets/:tenantId/reinitialiser-admin')");
        expect(declarationDocumentee(c, 'DOSSIER DE DÉMONSTRATION')).toBe("@Post('dossier-demonstration')");
        expect(declarationDocumentee(c, 'Désigne le dossier de l')).toBe("@Post('cabinets/:tenantId/dossier-editeur')");
    });
    it('les méthodes du service portent chacune leur commentaire', () => {
        const s = lire('src/modules/plateforme/plateforme.service.ts');
        expect(declarationDocumentee(s, 'Suspension, réactivation')).toMatch(/^private async modifierLicenceSansGarde\(/);
        expect(declarationDocumentee(s, 'LA LICENCE EST CELLE D')).toMatch(/^modifierLicence\(/);
        expect(declarationDocumentee(s, 'DOSSIER DE DÉMONSTRATION · le troisième')).toMatch(/^async preparerDossierDemonstration\(/);
        expect(declarationDocumentee(s, 'DÉSIGNER LE DOSSIER DE L')).toMatch(/^async designerDossierEditeur\(/);
    });
});
describe('F245 · les chemins que le schéma cite existent', () => {
    it('tout `src/modules/…` d’un commentaire du schéma désigne un fichier ou un dossier réel', () => {
        const schema = lire('prisma/schema.prisma');
        const cites = [...schema.matchAll(/(?<![\w/])src\/modules\/[\w./-]*[\w-]/g)].map((m) => m[0]);
        expect(cites).toContain('src/modules/plateforme/abonnements');
        expect(cites.filter((c) => !(0, fs_1.existsSync)((0, path_1.join)(RACINE, c)))).toEqual([]);
    });
});
//# sourceMappingURL=commentaires-f245.spec.js.map