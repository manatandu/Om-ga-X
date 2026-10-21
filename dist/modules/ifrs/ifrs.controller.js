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
exports.IfrsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const ifrs_service_1 = require("./ifrs.service");
const exercice_requis_1 = require("../../common/exercice-requis");
const ifrs_dto_1 = require("./dto/ifrs.dto");
let IfrsController = class IfrsController {
    constructor(ifrs) {
        this.ifrs = ifrs;
    }
    etat(user, exerciceId) {
        return this.ifrs.etat(user.tenantId, exerciceId);
    }
    etatConsolide(user, exerciceId) {
        return this.ifrs.etatConsolide(user.tenantId, exerciceId);
    }
    ajouterRegleConsolidation(user, dto) {
        return this.ifrs.ajouterRegleConsolidation(user.tenantId, dto);
    }
    supprimerRegleConsolidation(user, id) {
        return this.ifrs.supprimerRegleConsolidation(user.tenantId, id);
    }
    declarerActivite(user, dto) {
        return this.ifrs.declarerActivite(user.tenantId, dto);
    }
    declarerPremiereApplication(user, dto) {
        return this.ifrs.declarerPremiereApplication(user.tenantId, dto);
    }
    declarerNotes(user, dto) {
        return this.ifrs.declarerNotes(user.tenantId, dto);
    }
    declarerNotesIfrs12(user, dto) {
        return this.ifrs.declarerNotesIfrs12(user.tenantId, dto);
    }
    declarerTresorerie(user, dto) {
        return this.ifrs.declarerTresorerie(user.tenantId, dto);
    }
    declarerEffetChange(user, dto) {
        return this.ifrs.declarerEffetChange(user.tenantId, dto);
    }
    supprimerEffetChange(user, exerciceId, consolide) {
        return this.ifrs.supprimerEffetChange(user.tenantId, exerciceId, consolide === 'true');
    }
    ajouterRegle(user, dto) {
        return this.ifrs.ajouterRegle(user.tenantId, dto);
    }
    supprimerRegle(user, id) {
        return this.ifrs.supprimerRegle(user.tenantId, id);
    }
    ajouterRetraitement(user, dto) {
        return this.ifrs.ajouterRetraitement(user.tenantId, dto);
    }
    supprimerRetraitement(user, id) {
        return this.ifrs.supprimerRetraitement(user.tenantId, id);
    }
    ajouterMouvementCp(user, dto) {
        return this.ifrs.ajouterMouvementCp(user.tenantId, dto);
    }
    supprimerMouvementCp(user, id) {
        return this.ifrs.supprimerMouvementCp(user.tenantId, id);
    }
};
exports.IfrsController = IfrsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "etat", null);
__decorate([
    (0, common_1.Get)('consolide'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "etatConsolide", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('regles-consolidation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.RegleConsolidationIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "ajouterRegleConsolidation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('regles-consolidation/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "supprimerRegleConsolidation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('activite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.ActiviteIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "declarerActivite", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('premiere-application'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.PremiereApplicationIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "declarerPremiereApplication", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('notes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.NotesIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "declarerNotes", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('notes-ifrs12'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.NotesIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "declarerNotesIfrs12", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.TresorerieIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "declarerTresorerie", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('effet-change'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.EffetChangeIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "declarerEffetChange", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('effet-change/:exerciceId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('consolide')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "supprimerEffetChange", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('regles'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.RegleIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "ajouterRegle", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('regles/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "supprimerRegle", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('retraitements'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.RetraitementIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "ajouterRetraitement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('retraitements/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "supprimerRetraitement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('mouvements-capitaux-propres'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ifrs_dto_1.MouvementCpIfrsDto]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "ajouterMouvementCp", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('mouvements-capitaux-propres/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], IfrsController.prototype, "supprimerMouvementCp", null);
exports.IfrsController = IfrsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Controller)('ifrs'),
    __metadata("design:paramtypes", [ifrs_service_1.IfrsService])
], IfrsController);
//# sourceMappingURL=ifrs.controller.js.map