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
exports.RelancesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const relances_service_1 = require("./relances.service");
const relances_dto_1 = require("./dto/relances.dto");
const client_1 = require("@prisma/client");
const exercice_requis_1 = require("../../common/exercice-requis");
const compte_du_dossier_1 = require("../../common/compte-du-dossier");
let RelancesController = class RelancesController {
    constructor(relances) {
        this.relances = relances;
    }
    async listerNiveaux(user) {
        return this.relances.listerNiveaux(user.tenantId);
    }
    async creerNiveau(user, dto) {
        return this.relances.creerNiveau(user.tenantId, dto);
    }
    async modifierNiveau(user, id, dto) {
        return this.relances.modifierNiveau(user.tenantId, id, dto);
    }
    async positions(user, exerciceId, type, dateReference, racine) {
        return this.relances.positions(user.tenantId, { exerciceId, type, dateReference, racine });
    }
    async releve(user, compteId, exerciceId) {
        return this.relances.releve(user.tenantId, compteId, exerciceId);
    }
    async emettre(user, dto) {
        return this.relances.emettre(user.tenantId, user.userId, dto);
    }
    async horsRelance(user, tiersId, dto) {
        return this.relances.definirHorsRelance(user.tenantId, tiersId, dto);
    }
    async historique(user, compteId, du, au) {
        return this.relances.historique(user.tenantId, { compteId: compteId || undefined, du: du || undefined, au: au || undefined });
    }
};
exports.RelancesController = RelancesController;
__decorate([
    (0, common_1.Get)('niveaux'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RelancesController.prototype, "listerNiveaux", null);
__decorate([
    (0, common_1.Post)('niveaux'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, relances_dto_1.CreerNiveauDto]),
    __metadata("design:returntype", Promise)
], RelancesController.prototype, "creerNiveau", null);
__decorate([
    (0, common_1.Patch)('niveaux/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, relances_dto_1.ModifierNiveauDto]),
    __metadata("design:returntype", Promise)
], RelancesController.prototype, "modifierNiveau", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('type')),
    __param(3, (0, common_1.Query)('dateReference')),
    __param(4, (0, common_1.Query)('racine')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RelancesController.prototype, "positions", null);
__decorate([
    (0, common_1.Get)('releve/:compteId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId')),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RelancesController.prototype, "releve", null);
__decorate([
    (0, common_1.Post)('emettre'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, relances_dto_1.EmettreRelancesDto]),
    __metadata("design:returntype", Promise)
], RelancesController.prototype, "emettre", null);
__decorate([
    (0, common_1.Patch)('tiers/:tiersId/hors-relance'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tiersId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, relances_dto_1.HorsRelanceDto]),
    __metadata("design:returntype", Promise)
], RelancesController.prototype, "horsRelance", null);
__decorate([
    (0, common_1.Get)('historique'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('compteId', compte_du_dossier_1.COMPTE_FACULTATIF)),
    __param(2, (0, common_1.Query)('du')),
    __param(3, (0, common_1.Query)('au')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RelancesController.prototype, "historique", null);
exports.RelancesController = RelancesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('relances'),
    __metadata("design:paramtypes", [relances_service_1.RelancesService])
], RelancesController);
//# sourceMappingURL=relances.controller.js.map