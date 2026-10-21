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
exports.PaiementSalairesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const ribs_tiers_dto_1 = require("../tiers/dto/ribs-tiers.dto");
const ribs_salaries_service_1 = require("./ribs-salaries.service");
const paiement_salaires_service_1 = require("./paiement-salaires.service");
const paiement_salaires_dto_1 = require("./dto/paiement-salaires.dto");
const lireCoupures = (texte) => texte === undefined || texte.trim() === '' ? undefined : texte.split(',').map((v) => Number(v.trim()));
let PaiementSalairesController = class PaiementSalairesController {
    constructor(ribs, paiements) {
        this.ribs = ribs;
        this.paiements = paiements;
    }
    lire(user, salarieId) {
        return this.ribs.lire(user.tenantId, salarieId, user.userId);
    }
    definirMode(user, salarieId, dto) {
        return this.ribs.definirMode(user.tenantId, salarieId, dto.modePaiement, user.userId);
    }
    creerRib(user, salarieId, dto) {
        return this.ribs.creer(user.tenantId, salarieId, dto, user.userId);
    }
    modifierRib(user, id, dto) {
        return this.ribs.modifier(user.tenantId, id, dto, user.userId);
    }
    viserRib(user, id, dto) {
        return this.ribs.viser(user.tenantId, id, user.userId, dto.saisiLeLu);
    }
    supprimerRib(user, id) {
        return this.ribs.supprimer(user.tenantId, id);
    }
    proposition(user, mois, coupures) {
        return this.paiements.proposition(user.tenantId, mois, lireCoupures(coupures));
    }
    payer(user, mois, dto) {
        return this.paiements.payer(user.tenantId, user.userId, user.email, mois, dto);
    }
    annuler(user, id, dto) {
        return this.paiements.annuler(user.tenantId, user.userId, user.email, id, dto);
    }
};
exports.PaiementSalairesController = PaiementSalairesController;
__decorate([
    (0, common_1.Get)('salaries/:salarieId/paiement'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "lire", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/mode-paiement'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, paiement_salaires_dto_1.ModePaiementSalarieDto]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "definirMode", null);
__decorate([
    (0, common_1.Post)('salaries/:salarieId/ribs'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('salarieId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ribs_tiers_dto_1.RibTiersDto]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "creerRib", null);
__decorate([
    (0, common_1.Patch)('ribs-salaries/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ribs_tiers_dto_1.RibTiersDto]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "modifierRib", null);
__decorate([
    (0, common_1.Post)('ribs-salaries/:id/viser'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ribs_tiers_dto_1.VisaRibDto]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "viserRib", null);
__decorate([
    (0, common_1.Delete)('ribs-salaries/:id'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "supprimerRib", null);
__decorate([
    (0, common_1.Get)('paiement-salaires/:mois'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE, client_1.RoleUtilisateur.LECTURE_SEULE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('mois')),
    __param(2, (0, common_1.Query)('coupures')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "proposition", null);
__decorate([
    (0, common_1.Post)('paiement-salaires/:mois'),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('mois')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, paiement_salaires_dto_1.PaiementSalairesDto]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "payer", null);
__decorate([
    (0, common_1.Post)('paiements-salaires/:id/annulation'),
    (0, acces_roles_cantonnes_decorator_1.ReserveAuComptable)(),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, paiement_salaires_dto_1.AnnulationPaiementSalairesDto]),
    __metadata("design:returntype", void 0)
], PaiementSalairesController.prototype, "annuler", null);
exports.PaiementSalairesController = PaiementSalairesController = __decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ aideComptable: false, gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('personnel'),
    __metadata("design:paramtypes", [ribs_salaries_service_1.RibsSalariesService,
        paiement_salaires_service_1.PaiementSalairesService])
], PaiementSalairesController);
//# sourceMappingURL=paiement-salaires.controller.js.map