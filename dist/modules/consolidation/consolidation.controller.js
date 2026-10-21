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
exports.ConsolidationController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const perimetre_service_1 = require("./perimetre.service");
const cumul_service_1 = require("./cumul.service");
const etats_consolides_service_1 = require("./etats-consolides.service");
const exercice_requis_1 = require("../../common/exercice-requis");
const perimetre_dto_1 = require("./dto/perimetre.dto");
let ConsolidationController = class ConsolidationController {
    constructor(perimetre, cumuls, etatsConsolides) {
        this.perimetre = perimetre;
        this.cumuls = cumuls;
        this.etatsConsolides = etatsConsolides;
    }
    etat(user, exerciceId) {
        return this.perimetre.etat(user.tenantId, exerciceId);
    }
    creerEntite(user, dto) {
        return this.perimetre.creerEntite(user.tenantId, dto);
    }
    modifierEntite(user, id, dto) {
        return this.perimetre.modifierEntite(user.tenantId, id, dto);
    }
    supprimerEntite(user, id) {
        return this.perimetre.supprimerEntite(user.tenantId, id);
    }
    ajouterLien(user, dto) {
        return this.perimetre.ajouterLien(user.tenantId, dto);
    }
    modifierLien(user, id, dto) {
        return this.perimetre.modifierLien(user.tenantId, id, dto);
    }
    supprimerLien(user, id) {
        return this.perimetre.supprimerLien(user.tenantId, id);
    }
    enregistrerFaits(user, dto) {
        return this.perimetre.enregistrerFaits(user.tenantId, dto);
    }
    cumul(user, exerciceId) {
        return this.cumuls.cumul(user.tenantId, exerciceId);
    }
    etats(user, exerciceId) {
        return this.etatsConsolides.etats(user.tenantId, exerciceId);
    }
    importerBalance(user, id, dto) {
        return this.cumuls.importerBalance(user.tenantId, id, dto);
    }
    declarerAcquisition(user, id, dto) {
        return this.cumuls.declarerAcquisition(user.tenantId, id, dto);
    }
    ajouterEcartEvaluation(user, id, dto) {
        return this.cumuls.ajouterEcartEvaluation(user.tenantId, id, dto);
    }
    supprimerEcartEvaluation(user, id) {
        return this.cumuls.supprimerEcartEvaluation(user.tenantId, id);
    }
    ajouterProvisionChange(user, dto) {
        return this.cumuls.ajouterProvisionChange(user.tenantId, dto);
    }
    supprimerProvisionChange(user, id) {
        return this.cumuls.supprimerProvisionChange(user.tenantId, id);
    }
    enregistrerMonnaie(user, id, dto) {
        return this.cumuls.enregistrerMonnaie(user.tenantId, id, dto);
    }
    enregistrerFiscalite(user, dto) {
        return this.cumuls.enregistrerFiscalite(user.tenantId, dto);
    }
    ajouterResultatInterne(user, dto) {
        return this.cumuls.ajouterResultatInterne(user.tenantId, dto);
    }
    supprimerResultatInterne(user, id) {
        return this.cumuls.supprimerResultatInterne(user.tenantId, id);
    }
    ajouterReciproque(user, dto) {
        return this.cumuls.ajouterReciproque(user.tenantId, dto);
    }
    supprimerReciproque(user, id) {
        return this.cumuls.supprimerReciproque(user.tenantId, id);
    }
};
exports.ConsolidationController = ConsolidationController;
__decorate([
    (0, common_1.Get)('perimetre'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "etat", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('entites'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perimetre_dto_1.EntitePerimetreDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "creerEntite", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('entites/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, perimetre_dto_1.ModifierEntitePerimetreDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "modifierEntite", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('entites/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "supprimerEntite", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('liens'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perimetre_dto_1.LienParticipationDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "ajouterLien", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('liens/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, perimetre_dto_1.ModifierLienParticipationDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "modifierLien", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('liens/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "supprimerLien", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('faits'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perimetre_dto_1.FaitsConsolidationDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "enregistrerFaits", null);
__decorate([
    (0, common_1.Get)('cumul'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "cumul", null);
__decorate([
    (0, common_1.Get)('etats'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "etats", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('entites/:id/balance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, perimetre_dto_1.ImporterBalanceEntiteDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "importerBalance", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('liens/:id/acquisition'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, perimetre_dto_1.AcquisitionDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "declarerAcquisition", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('liens/:id/ecarts-evaluation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, perimetre_dto_1.EcartEvaluationDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "ajouterEcartEvaluation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('ecarts-evaluation/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "supprimerEcartEvaluation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('provisions-change'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perimetre_dto_1.ProvisionChangeDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "ajouterProvisionChange", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('provisions-change/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "supprimerProvisionChange", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('entites/:id/monnaie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, perimetre_dto_1.MonnaieEntiteDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "enregistrerMonnaie", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Put)('fiscalite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perimetre_dto_1.FiscaliteEntiteDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "enregistrerFiscalite", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('resultats-internes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perimetre_dto_1.ResultatInterneDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "ajouterResultatInterne", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('resultats-internes/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "supprimerResultatInterne", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('reciproques'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perimetre_dto_1.OperationReciproqueDto]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "ajouterReciproque", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('reciproques/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsolidationController.prototype, "supprimerReciproque", null);
exports.ConsolidationController = ConsolidationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.Controller)('consolidation'),
    __metadata("design:paramtypes", [perimetre_service_1.PerimetreService,
        cumul_service_1.CumulService,
        etats_consolides_service_1.EtatsConsolidesService])
], ConsolidationController);
//# sourceMappingURL=consolidation.controller.js.map