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
exports.RibsTiersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const ribs_tiers_service_1 = require("./ribs-tiers.service");
const ribs_tiers_dto_1 = require("./dto/ribs-tiers.dto");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
let RibsTiersController = class RibsTiersController {
    constructor(ribs) {
        this.ribs = ribs;
    }
    lister(user, tiersId) {
        return this.ribs.lister(user.tenantId, tiersId, user.userId);
    }
    creer(user, tiersId, dto) {
        return this.ribs.creer(user.tenantId, tiersId, dto, user.userId);
    }
    modifier(user, id, dto) {
        return this.ribs.modifier(user.tenantId, id, dto, user.userId);
    }
    viser(user, id, dto) {
        return this.ribs.viser(user.tenantId, id, user.userId, dto.saisiLeLu);
    }
    supprimer(user, id) {
        return this.ribs.supprimer(user.tenantId, id);
    }
};
exports.RibsTiersController = RibsTiersController;
__decorate([
    (0, common_1.Get)('tiers/:tiersId/ribs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tiersId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RibsTiersController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('tiers/:tiersId/ribs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tiersId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ribs_tiers_dto_1.RibTiersDto]),
    __metadata("design:returntype", void 0)
], RibsTiersController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)('ribs-tiers/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ribs_tiers_dto_1.RibTiersDto]),
    __metadata("design:returntype", void 0)
], RibsTiersController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)('ribs-tiers/:id/viser'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ribs_tiers_dto_1.VisaRibDto]),
    __metadata("design:returntype", void 0)
], RibsTiersController.prototype, "viser", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)('ribs-tiers/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RibsTiersController.prototype, "supprimer", null);
exports.RibsTiersController = RibsTiersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ribs_tiers_service_1.RibsTiersService])
], RibsTiersController);
//# sourceMappingURL=ribs-tiers.controller.js.map