"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const catalogue_retraitements_1 = require("./catalogue-retraitements");
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
describe('passe F5 · art. 73, al. 2, 5° · une réintégration est aussi un revenu distribué', () => {
    it('gèle la liste des réintégrations que le texte exclut, chacune avec son motif', () => {
        expect(Object.keys(catalogue_retraitements_1.CODES_HORS_ARTICLE_73_5).sort()).toEqual([
            'AMENDES_PENALITES',
            'AMORTISSEMENTS_EXCEDENT',
            'ECARTS_CONVERSION_CREANCES_DETTES',
            'IMPOT_SUR_LE_RESULTAT',
            'PRELEVEMENT_EXPATRIES',
            'PROVISIONS_NON_ADMISES',
            'REEVALUATION_SUPPLEMENT_ANNUITE',
        ]);
    });
    it('porte la mention sur toute autre réintégration, et sur elle seule', () => {
        for (const r of catalogue_retraitements_1.CATALOGUE_RETRAITEMENTS) {
            const attendue = r.sens === client_1.SensRetraitementFiscal.REINTEGRATION && r.code !== catalogue_retraitements_1.CODE_LIBRE && !(r.code in catalogue_retraitements_1.CODES_HORS_ARTICLE_73_5);
            expect([r.code, r.revenusDistribues ?? null]).toEqual([r.code, attendue ? catalogue_retraitements_1.MENTION_ARTICLE_73_5 : null]);
        }
        expect(catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get('DEPENSES_PERSONNELLES')?.revenusDistribues).toContain('art. 120');
        expect(catalogue_retraitements_1.MENTION_ARTICLE_73_5).toContain('art. 73, al. 2, 5°');
    });
});
describe('passe F5 · les charges mixtes et les bénéficiaires non révélés', () => {
    it("sert aux personnes physiques les 50 % forfaitaires des art. 89 et 99, pas l'art. 20 seul", () => {
        const d = catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get('DEPENSES_PERSONNELLES');
        expect(d.aide).toContain('50 % de la charge mixte sont retenus forfaitairement');
        expect(d.source).toContain('art. 89, al. 4 et art. 99, al. 2');
    });
    it("nomme l'IRPP au taux le plus élevé de l'art. 117 sur les sommes à bénéficiaires non révélés", () => {
        const d = catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get('REMUNERATIONS_NON_DECLAREES');
        expect(d.aide).toContain('au taux le plus élevé du barème');
        expect(d.source).toContain('art. 117');
    });
});
describe('passe F5 · la retenue sur capitaux mobiliers et le déposant', () => {
    const capitaux = correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === 'capitauxMobiliers');
    it("ne donne plus le PLACEMENT de trésorerie pour un cas de retenue à reverser, et dit que la banque l'opère", () => {
        for (const r of [capitaux.reserve, capitaux.reserveSyscohada]) {
            expect(r).toContain('PLACEMENT de trésorerie');
            expect(r).toContain('opérée par les débiteurs de ces revenus');
        }
    });
    it("nomme l'imputation de l'art. 76 à la société-mère, sans rien imputer", () => {
        expect(capitaux.reserveSyscohada).toContain('(art. 76), à quatre conditions cumulatives');
        expect(capitaux.reserveSyscohada).toContain("OmegaX n'impute rien");
    });
});
describe('passe F5 · une seule phrase de l’arrêté n° 019/2025 pour la paie et le registre', () => {
    it('le registre des retenues sert la phrase de la paie', () => {
        const { FORFAITS_ARRETE_019_2025 } = jest.requireActual('../personnel/bareme-irpp');
        const salaires = correspondance_retenues_1.NATURES_RETENUES.find((n) => (n.reserve ?? '').includes('PERSONNEL DOMESTIQUE'));
        expect(salaires.reserve).toContain(FORFAITS_ARRETE_019_2025);
    });
});
//# sourceMappingURL=passe-f5-irpp.spec.js.map