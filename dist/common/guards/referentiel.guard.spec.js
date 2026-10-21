"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const referentiel_guard_1 = require("./referentiel.guard");
const referentiels_decorator_1 = require("../decorators/referentiels.decorator");
function contexte(referentielsRequis, tenantId = 't1', prefetch) {
    const request = { user: { tenantId, ...(prefetch ? { referentiel: prefetch } : {}) } };
    const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(referentielsRequis),
    };
    const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => ({}),
        getClass: () => ({}),
    };
    return { ctx, reflector, request };
}
function service(referentiel) {
    return {
        tenant: {
            findUnique: jest.fn().mockResolvedValue(referentiel ? { referentiel } : null),
        },
    };
}
describe('ReferentielGuard', () => {
    it('laisse tout passer quand la route ne porte aucun @ReferentielsAutorises', async () => {
        const { ctx, reflector } = contexte(undefined);
        const guard = new referentiel_guard_1.ReferentielGuard(reflector, service('SYSCOHADA'));
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
    it('laisse passer un dossier du bon référentiel', async () => {
        const { ctx, reflector } = contexte(['SYCEBNL']);
        const guard = new referentiel_guard_1.ReferentielGuard(reflector, service('SYCEBNL'));
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
    it('refuse un dossier du mauvais référentiel', async () => {
        const { ctx, reflector } = contexte(['SYCEBNL']);
        const guard = new referentiel_guard_1.ReferentielGuard(reflector, service('SYSCOHADA'));
        await expect(guard.canActivate(ctx)).rejects.toThrow(common_1.ForbiddenException);
    });
    it('refuse un tenant introuvable plutôt que de laisser passer par défaut', async () => {
        const { ctx, reflector } = contexte(['SYCEBNL']);
        const guard = new referentiel_guard_1.ReferentielGuard(reflector, service(null));
        await expect(guard.canActivate(ctx)).rejects.toThrow(common_1.ForbiddenException);
    });
    it('refuse quand le tenant ne peut pas être résolu depuis la requête', async () => {
        const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['SYCEBNL']) };
        const ctx = {
            switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
            getHandler: () => ({}),
            getClass: () => ({}),
        };
        const guard = new referentiel_guard_1.ReferentielGuard(reflector, service('SYCEBNL'));
        await expect(guard.canActivate(ctx)).rejects.toThrow(common_1.ForbiddenException);
    });
    it('utilise le référentiel préchargé par le jeton, sans lire la base', async () => {
        const { ctx, reflector } = contexte(['SYCEBNL'], 't1', 'SYCEBNL');
        const prisma = service('SYSCOHADA');
        const guard = new referentiel_guard_1.ReferentielGuard(reflector, prisma);
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });
    it('refuse sur le référentiel préchargé, sans se rattraper sur la base', async () => {
        const { ctx, reflector } = contexte(['SYCEBNL'], 't1', 'SYSCOHADA');
        const prisma = service('SYCEBNL');
        const guard = new referentiel_guard_1.ReferentielGuard(reflector, prisma);
        await expect(guard.canActivate(ctx)).rejects.toThrow(common_1.ForbiddenException);
        expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });
    describe('avec un vrai Reflector', () => {
        let ControleurSycebnl = class ControleurSycebnl {
            routeSyscohada() {
                return null;
            }
            routeHeritee() {
                return null;
            }
        };
        __decorate([
            (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], ControleurSycebnl.prototype, "routeSyscohada", null);
        ControleurSycebnl = __decorate([
            (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL)
        ], ControleurSycebnl);
        function contexteReel(methode) {
            const request = { user: { tenantId: 't1' } };
            return {
                switchToHttp: () => ({ getRequest: () => request }),
                getHandler: () => ControleurSycebnl.prototype[methode],
                getClass: () => ControleurSycebnl,
            };
        }
        it('le décorateur de la méthode l’emporte sur celui de la classe', async () => {
            const guard = new referentiel_guard_1.ReferentielGuard(new core_1.Reflector(), service('SYSCOHADA'));
            await expect(guard.canActivate(contexteReel('routeSyscohada'))).resolves.toBe(true);
            const guardRefus = new referentiel_guard_1.ReferentielGuard(new core_1.Reflector(), service('SYCEBNL'));
            await expect(guardRefus.canActivate(contexteReel('routeSyscohada'))).rejects.toThrow(common_1.ForbiddenException);
        });
        it('une méthode sans décorateur hérite de celui de la classe', async () => {
            const guard = new referentiel_guard_1.ReferentielGuard(new core_1.Reflector(), service('SYCEBNL'));
            await expect(guard.canActivate(contexteReel('routeHeritee'))).resolves.toBe(true);
            const guardRefus = new referentiel_guard_1.ReferentielGuard(new core_1.Reflector(), service('SYSCOHADA'));
            await expect(guardRefus.canActivate(contexteReel('routeHeritee'))).rejects.toThrow(common_1.ForbiddenException);
        });
    });
});
//# sourceMappingURL=referentiel.guard.spec.js.map