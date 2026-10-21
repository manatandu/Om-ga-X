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
exports.InventaireController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const licence_guard_1 = require("../licence/licence.guard");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const inventaire_service_1 = require("./inventaire.service");
const inventaire_dto_1 = require("./dto/inventaire.dto");
const exercice_requis_1 = require("../../common/exercice-requis");
let InventaireController = class InventaireController {
    constructor(inventaire) {
        this.inventaire = inventaire;
    }
    lister(user, exerciceId) {
        return this.inventaire.lister(user.tenantId, exerciceId);
    }
    resume(user, exerciceId) {
        return this.inventaire.resumePourLivreInventaire(user.tenantId, exerciceId);
    }
    editionPvCaisse(user, pvId) {
        return this.inventaire.editionPvCaisse(user.tenantId, pvId);
    }
    editionFichesVierges(user, id, sousCommissionId) {
        return this.inventaire.editionFichesVierges(user.tenantId, id, sousCommissionId);
    }
    editionProcesVerbal(user, id) {
        return this.inventaire.editionProcesVerbal(user.tenantId, id);
    }
    consulter(user, id) {
        return this.inventaire.consulter(user.tenantId, id);
    }
    creer(user, dto) {
        return this.inventaire.creer(user.tenantId, user.userId, dto);
    }
    modifier(user, id, dto) {
        return this.inventaire.modifier(user.tenantId, id, dto);
    }
    ajouterSousCommission(user, id, dto) {
        return this.inventaire.ajouterSousCommission(user.tenantId, id, dto);
    }
    ajouterMembre(user, sousCommissionId, dto) {
        return this.inventaire.ajouterMembre(user.tenantId, sousCommissionId, dto);
    }
    creerFiche(user, id, dto) {
        return this.inventaire.creerFiche(user.tenantId, id, dto);
    }
    engendrerFiches(user, id) {
        return this.inventaire.engendrerFichesImmobilisations(user.tenantId, id);
    }
    saisirComptage(user, ficheId, dto) {
        return this.inventaire.saisirComptage(user.tenantId, ficheId, dto);
    }
    supprimerFiche(user, ficheId) {
        return this.inventaire.supprimerFiche(user.tenantId, ficheId);
    }
    rapprocher(user, id) {
        return this.inventaire.rapprocher(user.tenantId, id);
    }
    arbitrer(user, ecartId, dto) {
        return this.inventaire.arbitrer(user.tenantId, ecartId, user.userId, dto);
    }
    proposition(user, ecartId) {
        return this.inventaire.propositionRedressement(user.tenantId, ecartId);
    }
    candidatesRedressement(user, ecartId) {
        return this.inventaire.ecrituresCandidatesRedressement(user.tenantId, ecartId);
    }
    rattacherRedressement(user, ecartId, dto) {
        return this.inventaire.rattacherEcritureRedressement(user.tenantId, ecartId, dto.ecritureId);
    }
    detacherRedressement(user, ecartId) {
        return this.inventaire.detacherEcritureRedressement(user.tenantId, ecartId);
    }
    etablirPv(user, id, dto) {
        return this.inventaire.etablirProcesVerbal(user.tenantId, id, user.userId, dto);
    }
    etablirPvCaisse(user, id, dto) {
        return this.inventaire.etablirPvCaisse(user.tenantId, id, user.userId, dto);
    }
    apercuPvCaisse(user, id, compteId, dateComptage) {
        return this.inventaire.apercuPvCaisse(user.tenantId, id, compteId ?? '', dateComptage ?? '');
    }
    mouvementsReconstitution(user, pvId) {
        return this.inventaire.mouvementsReconstitution(user.tenantId, pvId);
    }
    caissesNonComptees(user, id) {
        return this.inventaire.caissesNonComptees(user.tenantId, id);
    }
    clore(user, id) {
        return this.inventaire.clore(user.tenantId, id, user.userId);
    }
};
exports.InventaireController = InventaireController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('exerciceId', exercice_requis_1.EXERCICE_FACULTATIF)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "lister", null);
__decorate([
    (0, common_1.Get)('resume/:exerciceId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('exerciceId', exercice_requis_1.EXERCICE_REQUIS)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "resume", null);
__decorate([
    (0, common_1.Get)('pv-caisse/:pvId/edition'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('pvId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "editionPvCaisse", null);
__decorate([
    (0, common_1.Get)(':id/editions/fiches-de-comptage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('sousCommissionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "editionFichesVierges", null);
__decorate([
    (0, common_1.Get)(':id/editions/proces-verbal'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "editionProcesVerbal", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "consulter", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, inventaire_dto_1.CreerCampagneDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "creer", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.ModifierCampagneDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "modifier", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/sous-commissions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.AjouterSousCommissionDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "ajouterSousCommission", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('sous-commissions/:sousCommissionId/membres'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sousCommissionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.AjouterMembreDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "ajouterMembre", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/fiches'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.CreerFicheDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "creerFiche", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/fiches/immobilisations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "engendrerFiches", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('fiches/:ficheId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ficheId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.SaisirComptageDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "saisirComptage", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('fiches/:ficheId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ficheId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "supprimerFiche", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/rapprocher'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "rapprocher", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Patch)('ecarts/:ecartId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ecartId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.ArbitrerEcartDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "arbitrer", null);
__decorate([
    (0, common_1.Get)('ecarts/:ecartId/proposition'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ecartId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "proposition", null);
__decorate([
    (0, common_1.Get)('ecarts/:ecartId/ecritures-candidates'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ecartId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "candidatesRedressement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)('ecarts/:ecartId/ecriture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ecartId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.RattacherEcritureEcartDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "rattacherRedressement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Delete)('ecarts/:ecartId/ecriture'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('ecartId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "detacherRedressement", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/proces-verbal'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.EtablirProcesVerbalDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "etablirPv", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/pv-caisse'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventaire_dto_1.EtablirPvCaisseDto]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "etablirPvCaisse", null);
__decorate([
    (0, common_1.Get)(':id/pv-caisse/apercu'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('compteId')),
    __param(3, (0, common_1.Query)('dateComptage')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "apercuPvCaisse", null);
__decorate([
    (0, common_1.Get)('pv-caisse/:pvId/mouvements'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('pvId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "mouvementsReconstitution", null);
__decorate([
    (0, common_1.Get)(':id/caisses-non-comptees'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "caissesNonComptees", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET, client_1.RoleUtilisateur.COMPTABLE),
    (0, common_1.Post)(':id/clore'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventaireController.prototype, "clore", null);
exports.InventaireController = InventaireController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, licence_guard_1.LicenceGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('inventaire'),
    __metadata("design:paramtypes", [inventaire_service_1.InventaireService])
], InventaireController);
//# sourceMappingURL=inventaire.controller.js.map