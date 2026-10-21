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
exports.FiscaliteController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const fiscalite_service_1 = require("./fiscalite.service");
const fiscalite_dto_1 = require("./dto/fiscalite.dto");
const constat_impot_service_1 = require("./constat-impot.service");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const exercice_requis_1 = require("../../common/exercice-requis");
let FiscaliteController = class FiscaliteController {
    constructor(fiscalite, constats) {
        this.fiscalite = fiscalite;
        this.constats = constats;
    }
    async exemptionIs(user) {
        return this.fiscalite.exemptionIs(user.tenantId);
    }
    catalogue() {
        return this.fiscalite.catalogue();
    }
    async propositions(user, exerciceId) {
        return this.fiscalite.propositionsRetraitements(user.tenantId, exerciceId);
    }
    async resultatFiscal(user, exerciceId) {
        return this.fiscalite.resultatFiscal(user.tenantId, exerciceId);
    }
    async ajouterRetraitement(user, exerciceId, dto) {
        return this.fiscalite.ajouterRetraitement(user.tenantId, exerciceId, dto);
    }
    async modifierRetraitement(user, id, dto) {
        return this.fiscalite.modifierRetraitement(user.tenantId, id, dto);
    }
    async supprimerRetraitement(user, id) {
        return this.fiscalite.supprimerRetraitement(user.tenantId, id);
    }
    async ecritureImpot(user, exerciceId) {
        return this.constats.etat(user.tenantId, exerciceId);
    }
    async passerEcritureImpot(user, exerciceId, dto) {
        return this.constats.passer(user.tenantId, user.userId, exerciceId, dto);
    }
    async annulerEcritureImpot(user, exerciceId, dto) {
        return this.constats.annuler(user.tenantId, user.userId, exerciceId, dto);
    }
    async modifierDossier(user, exerciceId, dto) {
        return this.fiscalite.modifierDossier(user.tenantId, exerciceId, dto);
    }
};
exports.FiscaliteController = FiscaliteController;
__decorate([
    (0, common_1.Get)('exemption-is'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "exemptionIs", null);
__decorate([
    (0, common_1.Get)('catalogue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FiscaliteController.prototype, "catalogue", null);
__decorate([
    (0, common_1.Get)('exercices/:exerciceId/propositions-retraitements'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "propositions", null);
__decorate([
    (0, common_1.Get)('resultat-fiscal'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "resultatFiscal", null);
__decorate([
    (0, common_1.Post)('exercices/:exerciceId/retraitements'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fiscalite_dto_1.CreerRetraitementDto]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "ajouterRetraitement", null);
__decorate([
    (0, common_1.Patch)('retraitements/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fiscalite_dto_1.ModifierRetraitementDto]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "modifierRetraitement", null);
__decorate([
    (0, common_1.Delete)('retraitements/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "supprimerRetraitement", null);
__decorate([
    (0, common_1.Get)('exercices/:exerciceId/ecriture-impot'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "ecritureImpot", null);
__decorate([
    (0, common_1.Post)('exercices/:exerciceId/ecriture-impot'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fiscalite_dto_1.PasserConstatImpotDto]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "passerEcritureImpot", null);
__decorate([
    (0, common_1.Post)('exercices/:exerciceId/ecriture-impot/annuler'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fiscalite_dto_1.AnnulerConstatImpotDto]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "annulerEcritureImpot", null);
__decorate([
    (0, common_1.Patch)('exercices/:exerciceId/dossier'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fiscalite_dto_1.ModifierDossierFiscalDto]),
    __metadata("design:returntype", Promise)
], FiscaliteController.prototype, "modifierDossier", null);
exports.FiscaliteController = FiscaliteController = __decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('fiscalite'),
    __metadata("design:paramtypes", [fiscalite_service_1.FiscaliteService,
        constat_impot_service_1.ConstatImpotService])
], FiscaliteController);
//# sourceMappingURL=fiscalite.controller.js.map