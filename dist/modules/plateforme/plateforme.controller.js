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
exports.PlateformeController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const operateur_plateforme_guard_1 = require("./operateur-plateforme.guard");
const plateforme_service_1 = require("./plateforme.service");
const licences_sur_site_service_1 = require("./licences-sur-site.service");
const abonnements_service_1 = require("./abonnements/abonnements.service");
const courriels_editeur_service_1 = require("./abonnements/courriels-editeur.service");
const essais_echus_service_1 = require("./essais-echus/essais-echus.service");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const plateforme_dto_1 = require("./dto/plateforme.dto");
let PlateformeController = class PlateformeController {
    constructor(plateformeService, licencesSurSite, abonnements, courriels, essaisEchus) {
        this.plateformeService = plateformeService;
        this.licencesSurSite = licencesSurSite;
        this.abonnements = abonnements;
        this.courriels = courriels;
        this.essaisEchus = essaisEchus;
    }
    formules() {
        return this.abonnements.formules();
    }
    fixerPrix(code, dto) {
        return this.abonnements.fixerPrix(code, dto.prixMensuelUsd ?? null, dto.prixAnnuelUsd ?? null);
    }
    listeAbonnements() {
        return this.abonnements.lister();
    }
    enregistrerAbonnement(dto) {
        return this.abonnements.enregistrer(dto);
    }
    activerAbonnement(id, dto) {
        return this.abonnements.activer(id, dto.actif);
    }
    marquerPayee(id, dto) {
        return this.abonnements.marquerPayee(id, dto.payeeLe);
    }
    facturerAbonnements(dto, operateur) {
        return this.abonnements.facturer(operateur.tenantId, dto.periode, dto.dateFacture, dto.tauxTvaId ?? null, dto.envoyer ? { userId: operateur.userId } : null);
    }
    envoyerFactureAbonnement(id, dto, operateur) {
        return this.courriels.envoyerFacture({ tenantId: operateur.tenantId, userId: operateur.userId }, id, dto.destinataire ?? null);
    }
    listeLicencesSurSite() {
        return this.licencesSurSite.lister();
    }
    fichierLicenceSurSite(id) {
        return this.licencesSurSite.fichier(id);
    }
    envoyerLicenceSurSite(id, dto, operateur) {
        return this.courriels.envoyerLicence({ tenantId: operateur.tenantId, userId: operateur.userId }, id, dto.destinataire ?? '', dto.destinataireNom ?? null);
    }
    emettreLicenceSurSite(dto, operateur) {
        return this.licencesSurSite.emettre({ titulaire: dto.titulaire, empreinteMachine: dto.empreinteMachine, finMaintenance: dto.finMaintenance, expiration: dto.expiration ?? null, dossiersMax: dto.dossiersMax }, operateur.email);
    }
    listeCabinets() {
        return this.plateformeService.listeCabinets();
    }
    creerCabinet(dto) {
        return this.plateformeService.creerCabinet(dto);
    }
    modifierLicence(tenantId, dto) {
        return this.plateformeService.modifierLicence(tenantId, dto);
    }
    modifierGroupe(tenantId, dto) {
        return this.plateformeService.modifierGroupe(tenantId, dto);
    }
    async designerDossierEditeur(tenantId) {
        return this.plateformeService.designerDossierEditeur(tenantId);
    }
    preparerDemonstration(dto) {
        return this.plateformeService.preparerDossierDemonstration(dto);
    }
    reinitialiserAdmin(tenantId, dto) {
        return this.plateformeService.reinitialiserAdmin(tenantId, dto);
    }
    listeEssaisEchus() {
        return this.essaisEchus.lister();
    }
    envoyerRappelsEssaisEchus(operateur) {
        return this.essaisEchus.envoyerRappels({ userId: operateur.userId, email: operateur.email });
    }
    supprimerEssaiEchu(tenantId, dto, operateur) {
        return this.essaisEchus.supprimer(tenantId, { userId: operateur.userId, email: operateur.email }, dto.confirmation);
    }
};
exports.PlateformeController = PlateformeController;
__decorate([
    (0, common_1.Get)('formules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "formules", null);
__decorate([
    (0, common_1.Patch)('formules/:code'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.FixerPrixFormuleDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "fixerPrix", null);
__decorate([
    (0, common_1.Get)('abonnements'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "listeAbonnements", null);
__decorate([
    (0, common_1.Post)('abonnements'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [plateforme_dto_1.EnregistrerAbonnementDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "enregistrerAbonnement", null);
__decorate([
    (0, common_1.Patch)('abonnements/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.ActiverAbonnementDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "activerAbonnement", null);
__decorate([
    (0, common_1.Patch)('abonnements/factures/:id/payee'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.MarquerPayeeDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "marquerPayee", null);
__decorate([
    (0, common_1.Post)('abonnements/facturer'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [plateforme_dto_1.FacturerAbonnementsDto, Object]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "facturerAbonnements", null);
__decorate([
    (0, common_1.Post)('abonnements/factures/:id/envoyer'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.EnvoyerParCourrielDto, Object]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "envoyerFactureAbonnement", null);
__decorate([
    (0, common_1.Get)('licences-sur-site'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "listeLicencesSurSite", null);
__decorate([
    (0, common_1.Get)('licences-sur-site/:id/fichier'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "fichierLicenceSurSite", null);
__decorate([
    (0, common_1.Post)('licences-sur-site/:id/envoyer'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.EnvoyerParCourrielDto, Object]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "envoyerLicenceSurSite", null);
__decorate([
    (0, common_1.Post)('licences-sur-site'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [plateforme_dto_1.EmettreLicenceSurSiteDto, Object]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "emettreLicenceSurSite", null);
__decorate([
    (0, common_1.Get)('cabinets'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "listeCabinets", null);
__decorate([
    (0, common_1.Post)('cabinets'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [plateforme_dto_1.CreerCabinetDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "creerCabinet", null);
__decorate([
    (0, common_1.Patch)('cabinets/:tenantId/licence'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.ModifierLicenceDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "modifierLicence", null);
__decorate([
    (0, common_1.Patch)('cabinets/:tenantId/groupe'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.ModifierGroupeDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "modifierGroupe", null);
__decorate([
    (0, common_1.Post)('cabinets/:tenantId/dossier-editeur'),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlateformeController.prototype, "designerDossierEditeur", null);
__decorate([
    (0, common_1.Post)('dossier-demonstration'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [plateforme_dto_1.PreparerDemonstrationDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "preparerDemonstration", null);
__decorate([
    (0, common_1.Post)('cabinets/:tenantId/reinitialiser-admin'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.ReinitialiserAdminDto]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "reinitialiserAdmin", null);
__decorate([
    (0, common_1.Get)('essais-echus'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "listeEssaisEchus", null);
__decorate([
    (0, common_1.Post)('essais-echus/rappels'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "envoyerRappelsEssaisEchus", null);
__decorate([
    (0, common_1.Post)('essais-echus/:tenantId/supprimer'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, plateforme_dto_1.SupprimerEssaiEchuDto, Object]),
    __metadata("design:returntype", void 0)
], PlateformeController.prototype, "supprimerEssaiEchu", null);
exports.PlateformeController = PlateformeController = __decorate([
    (0, common_1.Controller)('plateforme'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, operateur_plateforme_guard_1.OperateurPlateformeGuard),
    __metadata("design:paramtypes", [plateforme_service_1.PlateformeService,
        licences_sur_site_service_1.LicencesSurSiteService,
        abonnements_service_1.AbonnementsService,
        courriels_editeur_service_1.CourrielsEditeurService,
        essais_echus_service_1.EssaisEchusService])
], PlateformeController);
//# sourceMappingURL=plateforme.controller.js.map