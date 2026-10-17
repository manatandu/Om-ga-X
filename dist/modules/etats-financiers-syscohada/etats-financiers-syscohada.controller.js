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
exports.EtatsFinanciersSyscohadaController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const etats_financiers_syscohada_service_1 = require("./etats-financiers-syscohada.service");
const etats_financiers_smt_syscohada_service_1 = require("./etats-financiers-smt-syscohada.service");
const note_annexe_service_1 = require("../notes-annexes/note-annexe.service");
const exercice_requis_1 = require("../../common/exercice-requis");
let EtatsFinanciersSyscohadaController = class EtatsFinanciersSyscohadaController {
    constructor(etatsFinanciersSyscohadaService, etatsFinanciersSmtSyscohadaService, noteAnnexeService) {
        this.etatsFinanciersSyscohadaService = etatsFinanciersSyscohadaService;
        this.etatsFinanciersSmtSyscohadaService = etatsFinanciersSmtSyscohadaService;
        this.noteAnnexeService = noteAnnexeService;
    }
    async bilan(user, exerciceId, arreteAu) {
        return this.etatsFinanciersSyscohadaService.bilan(user.tenantId, exerciceId, arreteAu);
    }
    async compteDeResultat(user, exerciceId, arreteAu) {
        return this.etatsFinanciersSyscohadaService.compteDeResultat(user.tenantId, exerciceId, arreteAu);
    }
    async tableauFluxTresorerie(user, exerciceId, arreteAu) {
        return this.etatsFinanciersSyscohadaService.tableauFluxTresorerie(user.tenantId, exerciceId, arreteAu);
    }
    async notes(user, exerciceId) {
        return this.noteAnnexeService.notesSyscohada(user.tenantId, exerciceId);
    }
    async bilanSmt(user, exerciceId) {
        return this.etatsFinanciersSmtSyscohadaService.bilan(user.tenantId, exerciceId);
    }
    async compteDeResultatSmt(user, exerciceId) {
        return this.etatsFinanciersSmtSyscohadaService.compteDeResultat(user.tenantId, exerciceId);
    }
    async journalTresorerieSmt(user, exerciceId) {
        return this.etatsFinanciersSmtSyscohadaService.journalTresorerie(user.tenantId, exerciceId);
    }
    async notesSmt(user, exerciceId) {
        const [note1, note2, note3, journauxDeSuivi, etatsDesGaranties] = await Promise.all([
            this.etatsFinanciersSmtSyscohadaService.note1MaterielMobilierCautions(user.tenantId, exerciceId),
            this.etatsFinanciersSmtSyscohadaService.note2Stocks(user.tenantId, exerciceId),
            this.etatsFinanciersSmtSyscohadaService.note3CreancesDettes(user.tenantId, exerciceId),
            this.etatsFinanciersSmtSyscohadaService.journauxDeSuivi(user.tenantId, exerciceId),
            this.etatsFinanciersSmtSyscohadaService.etatsDesGaranties(user.tenantId),
        ]);
        return {
            fiche: this.etatsFinanciersSmtSyscohadaService.ficheNotes(),
            note1,
            note2,
            note3,
            journauxDeSuivi,
            etatsDesGaranties,
        };
    }
    async eligibiliteSmt(user, exerciceId) {
        return this.etatsFinanciersSmtSyscohadaService.eligibilite(user.tenantId, exerciceId);
    }
};
exports.EtatsFinanciersSyscohadaController = EtatsFinanciersSyscohadaController;
__decorate([
    (0, common_1.Get)('bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('arreteAu')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "bilan", null);
__decorate([
    (0, common_1.Get)('compte-de-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('arreteAu')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "compteDeResultat", null);
__decorate([
    (0, common_1.Get)('tableau-flux-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('arreteAu')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "tableauFluxTresorerie", null);
__decorate([
    (0, common_1.Get)('notes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "notes", null);
__decorate([
    (0, common_1.Get)('smt/bilan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "bilanSmt", null);
__decorate([
    (0, common_1.Get)('smt/compte-de-resultat'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "compteDeResultatSmt", null);
__decorate([
    (0, common_1.Get)('smt/journal-tresorerie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "journalTresorerieSmt", null);
__decorate([
    (0, common_1.Get)('smt/notes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "notesSmt", null);
__decorate([
    (0, common_1.Get)('smt/eligibilite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EtatsFinanciersSyscohadaController.prototype, "eligibiliteSmt", null);
exports.EtatsFinanciersSyscohadaController = EtatsFinanciersSyscohadaController = __decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYSCOHADA),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('etats-financiers-syscohada'),
    __metadata("design:paramtypes", [etats_financiers_syscohada_service_1.EtatsFinanciersSyscohadaService,
        etats_financiers_smt_syscohada_service_1.EtatsFinanciersSmtSyscohadaService,
        note_annexe_service_1.NoteAnnexeService])
], EtatsFinanciersSyscohadaController);
//# sourceMappingURL=etats-financiers-syscohada.controller.js.map