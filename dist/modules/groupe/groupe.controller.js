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
exports.GroupeController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const groupe_service_1 = require("./groupe.service");
const groupe_dto_1 = require("./dto/groupe.dto");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const exercice_requis_1 = require("../../common/exercice-requis");
const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function envoyerXlsx(res, classeur) {
    res.set({
        'Content-Type': TYPE_XLSX,
        'Content-Disposition': `attachment; filename="${classeur.nomFichier}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(classeur.buffer);
}
let GroupeController = class GroupeController {
    constructor(groupeService) {
        this.groupeService = groupeService;
    }
    cellules(user) {
        return this.groupeService.cellules(user.tenantId);
    }
    creerCellule(user, dto) {
        return this.groupeService.creerCellule(user.tenantId, dto);
    }
    supervision(user, exerciceId) {
        return this.groupeService.supervision(user.tenantId, exerciceId);
    }
    balanceCellule(user, celluleId, exerciceId) {
        return this.groupeService.balanceCellule(user.tenantId, celluleId, exerciceId);
    }
    async canevas(user, res, celluleId) {
        envoyerXlsx(res, await this.groupeService.canevas(user.tenantId, celluleId));
    }
    importerCanevas(user, celluleId, dto) {
        return this.groupeService.importerCanevas(user.tenantId, celluleId, user.userId, dto);
    }
    balanceAgregee(user, exerciceId) {
        return this.groupeService.balanceAgregee(user.tenantId, exerciceId);
    }
    async liasseGroupe(user, res, exerciceId) {
        envoyerXlsx(res, await this.groupeService.liasseGroupe(user.tenantId, exerciceId, user.userId));
    }
    async balanceAgregeeExcel(user, res, exerciceId) {
        envoyerXlsx(res, await this.groupeService.balanceAgregeeExcel(user.tenantId, exerciceId));
    }
};
exports.GroupeController = GroupeController;
__decorate([
    (0, common_1.Get)('cellules'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GroupeController.prototype, "cellules", null);
__decorate([
    (0, common_1.Post)('cellules'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, groupe_dto_1.CreerCelluleDto]),
    __metadata("design:returntype", void 0)
], GroupeController.prototype, "creerCellule", null);
__decorate([
    (0, common_1.Get)('supervision'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GroupeController.prototype, "supervision", null);
__decorate([
    (0, common_1.Get)('cellules/:celluleId/balance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('celluleId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_D_UNE_CELLULE)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], GroupeController.prototype, "balanceCellule", null);
__decorate([
    (0, common_1.Get)('cellules/:celluleId/canevas'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Param)('celluleId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], GroupeController.prototype, "canevas", null);
__decorate([
    (0, common_1.Post)('cellules/:celluleId/import-canevas'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('celluleId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, groupe_dto_1.ImporterCanevasDto]),
    __metadata("design:returntype", void 0)
], GroupeController.prototype, "importerCanevas", null);
__decorate([
    (0, common_1.Get)('balance-agregee'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GroupeController.prototype, "balanceAgregee", null);
__decorate([
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Get)('liasse/excel'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], GroupeController.prototype, "liasseGroupe", null);
__decorate([
    (0, common_1.Get)('balance-agregee/excel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], GroupeController.prototype, "balanceAgregeeExcel", null);
exports.GroupeController = GroupeController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA),
    (0, common_1.Controller)('groupe'),
    __metadata("design:paramtypes", [groupe_service_1.GroupeService])
], GroupeController);
//# sourceMappingURL=groupe.controller.js.map