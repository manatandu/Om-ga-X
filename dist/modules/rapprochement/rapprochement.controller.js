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
exports.RapprochementController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const compte_du_dossier_1 = require("../../common/compte-du-dossier");
const rapprochement_service_1 = require("./rapprochement.service");
const rapprochement_dto_1 = require("./dto/rapprochement.dto");
const client_1 = require("@prisma/client");
let RapprochementController = class RapprochementController {
    constructor(rapprochementService) {
        this.rapprochementService = rapprochementService;
    }
    async lister(user, compteId) {
        return this.rapprochementService.lister(user.tenantId, compteId);
    }
    async obtenir(user, id) {
        return this.rapprochementService.obtenir(user.tenantId, id);
    }
    async ouvrir(user, dto) {
        return this.rapprochementService.ouvrir(user.tenantId, user.userId, dto);
    }
    async pointer(user, id, dto) {
        return this.rapprochementService.pointer(user.tenantId, id, dto.ligneIds);
    }
    async depointer(user, id, dto) {
        return this.rapprochementService.depointer(user.tenantId, id, dto.ligneIds);
    }
    async cloturer(user, id) {
        return this.rapprochementService.cloturer(user.tenantId, id);
    }
    async rouvrir(user, id, dto) {
        return this.rapprochementService.rouvrir(user.tenantId, user.userId, id, dto.motif);
    }
    async declarerDepart(user, id, dto) {
        return this.rapprochementService.declarerDepart(user.tenantId, id, dto);
    }
    async declarerEncours(user, id, dto) {
        return this.rapprochementService.declarerEncours(user.tenantId, user.userId, id, dto);
    }
    async retirerEncours(user, id, encoursId) {
        return this.rapprochementService.retirerEncours(user.tenantId, id, encoursId);
    }
    async pointerEncours(user, id, dto) {
        return this.rapprochementService.pointerEncours(user.tenantId, id, dto.encoursIds);
    }
    async depointerEncours(user, id, dto) {
        return this.rapprochementService.depointerEncours(user.tenantId, id, dto.encoursIds);
    }
    async annuler(user, id) {
        return this.rapprochementService.annuler(user.tenantId, id);
    }
    async importerReleve(user, id, dto) {
        return this.rapprochementService.importerReleve(user.tenantId, id, dto);
    }
    async retirerReleve(user, id) {
        return this.rapprochementService.retirerReleve(user.tenantId, id);
    }
    async proposer(user, id, requete) {
        return this.rapprochementService.proposer(user.tenantId, id, requete.fenetreJours);
    }
    async confirmer(user, id, dto) {
        return this.rapprochementService.confirmer(user.tenantId, id, dto);
    }
    async dissocier(user, id, ligneReleveId) {
        return this.rapprochementService.dissocier(user.tenantId, id, ligneReleveId);
    }
};
exports.RapprochementController = RapprochementController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('compteId', compte_du_dossier_1.COMPTE_FACULTATIF)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "obtenir", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, rapprochement_dto_1.OuvrirRapprochementDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "ouvrir", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/pointer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.PointerDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "pointer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/depointer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.PointerDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "depointer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/cloturer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "cloturer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/rouvrir'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.RouvrirRapprochementDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "rouvrir", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/depart'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.DeclarerDepartDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "declarerDepart", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/encours'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.DeclarerEncoursDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "declarerEncours", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':id/encours/:encoursId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('encoursId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "retirerEncours", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/encours/pointer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.PointerEncoursDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "pointerEncours", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/encours/depointer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.PointerEncoursDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "depointerEncours", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "annuler", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/releve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.ImporterReleveDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "importerReleve", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':id/releve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "retirerReleve", null);
__decorate([
    (0, common_1.Get)(':id/propositions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.PropositionsRapprochementDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "proposer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/correspondances'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rapprochement_dto_1.ConfirmerCorrespondancesDto]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "confirmer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/releve/:ligneReleveId/dissocier'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('ligneReleveId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RapprochementController.prototype, "dissocier", null);
exports.RapprochementController = RapprochementController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('rapprochements'),
    __metadata("design:paramtypes", [rapprochement_service_1.RapprochementService])
], RapprochementController);
//# sourceMappingURL=rapprochement.controller.js.map