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
exports.VirementsFondsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const exercice_requis_1 = require("../../common/exercice-requis");
const documents_tiers_controller_1 = require("../tiers/documents-tiers.controller");
const documents_tiers_1 = require("../tiers/documents-tiers");
const virements_fonds_service_1 = require("./virements-fonds.service");
const virements_fonds_dto_1 = require("./virements-fonds.dto");
let VirementsFondsController = class VirementsFondsController {
    constructor(virements) {
        this.virements = virements;
    }
    lister(user, exerciceId) {
        return this.virements.lister(user.tenantId, exerciceId);
    }
    creer(user, dto) {
        return this.virements.creer(user.tenantId, user.userId, dto);
    }
    annuler(user, id, dto) {
        return this.virements.annuler(user.tenantId, user.userId, id, dto);
    }
    deposerPiece(user, id, operation, fichier) {
        return this.virements.deposerPiece(user.tenantId, id, operation, fichier, user.email);
    }
    async telechargerPiece(user, id, res) {
        const piece = await this.virements.telechargerPiece(user.tenantId, id);
        res.set({
            'Content-Type': piece.typeMime,
            'Content-Disposition': (0, documents_tiers_1.dispositionTelechargement)(piece.nomFichier),
            'X-Content-Type-Options': 'nosniff',
            'Access-Control-Expose-Headers': 'Content-Disposition',
        });
        res.send(Buffer.from(piece.contenu));
    }
};
exports.VirementsFondsController = VirementsFondsController;
__decorate([
    (0, common_1.Get)('virements-fonds'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VirementsFondsController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('virements-fonds'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, virements_fonds_dto_1.CreerVirementDto]),
    __metadata("design:returntype", void 0)
], VirementsFondsController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, common_1.Post)('virements-fonds/:id/annuler'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, virements_fonds_dto_1.AnnulerVirementDto]),
    __metadata("design:returntype", void 0)
], VirementsFondsController.prototype, "annuler", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('virements-fonds/:id/pieces'),
    (0, common_1.UseFilters)(documents_tiers_controller_1.RefusEnvoi),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('fichier', { limits: { fileSize: documents_tiers_1.TAILLE_MAX_DOCUMENT, files: 1, fields: 2 } })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('operation')),
    __param(3, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object]),
    __metadata("design:returntype", void 0)
], VirementsFondsController.prototype, "deposerPiece", null);
__decorate([
    (0, common_1.Get)('pieces-virement-fonds/:id/fichier'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], VirementsFondsController.prototype, "telechargerPiece", null);
exports.VirementsFondsController = VirementsFondsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [virements_fonds_service_1.VirementsFondsService])
], VirementsFondsController);
//# sourceMappingURL=virements-fonds.controller.js.map