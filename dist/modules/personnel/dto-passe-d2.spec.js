"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const personnel_dto_1 = require("./dto/personnel.dto");
const erreursSur = async (cls, corps, champ) => (await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(cls, corps))).filter((e) => e.property === champ);
describe('Passe D2 · les portes du corps de requête', () => {
    const simulation = { moisDePaie: '2026-03', elements: [] };
    it('la majoration des risques professionnels n’admet que 50 ou 100', async () => {
        for (const ok of [50, 100]) {
            expect(await erreursSur(personnel_dto_1.SimulationPaieDto, { ...simulation, majorationRisquesProfessionnelsPourCent: ok }, 'majorationRisquesProfessionnelsPourCent')).toEqual([]);
        }
        for (const ko of [25, 150, true]) {
            expect((await erreursSur(personnel_dto_1.SimulationPaieDto, { ...simulation, majorationRisquesProfessionnelsPourCent: ko }, 'majorationRisquesProfessionnelsPourCent')).length).toBe(1);
        }
    });
    it('constat 3 · le montant d’un élément de paie est au centime, comme les autres montants de la paie', async () => {
        const element = (montantFc) => ({ nature: 'ALLOCATIONS_FAMILIALES_LEGALES', libelle: 'Allocations', montantFc });
        const refus = async (montantFc) => (await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(personnel_dto_1.SimulationPaieDto, { ...simulation, elements: [element(montantFc)] }))).filter((e) => e.property === 'elements');
        expect(await refus(50_000.01)).toEqual([]);
        expect(await refus(50_000)).toEqual([]);
        expect((await refus(50_000.005)).length).toBe(1);
        const [elements] = await refus(50_000.005);
        const messages = JSON.stringify(elements.children);
        expect(messages).toContain(personnel_dto_1.MOTIF_MONTANT_AU_CENTIME);
    });
    it('les rangs du livre de paie sont bornés à 1 et 33', async () => {
        expect(await erreursSur(personnel_dto_1.LivreDePaieDto, { mentionsPortees: [1, 33] }, 'mentionsPortees')).toEqual([]);
        expect((await erreursSur(personnel_dto_1.LivreDePaieDto, { mentionsPortees: [34] }, 'mentionsPortees')).length).toBe(1);
        expect((await erreursSur(personnel_dto_1.LivreDePaieDto, { mentionsPortees: [0] }, 'mentionsPortees')).length).toBe(1);
    });
});
//# sourceMappingURL=dto-passe-d2.spec.js.map