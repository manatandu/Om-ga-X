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
exports.ControlesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const dossier_revision_service_1 = require("./dossier-revision.service");
const exercice_requis_1 = require("../../common/exercice-requis");
let ControlesController = class ControlesController {
    constructor(controles, revision) {
        this.controles = controles;
        this.revision = revision;
    }
    async reglesComptes(user) {
        return this.revision.regles(user.referentiel);
    }
    async dossierRevision(user, exerciceId) {
        return this.revision.dossier(user.tenantId, exerciceId, user.referentiel);
    }
    async analyser(user, exerciceId) {
        return this.controles.analyser(user.tenantId, exerciceId);
    }
    async caisse(user, exerciceId) {
        return this.controles.controleCaisse(user.tenantId, exerciceId);
    }
    async evolutionMensuelle(user, exerciceId, classe) {
        return this.controles.evolutionMensuelle(user.tenantId, exerciceId, { classe });
    }
    async comptesDormants(user, mois) {
        const n = Number(mois);
        return this.controles.comptesDormants(user.tenantId, Number.isFinite(n) && n > 0 ? n : 12);
    }
};
exports.ControlesController = ControlesController;
__decorate([
    (0, common_1.Get)('regles-comptes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ControlesController.prototype, "reglesComptes", null);
__decorate([
    (0, common_1.Get)('dossier-revision'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ControlesController.prototype, "dossierRevision", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ControlesController.prototype, "analyser", null);
__decorate([
    (0, common_1.Get)('caisse'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ControlesController.prototype, "caisse", null);
__decorate([
    (0, common_1.Get)('evolution-mensuelle'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __param(2, (0, common_1.Query)('classe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ControlesController.prototype, "evolutionMensuelle", null);
__decorate([
    (0, common_1.Get)('comptes-dormants'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('mois')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ControlesController.prototype, "comptesDormants", null);
exports.ControlesController = ControlesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('controles'),
    __metadata("design:paramtypes", [controles_service_1.ControlesService,
        dossier_revision_service_1.DossierRevisionService])
], ControlesController);
//# sourceMappingURL=controles.controller.js.map