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
exports.TauxTvaController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const taux_tva_service_1 = require("./taux-tva.service");
const taux_tva_dto_1 = require("./dto/taux-tva.dto");
const client_1 = require("@prisma/client");
let TauxTvaController = class TauxTvaController {
    constructor(tauxTvaService) {
        this.tauxTvaService = tauxTvaService;
    }
    async lister(user, actifsSeuls) {
        return this.tauxTvaService.lister(user.tenantId, actifsSeuls === 'true');
    }
    async declaration(user, dateDebut, dateFin) {
        if (!dateDebut || !dateFin) {
            throw new common_1.BadRequestException('dateDebut et dateFin sont requis');
        }
        const { figeEncaissement, ...declaration } = await this.tauxTvaService.declaration(user.tenantId, new Date(dateDebut), new Date(dateFin));
        return declaration;
    }
    async comptabiliserLiquidation(user, dto) {
        return this.tauxTvaService.comptabiliserLiquidation(user.tenantId, user.userId, dto);
    }
    async listerLiquidations(user) {
        return this.tauxTvaService.listerLiquidations(user.tenantId);
    }
    async annulerLiquidation(user, id) {
        return this.tauxTvaService.annulerLiquidation(user.tenantId, id);
    }
    async prorataDefinitif(user, annee) {
        const n = Number(annee);
        if (!annee || !Number.isInteger(n) || n < 1900 || n > 2200) {
            throw new common_1.BadRequestException('Une année civile est requise (paramètre `annee`).');
        }
        return this.tauxTvaService.prorataDefinitif(user.tenantId, n);
    }
    async creer(user, dto) {
        return this.tauxTvaService.creer(user.tenantId, dto);
    }
    async modifier(user, id, dto) {
        return this.tauxTvaService.modifier(user.tenantId, id, dto);
    }
    async supprimer(user, id) {
        return this.tauxTvaService.supprimer(user.tenantId, id);
    }
};
exports.TauxTvaController = TauxTvaController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('actifsSeuls')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('declaration'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('dateDebut')),
    __param(2, (0, common_1.Query)('dateFin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "declaration", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('declaration/comptabiliser'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, taux_tva_dto_1.ComptabiliserLiquidationDto]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "comptabiliserLiquidation", null);
__decorate([
    (0, common_1.Get)('liquidations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "listerLiquidations", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('liquidations/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "annulerLiquidation", null);
__decorate([
    (0, common_1.Get)('prorata-definitif'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('annee')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "prorataDefinitif", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, taux_tva_dto_1.CreerTauxTvaDto]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, taux_tva_dto_1.ModifierTauxTvaDto]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TauxTvaController.prototype, "supprimer", null);
exports.TauxTvaController = TauxTvaController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('taux-tva'),
    __metadata("design:paramtypes", [taux_tva_service_1.TauxTvaService])
], TauxTvaController);
//# sourceMappingURL=taux-tva.controller.js.map