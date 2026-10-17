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
exports.LocationAcquisitionController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const licence_guard_1 = require("../../licence/licence.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
const exercice_requis_1 = require("../../../common/exercice-requis");
const immobilisation_dto_1 = require("../dto/immobilisation.dto");
const location_acquisition_service_1 = require("./location-acquisition.service");
let LocationAcquisitionController = class LocationAcquisitionController {
    constructor(service) {
        this.service = service;
    }
    lister(user, exerciceId) {
        return this.service.lister(user.tenantId, exerciceId);
    }
    proposer(user, id, exerciceId) {
        return this.service.proposer(user.tenantId, id, exerciceId);
    }
    passer(user, id, dto) {
        return this.service.passer(user.tenantId, user.userId, id, dto);
    }
    declarerGarantie(user, id, dto) {
        return this.service.declarerGarantie(user.tenantId, id, dto.appelee);
    }
    declarerOption(user, id, dto) {
        return this.service.declarerOption(user.tenantId, user.userId, id, dto);
    }
};
exports.LocationAcquisitionController = LocationAcquisitionController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LocationAcquisitionController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)(':id/cloture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], LocationAcquisitionController.prototype, "proposer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/cloture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.ClotureLocationAcquisitionDto]),
    __metadata("design:returntype", void 0)
], LocationAcquisitionController.prototype, "passer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/garantie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.DeclarerGarantieLocationAcquisitionDto]),
    __metadata("design:returntype", void 0)
], LocationAcquisitionController.prototype, "declarerGarantie", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/option'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.DeclarerOptionLocationAcquisitionDto]),
    __metadata("design:returntype", void 0)
], LocationAcquisitionController.prototype, "declarerOption", null);
exports.LocationAcquisitionController = LocationAcquisitionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('immobilisations/location-acquisition/contrats'),
    __metadata("design:paramtypes", [location_acquisition_service_1.LocationAcquisitionService])
], LocationAcquisitionController);
//# sourceMappingURL=location-acquisition.controller.js.map