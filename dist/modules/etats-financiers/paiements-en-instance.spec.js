"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paiements_en_instance_1 = require("./paiements-en-instance");
describe('Repère H · lecture du paramètre (audit final F13)', () => {
    it('absent ou vide vaut « non renseigné », zéro reste zéro, un montant se lit', () => {
        expect([(0, paiements_en_instance_1.lirePaiementsEnInstance)(undefined), (0, paiements_en_instance_1.lirePaiementsEnInstance)(''), (0, paiements_en_instance_1.lirePaiementsEnInstance)('0'), (0, paiements_en_instance_1.lirePaiementsEnInstance)('1500.5')]).toEqual([
            null,
            null,
            0,
            1500.5,
        ]);
    });
    it('un montant illisible est refusé, jamais lu comme zéro', () => {
        expect(() => (0, paiements_en_instance_1.lirePaiementsEnInstance)('mille')).toThrow(/illisibles/);
    });
});
//# sourceMappingURL=paiements-en-instance.spec.js.map