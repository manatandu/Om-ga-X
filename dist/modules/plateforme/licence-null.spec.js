"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const plateforme_dto_1 = require("./dto/plateforme.dto");
const plateforme_service_1 = require("./plateforme.service");
async function refusDuPipe(corps) {
    const pipe = new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    try {
        await pipe.transform(corps, { type: 'body', metatype: plateforme_dto_1.ModifierLicenceDto, data: undefined });
        return null;
    }
    catch (e) {
        if (e instanceof common_1.BadRequestException)
            return e;
        throw e;
    }
}
function motifsDu(refus) {
    if (!refus)
        return [];
    const reponse = refus.getResponse();
    return Array.isArray(reponse.message) ? reponse.message : [String(reponse.message)];
}
describe('ModifierLicenceDto · null refusé en 400 nommé', () => {
    const cas = [
        ['type', /Le type de licence ne s’efface pas/],
        ['statut', /ACTIVE ou SUSPENDUE, jamais null/],
        ['dateExpiration', /ne s’efface pas par null · envoyez une date AAAA-MM-JJ, ou une chaîne vide/],
    ];
    for (const [champ, motif] of cas) {
        it(`${champ} à null · 400 avec son motif, jamais 500`, async () => {
            const refus = await refusDuPipe({ [champ]: null });
            expect(refus).not.toBeNull();
            expect(refus.getStatus()).toBe(400);
            expect(motifsDu(refus).some((m) => motif.test(m))).toBe(true);
        });
    }
    it('la chaîne vide lève toujours l’échéance, une date la pose, l’absence ne dit rien', async () => {
        expect(await refusDuPipe({ dateExpiration: '' })).toBeNull();
        expect(await refusDuPipe({ dateExpiration: '2027-08-31' })).toBeNull();
        expect(await refusDuPipe({ statut: client_1.StatutLicence.SUSPENDUE })).toBeNull();
        expect(await refusDuPipe({})).toBeNull();
    });
});
describe('PlateformeService.modifierLicence · une date mal lue ne part pas', () => {
    const monter = () => {
        const ecritures = [];
        const prisma = {
            licence: {
                findUnique: async ({ where }) => where.tenantId === 't1' ? { tenantId: 't1', type: client_1.TypeLicence.ABONNEMENT, statut: client_1.StatutLicence.ACTIVE } : null,
                update: async (args) => {
                    ecritures.push({ op: 'update', ...args });
                    return { type: client_1.TypeLicence.ABONNEMENT, ...args.data };
                },
                updateMany: async (args) => {
                    ecritures.push({ op: 'updateMany', ...args });
                    return { count: 0 };
                },
            },
        };
        const s = new plateforme_service_1.PlateformeService(prisma, { get: () => undefined }, undefined);
        return { s, ecritures };
    };
    for (const illisible of ['2027-02-30', '2026-W05']) {
        it(`« ${illisible} » · refusé en 400, rien n’est écrit, cellules comprises`, async () => {
            expect(await refusDuPipe({ dateExpiration: illisible })).toBeNull();
            const { s, ecritures } = monter();
            await expect(s.modifierLicence('t1', { dateExpiration: illisible })).rejects.toThrow(common_1.BadRequestException);
            expect(ecritures).toHaveLength(0);
        });
    }
    it('une date lisible est posée au jour écrit, et la cascade reçoit la même', async () => {
        const { s, ecritures } = monter();
        await s.modifierLicence('t1', { dateExpiration: '2028-02-29' });
        expect(ecritures.map((e) => e.op)).toEqual(['update', 'updateMany']);
        for (const e of ecritures) {
            expect(e.data.dateExpiration.toISOString().slice(0, 10)).toBe('2028-02-29');
        }
        expect(ecritures[0].where).toEqual({ tenantId: 't1' });
    });
    it('la chaîne vide lève l’échéance, pas 1970', async () => {
        const { s, ecritures } = monter();
        await s.modifierLicence('t1', { dateExpiration: '' });
        expect(ecritures[0].data.dateExpiration).toBeNull();
    });
    it('un autre cabinet est introuvable, rien n’est écrit', async () => {
        const { s, ecritures } = monter();
        await expect(s.modifierLicence('t2', { dateExpiration: '2028-01-01' })).rejects.toThrow('Cabinet introuvable');
        expect(ecritures).toHaveLength(0);
    });
});
//# sourceMappingURL=licence-null.spec.js.map