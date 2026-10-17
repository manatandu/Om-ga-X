"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const tiers_dto_1 = require("./tiers.dto");
const OPTIONS_DU_PIPE_GLOBAL = { whitelist: true, forbidNonWhitelisted: true, transform: true };
async function refus(metatype, valeur, type = 'body') {
    try {
        await new common_1.ValidationPipe(OPTIONS_DU_PIPE_GLOBAL).transform(valeur, { type, metatype, data: undefined });
        return null;
    }
    catch (e) {
        if (e instanceof common_1.BadRequestException)
            return JSON.stringify(e.getResponse());
        throw e;
    }
}
const tiers = { type: 'CLIENT', code: 'C1', nom: 'Acme' };
describe('le numéro de compte choisi à la création, au pipe', () => {
    it('absent ou fait de chiffres, il passe · le service juge le reste', async () => {
        expect(await refus(tiers_dto_1.CreerTiersDto, tiers)).toBeNull();
        expect(await refus(tiers_dto_1.CreerTiersDto, { ...tiers, numeroCompte: '41110250' })).toBeNull();
    });
    it('null, vide ou trop long, il est refusé en le disant', async () => {
        expect(await refus(tiers_dto_1.CreerTiersDto, { ...tiers, numeroCompte: null })).toMatch(/omettez le champ/);
        expect(await refus(tiers_dto_1.CreerTiersDto, { ...tiers, numeroCompte: '' })).toMatch(/ne peut pas être vide/);
        expect(await refus(tiers_dto_1.CreerTiersDto, { ...tiers, numeroCompte: '4'.repeat(14) })).toMatch(/au plus 13 chiffres/);
        expect(await refus(tiers_dto_1.CreerTiersDto, { ...tiers, numeroCompte: 41110250 })).toMatch(/suite de chiffres/);
    });
});
describe('le type de la proposition, au pipe', () => {
    it('un type connu passe, un type absent ou inconnu est refusé', async () => {
        expect(await refus(tiers_dto_1.NumeroProposeDto, { type: 'FOURNISSEUR' }, 'query')).toBeNull();
        expect(await refus(tiers_dto_1.NumeroProposeDto, {}, 'query')).toMatch(/Type de tiers inconnu/);
        expect(await refus(tiers_dto_1.NumeroProposeDto, { type: 'BANQUE' }, 'query')).toMatch(/Type de tiers inconnu/);
    });
});
//# sourceMappingURL=numero-compte.dto.spec.js.map