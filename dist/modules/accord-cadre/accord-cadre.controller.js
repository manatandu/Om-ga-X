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
exports.AccordCadreController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const referentiel_guard_1 = require("../../common/guards/referentiel.guard");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const accord_cadre_service_1 = require("./accord-cadre.service");
const accord_cadre_dto_1 = require("./dto/accord-cadre.dto");
let AccordCadreController = class AccordCadreController {
    constructor(accords) {
        this.accords = accords;
    }
    etat(user, dateReference) {
        return this.accords.etat(user.tenantId, { dateReference });
    }
    enregistrer(user, dto) {
        return this.accords.enregistrer(user.tenantId, dto);
    }
    declarerMainOeuvre(user, id, dto) {
        return this.accords.declarerMainOeuvre(user.tenantId, id, dto);
    }
    denoncer(user, id, dto) {
        return this.accords.denoncer(user.tenantId, id, dto);
    }
};
exports.AccordCadreController = AccordCadreController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('dateReference')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AccordCadreController.prototype, "etat", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, accord_cadre_dto_1.EnregistrerAccordCadreDto]),
    __metadata("design:returntype", void 0)
], AccordCadreController.prototype, "enregistrer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/main-oeuvre'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, accord_cadre_dto_1.DeclarerMainOeuvreDto]),
    __metadata("design:returntype", void 0)
], AccordCadreController.prototype, "declarerMainOeuvre", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id/denonciation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, accord_cadre_dto_1.DenoncerAccordCadreDto]),
    __metadata("design:returntype", void 0)
], AccordCadreController.prototype, "denoncer", null);
exports.AccordCadreController = AccordCadreController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard, referentiel_guard_1.ReferentielGuard),
    (0, referentiels_decorator_1.ReferentielsAutorises)(client_1.Referentiel.SYCEBNL),
    (0, common_1.Controller)('accord-cadre'),
    __metadata("design:paramtypes", [accord_cadre_service_1.AccordCadreService])
], AccordCadreController);
//# sourceMappingURL=accord-cadre.controller.js.map