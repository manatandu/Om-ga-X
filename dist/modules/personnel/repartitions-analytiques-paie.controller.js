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
exports.RepartitionsAnalytiquesPaieController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const repartitions_analytiques_paie_service_1 = require("./repartitions-analytiques-paie.service");
const repartition_analytique_paie_dto_1 = require("./dto/repartition-analytique-paie.dto");
let RepartitionsAnalytiquesPaieController = class RepartitionsAnalytiquesPaieController {
    constructor(repartitions) {
        this.repartitions = repartitions;
    }
    lire(user, salarieId) {
        return this.repartitions.lire(user.tenantId, salarieId);
    }
    declarer(user, salarieId, dto) {
        return this.repartitions.declarer(user.tenantId, user.userId, salarieId, dto);
    }
    retirer(user, id, dto) {
        return this.repartitions.retirer(user.tenantId, user.userId, id, dto.motif);
    }
};
exports.RepartitionsAnalytiquesPaieController = RepartitionsAnalytiquesPaieController;
__decorate([
    (0, common_1.Get)('salaries/:salarieId/repartitions-analytiques'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RepartitionsAnalytiquesPaieController.prototype, "lire", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/repartitions-analytiques'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, repartition_analytique_paie_dto_1.RepartitionAnalytiquePaieDto]),
    __metadata("design:returntype", void 0)
], RepartitionsAnalytiquesPaieController.prototype, "declarer", null);
__decorate([
    (0, common_1.Post)('repartitions-analytiques/:id/retrait'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, repartition_analytique_paie_dto_1.RetraitRepartitionAnalytiqueDto]),
    __metadata("design:returntype", void 0)
], RepartitionsAnalytiquesPaieController.prototype, "retirer", null);
exports.RepartitionsAnalytiquesPaieController = RepartitionsAnalytiquesPaieController = __decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ aideComptable: false, gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('personnel'),
    __metadata("design:paramtypes", [repartitions_analytiques_paie_service_1.RepartitionsAnalytiquesPaieService])
], RepartitionsAnalytiquesPaieController);
//# sourceMappingURL=repartitions-analytiques-paie.controller.js.map