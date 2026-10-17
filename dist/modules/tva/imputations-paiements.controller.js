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
exports.ImputationsPaiementsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const imputations_paiements_service_1 = require("./imputations-paiements.service");
const imputation_paiement_dto_1 = require("./dto/imputation-paiement.dto");
let ImputationsPaiementsController = class ImputationsPaiementsController {
    constructor(imputations) {
        this.imputations = imputations;
    }
    async groupe(user, ligneId) {
        return this.imputations.groupe(user.tenantId, ligneId);
    }
    async declarer(user, dto) {
        return this.imputations.declarer(user.tenantId, user.userId, dto);
    }
    async retirer(user, ligneReglementId, dto) {
        return this.imputations.retirer(user.tenantId, user.userId, ligneReglementId, dto);
    }
};
exports.ImputationsPaiementsController = ImputationsPaiementsController;
__decorate([
    (0, common_1.Get)('groupe/:ligneId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ligneId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ImputationsPaiementsController.prototype, "groupe", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, imputation_paiement_dto_1.DeclarerImputationDto]),
    __metadata("design:returntype", Promise)
], ImputationsPaiementsController.prototype, "declarer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':ligneReglementId/retirer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ligneReglementId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, imputation_paiement_dto_1.RetirerImputationDto]),
    __metadata("design:returntype", Promise)
], ImputationsPaiementsController.prototype, "retirer", null);
exports.ImputationsPaiementsController = ImputationsPaiementsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('imputations-paiements'),
    __metadata("design:paramtypes", [imputations_paiements_service_1.ImputationsPaiementsService])
], ImputationsPaiementsController);
//# sourceMappingURL=imputations-paiements.controller.js.map