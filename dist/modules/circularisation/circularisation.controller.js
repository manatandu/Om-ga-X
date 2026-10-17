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
exports.CircularisationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const circularisation_service_1 = require("./circularisation.service");
const circularisation_dto_1 = require("./dto/circularisation.dto");
const exercice_requis_1 = require("../../common/exercice-requis");
let CircularisationController = class CircularisationController {
    constructor(circularisation) {
        this.circularisation = circularisation;
    }
    lister(user, exerciceId) {
        return this.circularisation.lister(user.tenantId, exerciceId);
    }
    consulter(user, id) {
        return this.circularisation.consulter(user.tenantId, id);
    }
    echantillon(user, id) {
        return this.circularisation.echantillonPropose(user.tenantId, id);
    }
    creer(user, dto) {
        return this.circularisation.creer(user.tenantId, user.userId, dto);
    }
    creerDemande(user, id, dto) {
        return this.circularisation.creerDemande(user.tenantId, id, dto);
    }
    envoyer(user, id, dto) {
        return this.circularisation.envoyer(user.tenantId, id, dto);
    }
    depouiller(user, demandeId, dto) {
        return this.circularisation.depouiller(user.tenantId, demandeId, dto);
    }
    retirerDemande(user, demandeId) {
        return this.circularisation.retirerDemande(user.tenantId, demandeId);
    }
    proceduresAlternatives(user, demandeId, dto) {
        return this.circularisation.consignerProceduresAlternatives(user.tenantId, demandeId, dto);
    }
    clore(user, id, dto) {
        return this.circularisation.clore(user.tenantId, id, user.userId, dto);
    }
};
exports.CircularisationController = CircularisationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_FACULTATIF)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "consulter", null);
__decorate([
    (0, common_1.Get)(':id/echantillon'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "echantillon", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, circularisation_dto_1.CreerCampagneCircularisationDto]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/demandes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, circularisation_dto_1.CreerDemandeDto]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "creerDemande", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/envoyer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, circularisation_dto_1.EnvoyerDto]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "envoyer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('demandes/:demandeId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('demandeId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, circularisation_dto_1.DepouillerDto]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "depouiller", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('demandes/:demandeId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('demandeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "retirerDemande", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('demandes/:demandeId/procedures-alternatives'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('demandeId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, circularisation_dto_1.ProceduresAlternativesDto]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "proceduresAlternatives", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/clore'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, circularisation_dto_1.ClorerCampagneDto]),
    __metadata("design:returntype", void 0)
], CircularisationController.prototype, "clore", null);
exports.CircularisationController = CircularisationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('circularisation'),
    __metadata("design:paramtypes", [circularisation_service_1.CircularisationService])
], CircularisationController);
//# sourceMappingURL=circularisation.controller.js.map