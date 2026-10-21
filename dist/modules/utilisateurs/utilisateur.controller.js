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
exports.UtilisateurController = void 0;
const common_1 = require("@nestjs/common");
const fonctions_metier_1 = require("../../common/fonctions/fonctions-metier");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const utilisateur_service_1 = require("./utilisateur.service");
const avis_acces_service_1 = require("./avis-acces.service");
const utilisateur_dto_1 = require("./dto/utilisateur.dto");
const client_1 = require("@prisma/client");
let UtilisateurController = class UtilisateurController {
    constructor(utilisateurService, avis) {
        this.utilisateurService = utilisateurService;
        this.avis = avis;
    }
    async lister(user) {
        return this.utilisateurService.lister(user.tenantId);
    }
    async creer(user, dto) {
        const cree = await this.utilisateurService.creer(user.tenantId, dto);
        return {
            ...cree,
            avis: await this.avis.annoncerCompteCree(user.tenantId, {
                userId: cree.id,
                email: cree.email,
                role: cree.role,
                parQui: user.userId,
            }),
        };
    }
    async modifier(user, id, dto) {
        return this.utilisateurService.modifier(user.tenantId, id, user.userId, dto);
    }
    async reinitialiserMotDePasse(user, id, dto) {
        const resultat = await this.utilisateurService.reinitialiserMotDePasse(user.tenantId, id, dto.motDePasseProvisoire);
        return {
            ...resultat,
            avis: await this.avis.annoncerReinitialisation(user.tenantId, {
                userId: id,
                email: resultat.email,
                parQui: user.userId,
            }),
        };
    }
    catalogueFonctions() {
        return Object.entries(fonctions_metier_1.LIBELLES_FONCTION).map(([code, libelle]) => ({ code, libelle }));
    }
    async definirFonctions(user, id, dto) {
        return this.utilisateurService.definirFonctions(user.tenantId, id, dto);
    }
    async definirJournaux(user, id, dto) {
        return this.utilisateurService.definirJournaux(user.tenantId, id, dto);
    }
    async deverrouiller(user, id) {
        return this.utilisateurService.deverrouiller(user.tenantId, id);
    }
};
exports.UtilisateurController = UtilisateurController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UtilisateurController.prototype, "lister", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, utilisateur_dto_1.CreerUtilisateurDto]),
    __metadata("design:returntype", Promise)
], UtilisateurController.prototype, "creer", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, utilisateur_dto_1.ModifierUtilisateurDto]),
    __metadata("design:returntype", Promise)
], UtilisateurController.prototype, "modifier", null);
__decorate([
    (0, common_1.Post)(':id/reinitialiser-mot-de-passe'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, utilisateur_dto_1.ReinitialiserMotDePasseDto]),
    __metadata("design:returntype", Promise)
], UtilisateurController.prototype, "reinitialiserMotDePasse", null);
__decorate([
    (0, common_1.Get)('fonctions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UtilisateurController.prototype, "catalogueFonctions", null);
__decorate([
    (0, common_1.Put)(':id/fonctions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, utilisateur_dto_1.DefinirFonctionsDto]),
    __metadata("design:returntype", Promise)
], UtilisateurController.prototype, "definirFonctions", null);
__decorate([
    (0, common_1.Put)(':id/journaux'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, utilisateur_dto_1.DefinirJournauxDto]),
    __metadata("design:returntype", Promise)
], UtilisateurController.prototype, "definirJournaux", null);
__decorate([
    (0, common_1.Post)(':id/deverrouiller'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UtilisateurController.prototype, "deverrouiller", null);
exports.UtilisateurController = UtilisateurController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Controller)('utilisateurs'),
    __metadata("design:paramtypes", [utilisateur_service_1.UtilisateurService,
        avis_acces_service_1.AvisAccesService])
], UtilisateurController);
//# sourceMappingURL=utilisateur.controller.js.map