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
exports.RegularisationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const regularisation_service_1 = require("./regularisation.service");
const regularisation_dto_1 = require("./dto/regularisation.dto");
const client_1 = require("@prisma/client");
const exercice_requis_1 = require("../../common/exercice-requis");
let RegularisationController = class RegularisationController {
    constructor(service) {
        this.service = service;
    }
    async lister(user, exerciceId) {
        return this.service.lister(user.tenantId, exerciceId);
    }
    async simuler(user, dto) {
        return this.service.simuler(user.tenantId, dto);
    }
    async creer(user, dto) {
        return this.service.creer(user.tenantId, user.userId, dto);
    }
    async reprendre(user, id, body) {
        return this.service.reprendre(user.tenantId, user.userId, id, body.exerciceCibleId);
    }
    async listerAbonnements(user) {
        return this.service.listerAbonnements(user.tenantId);
    }
    async creerAbonnement(user, dto) {
        return this.service.creerAbonnement(user.tenantId, user.userId, dto);
    }
    async modifierAbonnement(user, id, dto) {
        return this.service.modifierAbonnement(user.tenantId, id, dto);
    }
    async supprimerAbonnement(user, id) {
        return this.service.supprimerAbonnement(user.tenantId, id);
    }
    async generer(user, id, dto) {
        return this.service.genererEcritures(user.tenantId, user.userId, id, dto);
    }
};
exports.RegularisationController = RegularisationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "lister", null);
__decorate([
    (0, common_1.Post)('simuler'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, regularisation_dto_1.CreerRegularisationDto]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "simuler", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, regularisation_dto_1.CreerRegularisationDto]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "creer", null);
__decorate([
    (0, common_1.Post)(':id/reprise'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, regularisation_dto_1.ReprendreRegularisationDto]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "reprendre", null);
__decorate([
    (0, common_1.Get)('abonnements/liste'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "listerAbonnements", null);
__decorate([
    (0, common_1.Post)('abonnements'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, regularisation_dto_1.CreerAbonnementDto]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "creerAbonnement", null);
__decorate([
    (0, common_1.Patch)('abonnements/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, regularisation_dto_1.ModifierAbonnementDto]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "modifierAbonnement", null);
__decorate([
    (0, common_1.Delete)('abonnements/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "supprimerAbonnement", null);
__decorate([
    (0, common_1.Post)('abonnements/:id/generer'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, regularisation_dto_1.GenererAbonnementDto]),
    __metadata("design:returntype", Promise)
], RegularisationController.prototype, "generer", null);
exports.RegularisationController = RegularisationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('regularisations'),
    __metadata("design:paramtypes", [regularisation_service_1.RegularisationService])
], RegularisationController);
//# sourceMappingURL=regularisation.controller.js.map