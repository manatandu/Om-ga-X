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
exports.OrdresVirementController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const ordres_virement_service_1 = require("./ordres-virement.service");
const ordres_virement_dto_1 = require("./ordres-virement.dto");
const personnelOuvert = (user) => user.role !== client_1.RoleUtilisateur.AIDE_COMPTABLE;
let OrdresVirementController = class OrdresVirementController {
    constructor(ordres) {
        this.ordres = ordres;
    }
    lister(user, filtre) {
        return this.ordres.lister(user.tenantId, filtre.statut, personnelOuvert(user));
    }
    detail(user, id) {
        return this.ordres.detail(user.tenantId, id, personnelOuvert(user));
    }
    avisReglement(user, id) {
        return this.ordres.avisReglement(user.tenantId, id, personnelOuvert(user));
    }
    imprimer(user, id) {
        return this.ordres.imprimer(user.tenantId, id, user.email, personnelOuvert(user));
    }
    annuler(user, id, dto) {
        return this.ordres.annuler(user.tenantId, id, user.email, dto.motif, personnelOuvert(user));
    }
};
exports.OrdresVirementController = OrdresVirementController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ordres_virement_dto_1.ListerOrdresDto]),
    __metadata("design:returntype", void 0)
], OrdresVirementController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdresVirementController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)(':id/avis-reglement'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdresVirementController.prototype, "avisReglement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/impression'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdresVirementController.prototype, "imprimer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/annulation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ordres_virement_dto_1.AnnulerOrdreDto]),
    __metadata("design:returntype", void 0)
], OrdresVirementController.prototype, "annuler", null);
exports.OrdresVirementController = OrdresVirementController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('ordres-virement'),
    __metadata("design:paramtypes", [ordres_virement_service_1.OrdresVirementService])
], OrdresVirementController);
//# sourceMappingURL=ordres-virement.controller.js.map