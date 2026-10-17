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
exports.ExportModificationsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const licence_guard_1 = require("../../licence/licence.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../../common/decorators/acces-roles-cantonnes.decorator");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
const export_modifications_service_1 = require("./export-modifications.service");
const exporter_ecritures_dto_1 = require("./dto/exporter-ecritures.dto");
const pagination_par_numero_1 = require("../pagination-par-numero");
const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function brouillardOuRefus(valeur) {
    if (valeur === undefined || valeur === '' || valeur === 'true')
        return true;
    if (valeur === 'false')
        return false;
    throw new common_1.BadRequestException('Paramètre inclureBrouillard · « true » ou « false ».');
}
let ExportModificationsController = class ExportModificationsController {
    constructor(service) {
        this.service = service;
    }
    async lister(user, avant) {
        return this.service.lister(user.tenantId, (0, pagination_par_numero_1.lireAvant)(avant));
    }
    async apercu(user, inclureBrouillard) {
        return this.service.apercu(user.tenantId, brouillardOuRefus(inclureBrouillard));
    }
    async exporter(user, dto) {
        return this.service.exporter(user.tenantId, user.userId, dto.mode, dto.inclureBrouillard);
    }
    async fichier(user, id, res) {
        const { nomFichier, contenu } = await this.service.fichier(user.tenantId, id);
        res.set({
            'Content-Type': TYPE_XLSX,
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
            'Access-Control-Expose-Headers': 'Content-Disposition',
        });
        res.send(contenu);
    }
};
exports.ExportModificationsController = ExportModificationsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('avant')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExportModificationsController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('apercu'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('inclureBrouillard')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExportModificationsController.prototype, "apercu", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, exporter_ecritures_dto_1.ExporterEcrituresDto]),
    __metadata("design:returntype", Promise)
], ExportModificationsController.prototype, "exporter", null);
__decorate([
    (0, common_1.Get)(':id/fichier'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExportModificationsController.prototype, "fichier", null);
exports.ExportModificationsController = ExportModificationsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('exports-ecritures'),
    __metadata("design:paramtypes", [export_modifications_service_1.ExportModificationsService])
], ExportModificationsController);
//# sourceMappingURL=export-modifications.controller.js.map