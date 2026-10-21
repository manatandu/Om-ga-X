"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bailleur_referentiel_1 = require("./bailleur-referentiel");
const prisma = (referentiel, lu) => ({
    tenant: {
        findUniqueOrThrow: async () => {
            lu.fois += 1;
            return { referentiel };
        },
    },
});
describe('rattachement à un bailleur · réservé au SYCEBNL', () => {
    it('refuse un bailleurId sur un dossier SYSCOHADA, et le dit dans son vocabulaire', async () => {
        const lu = { fois: 0 };
        await expect((0, bailleur_referentiel_1.refuserBailleurHorsSycebnl)(prisma(client_1.Referentiel.SYSCOHADA, lu), 't1', 'b1')).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect((0, bailleur_referentiel_1.refuserBailleurHorsSycebnl)(prisma(client_1.Referentiel.SYSCOHADA, lu), 't1', 'b1')).rejects.toThrow(/apporteurs, associés et groupe/);
    });
    it('laisse passer sur un dossier SYCEBNL', async () => {
        const lu = { fois: 0 };
        await expect((0, bailleur_referentiel_1.refuserBailleurHorsSycebnl)(prisma(client_1.Referentiel.SYCEBNL, lu), 't1', 'b1')).resolves.toBeUndefined();
    });
    it('laisse toujours passer le DÉTACHEMENT, sans lire le dossier', async () => {
        const lu = { fois: 0 };
        await (0, bailleur_referentiel_1.refuserBailleurHorsSycebnl)(prisma(client_1.Referentiel.SYSCOHADA, lu), 't1', null);
        await (0, bailleur_referentiel_1.refuserBailleurHorsSycebnl)(prisma(client_1.Referentiel.SYSCOHADA, lu), 't1', undefined);
        expect(lu.fois).toBe(0);
    });
});
//# sourceMappingURL=bailleur-referentiel.spec.js.map