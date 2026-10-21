"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catalogue_retraitements_1 = require("./catalogue-retraitements");
describe('AMORTISSEMENTS_EXCEDENT · les chemins de l’excédent à réintégrer', () => {
    const motif = catalogue_retraitements_1.RETRAITEMENT_PAR_CODE.get('AMORTISSEMENTS_EXCEDENT').assietteHorsPortee ?? '';
    it('nomme le calcul du dégressif fiscal dans la fenêtre Immobilisations', () => {
        expect(motif).toContain('BIEN AMORTI EN DÉGRESSIF FISCAL (SYSCOHADA, Système normal, option prise)');
        expect(motif).toContain('fenêtre Immobilisations, bouton « Fiscal »');
    });
    it('garde le renvoi hors du logiciel pour les autres biens', () => {
        expect(motif).toContain('AUTRES BIENS');
        expect(motif).toContain('établissez l\'écart hors du logiciel');
    });
    it("porte la réserve de l'art. 4 de l'arrêté n° 013/2025 · justifié, pas de réintégration ; à défaut, rejet", () => {
        expect(motif).toContain('arrêté n° 013/CAB/MIN/FINANCES/2025, art. 4');
        expect(motif).toContain("justifié lors du contrôle, l'écart n'est pas à réintégrer, et à défaut de justification il est rejeté");
    });
});
//# sourceMappingURL=catalogue-retraitements.spec.js.map