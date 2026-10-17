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
exports.BailleurController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const bailleur_service_1 = require("./bailleur.service");
const bailleur_dto_1 = require("./dto/bailleur.dto");
let BailleurController = class BailleurController {
    constructor(bailleurService) {
        this.bailleurService = bailleurService;
    }
    async lister(user, actifsSeuls) {
        return this.bailleurService.lister(user.tenantId, actifsSeuls === 'true');
    }
    async creer(user, dto) {
        return this.bailleurService.creer(user.tenantId, dto);
    }
    async modifier(user, id, dto) {
        return this.bailleurService.modifier(user.tenantId, id, dto);
    }
};
exports.BailleurController = BailleurController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('actifsSeuls')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BailleurController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bailleur_dto_1.CreerBailleurDto]),
    __metadata("design:returntype", Promise)
], BailleurController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, bailleur_dto_1.ModifierBailleurDto]),
    __metadata("design:returntype", Promise)
], BailleurController.prototype, "modifier", null);
exports.BailleurController = BailleurController = __decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('bailleurs'),
    __metadata("design:paramtypes", [bailleur_service_1.BailleurService])
], BailleurController);
//# sourceMappingURL=bailleur.controller.js.map