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
exports.SelectionsEditionController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const licence_guard_1 = require("../../licence/licence.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
const selections_edition_service_1 = require("./selections-edition.service");
const selection_edition_dto_1 = require("./dto/selection-edition.dto");
function editionOuRefus(valeur) {
    if (valeur && Object.values(client_1.EditionSelection).includes(valeur))
        return valeur;
    throw new common_1.BadRequestException('Édition inconnue · JOURNAL ou IMPRESSION_DIFFEREE.');
}
let SelectionsEditionController = class SelectionsEditionController {
    constructor(service) {
        this.service = service;
    }
    async lister(user, edition) {
        return this.service.lister(user.tenantId, editionOuRefus(edition));
    }
    async creer(user, dto) {
        return this.service.creer(user.tenantId, user.userId, dto.edition, dto.nom, dto.criteres);
    }
    async remplacer(user, id, dto) {
        return this.service.remplacer(user.tenantId, id, dto.criteres);
    }
    async supprimer(user, id) {
        return this.service.supprimer(user.tenantId, id);
    }
};
exports.SelectionsEditionController = SelectionsEditionController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('edition')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SelectionsEditionController.prototype, "lister", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, selection_edition_dto_1.CreerSelectionEditionDto]),
    __metadata("design:returntype", Promise)
], SelectionsEditionController.prototype, "creer", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, selection_edition_dto_1.RemplacerSelectionEditionDto]),
    __metadata("design:returntype", Promise)
], SelectionsEditionController.prototype, "remplacer", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SelectionsEditionController.prototype, "supprimer", null);
exports.SelectionsEditionController = SelectionsEditionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('selections-edition'),
    __metadata("design:paramtypes", [selections_edition_service_1.SelectionsEditionService])
], SelectionsEditionController);
//# sourceMappingURL=selections-edition.controller.js.map