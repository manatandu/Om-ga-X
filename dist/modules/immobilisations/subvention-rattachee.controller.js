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
exports.SubventionRattacheeController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
const subvention_rattachee_service_1 = require("./subvention-rattachee.service");
let SubventionRattacheeController = class SubventionRattacheeController {
    constructor(service) {
        this.service = service;
    }
    lister(user, immobilisationId) {
        return this.service.lister(user.tenantId, immobilisationId);
    }
    octrois(user, compteSubventionId) {
        return this.service.octrois(user.tenantId, compteSubventionId);
    }
    enregistrerOctroi(user, dto) {
        return this.service.enregistrerOctroi(user.tenantId, user.userId, dto);
    }
    ventilation(user, id, montant) {
        const m = Number(montant);
        return this.service.ventilation(user.tenantId, id, Number.isFinite(m) && m > 0 ? m : 0);
    }
    rattacher(user, dto) {
        return this.service.rattacher(user.tenantId, user.userId, dto);
    }
    reduire(user, id, dto) {
        return this.service.reduire(user.tenantId, user.userId, id, dto);
    }
    declarerMethode(user, dto) {
        return this.service.declarerMethode(user.tenantId, dto);
    }
};
exports.SubventionRattacheeController = SubventionRattacheeController;
__decorate([
    (0, common_1.Get)('subventions-rattachees'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('immobilisationId', new common_1.ParseUUIDPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SubventionRattacheeController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('subventions-rattachees/octrois'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('compteSubventionId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SubventionRattacheeController.prototype, "octrois", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('subventions-rattachees/octrois'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.OctroiSubventionDto]),
    __metadata("design:returntype", void 0)
], SubventionRattacheeController.prototype, "enregistrerOctroi", null);
__decorate([
    (0, common_1.Get)(':id/ventilation-subvention'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('montant')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SubventionRattacheeController.prototype, "ventilation", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('subventions-rattachees'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.RattacherSubventionDto]),
    __metadata("design:returntype", void 0)
], SubventionRattacheeController.prototype, "rattacher", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('subventions-rattachees/:id/reductions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.ReduireSubventionDto]),
    __metadata("design:returntype", void 0)
], SubventionRattacheeController.prototype, "reduire", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Put)('subventions-rattachees-methode'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, immobilisation_dto_1.MethodeDepreciationSubventionDto]),
    __metadata("design:returntype", void 0)
], SubventionRattacheeController.prototype, "declarerMethode", null);
exports.SubventionRattacheeController = SubventionRattacheeController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('immobilisations'),
    __metadata("design:paramtypes", [subvention_rattachee_service_1.SubventionRattacheeService])
], SubventionRattacheeController);
//# sourceMappingURL=subvention-rattachee.controller.js.map