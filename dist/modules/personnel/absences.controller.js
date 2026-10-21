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
exports.AbsencesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const absences_service_1 = require("./absences.service");
const absences_dto_1 = require("./dto/absences.dto");
let AbsencesController = class AbsencesController {
    constructor(absences) {
        this.absences = absences;
    }
    catalogue() {
        return this.absences.catalogue();
    }
    lister(user, salarieId) {
        return this.absences.lister(user.tenantId, salarieId);
    }
    duMois(user, salarieId, mois, moyenne) {
        return this.absences.duMois(user.tenantId, salarieId, mois, moyenne);
    }
    creer(user, salarieId, dto) {
        return this.absences.creer(user.tenantId, user.email, salarieId, dto);
    }
    annuler(user, id, dto) {
        return this.absences.annuler(user.tenantId, user.email, id, dto.motif);
    }
    declarerIndemniteCaisse(user, id, dto) {
        return this.absences.declarerIndemniteCaisse(user.tenantId, user.email, id, dto);
    }
    annulerIndemniteCaisse(user, id, dto) {
        return this.absences.annulerIndemniteCaisse(user.tenantId, user.email, id, dto.motif);
    }
};
exports.AbsencesController = AbsencesController;
__decorate([
    (0, common_1.Get)('absences/catalogue'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AbsencesController.prototype, "catalogue", null);
__decorate([
    (0, common_1.Get)('salaries/:salarieId/absences'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AbsencesController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('salaries/:salarieId/absences/mois/:mois'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Param)('mois')),
    __param(3, (0, common_1.Query)('moyenne')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], AbsencesController.prototype, "duMois", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/absences'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, absences_dto_1.AbsenceSalarieDto]),
    __metadata("design:returntype", void 0)
], AbsencesController.prototype, "creer", null);
__decorate([
    (0, common_1.Post)('absences/:id/annulation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, absences_dto_1.AnnulationAbsenceDto]),
    __metadata("design:returntype", void 0)
], AbsencesController.prototype, "annuler", null);
__decorate([
    (0, common_1.Post)('absences/:id/indemnites-caisse'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, absences_dto_1.IndemniteCaisseDto]),
    __metadata("design:returntype", void 0)
], AbsencesController.prototype, "declarerIndemniteCaisse", null);
__decorate([
    (0, common_1.Post)('indemnites-caisse/:id/annulation'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, absences_dto_1.AnnulationAbsenceDto]),
    __metadata("design:returntype", void 0)
], AbsencesController.prototype, "annulerIndemniteCaisse", null);
exports.AbsencesController = AbsencesController = __decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ aideComptable: false, gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('personnel'),
    __metadata("design:paramtypes", [absences_service_1.AbsencesService])
], AbsencesController);
//# sourceMappingURL=absences.controller.js.map