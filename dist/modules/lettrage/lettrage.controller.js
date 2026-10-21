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
exports.LettrageDossierController = exports.LettrageController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const lettrage_service_1 = require("./lettrage.service");
const lettrage_dto_1 = require("./dto/lettrage.dto");
const client_1 = require("@prisma/client");
let LettrageController = class LettrageController {
    constructor(lettrageService) {
        this.lettrageService = lettrageService;
    }
    async lister(user, compteId, nonLettreesSeulement) {
        return this.lettrageService.lister(user.tenantId, compteId, nonLettreesSeulement === 'true');
    }
    async lettrer(user, compteId, dto) {
        return this.lettrageService.lettrerManuel(user.tenantId, compteId, dto.ligneIds, user.userId, {
            autoriserPartiel: dto.autoriserPartiel,
            lettre: dto.lettre,
        });
    }
    async lettrageAutomatique(user, compteId) {
        return this.lettrageService.lettrageAutomatique(user.tenantId, compteId, user.userId);
    }
    async preLettrage(user, compteId) {
        return this.lettrageService.preLettrage(user.tenantId, compteId);
    }
    async confirmerPreLettrage(user, compteId, dto) {
        return this.lettrageService.confirmerPreLettrage(user.tenantId, compteId, user.userId, dto.groupes);
    }
    async reconduire(user, compteId, dto) {
        return this.lettrageService.reconduire(user.tenantId, compteId, dto.lettrageId, user.userId);
    }
    async completer(user, lettrageId, dto) {
        return this.lettrageService.completer(user.tenantId, lettrageId, dto.ligneIds);
    }
    async propositionEcartChange(user, compteId, lettrageId) {
        return this.lettrageService.propositionEcartChange(user.tenantId, lettrageId, compteId);
    }
    async verrouiller(user, lettrageId, dto) {
        return this.lettrageService.verrouiller(user.tenantId, lettrageId, dto.verrouille);
    }
    async delettrer(user, compteId, lettre) {
        return this.lettrageService.delettrer(user.tenantId, compteId, lettre);
    }
};
exports.LettrageController = LettrageController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Query)('nonLettreesSeulement')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lettrage_dto_1.LettrerDto]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "lettrer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('auto'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "lettrageAutomatique", null);
__decorate([
    (0, common_1.Get)('pre-lettrage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "preLettrage", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('pre-lettrage/confirmer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lettrage_dto_1.ConfirmerPreLettrageDto]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "confirmerPreLettrage", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('reconduire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lettrage_dto_1.ReconduireLettrageDto]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "reconduire", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':lettrageId/completer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('lettrageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lettrage_dto_1.CompleterLettrageDto]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "completer", null);
__decorate([
    (0, common_1.Get)(':lettrageId/ecart-change'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Param)('lettrageId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "propositionEcartChange", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':lettrageId/verrou'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('lettrageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lettrage_dto_1.VerrouillerLettrageDto]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "verrouiller", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':lettre'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Param)('lettre')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LettrageController.prototype, "delettrer", null);
exports.LettrageController = LettrageController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('comptes/:compteId/lettrage'),
    __metadata("design:paramtypes", [lettrage_service_1.LettrageService])
], LettrageController);
let LettrageDossierController = class LettrageDossierController {
    constructor(lettrageService) {
        this.lettrageService = lettrageService;
    }
    async listerTout(user, statut) {
        const filtre = statut === 'SOLDE' ? client_1.StatutLettrage.SOLDE : statut === 'PARTIEL' ? client_1.StatutLettrage.PARTIEL : undefined;
        return this.lettrageService.listerGroupesDuDossier(user.tenantId, filtre);
    }
};
exports.LettrageDossierController = LettrageDossierController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('statut')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LettrageDossierController.prototype, "listerTout", null);
exports.LettrageDossierController = LettrageDossierController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('lettrage'),
    __metadata("design:paramtypes", [lettrage_service_1.LettrageService])
], LettrageDossierController);
//# sourceMappingURL=lettrage.controller.js.map