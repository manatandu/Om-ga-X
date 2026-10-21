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
exports.CreancesDouteusesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const exercice_requis_1 = require("../../common/exercice-requis");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const creances_douteuses_service_1 = require("./creances-douteuses.service");
const creances_douteuses_dto_1 = require("./dto/creances-douteuses.dto");
let CreancesDouteusesController = class CreancesDouteusesController {
    constructor(service) {
        this.service = service;
    }
    lister(user, exerciceId) {
        return this.service.lister(user.tenantId, exerciceId);
    }
    comptes(user, exerciceId, numero) {
        return this.service.comptes(user.tenantId, exerciceId, numero);
    }
    propositionRevue(user, id, exerciceId) {
        return this.service.propositionRevue(user.tenantId, id, exerciceId);
    }
    reclasser(user, dto) {
        return this.service.reclasser(user.tenantId, user.userId, dto);
    }
    declarer(user, dto) {
        return this.service.declarer(user.tenantId, user.userId, dto);
    }
    revoir(user, id, dto) {
        return this.service.revoir(user.tenantId, user.userId, id, dto);
    }
    perte(user, id, dto) {
        return this.service.perte(user.tenantId, user.userId, id, dto);
    }
    propositionLettrage416(user, id, exerciceId) {
        return this.service.propositionLettrage416(user.tenantId, id, exerciceId);
    }
    lettrer416(user, id, dto) {
        return this.service.lettrer416(user.tenantId, user.userId, id, dto);
    }
    async factures(user, id) {
        const [candidates, designees] = await Promise.all([
            this.service.facturesCandidates(user.tenantId, id),
            this.service.facturesDesignees(user.tenantId, id),
        ]);
        return { ...candidates, designees };
    }
    async designerFactures(user, id, dto) {
        return this.service.designerFactures(user.tenantId, user.userId, id, dto);
    }
    async retirerDesignation(user, id, designationId, dto) {
        return this.service.retirerDesignation(user.tenantId, user.userId, id, designationId, dto);
    }
    recouvrement(user, id, dto) {
        return this.service.recouvrement(user.tenantId, user.userId, id, dto);
    }
    retirer(user, id) {
        return this.service.retirerCreance(user.tenantId, id);
    }
    annulerRevue(user, id, revueId, dto) {
        return this.service.annulerRevue(user.tenantId, user.userId, id, revueId, dto);
    }
    candidatesCorrection(user, id) {
        return this.service.candidatesCorrection(user.tenantId, id);
    }
    corrigerParResultat(user, id, dto) {
        return this.service.corrigerParResultat(user.tenantId, user.userId, id, dto);
    }
    annulerReclassement(user, id, dto) {
        return this.service.annulerReclassement(user.tenantId, user.userId, id, dto);
    }
    annulerMouvement(user, id, mouvementId, dto) {
        return this.service.annulerMouvement(user.tenantId, user.userId, id, mouvementId, dto);
    }
    retirerMouvement(user, id, mouvementId) {
        return this.service.retirerMouvement(user.tenantId, user.userId, id, mouvementId);
    }
    propositionRecuperation(user, id) {
        return this.service.propositionRecuperation(user.tenantId, id);
    }
    recupererTva(user, id, dto) {
        return this.service.recupererTva(user.tenantId, user.userId, id, dto);
    }
    annulerRecuperation(user, id, recuperationId, dto) {
        return this.service.annulerRecuperation(user.tenantId, user.userId, id, recuperationId, dto);
    }
};
exports.CreancesDouteusesController = CreancesDouteusesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('comptes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('numero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "comptes", null);
__decorate([
    (0, common_1.Get)(':id/revue'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "propositionRevue", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, creances_douteuses_dto_1.ReclasserCreanceDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "reclasser", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('declarations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, creances_douteuses_dto_1.DeclarerCreanceOuvertureDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "declarer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/revue'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creances_douteuses_dto_1.RevoirDepreciationDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "revoir", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/perte'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creances_douteuses_dto_1.PerteCreanceDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "perte", null);
__decorate([
    (0, common_1.Get)(':id/lettrage-416'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "propositionLettrage416", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/lettrage-416'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creances_douteuses_dto_1.Lettrer416Dto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "lettrer416", null);
__decorate([
    (0, common_1.Get)(':id/factures'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CreancesDouteusesController.prototype, "factures", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/factures'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creances_douteuses_dto_1.DesignerFacturesDto]),
    __metadata("design:returntype", Promise)
], CreancesDouteusesController.prototype, "designerFactures", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/factures/:designationId/retirer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('designationId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, creances_douteuses_dto_1.RetirerDesignationDto]),
    __metadata("design:returntype", Promise)
], CreancesDouteusesController.prototype, "retirerDesignation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/recouvrement'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creances_douteuses_dto_1.RecouvrementCreanceDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "recouvrement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "retirer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/revues/:revueId/annuler'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('revueId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, creances_douteuses_dto_1.AnnulerRevueDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "annulerRevue", null);
__decorate([
    (0, common_1.Get)(':id/correction-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "candidatesCorrection", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/correction-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creances_douteuses_dto_1.CorrigerParResultatDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "corrigerParResultat", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/annuler'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creances_douteuses_dto_1.AnnulerReclassementDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "annulerReclassement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/mouvements/:mouvementId/annuler'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('mouvementId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, creances_douteuses_dto_1.AnnulerMouvementDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "annulerMouvement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Delete)(':id/mouvements/:mouvementId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('mouvementId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "retirerMouvement", null);
__decorate([
    (0, common_1.Get)(':id/recuperation-tva'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "propositionRecuperation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/recuperation-tva'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, creances_douteuses_dto_1.RecupererTvaCreanceDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "recupererTva", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)(':id/recuperations-tva/:recuperationId/annuler'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('recuperationId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, creances_douteuses_dto_1.AnnulerRecuperationTvaDto]),
    __metadata("design:returntype", void 0)
], CreancesDouteusesController.prototype, "annulerRecuperation", null);
exports.CreancesDouteusesController = CreancesDouteusesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('creances-douteuses'),
    __metadata("design:paramtypes", [creances_douteuses_service_1.CreancesDouteusesService])
], CreancesDouteusesController);
//# sourceMappingURL=creances-douteuses.controller.js.map