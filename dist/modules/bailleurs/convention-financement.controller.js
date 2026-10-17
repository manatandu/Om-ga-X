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
exports.ConventionFinancementController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const convention_financement_service_1 = require("./convention-financement.service");
const convention_dto_1 = require("./dto/convention.dto");
let ConventionFinancementController = class ConventionFinancementController {
    constructor(conventions) {
        this.conventions = conventions;
    }
    async lister(user) {
        return this.conventions.lister(user.tenantId);
    }
    async mentions(user) {
        return this.conventions.mentionsEngagementsConditionnels(user.tenantId);
    }
    async creances(user) {
        return this.conventions.creancesARecevoir(user.tenantId);
    }
    async creer(user, dto) {
        return this.conventions.creer(user.tenantId, user.userId, dto);
    }
    async modifier(user, id, dto) {
        return this.conventions.modifier(user.tenantId, id, dto);
    }
    async clore(user, id, dto) {
        return this.conventions.clore(user.tenantId, id, dto);
    }
    async ajouterTranche(user, id, dto) {
        return this.conventions.ajouterTranche(user.tenantId, id, dto);
    }
    async encaisserTranche(user, id, trancheId, dto) {
        return this.conventions.encaisserTranche(user.tenantId, id, trancheId, dto);
    }
    async supprimerTranche(user, id, trancheId) {
        return this.conventions.supprimerTranche(user.tenantId, id, trancheId);
    }
    async ajouterRapport(user, id, dto) {
        return this.conventions.ajouterRapport(user.tenantId, id, dto);
    }
    async transmettreRapport(user, id, rapportId, dto) {
        return this.conventions.transmettreRapport(user.tenantId, id, rapportId, dto.dateTransmission);
    }
    async supprimerRapport(user, id, rapportId) {
        return this.conventions.supprimerRapport(user.tenantId, id, rapportId);
    }
};
exports.ConventionFinancementController = ConventionFinancementController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('mentions-notes-annexes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "mentions", null);
__decorate([
    (0, common_1.Get)('creances-a-recevoir'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "creances", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, convention_dto_1.CreerConventionDto]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, convention_dto_1.ModifierConventionDto]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)(':id/cloture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, convention_dto_1.CloreConventionDto]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "clore", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/tranches'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, convention_dto_1.CreerTrancheDto]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "ajouterTranche", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/tranches/:trancheId/encaissement'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('trancheId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, convention_dto_1.EncaisserTrancheDto]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "encaisserTranche", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':id/tranches/:trancheId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('trancheId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "supprimerTranche", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/rapports'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, convention_dto_1.CreerRapportDto]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "ajouterRapport", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/rapports/:rapportId/transmission'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('rapportId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, convention_dto_1.TransmettreRapportDto]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "transmettreRapport", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':id/rapports/:rapportId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('rapportId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ConventionFinancementController.prototype, "supprimerRapport", null);
exports.ConventionFinancementController = ConventionFinancementController = __decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('conventions-financement'),
    __metadata("design:paramtypes", [convention_financement_service_1.ConventionFinancementService])
], ConventionFinancementController);
//# sourceMappingURL=convention-financement.controller.js.map