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
exports.DemantelementController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const exercice_requis_1 = require("../../common/exercice-requis");
const immobilisation_dto_1 = require("./dto/immobilisation.dto");
const demantelement_service_1 = require("./demantelement.service");
let DemantelementController = class DemantelementController {
    constructor(service) {
        this.service = service;
    }
    valeurActualisee(cout, taux, annees) {
        return this.service.valeurActualisee(Number(cout), Number(taux), Number(annees));
    }
    etat(user, id, exerciceId) {
        return this.service.etat(user.tenantId, id, exerciceId);
    }
    desactualiser(user, id, dto) {
        return this.service.desactualiser(user.tenantId, user.userId, id, dto);
    }
    reprendre(user, id, dto) {
        return this.service.reprendre(user.tenantId, user.userId, id, dto);
    }
};
exports.DemantelementController = DemantelementController;
__decorate([
    (0, common_1.Get)('demantelement/valeur-actualisee'),
    __param(0, (0, common_1.Query)('coutFutur')),
    __param(1, (0, common_1.Query)('tauxPourcent')),
    __param(2, (0, common_1.Query)('annees')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DemantelementController.prototype, "valeurActualisee", null);
__decorate([
    (0, common_1.Get)(':id/demantelement'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], DemantelementController.prototype, "etat", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/demantelement/desactualisation'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.DesactualisationDemantelementDto]),
    __metadata("design:returntype", void 0)
], DemantelementController.prototype, "desactualiser", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/demantelement/reprise'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, immobilisation_dto_1.RepriseDemantelementDto]),
    __metadata("design:returntype", void 0)
], DemantelementController.prototype, "reprendre", null);
exports.DemantelementController = DemantelementController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('immobilisations'),
    __metadata("design:paramtypes", [demantelement_service_1.DemantelementService])
], DemantelementController);
//# sourceMappingURL=demantelement.controller.js.map