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
exports.CongesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const conges_service_1 = require("./conges.service");
const conges_dto_1 = require("./dto/conges.dto");
let CongesController = class CongesController {
    constructor(conges) {
        this.conges = conges;
    }
    compteur(user, salarieId, aLa) {
        return this.conges.compteur(user.tenantId, salarieId, aLa || undefined);
    }
    propositions(user, salarieId, du = '') {
        return this.conges.propositions(user.tenantId, salarieId, du);
    }
    congesDuMois(user, salarieId, mois) {
        return this.conges.congesDuMois(user.tenantId, salarieId, mois);
    }
    declarerReprise(user, salarieId, dto) {
        return this.conges.declarerReprise(user.tenantId, user.email, salarieId, dto);
    }
    creerConge(user, salarieId, dto) {
        return this.conges.creerConge(user.tenantId, user.email, salarieId, dto);
    }
    modifierAllocation(user, id, dto) {
        return this.conges.modifierAllocation(user.tenantId, id, dto);
    }
    annulerConge(user, id, dto) {
        return this.conges.annulerConge(user.tenantId, user.email, id, dto.motif);
    }
};
exports.CongesController = CongesController;
__decorate([
    (0, common_1.Get)('salaries/:salarieId/conges'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Query)('ala')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CongesController.prototype, "compteur", null);
__decorate([
    (0, common_1.Get)('salaries/:salarieId/conges/propositions'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Query)('du')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CongesController.prototype, "propositions", null);
__decorate([
    (0, common_1.Get)('salaries/:salarieId/conges/du-mois/:mois'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Param)('mois')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CongesController.prototype, "congesDuMois", null);
__decorate([
    (0, common_1.Put)('salaries/:salarieId/conges/reprise'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, conges_dto_1.RepriseCongesDto]),
    __metadata("design:returntype", void 0)
], CongesController.prototype, "declarerReprise", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/conges'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, conges_dto_1.CongeSalarieDto]),
    __metadata("design:returntype", void 0)
], CongesController.prototype, "creerConge", null);
__decorate([
    (0, common_1.Patch)('conges/:id/allocation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, conges_dto_1.AllocationCongeDto]),
    __metadata("design:returntype", void 0)
], CongesController.prototype, "modifierAllocation", null);
__decorate([
    (0, common_1.Post)('conges/:id/annulation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, conges_dto_1.AnnulationCongeDto]),
    __metadata("design:returntype", void 0)
], CongesController.prototype, "annulerConge", null);
exports.CongesController = CongesController = __decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ aideComptable: false, gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('personnel'),
    __metadata("design:paramtypes", [conges_service_1.CongesService])
], CongesController);
//# sourceMappingURL=conges.controller.js.map