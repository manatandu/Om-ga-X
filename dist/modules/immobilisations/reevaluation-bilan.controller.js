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
exports.ReevaluationBilanController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const exercice_requis_1 = require("../../common/exercice-requis");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
const reevaluation_bilan_service_1 = require("./reevaluation-bilan.service");
let ReevaluationBilanController = class ReevaluationBilanController {
    constructor(service) {
        this.service = service;
    }
    perimetre(user, exerciceId) {
        return this.service.perimetre(user.tenantId, exerciceId);
    }
    reevaluer(user, dto) {
        return this.service.reevaluer(user.tenantId, user.userId, dto);
    }
    propositionReprise(user, exerciceId) {
        return this.service.propositionRepriseProvision(user.tenantId, exerciceId);
    }
    note(user, exerciceId) {
        return this.service.noteReevaluations(user.tenantId, exerciceId);
    }
    declarationSpeciale(user, exerciceId) {
        return this.service.declarationSpeciale(user.tenantId, exerciceId);
    }
    ecartALaSortie(user, immobilisationId) {
        return this.service.ecartALaSortie(user.tenantId, immobilisationId);
    }
    comptesReserve(user, retenus) {
        return this.service.comptesReserve(user.tenantId, retenus === 'true');
    }
    passerReprise(user, dto) {
        return this.service.passerRepriseProvision(user.tenantId, user.userId, dto);
    }
};
exports.ReevaluationBilanController = ReevaluationBilanController;
__decorate([
    (0, common_1.Get)('reevaluation-bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReevaluationBilanController.prototype, "perimetre", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('reevaluation-bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.ReevaluerImmobilisationsDto]),
    __metadata("design:returntype", void 0)
], ReevaluationBilanController.prototype, "reevaluer", null);
__decorate([
    (0, common_1.Get)('reevaluation-bilan/reprise-provision'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReevaluationBilanController.prototype, "propositionReprise", null);
__decorate([
    (0, common_1.Get)('reevaluation-bilan/note'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReevaluationBilanController.prototype, "note", null);
__decorate([
    (0, common_1.Get)('reevaluation-bilan/declaration-speciale'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReevaluationBilanController.prototype, "declarationSpeciale", null);
__decorate([
    (0, common_1.Get)('reevaluation-bilan/ecart-a-la-sortie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('immobilisationId', new common_1.ParseUUIDPipe({ version: '4' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReevaluationBilanController.prototype, "ecartALaSortie", null);
__decorate([
    (0, common_1.Get)('reevaluation-bilan/comptes-reserve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('retenus')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReevaluationBilanController.prototype, "comptesReserve", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('reevaluation-bilan/reprise-provision'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.RepriseProvisionReevaluationDto]),
    __metadata("design:returntype", void 0)
], ReevaluationBilanController.prototype, "passerReprise", null);
exports.ReevaluationBilanController = ReevaluationBilanController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('immobilisations'),
    __metadata("design:paramtypes", [reevaluation_bilan_service_1.ReevaluationBilanService])
], ReevaluationBilanController);
//# sourceMappingURL=reevaluation-bilan.controller.js.map