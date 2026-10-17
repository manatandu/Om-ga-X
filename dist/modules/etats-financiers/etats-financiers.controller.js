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
exports.EtatsFinanciersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const etats_financiers_service_1 = require("./etats-financiers.service");
const etats_financiers_projet_service_1 = require("./etats-financiers-projet.service");
const etats_financiers_smt_service_1 = require("./etats-financiers-smt.service");
const etats_financiers_projet_budget_service_1 = require("./etats-financiers-projet-budget.service");
const paiements_en_instance_1 = require("./paiements-en-instance");
const exercice_requis_1 = require("../../common/exercice-requis");
let EtatsFinanciersController = class EtatsFinanciersController {
    constructor(etatsFinanciersService, etatsFinanciersProjetService, etatsFinanciersSmtService, etatsFinanciersProjetBudgetService) {
        this.etatsFinanciersService = etatsFinanciersService;
        this.etatsFinanciersProjetService = etatsFinanciersProjetService;
        this.etatsFinanciersSmtService = etatsFinanciersSmtService;
        this.etatsFinanciersProjetBudgetService = etatsFinanciersProjetBudgetService;
    }
    async bilan(user, exerciceId) {
        return this.etatsFinanciersService.bilan(user.tenantId, exerciceId);
    }
    async compteDeResultat(user, exerciceId) {
        return this.etatsFinanciersService.compteDeResultat(user.tenantId, exerciceId);
    }
    async tableauFluxTresorerie(user, exerciceId) {
        return this.etatsFinanciersService.tableauFluxTresorerie(user.tenantId, exerciceId);
    }
    async bilanProjet(user, exerciceId) {
        return this.etatsFinanciersProjetService.bilan(user.tenantId, exerciceId);
    }
    async compteExploitationProjet(user, exerciceId) {
        return this.etatsFinanciersProjetService.compteExploitation(user.tenantId, exerciceId);
    }
    async emploisRessources(user, exerciceId) {
        return this.etatsFinanciersProjetService.tableauEmploisRessources(user.tenantId, exerciceId);
    }
    async executionBudgetaire(user, exerciceId, planId) {
        return this.etatsFinanciersProjetBudgetService.executionBudgetaire(user.tenantId, exerciceId, planId);
    }
    async reconciliationTresorerie(user, exerciceId, paiementsEnInstance) {
        return this.etatsFinanciersProjetBudgetService.reconciliationTresorerie(user.tenantId, exerciceId, (0, paiements_en_instance_1.lirePaiementsEnInstance)(paiementsEnInstance));
    }
    async noteBailleur(user, exerciceId) {
        return this.etatsFinanciersProjetService.noteBailleur(user.tenantId, exerciceId);
    }
    async bilanSmt(user, exerciceId) {
        return this.etatsFinanciersSmtService.bilan(user.tenantId, exerciceId);
    }
    async compteDeResultatSmt(user, exerciceId) {
        return this.etatsFinanciersSmtService.compteDeResultat(user.tenantId, exerciceId);
    }
    async journalTresorerieSmt(user, exerciceId) {
        return this.etatsFinanciersSmtService.journalTresorerie(user.tenantId, exerciceId);
    }
    async notesSmt(user, exerciceId) {
        const [note1, note2, note3, note5] = await Promise.all([
            this.etatsFinanciersSmtService.note1Immobilisations(user.tenantId, exerciceId),
            this.etatsFinanciersSmtService.note2Stocks(user.tenantId, exerciceId),
            this.etatsFinanciersSmtService.note3CreancesDettes(user.tenantId, exerciceId),
            this.etatsFinanciersSmtService.note5Dotation(user.tenantId, exerciceId),
        ]);
        const applicables = await this.etatsFinanciersSmtService.notesApplicables(user.tenantId, exerciceId, {
            note1,
            note2,
            note3,
            note5,
        });
        return { fiche: this.etatsFinanciersSmtService.ficheNotes(), applicables, note1, note2, note3, note5 };
    }
    async eligibiliteSmt(user, exerciceId) {
        return this.etatsFinanciersSmtService.eligibilite(user.tenantId, exerciceId);
    }
};
exports.EtatsFinanciersController = EtatsFinanciersController;
__decorate([
    (0, common_1.Get)('bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "bilan", null);
__decorate([
    (0, common_1.Get)('compte-de-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "compteDeResultat", null);
__decorate([
    (0, common_1.Get)('tableau-flux-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "tableauFluxTresorerie", null);
__decorate([
    (0, common_1.Get)('projet/bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "bilanProjet", null);
__decorate([
    (0, common_1.Get)('projet/compte-exploitation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "compteExploitationProjet", null);
__decorate([
    (0, common_1.Get)('projet/emplois-ressources'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "emploisRessources", null);
__decorate([
    (0, common_1.Get)('projet/execution-budgetaire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('planId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "executionBudgetaire", null);
__decorate([
    (0, common_1.Get)('projet/reconciliation-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('paiementsEnInstance')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "reconciliationTresorerie", null);
__decorate([
    (0, common_1.Get)('projet/note-bailleur'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "noteBailleur", null);
__decorate([
    (0, common_1.Get)('smt/bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "bilanSmt", null);
__decorate([
    (0, common_1.Get)('smt/compte-de-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "compteDeResultatSmt", null);
__decorate([
    (0, common_1.Get)('smt/journal-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "journalTresorerieSmt", null);
__decorate([
    (0, common_1.Get)('smt/notes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "notesSmt", null);
__decorate([
    (0, common_1.Get)('smt/eligibilite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersController.prototype, "eligibiliteSmt", null);
exports.EtatsFinanciersController = EtatsFinanciersController = __decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('etats-financiers'),
    __metadata("design:paramtypes", [etats_financiers_service_1.EtatsFinanciersService,
        etats_financiers_projet_service_1.EtatsFinanciersProjetService,
        etats_financiers_smt_service_1.EtatsFinanciersSmtService,
        etats_financiers_projet_budget_service_1.EtatsFinanciersProjetBudgetService])
], EtatsFinanciersController);
//# sourceMappingURL=etats-financiers.controller.js.map