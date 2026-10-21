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
exports.TenantController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const tenant_service_1 = require("./tenant.service");
const parametres_dossier_dto_1 = require("./dto/parametres-dossier.dto");
const client_1 = require("@prisma/client");
let TenantController = class TenantController {
    constructor(tenantService) {
        this.tenantService = tenantService;
    }
    async demarrage(user) {
        return this.tenantService.demarrage(user.tenantId);
    }
    async parametres(user) {
        return this.tenantService.parametres(user.tenantId);
    }
    async modifierJeuEtats(user, dto) {
        return this.tenantService.modifierJeuEtatsFinanciers(user.tenantId, dto.jeuEtatsFinanciersSycebnl);
    }
    async modifierSystemeSyscohada(user, dto) {
        return this.tenantService.modifierSystemeSyscohada(user.tenantId, dto.systemeComptableSyscohada);
    }
    async modifierCoordonnees(user, dto) {
        return this.tenantService.modifierCoordonnees(user.tenantId, dto);
    }
    async modifierIdentite(user, dto) {
        return this.tenantService.modifierIdentite(user.tenantId, dto);
    }
    async modifierFormeJuridique(user, dto) {
        return this.tenantService.modifierFormeJuridique(user.tenantId, dto.formeJuridique, dto.droitEtranger);
    }
    async modifierFormeSyscohada(user, dto) {
        return this.tenantService.modifierFormeSyscohada(user.tenantId, dto.formeJuridiqueSyscohada, dto.dateEffetTransformation);
    }
    async modifierRegime(user, dto) {
        return this.tenantService.modifierRegime(user.tenantId, dto);
    }
    async modifierMethodeCotisations(user, dto) {
        return this.tenantService.modifierMethodeCotisations(user.tenantId, dto.methodeCotisations);
    }
    async modifierMethodeInventaireStocks(user, dto) {
        return this.tenantService.modifierMethodeInventaireStocks(user.tenantId, dto.methodeInventaireStocks);
    }
    async modifierLongueurCompte(user, dto) {
        return this.tenantService.modifierLongueurCompte(user.tenantId, dto.longueurCompte);
    }
    async modifierDoubleRegard(user, dto) {
        return this.tenantService.modifierDoubleRegard(user.tenantId, dto.doubleRegardValidation);
    }
    async modifierVisaRibs(user, dto) {
        return this.tenantService.modifierVisaRibs(user.tenantId, dto.visaRibs);
    }
    async modifierCreationCompteEnSaisie(user, dto) {
        return this.tenantService.modifierCreationCompteEnSaisie(user.tenantId, dto.creationCompteEnSaisie);
    }
    async modifierSeuilEcartReglement(user, dto) {
        return this.tenantService.modifierSeuilEcartReglement(user.tenantId, dto.seuilEcartReglement);
    }
    async modifierRefusClotureNonImprime(user, dto) {
        return this.tenantService.modifierRefusClotureNonImprime(user.tenantId, dto.refusClotureJournalNonImprime);
    }
    async modifierModules(user, dto) {
        return this.tenantService.modifierModules(user.tenantId, dto.modulesActives);
    }
};
exports.TenantController = TenantController;
__decorate([
    (0, common_1.Get)('demarrage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "demarrage", null);
__decorate([
    (0, common_1.Get)('parametres'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "parametres", null);
__decorate([
    (0, common_1.Patch)('jeu-etats-financiers'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierJeuEtatsDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierJeuEtats", null);
__decorate([
    (0, common_1.Patch)('systeme-syscohada'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierSystemeSyscohadaDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierSystemeSyscohada", null);
__decorate([
    (0, common_1.Patch)('coordonnees'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierCoordonneesDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierCoordonnees", null);
__decorate([
    (0, common_1.Patch)('identite'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierIdentiteDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierIdentite", null);
__decorate([
    (0, common_1.Patch)('forme-juridique'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierFormeJuridiqueDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierFormeJuridique", null);
__decorate([
    (0, common_1.Patch)('forme-syscohada'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierFormeSyscohadaDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierFormeSyscohada", null);
__decorate([
    (0, common_1.Patch)('regime'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierRegimeDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierRegime", null);
__decorate([
    (0, common_1.Patch)('methode-cotisations'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierMethodeCotisationsDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierMethodeCotisations", null);
__decorate([
    (0, common_1.Patch)('methode-inventaire-stocks'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierMethodeInventaireStocksDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierMethodeInventaireStocks", null);
__decorate([
    (0, common_1.Patch)('longueur-compte'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierLongueurCompteDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierLongueurCompte", null);
__decorate([
    (0, common_1.Patch)('double-regard'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierDoubleRegardDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierDoubleRegard", null);
__decorate([
    (0, common_1.Patch)('visa-ribs'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierVisaRibsDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierVisaRibs", null);
__decorate([
    (0, common_1.Patch)('creation-compte-en-saisie'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierCreationCompteEnSaisieDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierCreationCompteEnSaisie", null);
__decorate([
    (0, common_1.Patch)('seuil-ecart-reglement'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierSeuilEcartReglementDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierSeuilEcartReglement", null);
__decorate([
    (0, common_1.Patch)('refus-cloture-non-imprime'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierRefusClotureNonImprimeDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierRefusClotureNonImprime", null);
__decorate([
    (0, common_1.Patch)('modules'),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, parametres_dossier_dto_1.ModifierModulesDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "modifierModules", null);
exports.TenantController = TenantController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('dossier'),
    __metadata("design:paramtypes", [tenant_service_1.TenantService])
], TenantController);
//# sourceMappingURL=tenant.controller.js.map