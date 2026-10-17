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
exports.AnalytiqueController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const analytique_service_1 = require("./analytique.service");
const etats_analytiques_service_1 = require("./etats-analytiques.service");
const engagement_service_1 = require("./engagement.service");
const analytique_dto_1 = require("./dto/analytique.dto");
const od_analytique_dto_1 = require("./dto/od-analytique.dto");
const od_analytique_service_1 = require("./od-analytique.service");
const engagement_dto_1 = require("./dto/engagement.dto");
const client_1 = require("@prisma/client");
const exercice_requis_1 = require("../../common/exercice-requis");
let AnalytiqueController = class AnalytiqueController {
    constructor(analytique, etats, engagements, od) {
        this.analytique = analytique;
        this.etats = etats;
        this.engagements = engagements;
        this.od = od;
    }
    async listerOd(user, exerciceId, planId) {
        return this.od.lister(user.tenantId, exerciceId, planId);
    }
    async creerOd(user, dto) {
        return this.od.creer(user.tenantId, user.userId, dto);
    }
    async supprimerOd(user, odId) {
        return this.od.supprimer(user.tenantId, odId);
    }
    async listerPlans(user) {
        return this.analytique.listerPlans(user.tenantId);
    }
    async creerPlan(user, dto) {
        return this.analytique.creerPlan(user.tenantId, dto);
    }
    async modifierPlan(user, planId, dto) {
        return this.analytique.modifierPlan(user.tenantId, planId, dto);
    }
    async apercuLongueurSections(user, planId, longueur) {
        const texte = (longueur ?? '').trim();
        if (texte !== '' && !/^\d{1,3}$/.test(texte)) {
            throw new common_1.BadRequestException('La longueur des codes de section est un nombre entier de caractères.');
        }
        return this.analytique.apercuLongueurSections(user.tenantId, planId, texte === '' ? null : Number(texte));
    }
    async supprimerPlan(user, planId) {
        return this.analytique.supprimerPlan(user.tenantId, planId);
    }
    async listerSections(user, planId) {
        return this.analytique.listerSections(user.tenantId, planId);
    }
    async creerSection(user, planId, dto) {
        return this.analytique.creerSection(user.tenantId, planId, dto);
    }
    async modifierSection(user, sectionId, dto) {
        return this.analytique.modifierSection(user.tenantId, sectionId, dto);
    }
    async supprimerSection(user, sectionId) {
        return this.analytique.supprimerSection(user.tenantId, sectionId);
    }
    async budget(user, sectionId, exerciceId) {
        return this.analytique.budget(user.tenantId, sectionId, exerciceId);
    }
    async doterBudget(user, sectionId, dto) {
        return this.analytique.doterBudget(user.tenantId, sectionId, dto);
    }
    async modifierBudgetMois(user, sectionId, dto) {
        return this.analytique.modifierBudgetMois(user.tenantId, sectionId, dto);
    }
    async ventilations(user, ligneId) {
        return this.analytique.ventilationsDeLigne(user.tenantId, ligneId);
    }
    async ventiler(user, ligneId, dto) {
        return this.analytique.ventilerLigne(user.tenantId, ligneId, dto.ventilations);
    }
    async effacer(user, ligneId) {
        return this.analytique.effacerVentilation(user.tenantId, ligneId);
    }
    async balance(user, planId, exerciceId, dateDebut, dateFin) {
        return this.etats.balance(user.tenantId, { planId, exerciceId, dateDebut, dateFin });
    }
    async grandLivre(user, sectionId, exerciceId, dateDebut, dateFin) {
        return this.etats.grandLivre(user.tenantId, { sectionId, exerciceId, dateDebut, dateFin });
    }
    async controleCumuls(user, exerciceId, planId, dateDebut, dateFin) {
        return this.etats.controleCumuls(user.tenantId, { exerciceId, planId, dateDebut, dateFin });
    }
    async etatBudgetaire(user, planId, exerciceId, mois, dateDebut, dateFin) {
        return this.etats.etatBudgetaire(user.tenantId, {
            planId,
            exerciceId,
            mois: mois ? Number(mois) : undefined,
            dateDebut,
            dateFin,
        });
    }
    async listerEngagements(user, exerciceId) {
        return this.engagements.lister(user.tenantId, exerciceId);
    }
    async ecrituresRattachables(user, exerciceId, recherche) {
        return this.engagements.ecrituresRattachables(user.tenantId, exerciceId, recherche);
    }
    async creerEngagement(user, dto) {
        return this.engagements.creer(user.tenantId, user.userId, dto);
    }
    async rattacherExecution(user, engagementId, dto) {
        return this.engagements.rattacherExecution(user.tenantId, user.userId, engagementId, dto);
    }
    async detacherExecution(user, engagementId, executionId) {
        return this.engagements.detacherExecution(user.tenantId, engagementId, executionId);
    }
    async cloreEngagement(user, engagementId, dto) {
        return this.engagements.clore(user.tenantId, engagementId, dto);
    }
    async rouvrirEngagement(user, engagementId) {
        return this.engagements.rouvrir(user.tenantId, engagementId);
    }
    async supprimerEngagement(user, engagementId) {
        return this.engagements.supprimer(user.tenantId, engagementId);
    }
};
exports.AnalytiqueController = AnalytiqueController;
__decorate([
    (0, common_1.Get)('od'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('planId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "listerOd", null);
__decorate([
    (0, common_1.Post)('od'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, od_analytique_dto_1.CreerOdAnalytiqueDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "creerOd", null);
__decorate([
    (0, common_1.Delete)('od/:odId'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('odId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "supprimerOd", null);
__decorate([
    (0, common_1.Get)('plans'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "listerPlans", null);
__decorate([
    (0, common_1.Post)('plans'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, analytique_dto_1.CreerPlanAnalytiqueDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "creerPlan", null);
__decorate([
    (0, common_1.Patch)('plans/:planId'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('planId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, analytique_dto_1.ModifierPlanAnalytiqueDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "modifierPlan", null);
__decorate([
    (0, common_1.Get)('plans/:planId/longueur-sections'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('planId')),
    __param(2, (0, common_1.Query)('longueur')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "apercuLongueurSections", null);
__decorate([
    (0, common_1.Delete)('plans/:planId'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('planId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "supprimerPlan", null);
__decorate([
    (0, common_1.Get)('plans/:planId/sections'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('planId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "listerSections", null);
__decorate([
    (0, common_1.Post)('plans/:planId/sections'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('planId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, analytique_dto_1.CreerSectionDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "creerSection", null);
__decorate([
    (0, common_1.Patch)('sections/:sectionId'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sectionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, analytique_dto_1.ModifierSectionDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "modifierSection", null);
__decorate([
    (0, common_1.Delete)('sections/:sectionId'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "supprimerSection", null);
__decorate([
    (0, common_1.Get)('sections/:sectionId/budget'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sectionId')),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "budget", null);
__decorate([
    (0, common_1.Post)('sections/:sectionId/budget'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sectionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, analytique_dto_1.DoterBudgetDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "doterBudget", null);
__decorate([
    (0, common_1.Patch)('sections/:sectionId/budget'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sectionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, analytique_dto_1.ModifierBudgetMoisDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "modifierBudgetMois", null);
__decorate([
    (0, common_1.Get)('lignes/:ligneId/ventilations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ligneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "ventilations", null);
__decorate([
    (0, common_1.Post)('lignes/:ligneId/ventilations'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ligneId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, analytique_dto_1.VentilerLigneDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "ventiler", null);
__decorate([
    (0, common_1.Delete)('lignes/:ligneId/ventilations'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ligneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "effacer", null);
__decorate([
    (0, common_1.Get)('etats/balance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('planId')),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('dateDebut')),
    __param(4, (0, common_1.Query)('dateFin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "balance", null);
__decorate([
    (0, common_1.Get)('etats/grand-livre'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('sectionId')),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('dateDebut')),
    __param(4, (0, common_1.Query)('dateFin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "grandLivre", null);
__decorate([
    (0, common_1.Get)('etats/controle-cumuls'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('planId')),
    __param(3, (0, common_1.Query)('dateDebut')),
    __param(4, (0, common_1.Query)('dateFin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "controleCumuls", null);
__decorate([
    (0, common_1.Get)('etats/budgetaire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('planId')),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(3, (0, common_1.Query)('mois')),
    __param(4, (0, common_1.Query)('dateDebut')),
    __param(5, (0, common_1.Query)('dateFin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "etatBudgetaire", null);
__decorate([
    (0, common_1.Get)('engagements'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "listerEngagements", null);
__decorate([
    (0, common_1.Get)('engagements/ecritures-rattachables'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('recherche')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "ecrituresRattachables", null);
__decorate([
    (0, common_1.Post)('engagements'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, engagement_dto_1.CreerEngagementDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "creerEngagement", null);
__decorate([
    (0, common_1.Post)('engagements/:engagementId/executions'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('engagementId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, engagement_dto_1.RattacherExecutionDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "rattacherExecution", null);
__decorate([
    (0, common_1.Delete)('engagements/:engagementId/executions/:executionId'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('engagementId')),
    __param(2, (0, common_1.Param)('executionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "detacherExecution", null);
__decorate([
    (0, common_1.Patch)('engagements/:engagementId/cloture'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('engagementId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, engagement_dto_1.CloreEngagementDto]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "cloreEngagement", null);
__decorate([
    (0, common_1.Patch)('engagements/:engagementId/reouverture'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('engagementId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "rouvrirEngagement", null);
__decorate([
    (0, common_1.Delete)('engagements/:engagementId'),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('engagementId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AnalytiqueController.prototype, "supprimerEngagement", null);
exports.AnalytiqueController = AnalytiqueController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('analytique'),
    __metadata("design:paramtypes", [analytique_service_1.AnalytiqueService,
        etats_analytiques_service_1.EtatsAnalytiquesService,
        engagement_service_1.EngagementService,
        od_analytique_service_1.OdAnalytiqueService])
], AnalytiqueController);
//# sourceMappingURL=analytique.controller.js.map