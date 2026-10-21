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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompteController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const compte_service_1 = require("./compte.service");
const creer_compte_dto_1 = require("./dto/creer-compte.dto");
const client_1 = require("@prisma/client");
let CompteController = class CompteController {
    constructor(compteService) {
        this.compteService = compteService;
    }
    async lister(user, classe, recherche, actifsSeuls, typeCompte, retenus, usage) {
        return this.compteService.lister(user.tenantId, {
            classe,
            recherche,
            actifsSeuls: actifsSeuls === 'true',
            typeCompte,
            retenus: retenus === 'true',
            usage: usage === 'true',
        });
    }
    async renvois(user) {
        return this.compteService.renvoisDuPlan(user.tenantId);
    }
    async sousComptePropose(user, id) {
        return this.compteService.sousComptePropose(user.tenantId, id);
    }
    async propositionEnSaisie(user, numero) {
        return this.compteService.propositionEnSaisie(user.tenantId, numero ?? '');
    }
    async creerEnSaisie(user, dto) {
        return this.compteService.creerEnSaisie(user.tenantId, dto);
    }
    async neRetenirQueLesUtilises(user) {
        return this.compteService.neRetenirQueLesUtilises(user.tenantId);
    }
    async creer(user, dto) {
        return this.compteService.creer(user.tenantId, dto);
    }
    async modifier(user, id, dto) {
        return this.compteService.modifier(user.tenantId, id, dto);
    }
    async supprimer(user, id) {
        return this.compteService.supprimer(user.tenantId, id);
    }
};
exports.CompteController = CompteController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('classe')),
    __param(2, (0, common_1.Query)('recherche')),
    __param(3, (0, common_1.Query)('actifsSeuls')),
    __param(4, (0, common_1.Query)('typeCompte')),
    __param(5, (0, common_1.Query)('retenus')),
    __param(6, (0, common_1.Query)('usage')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('renvois'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "renvois", null);
__decorate([
    (0, common_1.Get)(':id/sous-compte-propose'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "sousComptePropose", null);
__decorate([
    (0, common_1.Get)('en-saisie/proposition'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('numero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "propositionEnSaisie", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('en-saisie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, creer_compte_dto_1.CreerCompteEnSaisieDto]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "creerEnSaisie", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('ne-retenir-que-les-utilises'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "neRetenirQueLesUtilises", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, creer_compte_dto_1.CreerCompteDto]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creer_compte_dto_1.ModifierCompteDto]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompteController.prototype, "supprimer", null);
exports.CompteController = CompteController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('comptes'),
    __metadata("design:paramtypes", [compte_service_1.CompteService])
], CompteController);
//# sourceMappingURL=compte.controller.js.map