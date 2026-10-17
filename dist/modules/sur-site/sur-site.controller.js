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
exports.SurSiteController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const courriel_1 = require("../../common/courriel");
const auth_service_1 = require("../auth/auth.service");
const register_dto_1 = require("../auth/dto/register.dto");
const administrateur_installation_guard_1 = require("./administrateur-installation.guard");
const licence_sur_site_service_1 = require("./licence-sur-site.service");
const sauvegarde_sur_site_service_1 = require("./sauvegarde-sur-site.service");
const sur_site_dto_1 = require("./sur-site.dto");
let SurSiteController = class SurSiteController {
    constructor(licence, sauvegardes, auth) {
        this.licence = licence;
        this.sauvegardes = sauvegardes;
        this.auth = auth;
    }
    async etat() {
        const e = this.licence.etat();
        if (!e.surSite)
            return { surSite: false };
        const c = e.contenu;
        return {
            surSite: true,
            premierDossierAttendu: await this.auth.premierDossierAttendu(),
            statut: e.statut,
            motif: e.motif,
            empreinte: e.empreinte,
            dateVersion: e.dateVersion,
            licence: c
                ? { numero: c.numero, titulaire: c.titulaire, emiseLe: c.emiseLe, finMaintenance: c.finMaintenance, expiration: c.expiration, dossiersMax: c.dossiersMax }
                : null,
        };
    }
    async deposer(dto) {
        this.licence.deposer(dto.contenu);
        return this.etat();
    }
    lister() {
        return { dossier: this.sauvegardes.dossier, copies: this.sauvegardes.lister(), copieExterne: this.sauvegardes.copieExterne() };
    }
    copieExterne(dto) {
        return this.sauvegardes.definirCopieExterne(dto.dossier ?? null, dto.phrase ?? null);
    }
    sauvegarder() {
        return this.sauvegardes.lancer();
    }
    async creerDossier(dto) {
        const r = await this.auth.register(dto);
        return { dossier: r.tenant.nom, email: (0, courriel_1.normaliserCourriel)(dto.email) };
    }
};
exports.SurSiteController = SurSiteController;
__decorate([
    (0, common_1.Get)('etat'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SurSiteController.prototype, "etat", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 3_600_000, limit: 20 } }),
    (0, common_1.Post)('licence'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sur_site_dto_1.DeposerLicenceDto]),
    __metadata("design:returntype", Promise)
], SurSiteController.prototype, "deposer", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, administrateur_installation_guard_1.AdministrateurInstallationGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Get)('sauvegardes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SurSiteController.prototype, "lister", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, administrateur_installation_guard_1.AdministrateurInstallationGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('sauvegardes/copie-externe'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sur_site_dto_1.CopieExterneDto]),
    __metadata("design:returntype", void 0)
], SurSiteController.prototype, "copieExterne", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, administrateur_installation_guard_1.AdministrateurInstallationGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('sauvegardes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SurSiteController.prototype, "sauvegarder", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, administrateur_installation_guard_1.AdministrateurInstallationGuard),
    (0, roles_decorator_1.Roles)(client_1.RoleUtilisateur.ADMIN_CABINET),
    (0, common_1.Post)('dossiers'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], SurSiteController.prototype, "creerDossier", null);
exports.SurSiteController = SurSiteController = __decorate([
    (0, common_1.Controller)('sur-site'),
    __metadata("design:paramtypes", [licence_sur_site_service_1.LicenceSurSiteService,
        sauvegarde_sur_site_service_1.SauvegardeSurSiteService,
        auth_service_1.AuthService])
], SurSiteController);
//# sourceMappingURL=sur-site.controller.js.map