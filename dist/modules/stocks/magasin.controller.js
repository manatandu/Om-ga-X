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
exports.MagasinController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const magasin_service_1 = require("./magasin.service");
const magasin_dto_1 = require("./dto/magasin.dto");
let MagasinController = class MagasinController {
    constructor(magasin) {
        this.magasin = magasin;
    }
    async listerArticles(user) {
        return this.magasin.listerArticles(user.tenantId);
    }
    async creerArticle(user, dto) {
        return this.magasin.creerArticle(user.tenantId, user.userId, dto);
    }
    async ficheDeStock(user, articleId) {
        return this.magasin.ficheDeStock(user.tenantId, articleId);
    }
    async enregistrerMouvement(user, articleId, dto) {
        return this.magasin.enregistrerMouvement(user.tenantId, user.userId, articleId, dto);
    }
    async annulerMouvement(user, articleId, mouvementId, dto) {
        return this.magasin.annulerMouvement(user.tenantId, user.userId, articleId, mouvementId, dto);
    }
    async confronter(user, dto) {
        return this.magasin.confronter(user.tenantId, dto.comptages, dto.dateComptage);
    }
    async enregistrerRegularisation(user, dto) {
        return this.magasin.enregistrerRegularisation(user.tenantId, user.userId, dto);
    }
};
exports.MagasinController = MagasinController;
__decorate([
    (0, common_1.Get)('articles'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MagasinController.prototype, "listerArticles", null);
__decorate([
    (0, common_1.Post)('articles'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, magasin_dto_1.CreerArticleStockDto]),
    __metadata("design:returntype", Promise)
], MagasinController.prototype, "creerArticle", null);
__decorate([
    (0, common_1.Get)('articles/:articleId/fiche'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('articleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MagasinController.prototype, "ficheDeStock", null);
__decorate([
    (0, common_1.Post)('articles/:articleId/mouvements'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('articleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, magasin_dto_1.EnregistrerMouvementStockDto]),
    __metadata("design:returntype", Promise)
], MagasinController.prototype, "enregistrerMouvement", null);
__decorate([
    (0, common_1.Post)('articles/:articleId/mouvements/:mouvementId/annulation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('articleId')),
    __param(2, (0, common_1.Param)('mouvementId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, magasin_dto_1.AnnulerMouvementStockDto]),
    __metadata("design:returntype", Promise)
], MagasinController.prototype, "annulerMouvement", null);
__decorate([
    (0, common_1.Post)('inventaire/confrontation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, magasin_dto_1.ConfronterInventaireDto]),
    __metadata("design:returntype", Promise)
], MagasinController.prototype, "confronter", null);
__decorate([
    (0, common_1.Post)('inventaire/regularisation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, magasin_dto_1.EnregistrerRegularisationInventaireDto]),
    __metadata("design:returntype", Promise)
], MagasinController.prototype, "enregistrerRegularisation", null);
exports.MagasinController = MagasinController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('magasin'),
    __metadata("design:paramtypes", [magasin_service_1.MagasinService])
], MagasinController);
//# sourceMappingURL=magasin.controller.js.map