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
exports.DocumentsObligatoiresController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const livre_inventaire_service_1 = require("./livre-inventaire.service");
const rapport_activite_service_1 = require("./rapport-activite.service");
const manuel_procedures_service_1 = require("./manuel-procedures.service");
const manuel_procedures_dto_1 = require("./dto/manuel-procedures.dto");
const documents_obligatoires_dto_1 = require("./dto/documents-obligatoires.dto");
const exercice_requis_1 = require("../../common/exercice-requis");
let DocumentsObligatoiresController = class DocumentsObligatoiresController {
    constructor(livreInventaire, rapportActivite, manuelProcedures) {
        this.livreInventaire = livreInventaire;
        this.rapportActivite = rapportActivite;
        this.manuelProcedures = manuelProcedures;
    }
    async transcriptions(user, exerciceId) {
        return this.livreInventaire.lister(user.tenantId, exerciceId);
    }
    async conformiteInventaire(user, exerciceId) {
        return this.livreInventaire.conformite(user.tenantId, exerciceId);
    }
    async transcrire(user, dto) {
        return this.livreInventaire.transcrire(user.tenantId, user.userId, dto);
    }
    async renseignerResume(user, id, dto) {
        return this.livreInventaire.renseignerResume(user.tenantId, id, dto);
    }
    async rapports(user, exerciceId) {
        return this.rapportActivite.lister(user.tenantId, exerciceId);
    }
    async conformiteRapport(user, exerciceId) {
        return user.referentiel === client_1.Referentiel.SYSCOHADA
            ? this.rapportActivite.conformiteRapportGestion(user.tenantId, exerciceId)
            : this.rapportActivite.conformite(user.tenantId, exerciceId);
    }
    async etablir(user, dto) {
        return this.rapportActivite.etablir(user.tenantId, user.userId, dto);
    }
    async manuels(user) {
        return this.manuelProcedures.lister(user.tenantId);
    }
    async conformiteManuel(user) {
        return this.manuelProcedures.conformite(user.tenantId);
    }
    async squeletteManuel() {
        return manuel_procedures_service_1.SQUELETTE_MANUEL;
    }
    async enregistrerManuel(user, dto) {
        return this.manuelProcedures.enregistrer(user.tenantId, user.userId, dto);
    }
};
exports.DocumentsObligatoiresController = DocumentsObligatoiresController;
__decorate([
    (0, common_1.Get)('livre-inventaire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "transcriptions", null);
__decorate([
    (0, common_1.Get)('livre-inventaire/conformite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "conformiteInventaire", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('livre-inventaire'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, documents_obligatoires_dto_1.TranscrireInventaireDto]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "transcrire", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('livre-inventaire/:id/resume'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, documents_obligatoires_dto_1.ResumeInventaireDto]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "renseignerResume", null);
__decorate([
    (0, common_1.Get)('rapport-activite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "rapports", null);
__decorate([
    (0, common_1.Get)('rapport-activite/conformite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "conformiteRapport", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('rapport-activite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, documents_obligatoires_dto_1.EtablirRapportActiviteDto]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "etablir", null);
__decorate([
    (0, common_1.Get)('manuel-procedures'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "manuels", null);
__decorate([
    (0, common_1.Get)('manuel-procedures/conformite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "conformiteManuel", null);
__decorate([
    (0, common_1.Get)('manuel-procedures/squelette'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "squeletteManuel", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('manuel-procedures'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, manuel_procedures_dto_1.EnregistrerManuelDto]),
    __metadata("design:returntype", Promise)
], DocumentsObligatoiresController.prototype, "enregistrerManuel", null);
exports.DocumentsObligatoiresController = DocumentsObligatoiresController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('documents-obligatoires'),
    __metadata("design:paramtypes", [livre_inventaire_service_1.LivreInventaireService,
        rapport_activite_service_1.RapportActiviteService,
        manuel_procedures_service_1.ManuelProceduresService])
], DocumentsObligatoiresController);
//# sourceMappingURL=documents-obligatoires.controller.js.map