"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const tiers_dto_1 = require("./dto/tiers.dto");
const fusion_tiers_1 = require("./fusion-tiers");
const qualite_tiers_1 = require("./qualite-tiers");
const tiers_service_1 = require("./tiers.service");
describe('la qualité, un libellé', () => {
    it('se range sans blancs de bord, un blanc vide l’efface, l’absence ne change rien', () => {
        expect((0, qualite_tiers_1.normaliserQualite)('  Société   anonyme ')).toBe('Société anonyme');
        expect((0, qualite_tiers_1.normaliserQualite)('   ')).toBeNull();
        expect((0, qualite_tiers_1.normaliserQualite)(null)).toBeNull();
        expect((0, qualite_tiers_1.normaliserQualite)(undefined)).toBeUndefined();
    });
    it('la liste proposée tient dans la colonne, sans doublon', () => {
        expect(new Set(qualite_tiers_1.QUALITES_PROPOSEES).size).toBe(qualite_tiers_1.QUALITES_PROPOSEES.length);
        for (const q of qualite_tiers_1.QUALITES_PROPOSEES)
            expect(q.length).toBeLessThanOrEqual(qualite_tiers_1.LONGUEUR_QUALITE);
    });
    it('la colonne et les deux DTO disent la même longueur', async () => {
        const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '../../../prisma/schema.prisma'), 'utf8');
        expect(schema).toContain(`qualite String? @db.VarChar(${qualite_tiers_1.LONGUEUR_QUALITE})`);
        const trop = 'x'.repeat(qualite_tiers_1.LONGUEUR_QUALITE + 1);
        const c = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(tiers_dto_1.CreerTiersDto, { type: 'CLIENT', code: 'C1', nom: 'Client', qualite: trop }));
        expect(c.map((e) => e.property)).toEqual(['qualite']);
        const m = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(tiers_dto_1.ModifierTiersDto, { qualite: trop }));
        expect(m.map((e) => e.property)).toEqual(['qualite']);
        expect(await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(tiers_dto_1.ModifierTiersDto, { qualite: null }))).toEqual([]);
    });
    it('la fusion comble une qualité manquante, jamais celle de la fiche conservée', () => {
        const fiche = (id, qualite) => ({
            id,
            code: id,
            type: 'CLIENT',
            adresse: null,
            boitePostale: null,
            ville: null,
            pays: null,
            telephone: null,
            email: null,
            numeroImpot: null,
            contact: null,
            qualite,
        });
        expect((0, fusion_tiers_1.coordonneesAComblement)(fiche('a', 'Société'), fiche('b', null))).toEqual({ qualite: 'Société' });
        expect((0, fusion_tiers_1.coordonneesAComblement)(fiche('a', 'Société'), fiche('b', 'Particulier'))).toEqual({});
    });
});
describe('la qualité à la création et à la modification', () => {
    function monter() {
        const update = jest.fn(async ({ data }) => ({ id: 't1', ...data }));
        const prisma = {
            tiers: {
                findFirst: jest.fn(async () => ({ id: 't1', tenantId: 'd', type: 'CLIENT', comptesRattaches: [] })),
                update,
            },
        };
        return { service: new tiers_service_1.TiersService(prisma), update };
    }
    it('un blanc efface, un libellé se range, l’absence ne touche pas la colonne', async () => {
        const { service, update } = monter();
        await service.modifier('d', 't1', { qualite: '   ' });
        expect(update.mock.calls[0][0].data).toEqual({ qualite: null });
        await service.modifier('d', 't1', { qualite: ' Établissement   public ' });
        expect(update.mock.calls[1][0].data).toEqual({ qualite: 'Établissement public' });
        await service.modifier('d', 't1', { nom: 'Autre nom' });
        expect(update.mock.calls[2][0].data).toEqual({ nom: 'Autre nom' });
    });
});
//# sourceMappingURL=qualite-tiers.spec.js.map