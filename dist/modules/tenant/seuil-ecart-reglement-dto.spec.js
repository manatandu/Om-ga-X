"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const parametres_dossier_dto_1 = require("./dto/parametres-dossier.dto");
async function messages(corps) {
    const erreurs = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierSeuilEcartReglementDto, corps));
    return erreurs.flatMap((e) => Object.values(e.constraints ?? {}));
}
describe('ModifierSeuilEcartReglementDto · la borne de la colonne', () => {
    it('au plus la borne, au centime · au-delà, refusé en le disant', async () => {
        expect(await messages({ seuilEcartReglement: parametres_dossier_dto_1.SEUIL_ECART_REGLEMENT_MAX })).toEqual([]);
        expect(await messages({ seuilEcartReglement: 500.25 })).toEqual([]);
        const refus = await messages({ seuilEcartReglement: parametres_dossier_dto_1.SEUIL_ECART_REGLEMENT_MAX + 1 });
        expect(refus.join(' ')).toContain("Le seuil de l'écart de règlement est au plus");
    });
    it('la borne tient dans DECIMAL(18,2) · seize chiffres avant la virgule au plus', () => {
        expect(String(parametres_dossier_dto_1.SEUIL_ECART_REGLEMENT_MAX).length).toBeLessThanOrEqual(16);
        expect(Number.isSafeInteger(parametres_dossier_dto_1.SEUIL_ECART_REGLEMENT_MAX)).toBe(true);
    });
    it('null retire le seuil · aucune borne ne le refuse', async () => {
        expect(await messages({ seuilEcartReglement: null })).toEqual([]);
    });
});
//# sourceMappingURL=seuil-ecart-reglement-dto.spec.js.map