"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const fiscalite_dto_1 = require("./dto/fiscalite.dto");
async function messages(dto, corps) {
    const erreurs = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(dto, corps));
    return erreurs.flatMap((e) => [
        ...Object.values(e.constraints ?? {}),
        ...(e.children ?? []).flatMap((c) => (c.children ?? []).flatMap((cc) => Object.values(cc.constraints ?? {}))),
    ]);
}
describe('Dossier fiscal · null n’efface pas une colonne NOT NULL (CLAUDE.md § 9)', () => {
    for (const champ of ['acomptesVerses', 'supplementsAdministration', 'supplementsPeriodeCreation']) {
        it(`${champ} · null refusé en 400 nommé, absent admis, 0 admis`, async () => {
            const refus = await messages(fiscalite_dto_1.ModifierDossierFiscalDto, { [champ]: null });
            expect(refus.join(' ')).toContain("ne s'efface pas");
            expect(await messages(fiscalite_dto_1.ModifierDossierFiscalDto, {})).toEqual([]);
            expect(await messages(fiscalite_dto_1.ModifierDossierFiscalDto, { [champ]: 0 })).toEqual([]);
        });
    }
    it('les colonnes nullables gardent null comme effacement', async () => {
        expect(await messages(fiscalite_dto_1.ModifierDossierFiscalDto, {
            deficitAnterieurSaisi: null,
            resultatPeriodeCreationSaisi: null,
            deficitAnterieurOrigines: null,
            natureActivite: null,
        })).toEqual([]);
    });
});
describe('Dossier fiscal · bornes hautes', () => {
    it('un montant au-delà de la borne compatible Decimal(18, 2) est refusé, nommé', async () => {
        for (const champ of ['acomptesVerses', 'supplementsAdministration', 'deficitAnterieurSaisi', 'supplementsPeriodeCreation', 'resultatPeriodeCreationSaisi']) {
            const refus = await messages(fiscalite_dto_1.ModifierDossierFiscalDto, { [champ]: fiscalite_dto_1.MONTANT_FISCAL_MAX + 1 });
            expect(`${champ}: ${refus.join(' ')}`).toContain('Montant hors des bornes');
            expect(await messages(fiscalite_dto_1.ModifierDossierFiscalDto, { [champ]: fiscalite_dto_1.MONTANT_FISCAL_MAX })).toEqual([]);
        }
        expect((await messages(fiscalite_dto_1.ModifierDossierFiscalDto, { resultatPeriodeCreationSaisi: -fiscalite_dto_1.MONTANT_FISCAL_MAX - 1 })).join(' ')).toContain('Montant hors des bornes');
        expect((await messages(fiscalite_dto_1.CreerRetraitementDto, { code: 'X', montant: fiscalite_dto_1.MONTANT_FISCAL_MAX + 1 })).join(' ')).toContain('Montant hors des bornes');
        expect(fiscalite_dto_1.MONTANT_FISCAL_MAX).toBeLessThan(1e16);
    });
    it('une part d’origine au-delà de la borne est refusée', async () => {
        const refus = await messages(fiscalite_dto_1.ModifierDossierFiscalDto, {
            deficitAnterieurSaisi: 100,
            deficitAnterieurOrigines: [{ dateFin: '2025-12-31', montant: fiscalite_dto_1.MONTANT_FISCAL_MAX + 1 }],
        });
        expect(refus.join(' ')).toContain('Montant hors des bornes');
    });
    it(`l’origine du report tient en ${fiscalite_dto_1.ORIGINES_DEFICIT_MAX} parts au plus`, async () => {
        const parts = (n) => Array.from({ length: n }, () => ({ dateFin: '2025-12-31', montant: 1 }));
        expect((await messages(fiscalite_dto_1.ModifierDossierFiscalDto, { deficitAnterieurSaisi: 21, deficitAnterieurOrigines: parts(fiscalite_dto_1.ORIGINES_DEFICIT_MAX + 1) })).join(' ')).toContain(`${fiscalite_dto_1.ORIGINES_DEFICIT_MAX} parts au plus`);
        expect(await messages(fiscalite_dto_1.ModifierDossierFiscalDto, { deficitAnterieurSaisi: 20, deficitAnterieurOrigines: parts(fiscalite_dto_1.ORIGINES_DEFICIT_MAX) })).toEqual([]);
    });
});
//# sourceMappingURL=dossier-fiscal-dto.spec.js.map