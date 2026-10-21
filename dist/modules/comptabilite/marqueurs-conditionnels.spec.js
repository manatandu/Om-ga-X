"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const lire = (f) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', f), 'utf8');
function blocApres(source, debut) {
    const i = typeof debut === 'number' ? debut : source.indexOf(debut);
    expect(['ancre trouvée', i >= 0]).toEqual(['ancre trouvée', true]);
    const siPerdu = source.indexOf('if (count === 0) {', i);
    return source.slice(i, source.indexOf('}', source.indexOf(';\n', source.indexOf('retirerCompensation', siPerdu))) + 1);
}
describe('marqueurs posés après creer', () => {
    it.each([
        ['regularisation/regularisation.service.ts', 'data: { ecritureRepriseId: ecriture.id },', 'ecritureRepriseId: null'],
        ['regularisation/regularisation.service.ts', 'await this.prisma.echeanceAbonnement.updateMany({', 'ecritureId: null'],
    ])('%s · %s', (fichier, ancre, condition) => {
        const source = lire(fichier);
        const debut = source.lastIndexOf('updateMany({', source.indexOf(ancre) + ancre.length);
        const bloc = blocApres(source, debut);
        expect(bloc).toContain(condition);
        expect(bloc).toContain('if (count === 0) {');
        expect(bloc).toContain('this.ecritureService.retirerCompensation(tenantId, ecriture.id)');
    });
    it('la contre-passation d’une réévaluation · update unitaire conditionné au lien nul, le perdant retire sa pièce', () => {
        const source = lire('devises/devises.service.ts');
        const debut = source.indexOf('private async extournerSousVerrou(');
        expect(['ancre trouvée', debut >= 0]).toEqual(['ancre trouvée', true]);
        const corps = source.slice(debut, source.indexOf('\n  }\n', debut));
        const lien = corps.slice(corps.indexOf('await this.prisma.reevaluation.update({'));
        expect(lien).toContain('AND: [{ ecritureExtourneId: null }, { contrePassationDeclareeId: null }]');
        const perdu = lien.slice(lien.indexOf('} catch (e) {'));
        expect(perdu).toContain('this.ecritureService.retirerCompensation(tenantId, ecriture.id)');
        expect(perdu).toContain("e.code === 'P2025'");
    });
    it('la réévaluation retire ses deux écritures si son marqueur ne s’écrit pas', () => {
        const source = lire('devises/devises.service.ts');
        const i = source.indexOf('reevaluation = await this.prisma.reevaluation.create({');
        const capture = source.slice(source.indexOf('} catch (e) {', i), source.indexOf('throw e;', i));
        expect(capture).toContain('retirerCompensation(tenantId, ecritureEcarts.id)');
        expect(capture).toContain('retirerCompensation(tenantId, ecritureProvision.id)');
    });
});
//# sourceMappingURL=marqueurs-conditionnels.spec.js.map