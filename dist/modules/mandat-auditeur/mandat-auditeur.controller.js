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
exports.MandatAuditeurController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const mandat_auditeur_service_1 = require("./mandat-auditeur.service");
const mandat_auditeur_dto_1 = require("./dto/mandat-auditeur.dto");
let MandatAuditeurController = class MandatAuditeurController {
    constructor(mandats) {
        this.mandats = mandats;
    }
    lister(user) {
        return this.mandats.lister(user.tenantId);
    }
    obligation(user) {
        return this.mandats.obligation(user.tenantId);
    }
    duree(user, organe) {
        return this.mandats.dureeProposee(user.tenantId, organe);
    }
    enregistrer(user, dto) {
        return this.mandats.enregistrer(user.tenantId, dto);
    }
    refuserProrogation(user, id, dto) {
        return this.mandats.refuserProrogation(user.tenantId, id, dto.refus);
    }
    clore(user, id, dto) {
        return this.mandats.clore(user.tenantId, id, dto);
    }
};
exports.MandatAuditeurController = MandatAuditeurController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MandatAuditeurController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('obligation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MandatAuditeurController.prototype, "obligation", null);
__decorate([
    (0, common_1.Get)('duree'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MandatAuditeurController.prototype, "duree", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, mandat_auditeur_dto_1.EnregistrerMandatDto]),
    __metadata("design:returntype", void 0)
], MandatAuditeurController.prototype, "enregistrer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/prorogation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, mandat_auditeur_dto_1.RefusProrogationDto]),
    __metadata("design:returntype", void 0)
], MandatAuditeurController.prototype, "refuserProrogation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/fin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, mandat_auditeur_dto_1.CloreMandatDto]),
    __metadata("design:returntype", void 0)
], MandatAuditeurController.prototype, "clore", null);
exports.MandatAuditeurController = MandatAuditeurController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('mandat-auditeur'),
    __metadata("design:paramtypes", [mandat_auditeur_service_1.MandatAuditeurService])
], MandatAuditeurController);
//# sourceMappingURL=mandat-auditeur.controller.js.map