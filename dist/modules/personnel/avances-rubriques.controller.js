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
exports.AvancesRubriquesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const avances_rubriques_service_1 = require("./avances-rubriques.service");
const personnel_dto_1 = require("./dto/personnel.dto");
let AvancesRubriquesController = class AvancesRubriquesController {
    constructor(service) {
        this.service = service;
    }
    listerRubriques(user) {
        return this.service.listerRubriques(user.tenantId);
    }
    creerRubrique(user, dto) {
        return this.service.creerRubrique(user.tenantId, dto);
    }
    modifierRubrique(user, id, dto) {
        return this.service.modifierRubrique(user.tenantId, id, dto);
    }
    listerModeles(user) {
        return this.service.listerModeles(user.tenantId);
    }
    creerModele(user, dto) {
        return this.service.creerModele(user.tenantId, user.email, dto);
    }
    supprimerModele(user, id) {
        return this.service.supprimerModele(user.tenantId, id);
    }
    listerAvances(user, salarieId) {
        return this.service.listerAvances(user.tenantId, salarieId || undefined);
    }
    creerAvance(user, salarieId, dto) {
        return this.service.creerAvance(user.tenantId, user.email, salarieId, dto);
    }
    terminerSaisie(user, id, dto) {
        return this.service.terminerSaisie(user.tenantId, id, dto);
    }
    supprimerAvance(user, id) {
        return this.service.supprimerAvance(user.tenantId, id);
    }
};
exports.AvancesRubriquesController = AvancesRubriquesController;
__decorate([
    (0, common_1.Get)('rubriques'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "listerRubriques", null);
__decorate([
    (0, common_1.Post)('rubriques'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, personnel_dto_1.RubriquePaieDto]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "creerRubrique", null);
__decorate([
    (0, common_1.Patch)('rubriques/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.ModifierRubriquePaieDto]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "modifierRubrique", null);
__decorate([
    (0, common_1.Get)('modeles-bulletin'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "listerModeles", null);
__decorate([
    (0, common_1.Post)('modeles-bulletin'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, personnel_dto_1.ModeleBulletinDto]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "creerModele", null);
__decorate([
    (0, common_1.Delete)('modeles-bulletin/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "supprimerModele", null);
__decorate([
    (0, common_1.Get)('avances'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('salarieId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "listerAvances", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/avances'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.AvanceSalaireDto]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "creerAvance", null);
__decorate([
    (0, common_1.Patch)('avances/:id/fin'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, personnel_dto_1.FinSaisieArretDto]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "terminerSaisie", null);
__decorate([
    (0, common_1.Delete)('avances/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AvancesRubriquesController.prototype, "supprimerAvance", null);
exports.AvancesRubriquesController = AvancesRubriquesController = __decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ aideComptable: false, gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('personnel'),
    __metadata("design:paramtypes", [avances_rubriques_service_1.AvancesRubriquesService])
], AvancesRubriquesController);
//# sourceMappingURL=avances-rubriques.controller.js.map