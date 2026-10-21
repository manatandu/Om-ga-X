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
exports.ReglementsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const reglements_service_1 = require("./reglements.service");
const reglements_dto_1 = require("./reglements.dto");
const exercice_requis_1 = require("../../common/exercice-requis");
let ReglementsController = class ReglementsController {
    constructor(reglements) {
        this.reglements = reglements;
    }
    async echeances(user, exerciceId, sens, jusquau) {
        if (sens !== 'FOURNISSEUR' && sens !== 'CLIENT')
            throw new common_1.BadRequestException('Sens attendu : FOURNISSEUR ou CLIENT.');
        return this.reglements.echeances(user.tenantId, exerciceId, sens, jusquau);
    }
    async comptesEscompteEcart(user, sens) {
        if (sens !== 'FOURNISSEUR' && sens !== 'CLIENT')
            throw new common_1.BadRequestException('Sens attendu : FOURNISSEUR ou CLIENT.');
        return this.reglements.comptesEscompteEcart(user.tenantId, sens);
    }
    async enregistrer(user, dto) {
        return this.reglements.enregistrer(user.tenantId, user.userId, dto, user.email);
    }
    async passerEcartChange(user, dto) {
        return this.reglements.passerEcartChange(user.tenantId, user.userId, dto);
    }
};
exports.ReglementsController = ReglementsController;
__decorate([
    (0, common_1.Get)('echeances'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('sens')),
    __param(3, (0, common_1.Query)('jusquau')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ReglementsController.prototype, "echeances", null);
__decorate([
    (0, common_1.Get)('comptes-escompte-ecart'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('sens')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReglementsController.prototype, "comptesEscompteEcart", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reglements_dto_1.EnregistrerReglementsDto]),
    __metadata("design:returntype", Promise)
], ReglementsController.prototype, "enregistrer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('ecart-change'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reglements_dto_1.PasserEcartChangeDto]),
    __metadata("design:returntype", Promise)
], ReglementsController.prototype, "passerEcartChange", null);
exports.ReglementsController = ReglementsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('reglements'),
    __metadata("design:paramtypes", [reglements_service_1.ReglementsService])
], ReglementsController);
//# sourceMappingURL=reglements.controller.js.map