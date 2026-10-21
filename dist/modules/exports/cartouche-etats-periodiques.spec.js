"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'export.service.ts'), 'utf8');
const flux = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'classeur-en-flux.ts'), 'utf8');
const fpm = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'presentation-fpm.ts'), 'utf8');
const fpmService = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'export-fpm.service.ts'), 'utf8');
const edition = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'journal-edition.ts'), 'utf8');
describe('exports périodiques · identification de l’état', () => {
    it('porte l’identification en pied de page sur les trois livres obligatoires', () => {
        expect(flux).toContain('oddFooter:');
        expect(flux).toContain('params.identite.entite');
        for (const enFlux of ['journalExcelEnFlux', 'grandLivreCompletExcelEnFlux']) {
            expect(`${enFlux}: ${service.includes(`${enFlux}(`)}`).toBe(`${enFlux}: true`);
            expect(service).toContain('const identite = await this.identiteEtat(');
        }
        expect(fpm).toContain('oddFooter:');
        expect(fpm).toContain('Page &P / &N');
        expect(fpmService).toContain('this.exportService.identiteEtat(tenantId, { exerciceId })');
        expect(edition).toContain('oddFooter:');
        expect(edition).toContain('Page &P / &N');
        expect(edition).toContain('identite.entite');
        expect(service).toContain('ouvrirJournalEdition({ sortie, identite, formatJour, selection: criteresEnClair(filtres) })');
        const poses = service.match(/this\.piedDePageEtat\(feuille, (\w+)\)/g) ?? [];
        expect(poses.length).toBeGreaterThanOrEqual(3);
        for (const pose of poses)
            expect(pose).toMatch(/identite/i);
    });
    it('coiffe TOUS les états périodiques, sans exception', () => {
        const coiffes = service.match(/this\.coifferEtat\(/g) ?? [];
        expect(coiffes.length).toBeGreaterThanOrEqual(9);
        expect(edition).toContain("'JOURNAL'");
        for (const titre of [
            "'GRAND LIVRE'",
            "'BALANCE ÂGÉE'",
            'JUSTIFICATIF DE SOLDE',
            "'ÉVOLUTION DES SOLDES'",
            'TABLEAU DES IMMOBILISATIONS',
            "'TABLEAU DES AMORTISSEMENTS'",
        ]) {
            expect(service).toContain(titre);
        }
    });
    it('décale la ligne d’en-têtes de trois, partout où la coiffe est posée', () => {
        const finalisations = service.match(/this\.finaliserTableau\([^;]*?entete\w*\)/gs) ?? [];
        const coiffes = service.match(/this\.coifferEtat\(/g) ?? [];
        expect(finalisations.length).toBe(coiffes.length);
        for (const f of finalisations)
            expect(f).toContain('+ 3');
    });
    it('rend la ligne d’en-tête d’AVANT la coiffe, pas une constante', () => {
        expect(service).toContain('ligneEnteteAvant = 1');
        expect(service).toContain('return ligneEnteteAvant + 3;');
    });
    it('porte les cinq mentions que l’AUDCIF art. 22, 7° et le Titre IX demandent', () => {
        expect(service).toContain('identite.entite');
        expect(service).toContain('segmentIdentification(identite)');
        expect(service).toContain('immatriculation: immatriculationDesLivres(tenant)');
        expect(service).toContain('identite.periode');
        expect(service).toContain('montants en ${identite.devise}');
        expect(service).toContain('édité le ${edite}');
        expect(service).toContain('Page &P / &N');
    });
    it('n’exige pas d’exercice · le journal et le grand livre s’exportent sans', () => {
        expect(service).toContain('async identiteEtat(');
        expect(service).toContain("'Toutes périodes'");
        expect(service).toContain('this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })');
    });
    it('ne prétend plus que chaque feuille est strictement SYCEBNL', () => {
        expect(service).not.toContain('Chaque feuille reste strictement SYCEBNL');
        expect(service).toContain("livres obligatoires de\n * l'AUDCIF art. 19");
        expect(edition).toContain('AUDCIF art. 20, repris par le SYCEBNL');
    });
});
//# sourceMappingURL=cartouche-etats-periodiques.spec.js.map