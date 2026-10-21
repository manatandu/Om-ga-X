"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const constants_1 = require("@nestjs/common/constants");
const route_paramtypes_enum_1 = require("@nestjs/common/enums/route-paramtypes.enum");
const testing_1 = require("@nestjs/testing");
const ordres_virement_controller_1 = require("./ordres-virement.controller");
const ordres_virement_service_1 = require("./ordres-virement.service");
const ordres_virement_dto_1 = require("./ordres-virement.dto");
const prisma_service_1 = require("../../common/prisma.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const bootstrap_1 = require("../../bootstrap");
const ORDRES = [
    { id: 'o1', tenantId: 'dossier-1', numero: 1, statut: 'A_IMPRIMER' },
    { id: 'o2', tenantId: 'dossier-1', numero: 2, statut: 'IMPRIME' },
    { id: 'o3', tenantId: 'dossier-1', numero: 3, statut: 'ANNULE' },
    { id: 'o4', tenantId: 'dossier-1', numero: 4, statut: 'IMPRIME' },
    { id: 'x1', tenantId: 'dossier-2', numero: 1, statut: 'IMPRIME' },
];
function prismaFactice() {
    const garde = (where) => ORDRES.filter((o) => o.tenantId === where.tenantId && (where.statut === undefined || o.statut === where.statut));
    return {
        ordreVirement: {
            findMany: jest.fn(async ({ where, take }) => [...garde(where)].sort((a, b) => b.numero - a.numero).slice(0, take)),
            count: jest.fn(async ({ where }) => garde(where).length),
        },
    };
}
describe('F207 · le contrôleur lit son filtre par le DTO', () => {
    it('un seul paramètre de requête, entier, typé par le DTO · sans quoi le ValidationPipe ne le voit pas', () => {
        const args = Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, ordres_virement_controller_1.OrdresVirementController, 'lister');
        const requetes = Object.entries(args).filter(([cle]) => cle.startsWith(`${route_paramtypes_enum_1.RouteParamtypes.QUERY}:`));
        expect(requetes).toHaveLength(1);
        const [, { index, data }] = requetes[0];
        expect(data).toBeUndefined();
        const types = Reflect.getMetadata('design:paramtypes', ordres_virement_controller_1.OrdresVirementController.prototype, 'lister');
        expect(types[index]).toBe(ordres_virement_dto_1.ListerOrdresDto);
    });
});
describe('F207 · sur un vrai serveur Nest, avec le ValidationPipe de production', () => {
    let app;
    let port;
    let prisma;
    const sessionFactice = {
        canActivate(ctx) {
            ctx.switchToHttp().getRequest().user = { id: 'u-1', tenantId: 'dossier-1', role: 'ADMIN_CABINET' };
            return true;
        },
    };
    beforeAll(async () => {
        prisma = prismaFactice();
        const mod = await testing_1.Test.createTestingModule({
            controllers: [ordres_virement_controller_1.OrdresVirementController],
            providers: [ordres_virement_service_1.OrdresVirementService, { provide: prisma_service_1.PrismaService, useValue: prisma }],
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
        prisma.ordreVirement.findMany.mockClear();
        prisma.ordreVirement.count.mockClear();
    });
    const lire = async (requete) => {
        const reponse = await fetch(`http://127.0.0.1:${port}/ordres-virement${requete}`);
        return { statut: reponse.status, corps: (await reponse.json()) };
    };
    it('sans filtre · tous les ordres du dossier, le filtre rendu à null', async () => {
        const { statut, corps } = await lire('');
        expect(statut).toBe(200);
        expect(corps.ordres.map((o) => o.id)).toEqual(['o4', 'o3', 'o2', 'o1']);
        expect(corps).toMatchObject({ total: 4, tronque: false, enAttenteImpression: 1, statut: null });
    });
    it('filtré par état · seuls les ordres de cet état, le total sur le même filtre', async () => {
        const { statut, corps } = await lire('?statut=IMPRIME');
        expect(statut).toBe(200);
        expect(corps.ordres.map((o) => o.id)).toEqual(['o4', 'o2']);
        expect(corps).toMatchObject({ total: 2, tronque: false, enAttenteImpression: 1, statut: 'IMPRIME' });
    });
    it.each([['?statut=INCONNU'], ['?statut=imprime'], ['?statut=']])('%s · 400 avant toute lecture', async (requete) => {
        const { statut, corps } = await lire(requete);
        expect(statut).toBe(400);
        expect(JSON.stringify(corps.message)).toMatch(/statut/);
        expect(prisma.ordreVirement.findMany).not.toHaveBeenCalled();
        expect(prisma.ordreVirement.count).not.toHaveBeenCalled();
    });
    it('un paramètre mal nommé est refusé, jamais ignoré', async () => {
        const { statut, corps } = await lire('?etat=IMPRIME');
        expect(statut).toBe(400);
        expect(JSON.stringify(corps.message)).toMatch(/etat/);
        expect(prisma.ordreVirement.findMany).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=ordres-virement-filtre.spec.js.map