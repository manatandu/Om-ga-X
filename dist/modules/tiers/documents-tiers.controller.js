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
exports.DocumentsTiersController = exports.RefusEnvoi = exports.REFUS_MULTER = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const documents_tiers_service_1 = require("./documents-tiers.service");
const refus_envoi_filter_1 = require("../../common/pieces-jointes/refus-envoi.filter");
const documents_tiers_1 = require("./documents-tiers");
const documents_tiers_dto_1 = require("./dto/documents-tiers.dto");
var refus_envoi_filter_2 = require("../../common/pieces-jointes/refus-envoi.filter");
Object.defineProperty(exports, "REFUS_MULTER", { enumerable: true, get: function () { return refus_envoi_filter_2.REFUS_MULTER; } });
Object.defineProperty(exports, "RefusEnvoi", { enumerable: true, get: function () { return refus_envoi_filter_2.RefusEnvoi; } });
let DocumentsTiersController = class DocumentsTiersController {
    constructor(documents) {
        this.documents = documents;
    }
    lister(user, tiersId) {
        return this.documents.lister(user.tenantId, tiersId);
    }
    deposer(user, tiersId, fichier, dto) {
        return this.documents.deposer(user.tenantId, tiersId, fichier, dto.commentaire, user.email);
    }
    async telecharger(user, id, res) {
        const document = await this.documents.telecharger(user.tenantId, id);
        res.set({
            'Content-Type': document.typeMime,
            'Content-Disposition': (0, documents_tiers_1.dispositionTelechargement)(document.nomFichier),
            'X-Content-Type-Options': 'nosniff',
            'Access-Control-Expose-Headers': 'Content-Disposition',
        });
        res.send(Buffer.from(document.contenu));
    }
    modifier(user, id, dto) {
        return this.documents.modifierCommentaire(user.tenantId, id, dto.commentaire);
    }
    supprimer(user, id) {
        return this.documents.supprimer(user.tenantId, id);
    }
};
exports.DocumentsTiersController = DocumentsTiersController;
__decorate([
    (0, common_1.Get)('tiers/:tiersId/documents'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tiersId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DocumentsTiersController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('tiers/:tiersId/documents'),
    (0, common_1.UseFilters)(refus_envoi_filter_1.RefusEnvoi),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('fichier', { limits: { fileSize: documents_tiers_1.TAILLE_MAX_DOCUMENT, files: 1, fields: 4 } })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tiersId')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, documents_tiers_dto_1.DeposerDocumentDto]),
    __metadata("design:returntype", void 0)
], DocumentsTiersController.prototype, "deposer", null);
__decorate([
    (0, common_1.Get)('documents-tiers/:id/fichier'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], DocumentsTiersController.prototype, "telecharger", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('documents-tiers/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, documents_tiers_dto_1.CommentaireDocumentDto]),
    __metadata("design:returntype", void 0)
], DocumentsTiersController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('documents-tiers/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DocumentsTiersController.prototype, "supprimer", null);
exports.DocumentsTiersController = DocumentsTiersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [documents_tiers_service_1.DocumentsTiersService])
], DocumentsTiersController);
//# sourceMappingURL=documents-tiers.controller.js.map