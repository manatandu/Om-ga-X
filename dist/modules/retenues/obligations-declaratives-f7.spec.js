"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const correspondance_retenues_1 = require("./correspondance-retenues");
const planning_cloture_1 = require("../exercice/planning-cloture");
const cles = (forme) => (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(client_1.Referentiel.SYSCOHADA, forme).map((o) => o.cle);
describe('art. 12 et 17 · la déclaration annuelle suit la qualité de la personne', () => {
    it('une personne physique reçoit la déclaration IRPP, jamais celle de l’impôt sur les sociétés', () => {
        for (const forme of [client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, client_1.FormeJuridiqueSyscohada.ENTREPRENANT]) {
            expect(cles(forme)).toContain('declarationIrpp');
            expect(cles(forme)).not.toContain('declarationImpotSocietes');
        }
        expect(cles(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)).toContain('declarationImpotSocietes');
        expect(cles(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)).not.toContain('declarationIrpp');
    });
    it('art. 13 et 14 · les états certifiés ne visent que le Système normal ; relevé, perte et liquidation sont dits', () => {
        const is = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME).find((o) => o.cle === 'declarationImpotSocietes');
        expect(is.contenu).toContain('Pour une entreprise relevant du Système normal');
        expect(is.contenu).toContain('art. 13, al. 3');
        expect(is.contenu).toContain('art. 15');
        expect(is.contenu).toContain('art. 16');
        expect(is.contenu).toContain('contresignée par le conseil ou le comptable du redevable');
    });
});
describe('art. 18 et 19 · la déclaration mensuelle est due même sans paie', () => {
    it('« Néant » sur l’IRPP salaires et sur le prélèvement des expatriés', () => {
        const nature = (cle) => correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === cle);
        expect(nature('irppSalaires').echeance).toContain('« Néant » (art. 18, al. 2)');
        expect(nature('prelevementExpatries').echeance).toContain('« Néant » (art. 19, al. 2)');
    });
});
describe('art. 22 ter · une personne physique n’y est tenue qu’au réel ou aux petites entreprises', () => {
    it('la réserve est servie à la personne physique, pas à la personne morale', () => {
        const pour = (forme) => (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(client_1.Referentiel.SYSCOHADA, forme).find((o) => o.cle === 'declarationAnnuelleSalaires').reserve;
        expect(pour(client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE)).toContain('art. 22 ter');
        expect(pour(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)).toBeNull();
    });
});
describe('art. 3, 13 al. 4, 13 bis et 2 · le planning de clôture', () => {
    it('le jalon SYCEBNL distingue exemption et exonération et nomme l’art. 13, al. 4', () => {
        const jalon = planning_cloture_1.JALONS_CLOTURE.find((j) => j.etape === 15 && j.referentiels?.includes(client_1.Referentiel.SYCEBNL));
        expect(jalon.detail).toContain('Les personnes exemptées sont dispensées de l’obligation de souscrire les déclarations');
        expect(jalon.detail).toContain('art. 13, al. 4');
        expect(jalon.detail).not.toContain('aucun texte lu ne le dit');
    });
    it('le procès-verbal d’assemblée n’est pas servi à une personne physique ; la déclaration de l’art. 2 l’est à tous', () => {
        const pour = (forme) => (0, planning_cloture_1.obligationsEvenementiellesApplicables)({ referentiel: client_1.Referentiel.SYSCOHADA, formeJuridique: 'ASSOCIATION', droitEtranger: false, formeJuridiqueSyscohada: forme }).map((o) => o.cle);
        expect(pour(client_1.FormeJuridiqueSyscohada.ENTREPRENANT)).not.toContain('proceValAssembleeGenerale');
        expect(pour(client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)).toContain('proceValAssembleeGenerale');
        expect(pour(client_1.FormeJuridiqueSyscohada.ENTREPRENANT)).toContain('modificationsIdentiteFiscale');
        expect((0, planning_cloture_1.obligationsEvenementiellesApplicables)({ referentiel: client_1.Referentiel.SYCEBNL, formeJuridique: 'ASSOCIATION', droitEtranger: false }).map((o) => o.cle)).toContain('modificationsIdentiteFiscale');
    });
});
//# sourceMappingURL=obligations-declaratives-f7.spec.js.map