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
exports.BanquesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const banques_service_1 = require("./banques.service");
const banques_dto_1 = require("./dto/banques.dto");
let BanquesController = class BanquesController {
    constructor(service) {
        this.service = service;
    }
    lister(user) {
        return this.service.lister(user.tenantId);
    }
    creer(user, dto) {
        return this.service.creer(user.tenantId, dto);
    }
    modifier(user, id, dto) {
        return this.service.modifier(user.tenantId, id, dto);
    }
    supprimer(user, id) {
        return this.service.supprimer(user.tenantId, id);
    }
    creerRib(user, id, dto) {
        return this.service.creerRib(user.tenantId, id, dto);
    }
    modifierRib(user, id, dto) {
        return this.service.modifierRib(user.tenantId, id, dto);
    }
    supprimerRib(user, id) {
        return this.service.supprimerRib(user.tenantId, id);
    }
    listerLibelles(user) {
        return this.service.listerLibelles(user.tenantId);
    }
    creerLibelle(user, dto) {
        return this.service.creerLibelle(user.tenantId, dto);
    }
    modifierLibelle(user, id, dto) {
        return this.service.modifierLibelle(user.tenantId, id, dto);
    }
    supprimerLibelle(user, id) {
        return this.service.supprimerLibelle(user.tenantId, id);
    }
};
exports.BanquesController = BanquesController;
__decorate([
    (0, common_1.Get)('banques'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('banques'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, banques_dto_1.BanqueDto]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)('banques/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, banques_dto_1.ModifierBanqueDto]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)('banques/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "supprimer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('banques/:id/ribs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, banques_dto_1.RibDto]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "creerRib", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)('ribs-banque/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, banques_dto_1.RibDto]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "modifierRib", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)('ribs-banque/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "supprimerRib", null);
__decorate([
    (0, common_1.Get)('libelles-ecriture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "listerLibelles", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('libelles-ecriture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, banques_dto_1.LibelleDto]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "creerLibelle", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)('libelles-ecriture/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, banques_dto_1.ModifierLibelleDto]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "modifierLibelle", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)('libelles-ecriture/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BanquesController.prototype, "supprimerLibelle", null);
exports.BanquesController = BanquesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [banques_service_1.BanquesService])
], BanquesController);
//# sourceMappingURL=banques.controller.js.map