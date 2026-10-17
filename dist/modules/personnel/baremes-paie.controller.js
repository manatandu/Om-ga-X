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
exports.BaremesPaieController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const baremes_paie_service_1 = require("./baremes-paie.service");
const personnel_dto_1 = require("./dto/personnel.dto");
let BaremesPaieController = class BaremesPaieController {
    constructor(service) {
        this.service = service;
    }
    lister(user) {
        return this.service.lister(user.tenantId);
    }
    ajouter(user, dto) {
        return this.service.ajouter(user.tenantId, user.email, dto);
    }
    supprimer(user, id) {
        return this.service.supprimer(user.tenantId, id);
    }
};
exports.BaremesPaieController = BaremesPaieController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BaremesPaieController.prototype, "lister", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, personnel_dto_1.VersionBaremePaieDto]),
    __metadata("design:returntype", void 0)
], BaremesPaieController.prototype, "ajouter", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BaremesPaieController.prototype, "supprimer", null);
exports.BaremesPaieController = BaremesPaieController = __decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ aideComptable: false, gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('personnel/baremes'),
    __metadata("design:paramtypes", [baremes_paie_service_1.BaremesPaieService])
], BaremesPaieController);
//# sourceMappingURL=baremes-paie.controller.js.map