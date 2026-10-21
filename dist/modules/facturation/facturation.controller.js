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
exports.FacturationController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const facturation_service_1 = require("./facturation.service");
const facture_dto_1 = require("./dto/facture.dto");
const comptabilisation_facture_service_1 = require("./comptabilisation-facture.service");
let FacturationController = class FacturationController {
    constructor(facturation, comptabilisation) {
        this.facturation = facturation;
        this.comptabilisation = comptabilisation;
    }
    lister(user, filtre) {
        return this.facturation.lister(user.tenantId, { sens: filtre.sens, du: filtre.du, au: filtre.au });
    }
    etatDetaille(user, periode) {
        return this.facturation.etatDetaille(user.tenantId, periode);
    }
    enregistrer(user, dto) {
        return this.facturation.enregistrer(user.tenantId, dto);
    }
    emettreNoteDeCredit(user, id, dto) {
        return this.facturation.emettreNoteDeCredit(user.tenantId, id, dto);
    }
    comptabiliser(user, id, dto) {
        return this.comptabilisation.comptabiliser(user.tenantId, user.userId, id, {
            journalId: dto.journalId,
            compteGestionId: dto.compteGestionId ?? null,
            comptesParLigne: dto.comptesParLigne,
            dateReception: dto.dateReception ?? null,
        });
    }
    supprimer(user, id) {
        return this.facturation.supprimer(user.tenantId, id);
    }
};
exports.FacturationController = FacturationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, facture_dto_1.ListerFacturesDto]),
    __metadata("design:returntype", void 0)
], FacturationController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('etat-detaille'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('periode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FacturationController.prototype, "etatDetaille", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, facture_dto_1.EnregistrerFactureDto]),
    __metadata("design:returntype", void 0)
], FacturationController.prototype, "enregistrer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/note-de-credit'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, facture_dto_1.EmettreNoteDeCreditDto]),
    __metadata("design:returntype", void 0)
], FacturationController.prototype, "emettreNoteDeCredit", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/comptabiliser'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, facture_dto_1.ComptabiliserFactureDto]),
    __metadata("design:returntype", void 0)
], FacturationController.prototype, "comptabiliser", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FacturationController.prototype, "supprimer", null);
exports.FacturationController = FacturationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('facturation'),
    __metadata("design:paramtypes", [facturation_service_1.FacturationService,
        comptabilisation_facture_service_1.ComptabilisationFactureService])
], FacturationController);
//# sourceMappingURL=facturation.controller.js.map