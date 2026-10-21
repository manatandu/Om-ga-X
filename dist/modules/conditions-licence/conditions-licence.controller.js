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
exports.ConditionsLicenceController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const conditions_licence_service_1 = require("./conditions-licence.service");
const conditions_licence_dto_1 = require("./dto/conditions-licence.dto");
let ConditionsLicenceController = class ConditionsLicenceController {
    constructor(conditions) {
        this.conditions = conditions;
    }
    etat(user) {
        return this.conditions.etat(user.tenantId);
    }
    accepter(user, dto) {
        return this.conditions.accepter(user.tenantId, { userId: user.userId, email: user.email }, dto.version, dto.empreinte, dto.empreinteCommande);
    }
    renvoyerAccuse(user) {
        return this.conditions.renvoyerAccuse(user.tenantId, { userId: user.userId, email: user.email });
    }
};
exports.ConditionsLicenceController = ConditionsLicenceController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConditionsLicenceController.prototype, "etat", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('acceptation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, conditions_licence_dto_1.AccepterConditionsDto]),
    __metadata("design:returntype", void 0)
], ConditionsLicenceController.prototype, "accepter", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('accuse'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConditionsLicenceController.prototype, "renvoyerAccuse", null);
exports.ConditionsLicenceController = ConditionsLicenceController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('conditions-licence'),
    __metadata("design:paramtypes", [conditions_licence_service_1.ConditionsLicenceService])
], ConditionsLicenceController);
//# sourceMappingURL=conditions-licence.controller.js.map