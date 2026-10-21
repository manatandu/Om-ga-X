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
exports.JournalController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const journal_service_1 = require("./journal.service");
const analyse_journaux_service_1 = require("./analyse-journaux.service");
const journal_dto_1 = require("./dto/journal.dto");
const client_1 = require("@prisma/client");
const exercice_requis_1 = require("../../common/exercice-requis");
let JournalController = class JournalController {
    constructor(journalService, analyseJournauxService) {
        this.journalService = journalService;
        this.analyseJournauxService = analyseJournauxService;
    }
    async lister(user, actifsSeuls) {
        return this.journalService.lister(user.tenantId, actifsSeuls === 'true');
    }
    async palmaresComptes(user, exerciceId, classe, limite, inclureBrouillard) {
        return this.analyseJournauxService.palmaresComptes(user.tenantId, {
            exerciceId,
            classe: classe || undefined,
            limite: limite ? Number(limite) : undefined,
            inclureBrouillard: inclureBrouillard === 'true',
        });
    }
    async grilleSaisie(user, exerciceId) {
        return this.analyseJournauxService.grilleSaisie(user.tenantId, exerciceId);
    }
    async analyse(user, exerciceId) {
        return this.analyseJournauxService.analyseJournaux(user.tenantId, { exerciceId });
    }
    async comptesDuPlan(user) {
        return this.journalService.comptesDuPlanPourJournal(user.tenantId);
    }
    async compteDuJournalPropose(user, dto) {
        return this.journalService.compteDuJournalPropose(user.tenantId, dto.sousId);
    }
    async creer(user, dto) {
        return this.journalService.creer(user.tenantId, dto);
    }
    async modifier(user, id, dto) {
        return this.journalService.modifier(user.tenantId, id, dto);
    }
    async supprimer(user, id) {
        return this.journalService.supprimer(user.tenantId, id);
    }
};
exports.JournalController = JournalController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('actifsSeuls')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('palmares-comptes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('classe')),
    __param(3, (0, common_1.Query)('limite')),
    __param(4, (0, common_1.Query)('inclureBrouillard')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "palmaresComptes", null);
__decorate([
    (0, common_1.Get)('saisie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "grilleSaisie", null);
__decorate([
    (0, common_1.Get)('analyse'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "analyse", null);
__decorate([
    (0, common_1.Get)('comptes-du-plan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "comptesDuPlan", null);
__decorate([
    (0, common_1.Get)('compte-propose'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, journal_dto_1.CompteDuJournalProposeDto]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "compteDuJournalPropose", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, journal_dto_1.CreerJournalDto]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, journal_dto_1.ModifierJournalDto]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], JournalController.prototype, "supprimer", null);
exports.JournalController = JournalController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('journaux'),
    __metadata("design:paramtypes", [journal_service_1.JournalService,
        analyse_journaux_service_1.AnalyseJournauxService])
], JournalController);
//# sourceMappingURL=journal.controller.js.map