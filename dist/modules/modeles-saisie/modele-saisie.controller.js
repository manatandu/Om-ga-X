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
exports.ModeleSaisieController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const modele_saisie_service_1 = require("./modele-saisie.service");
const journal_du_dossier_1 = require("../../common/journal-du-dossier");
const modele_saisie_dto_1 = require("./dto/modele-saisie.dto");
let ModeleSaisieController = class ModeleSaisieController {
    constructor(service) {
        this.service = service;
    }
    async lister(user, journalId, inclureInactifs) {
        return this.service.lister(user.tenantId, journalId, inclureInactifs === 'true');
    }
    async creer(user, dto) {
        return this.service.creer(user.tenantId, user.userId, dto);
    }
    async modifier(user, id, dto) {
        return this.service.modifier(user.tenantId, id, dto);
    }
    async supprimer(user, id) {
        return this.service.supprimer(user.tenantId, id);
    }
};
exports.ModeleSaisieController = ModeleSaisieController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('journalId', journal_du_dossier_1.JOURNAL_FACULTATIF)),
    __param(2, (0, common_1.Query)('inclureInactifs')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ModeleSaisieController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, modele_saisie_dto_1.CreerModeleSaisieDto]),
    __metadata("design:returntype", Promise)
], ModeleSaisieController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, modele_saisie_dto_1.ModifierModeleSaisieDto]),
    __metadata("design:returntype", Promise)
], ModeleSaisieController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ModeleSaisieController.prototype, "supprimer", null);
exports.ModeleSaisieController = ModeleSaisieController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('modeles-saisie'),
    __metadata("design:paramtypes", [modele_saisie_service_1.ModeleSaisieService])
], ModeleSaisieController);
//# sourceMappingURL=modele-saisie.controller.js.map