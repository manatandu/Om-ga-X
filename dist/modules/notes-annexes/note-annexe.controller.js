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
exports.NoteAnnexeController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const note_annexe_service_1 = require("./note-annexe.service");
const rattachement_dto_1 = require("./dto/rattachement.dto");
const saisie_note_dto_1 = require("./dto/saisie-note.dto");
const exercice_requis_1 = require("../../common/exercice-requis");
let NoteAnnexeController = class NoteAnnexeController {
    constructor(noteAnnexeService) {
        this.noteAnnexeService = noteAnnexeService;
    }
    async associations(user, exerciceId) {
        return this.noteAnnexeService.notesAssociations(user.tenantId, exerciceId);
    }
    async projet(user, exerciceId) {
        return this.noteAnnexeService.notesProjet(user.tenantId, exerciceId);
    }
    async rattacher(user, dto) {
        return this.noteAnnexeService.rattacher(user.tenantId, user.userId, dto.jeu, dto.codeNote, dto.cleRubrique, dto.compteId);
    }
    async detacher(user, dto) {
        return this.noteAnnexeService.detacher(user.tenantId, dto.jeu, dto.codeNote, dto.cleRubrique, dto.compteId);
    }
    async saisir(user, dto) {
        return this.noteAnnexeService.enregistrerSaisie(user.tenantId, user.userId, dto.exerciceId, dto.jeu, dto.codeNote, dto.cleRubrique, dto.colonne, dto.valeur ?? null, dto.rang ?? 0);
    }
    async retirerFormatAnterieur(user, dto) {
        return this.noteAnnexeService.retirerSaisieFormatAnterieur(user.tenantId, user.userId, dto.exerciceId, dto.jeu, dto.codeNote, dto.motif);
    }
};
exports.NoteAnnexeController = NoteAnnexeController;
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('associations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NoteAnnexeController.prototype, "associations", null);
__decorate([
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Get)('projet'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NoteAnnexeController.prototype, "projet", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('rattachements'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, rattachement_dto_1.RattacherDto]),
    __metadata("design:returntype", Promise)
], NoteAnnexeController.prototype, "rattacher", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)('rattachements'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, rattachement_dto_1.RattacherDto]),
    __metadata("design:returntype", Promise)
], NoteAnnexeController.prototype, "detacher", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('saisies'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, saisie_note_dto_1.SaisirNoteDto]),
    __metadata("design:returntype", Promise)
], NoteAnnexeController.prototype, "saisir", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('saisies/format-anterieur/retirer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, saisie_note_dto_1.RetirerFormatAnterieurDto]),
    __metadata("design:returntype", Promise)
], NoteAnnexeController.prototype, "retirerFormatAnterieur", null);
exports.NoteAnnexeController = NoteAnnexeController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, common_1.Controller)('notes-annexes'),
    __metadata("design:paramtypes", [note_annexe_service_1.NoteAnnexeService])
], NoteAnnexeController);
//# sourceMappingURL=note-annexe.controller.js.map