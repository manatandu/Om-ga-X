"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const route_paramtypes_enum_1 = require("@nestjs/common/enums/route-paramtypes.enum");
const testing_1 = require("@nestjs/testing");
const journal_audit_controller_1 = require("./journal-audit.controller");
const journal_audit_service_1 = require("./journal-audit.service");
const filtre_journal_audit_dto_1 = require("./filtre-journal-audit.dto");
const prisma_service_1 = require("../prisma.service");
const jwt_auth_guard_1 = require("../../modules/auth/jwt-auth.guard");
const licence_guard_1 = require("../../modules/licence/licence.guard");
const roles_guard_1 = require("../guards/roles.guard");
const bootstrap_1 = require("../../bootstrap");
const EVENEMENTS = [
    { id: 'e-1', rang: 1, tenantId: 'dossier-1', horodatage: new Date('2026-08-31T23:00:00Z'), acteurEmail: 'a@cabinet.cd', entite: 'Compte', entiteId: 'c-1' },
    { id: 'e-2', rang: 2, tenantId: 'dossier-1', horodatage: new Date('2026-09-01T00:00:00Z'), acteurEmail: 'a@cabinet.cd', entite: 'Journal', entiteId: 'j-1' },
    { id: 'e-3', rang: 3, tenantId: 'dossier-1', horodatage: new Date('2026-09-15T10:00:00Z'), acteurEmail: 'b@cabinet.cd', entite: 'Compte', entiteId: 'c-2' },
    { id: 'e-4', rang: 4, tenantId: 'dossier-1', horodatage: new Date('2026-09-30T12:00:00Z'), acteurEmail: 'a@cabinet.cd', entite: 'Compte', entiteId: 'c-3' },
    { id: 'e-5', rang: 1, tenantId: 'dossier-2', horodatage: new Date('2026-09-10T10:00:00Z'), acteurEmail: 'a@cabinet.cd', entite: 'Compte', entiteId: 'c-9' },
];
function prismaFactice() {
    const appels = [];
    const filtrer = (where) => {
        for (const cle of ['tenantId', 'entite', 'entiteId', 'acteurEmail']) {
            const v = where[cle];
            if (v !== undefined && typeof v !== 'string')
                throw new Error(`Argument ${cle} invalide`);
            if (typeof v === 'string' && v.includes('\u0000')) {
                throw new Error('invalid byte sequence for encoding "UTF8": 0x00');
            }
        }
        const h = (where.horodatage ?? {});
        for (const borne of [h.gte, h.lte]) {
            if (borne !== undefined && !(borne instanceof Date && !Number.isNaN(borne.getTime()))) {
                throw new Error('Date invalide');
            }
            if (borne instanceof Date && !/^\d{4}-/.test(borne.toISOString())) {
                throw new Error('Could not convert argument value');
            }
        }
        return EVENEMENTS.filter((e) => e.tenantId === where.tenantId &&
            (where.entite === undefined || e.entite === where.entite) &&
            (where.entiteId === undefined || e.entiteId === where.entiteId) &&
            (where.acteurEmail === undefined || e.acteurEmail === where.acteurEmail) &&
            (h.gte === undefined || e.horodatage >= h.gte) &&
            (h.lte === undefined || e.horodatage <= h.lte));
    };
    const prisma = {
        evenementAudit: {
            count: jest.fn(async ({ where }) => {
                appels.push({ count: where });
                return filtrer(where).length;
            }),
            findMany: jest.fn(async ({ where, skip, take }) => {
                appels.push({ findMany: where, skip, take });
                if (!Number.isInteger(skip) || !Number.isInteger(take))
                    throw new Error('Entier invalide');
                return filtrer(where)
                    .sort((a, b) => b.rang - a.rang)
                    .slice(skip, skip + take);
            }),
        },
    };
    return { prisma, appels };
}
describe('F239 · la lecture d’une date du filtre', () => {
    it('rend l’instant exact des deux formes admises', () => {
        expect((0, filtre_journal_audit_dto_1.lireDateDuFiltre)('2026-09-01')?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
        expect((0, filtre_journal_audit_dto_1.lireDateDuFiltre)('2026-09-28T10:00:00Z')?.toISOString()).toBe('2026-09-28T10:00:00.000Z');
        expect((0, filtre_journal_audit_dto_1.lireDateDuFiltre)('2026-09-28T10:00+01:00')?.toISOString()).toBe('2026-09-28T09:00:00.000Z');
        expect((0, filtre_journal_audit_dto_1.lireDateDuFiltre)('2026-09-28T10:00:00.250Z')?.toISOString()).toBe('2026-09-28T10:00:00.250Z');
        expect((0, filtre_journal_audit_dto_1.lireDateDuFiltre)('2028-02-29')?.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    });
    it('refuse ce que `new Date` lirait de travers · « 1 » n’est pas le 1er janvier 2001', () => {
        expect(Number.isNaN(new Date('1').getTime())).toBe(false);
        expect(Number.isNaN(new Date('2026-02-30').getTime())).toBe(false);
        expect(Number.isNaN(new Date('2026-09-28T10:00').getTime())).toBe(false);
        for (const texte of ['1', '2026-02-30', '2026-09-31', '2027-02-29', '2026-09-28T10:00', '2026-09-28 10:00Z']) {
            expect([texte, (0, filtre_journal_audit_dto_1.lireDateDuFiltre)(texte)]).toEqual([texte, null]);
        }
    });
    it('refuse l’instant que la base ne reçoit pas · un fuseau fait franchir l’an 9999 ou l’an 0', () => {
        expect(new Date('9999-12-31T23:30-01:00').toISOString()).toBe('+010000-01-01T00:30:00.000Z');
        expect(new Date('0000-01-01T00:00+01:00').toISOString()).toBe('-000001-12-31T23:00:00.000Z');
        for (const texte of ['9999-12-31T23:30-01:00', '9999-12-31T23:00-23:59', '0000-01-01T00:00+01:00']) {
            expect([texte, (0, filtre_journal_audit_dto_1.lireDateDuFiltre)(texte)]).toEqual([texte, null]);
        }
        expect((0, filtre_journal_audit_dto_1.lireDateDuFiltre)('9999-12-31T23:59:59.999Z')?.toISOString()).toBe('9999-12-31T23:59:59.999Z');
        expect((0, filtre_journal_audit_dto_1.lireDateDuFiltre)('0001-01-01')?.toISOString()).toBe('0001-01-01T00:00:00.000Z');
    });
    it('refuse l’illisible tout court', () => {
        for (const texte of ['hier', '', '2026-13-01', '2026-09-28T25:00Z', '2026-09-28T10:60Z', '2026-09-28T10:00+24:00', '20260928']) {
            expect([texte, (0, filtre_journal_audit_dto_1.lireDateDuFiltre)(texte)]).toEqual([texte, null]);
        }
    });
});
describe('F239 · le contrôleur lit son filtre par le DTO', () => {
    it('un seul paramètre de requête, entier, typé par le DTO · sans quoi le ValidationPipe ne le voit pas', () => {
        const args = Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, journal_audit_controller_1.JournalAuditController, 'lister');
        const requetes = Object.entries(args).filter(([cle]) => cle.startsWith(`${route_paramtypes_enum_1.RouteParamtypes.QUERY}:`));
        expect(requetes).toHaveLength(1);
        const [, { index, data }] = requetes[0];
        expect(data).toBeUndefined();
        const types = Reflect.getMetadata('design:paramtypes', journal_audit_controller_1.JournalAuditController.prototype, 'lister');
        expect(types[index]).toBe(filtre_journal_audit_dto_1.FiltreJournalAuditDto);
    });
    it('transmet le filtre tel quel au service, sous le dossier de la session', async () => {
        const lister = jest.fn().mockResolvedValue({ total: 0 });
        const controleur = new journal_audit_controller_1.JournalAuditController({ lister });
        const filtre = Object.assign(new filtre_journal_audit_dto_1.FiltreJournalAuditDto(), { page: 2, entite: 'Compte' });
        await controleur.lister({ tenantId: 'dossier-1' }, filtre);
        expect(lister).toHaveBeenCalledWith('dossier-1', filtre);
    });
});
describe('F239 · le service refuse un filtre converti de travers, en dernière ligne', () => {
    const casIllisibles = [
        ['page NaN', { page: Number.NaN }],
        ['page décimale', { page: 1.5 }],
        ['taille NaN', { taille: Number.NaN }],
        ['taille infinie', { taille: Number.POSITIVE_INFINITY }],
        ['début invalide', { depuis: new Date('hier') }],
        ['fin invalide', { jusqua: new Date('pas une date') }],
        ['début au-delà de l’an 9999', { depuis: new Date('+010000-01-01T00:00:00Z') }],
        ['fin avant l’an 0', { jusqua: new Date('-000001-12-31T23:00:00Z') }],
        ['objet avec le caractère nul', { entite: 'Compte\u0000' }],
        ['identifiant avec le caractère nul', { entiteId: '\u0000' }],
        ['auteur avec le caractère nul', { acteurEmail: 'a\u0000@cabinet.cd' }],
    ];
    it.each(casIllisibles)('%s · 400 avant toute lecture', async (_nom, filtre) => {
        const { prisma, appels } = prismaFactice();
        const service = new journal_audit_service_1.JournalAuditService(prisma);
        await expect(service.lister('dossier-1', filtre)).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(appels).toHaveLength(0);
    });
    it('nomme le critère fautif', () => {
        expect((0, journal_audit_service_1.motifFiltreIllisible)({ page: Number.NaN })).toMatch(/Numéro de page/);
        expect((0, journal_audit_service_1.motifFiltreIllisible)({ jusqua: new Date('x') })).toMatch(/Date de fin/);
        expect((0, journal_audit_service_1.motifFiltreIllisible)({ depuis: new Date('+010000-01-01T00:00:00Z') })).toMatch(/Date de début/);
        expect((0, journal_audit_service_1.motifFiltreIllisible)({ entite: 'a\u0000' })).toMatch(/^Objet/);
        expect((0, journal_audit_service_1.motifFiltreIllisible)({ entiteId: 'a\u0000' })).toMatch(/Identifiant d’objet/);
        expect((0, journal_audit_service_1.motifFiltreIllisible)({ acteurEmail: 'a\u0000' })).toMatch(/Auteur/);
        expect((0, journal_audit_service_1.motifFiltreIllisible)({ page: 3, taille: 50, depuis: new Date('2026-09-01') })).toBeNull();
    });
});
describe('F239 · sur un vrai serveur Nest, avec le ValidationPipe de production', () => {
    let app;
    let port;
    let appels;
    const sessionFactice = {
        canActivate(ctx) {
            ctx.switchToHttp().getRequest().user = { id: 'u-1', tenantId: 'dossier-1', role: 'ADMIN_CABINET' };
            return true;
        },
    };
    beforeAll(async () => {
        const factice = prismaFactice();
        appels = factice.appels;
        const mod = await testing_1.Test.createTestingModule({
            controllers: [journal_audit_controller_1.JournalAuditController],
            providers: [journal_audit_service_1.JournalAuditService, { provide: prisma_service_1.PrismaService, useValue: factice.prisma }],
        })
            .overrideGuard(jwt_auth_guard_1.JwtAuthGuard)
            .useValue(sessionFactice)
            .overrideGuard(licence_guard_1.LicenceGuard)
            .useValue(sessionFactice)
            .overrideGuard(roles_guard_1.RolesGuard)
            .useValue(sessionFactice)
            .compile();
        app = mod.createNestApplication();
        (0, bootstrap_1.configurerApplication)(app);
        await app.listen(0);
        port = app.getHttpServer().address().port;
    });
    afterAll(async () => {
        await app.close();
    });
    beforeEach(() => {
        appels.length = 0;
    });
    const lire = async (requete) => {
        const reponse = await fetch(`http://127.0.0.1:${port}/journal-audit${requete}`);
        return { statut: reponse.status, corps: (await reponse.json()) };
    };
    it.each([
        ['?page=abc', /Numéro de page illisible/],
        ['?page=', /Numéro de page illisible/],
        ['?page=0', /Numéro de page illisible/],
        ['?page=1.5', /Numéro de page illisible/],
        ['?page=0x10', /Numéro de page illisible/],
        ['?page=1e2', /Numéro de page illisible/],
        [`?page=${filtre_journal_audit_dto_1.PAGE_JOURNAL_MAX + 1}`, /hors limite/],
        ['?page=99999999999999999999', /hors limite/],
        ['?taille=abc', /Taille de page illisible/],
        ['?taille=0', /Taille de page illisible/],
        ['?taille=201', /Taille de page illisible/],
        ['?depuis=hier', /Date de début illisible/],
        ['?depuis=1', /Date de début illisible/],
        ['?depuis=2026-02-30', /Date de début illisible/],
        ['?jusqua=2026-09-30T23:59', /Date de fin illisible/],
        ['?jusqua=', /Date de fin illisible/],
        ['?entite=Compte&entite=Journal', /Objet illisible/],
        ['?acteurEmail=a@cabinet.cd&acteurEmail=b@cabinet.cd', /Auteur illisible/],
        ['?entite=Compte%00', /Objet illisible · le caractère nul/],
        ['?entiteId=%00', /Identifiant d’objet illisible · le caractère nul/],
        ['?acteurEmail=a%00@cabinet.cd', /Auteur illisible · le caractère nul/],
        ['?depuis=9999-12-31T23:30-01:00', /Date de début illisible · attendu/],
        ['?jusqua=0000-01-01T00:00%2B01:00', /Date de fin illisible · attendu/],
    ])('%s · 400, avec sa raison, et la base n’est pas lue', async (requete, raison) => {
        const { statut, corps } = await lire(requete);
        expect([requete, statut]).toEqual([requete, 400]);
        expect(String(corps.message)).toMatch(raison);
        expect(appels).toHaveLength(0);
    });
    it('un paramètre inconnu est refusé · ignoré, il se lirait « aucun résultat » sur un filtre jamais appliqué', async () => {
        const { statut } = await lire('?auteur=a@cabinet.cd');
        expect(statut).toBe(400);
        expect(appels).toHaveLength(0);
    });
    it('un filtre lisible est appliqué tel qu’il est écrit, bornes comprises', async () => {
        const { statut, corps } = await lire('?page=1&taille=50&entite=Compte&acteurEmail=a@cabinet.cd&depuis=2026-09-01&jusqua=2026-09-30T12:00:00Z');
        expect(statut).toBe(200);
        expect(corps.evenements.map((e) => e.id)).toEqual(['e-4']);
        expect(corps).toMatchObject({ total: 1, page: 1, taille: 50 });
    });
    it('les chiffres de la page arrivent en nombres · la deuxième page commence où la première s’arrête', async () => {
        const { statut, corps } = await lire('?page=2&taille=2');
        expect(statut).toBe(200);
        expect(corps).toMatchObject({ total: 4, page: 2, taille: 2 });
        expect(corps.evenements.map((e) => e.id)).toEqual(['e-2', 'e-1']);
    });
    it('sans filtre, la première page par défaut', async () => {
        const { statut, corps } = await lire('');
        expect(statut).toBe(200);
        expect(corps).toMatchObject({ total: 4, page: 1, taille: 50 });
    });
});
//# sourceMappingURL=filtre-journal-audit.spec.js.map