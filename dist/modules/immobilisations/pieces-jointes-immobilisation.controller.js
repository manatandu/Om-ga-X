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
exports.PiecesJointesImmobilisationController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const pieces_jointes_service_1 = require("../../common/pieces-jointes/pieces-jointes.service");
const recevoir_une_piece_1 = require("../../common/pieces-jointes/recevoir-une-piece");
const pieces_jointes_dto_1 = require("../../common/pieces-jointes/pieces-jointes.dto");
const pieces_jointes_immobilisation_1 = require("./pieces-jointes-immobilisation");
let PiecesJointesImmobilisationController = class PiecesJointesImmobilisationController {
    constructor(pieces) {
        this.pieces = pieces;
    }
    lister(user, immobilisationId) {
        return this.pieces.lister(user.tenantId, pieces_jointes_immobilisation_1.REGLE_PIECES_IMMOBILISATION, immobilisationId);
    }
    deposer(user, immobilisationId, fichier, dto) {
        return this.pieces.deposer(user.tenantId, pieces_jointes_immobilisation_1.REGLE_PIECES_IMMOBILISATION, immobilisationId, fichier, dto.commentaire, user.email);
    }
    async telecharger(user, id, res) {
        (0, recevoir_une_piece_1.servirLaPiece)(res, await this.pieces.telecharger(user.tenantId, 'IMMOBILISATION', id));
    }
    commenter(user, id, dto) {
        return this.pieces.modifierCommentaire(user.tenantId, 'IMMOBILISATION', id, dto.commentaire);
    }
    retirer(user, id) {
        return this.pieces.retirer(user.tenantId, pieces_jointes_immobilisation_1.REGLE_PIECES_IMMOBILISATION, id);
    }
};
exports.PiecesJointesImmobilisationController = PiecesJointesImmobilisationController;
__decorate([
    (0, common_1.Get)('immobilisations/:immobilisationId/pieces-jointes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('immobilisationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PiecesJointesImmobilisationController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('immobilisations/:immobilisationId/pieces-jointes'),
    (0, recevoir_une_piece_1.RecevoirUnePiece)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('immobilisationId')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, pieces_jointes_dto_1.DeposerPieceJointeDto]),
    __metadata("design:returntype", void 0)
], PiecesJointesImmobilisationController.prototype, "deposer", null);
__decorate([
    (0, common_1.Get)('pieces-jointes-immobilisations/:id/fichier'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], PiecesJointesImmobilisationController.prototype, "telecharger", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('pieces-jointes-immobilisations/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, pieces_jointes_dto_1.CommentairePieceJointeDto]),
    __metadata("design:returntype", void 0)
], PiecesJointesImmobilisationController.prototype, "commenter", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('pieces-jointes-immobilisations/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PiecesJointesImmobilisationController.prototype, "retirer", null);
exports.PiecesJointesImmobilisationController = PiecesJointesImmobilisationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [pieces_jointes_service_1.PiecesJointesService])
], PiecesJointesImmobilisationController);
//# sourceMappingURL=pieces-jointes-immobilisation.controller.js.map