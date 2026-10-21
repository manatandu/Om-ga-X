"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const correspondance_retenues_1 = require("./correspondance-retenues");
describe('Article 5 · l’avertissement lit la FORME JURIDIQUE, plus seulement le référentiel', () => {
    it('une ENTITÉ PUBLIQUE n’est plus déclarée redevable de plein droit', () => {
        const t = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'ENTITE_PUBLIQUE');
        expect(t).not.toContain("La société est redevable de l'impôt sur les sociétés");
        expect(t).toContain('ENTITÉ PUBLIQUE');
        expect(t).toContain('article 5, 1°');
        expect(t).toContain('subventions budgétaires');
        expect(t).toContain('exploitation lucrative');
        expect(t).toContain('ne tranche donc pas');
    });
    it('une SOCIÉTÉ COOPÉRATIVE porte ses deux conditions cumulatives', () => {
        const t = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'SOCIETE_COOPERATIVE');
        expect(t).not.toContain("La société est redevable de l'impôt sur les sociétés");
        expect(t).toContain('FORME CIVILE');
        expect(t).toContain('cumulatives');
        expect(t).toContain("sens de l'Acte uniforme");
    });
    it('une SARL reste redevable, avec son échéance et ses acomptes', () => {
        const t = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'SOCIETE_RESPONSABILITE_LIMITEE');
        expect(t).toContain("La société est redevable de l'impôt sur les sociétés");
        expect(t).toContain('30 avril');
        expect(t).toContain('25 juillet');
    });
    it('un dossier dont la forme n’est pas renseignée garde le droit commun', () => {
        const t = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', null);
        expect(t).toContain("La société est redevable de l'impôt sur les sociétés");
    });
    it('dans TOUS les cas, le rappel sur les impôts retenus pour autrui subsiste', () => {
        for (const forme of ['ENTITE_PUBLIQUE', 'SOCIETE_COOPERATIVE', 'SOCIETE_ANONYME', null]) {
            const t = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', forme);
            expect(t).toContain("retenu pour le compte d'autrui");
            expect(t).toContain('cotisation sociale');
        }
    });
});
describe('Titre Ier, art. 2 · l’exemption dispense de la DÉCLARATION comme du PAIEMENT', () => {
    it('l’avertissement SYCEBNL ne dit plus qu’une ASBL exemptée doit déclarer son IS', () => {
        const t = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYCEBNL', null);
        expect(t).toContain('DÉCLARATION ET DE PAIEMENT');
        expect(t).toContain('art. 5');
        expect(t).toContain('EXONÉRATION');
        expect(t).toContain('que du paiement');
    });
});
describe('le service passe bien la forme juridique à l’avertissement', () => {
    const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'retenues.service.ts'), 'utf8');
    it('la requête du dossier ramène la forme juridique', () => {
        expect(service).toContain('formeJuridiqueSyscohada: true');
    });
    it('l’appel la transmet · sans quoi le droit commun reviendrait en silence', () => {
        expect(service).toContain('avertissementRegimeImpot(referentiel, formeJuridiqueSyscohada)');
    });
});
//# sourceMappingURL=perimetre-loi-23-053.spec.js.map