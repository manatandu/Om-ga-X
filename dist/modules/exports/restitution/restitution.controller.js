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
exports.RestitutionController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
const restitution_service_1 = require("./restitution.service");
let RestitutionController = class RestitutionController {
    constructor(restitution) {
        this.restitution = restitution;
    }
    async archive(user, req, res) {
        const nomFichier = await this.restitution.nomDeLArchive(user.tenantId);
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Access-Control-Expose-Headers': 'Content-Disposition',
        });
        await this.restitution.produire(user.tenantId, { id: user.userId, email: user.email, adresseIp: req.ip ?? null }, res);
    }
};
exports.RestitutionController = RestitutionController;
__decorate([
    (0, common_1.Get)('archive'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RestitutionController.prototype, "archive", null);
exports.RestitutionController = RestitutionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('restitution'),
    __metadata("design:paramtypes", [restitution_service_1.RestitutionService])
], RestitutionController);
//# sourceMappingURL=restitution.controller.js.map