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
exports.ComptabiliteGestionController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const licence_guard_1 = require("../../licence/licence.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
const exercice_requis_1 = require("../../../common/exercice-requis");
const comptabilite_gestion_service_1 = require("./comptabilite-gestion.service");
const comptabilite_gestion_dto_1 = require("./dto/comptabilite-gestion.dto");
let ComptabiliteGestionController = class ComptabiliteGestionController {
    constructor(gestion) {
        this.gestion = gestion;
    }
    comportements(user, exerciceId) {
        return this.gestion.comportements(user.tenantId, exerciceId);
    }
    declarerComportements(user, dto) {
        return this.gestion.declarerComportements(user.tenantId, dto);
    }
    seuil(user, exerciceId) {
        return this.gestion.seuilRentabilite(user.tenantId, exerciceId);
    }
    cles(user, exerciceId) {
        return this.gestion.cles(user.tenantId, exerciceId);
    }
    creerCle(user, dto) {
        return this.gestion.creerCle(user.tenantId, user.userId, dto);
    }
    reprendre(user, dto) {
        return this.gestion.reprendreCles(user.tenantId, user.userId, dto.exerciceId);
    }
    supprimerCle(user, cleId) {
        return this.gestion.supprimerCle(user.tenantId, cleId);
    }
    proposition(user, cleId, date) {
        return this.gestion.proposition(user.tenantId, cleId, date);
    }
    repartir(user, cleId, dto) {
        return this.gestion.repartir(user.tenantId, user.userId, cleId, dto);
    }
    couts(user, exerciceId) {
        return this.gestion.coutsProduction(user.tenantId, exerciceId);
    }
    declarerCout(user, dto) {
        return this.gestion.declarerCoutProduction(user.tenantId, user.userId, dto);
    }
    supprimerCout(user, id) {
        return this.gestion.supprimerCoutProduction(user.tenantId, id);
    }
};
exports.ComptabiliteGestionController = ComptabiliteGestionController;
__decorate([
    (0, common_1.Get)('comportements'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "comportements", null);
__decorate([
    (0, common_1.Put)('comportements'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, comptabilite_gestion_dto_1.DeclarerComportementsDto]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "declarerComportements", null);
__decorate([
    (0, common_1.Get)('seuil-rentabilite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "seuil", null);
__decorate([
    (0, common_1.Get)('cles'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "cles", null);
__decorate([
    (0, common_1.Post)('cles'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, comptabilite_gestion_dto_1.CreerCleRepartitionDto]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "creerCle", null);
__decorate([
    (0, common_1.Post)('cles/reprendre'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, comptabilite_gestion_dto_1.ReprendreClesDto]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "reprendre", null);
__decorate([
    (0, common_1.Delete)('cles/:cleId'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('cleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "supprimerCle", null);
__decorate([
    (0, common_1.Get)('cles/:cleId/proposition'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('cleId')),
    __param(2, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "proposition", null);
__decorate([
    (0, common_1.Post)('cles/:cleId/repartir'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('cleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, comptabilite_gestion_dto_1.RepartirDto]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "repartir", null);
__decorate([
    (0, common_1.Get)('couts-production'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "couts", null);
__decorate([
    (0, common_1.Post)('couts-production'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, comptabilite_gestion_dto_1.DeclarerCoutProductionDto]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "declarerCout", null);
__decorate([
    (0, common_1.Delete)('couts-production/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ComptabiliteGestionController.prototype, "supprimerCout", null);
exports.ComptabiliteGestionController = ComptabiliteGestionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('comptabilite-gestion'),
    __metadata("design:paramtypes", [comptabilite_gestion_service_1.ComptabiliteGestionService])
], ComptabiliteGestionController);
//# sourceMappingURL=comptabilite-gestion.controller.js.map