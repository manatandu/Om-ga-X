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
exports.ModeleReglementController = exports.TiersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const tiers_service_1 = require("./tiers.service");
const tiers_dto_1 = require("./dto/tiers.dto");
const modele_reglement_dto_1 = require("./dto/modele-reglement.dto");
const client_1 = require("@prisma/client");
let TiersController = class TiersController {
    constructor(tiersService) {
        this.tiersService = tiersService;
    }
    async lister(user, type, recherche, actifsSeuls) {
        return this.tiersService.lister(user.tenantId, { type, recherche, actifsSeuls: actifsSeuls === 'true' });
    }
    async dossiersDuGroupe(user) {
        return this.tiersService.dossiersDuGroupe(user.tenantId);
    }
    async numeroPropose(user, dto) {
        return this.tiersService.numeroPropose(user.tenantId, dto.type);
    }
    async echeancierDeLigne(user, compteId, dto) {
        return this.tiersService.echeancierDeLigne(user.tenantId, compteId, dto);
    }
    async duplication(user, id) {
        return this.tiersService.duplication(user.tenantId, id);
    }
    async obtenir(user, id) {
        return this.tiersService.obtenir(user.tenantId, id);
    }
    async creer(user, dto) {
        return this.tiersService.creer(user.tenantId, dto);
    }
    async modifier(user, id, dto) {
        return this.tiersService.modifier(user.tenantId, id, dto);
    }
    async fusionner(user, id, cibleId) {
        return this.tiersService.fusionner(user.tenantId, id, cibleId);
    }
    async supprimer(user, id) {
        return this.tiersService.supprimer(user.tenantId, id);
    }
    async completerPanoplie(user, id) {
        return this.tiersService.completerPanoplie(user.tenantId, id);
    }
    async completerPanoplies(user, dto) {
        return this.tiersService.completerPanoplies(user.tenantId, dto.apres);
    }
    async rattacherCompte(user, id, dto) {
        return this.tiersService.rattacherCompte(user.tenantId, id, dto);
    }
    async definirComptePrincipal(user, id, compteId) {
        return this.tiersService.definirComptePrincipal(user.tenantId, id, compteId);
    }
    async detacherCompte(user, id, compteId) {
        return this.tiersService.detacherCompte(user.tenantId, id, compteId);
    }
};
exports.TiersController = TiersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('recherche')),
    __param(3, (0, common_1.Query)('actifsSeuls')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('dossiers-du-groupe'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "dossiersDuGroupe", null);
__decorate([
    (0, common_1.Get)('numero-propose'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, tiers_dto_1.NumeroProposeDto]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "numeroPropose", null);
__decorate([
    (0, common_1.Get)('echeancier-de-ligne/:compteId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('compteId', new common_1.ParseUUIDPipe({ exceptionFactory: () => new common_1.BadRequestException('Identifiant de compte illisible.') }))),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, modele_reglement_dto_1.EcheancierDeLigneDto]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "echeancierDeLigne", null);
__decorate([
    (0, common_1.Get)(':id/duplication'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "duplication", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "obtenir", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, tiers_dto_1.CreerTiersDto]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, tiers_dto_1.ModifierTiersDto]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/fusion/:cibleId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('cibleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "fusionner", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "supprimer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/panoplie'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "completerPanoplie", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('panoplies'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, tiers_dto_1.CompletionPanopliesDto]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "completerPanoplies", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/comptes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, tiers_dto_1.RattacherCompteDto]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "rattacherCompte", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Put)(':id/comptes/:compteId/principal'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('compteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "definirComptePrincipal", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)(':id/comptes/:compteId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('compteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], TiersController.prototype, "detacherCompte", null);
exports.TiersController = TiersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('tiers'),
    __metadata("design:paramtypes", [tiers_service_1.TiersService])
], TiersController);
let ModeleReglementController = class ModeleReglementController {
    constructor(tiersService) {
        this.tiersService = tiersService;
    }
    async lister(user) {
        return this.tiersService.listerModelesReglement(user.tenantId);
    }
    async creer(user, dto) {
        return this.tiersService.creerModeleReglement(user.tenantId, dto);
    }
    async modifier(user, id, dto) {
        return this.tiersService.modifierModeleReglement(user.tenantId, id, dto);
    }
    async listerEcheances(user, id) {
        return this.tiersService.listerEcheances(user.tenantId, id);
    }
    async ajouterEcheance(user, id, dto) {
        return this.tiersService.ajouterEcheance(user.tenantId, id, dto);
    }
    async supprimerEcheance(user, id, echeanceId) {
        return this.tiersService.supprimerEcheance(user.tenantId, id, echeanceId);
    }
    async calculerEcheances(user, id, dto) {
        return this.tiersService.calculerEcheances(user.tenantId, id, dto);
    }
};
exports.ModeleReglementController = ModeleReglementController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModeleReglementController.prototype, "lister", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, modele_reglement_dto_1.CreerModeleReglementDto]),
    __metadata("design:returntype", Promise)
], ModeleReglementController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, modele_reglement_dto_1.ModifierModeleReglementDto]),
    __metadata("design:returntype", Promise)
], ModeleReglementController.prototype, "modifier", null);
__decorate([
    (0, common_1.Get)(':id/echeances'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ModeleReglementController.prototype, "listerEcheances", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)(':id/echeances'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, modele_reglement_dto_1.CreerEcheanceReglementDto]),
    __metadata("design:returntype", Promise)
], ModeleReglementController.prototype, "ajouterEcheance", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Delete)(':id/echeances/:echeanceId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('echeanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ModeleReglementController.prototype, "supprimerEcheance", null);
__decorate([
    (0, common_1.Post)(':id/calculer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, modele_reglement_dto_1.CalculerEcheancesDto]),
    __metadata("design:returntype", Promise)
], ModeleReglementController.prototype, "calculerEcheances", null);
exports.ModeleReglementController = ModeleReglementController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('modeles-reglement'),
    __metadata("design:paramtypes", [tiers_service_1.TiersService])
], ModeleReglementController);
//# sourceMappingURL=tiers.controller.js.map