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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const register_dto_1 = require("./dto/register.dto");
const inscription_essai_dto_1 = require("./dto/inscription-essai.dto");
const inscription_essai_1 = require("./inscription-essai");
const login_dto_1 = require("./dto/login.dto");
const changer_mot_de_passe_dto_1 = require("./dto/changer-mot-de-passe.dto");
const changer_adresse_dto_1 = require("./dto/changer-adresse.dto");
const double_authentification_dto_1 = require("./dto/double-authentification.dto");
const deconnecter_autres_appareils_dto_1 = require("./dto/deconnecter-autres-appareils.dto");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const sortie_mot_de_passe_decorator_1 = require("../../common/decorators/sortie-mot-de-passe.decorator");
const session_constants_1 = require("./session.constants");
const session_longue_1 = require("./session-longue");
const mode_installation_1 = require("../../common/mode-installation");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
let AuthController = class AuthController {
    constructor(authService, config) {
        this.authService = authService;
        this.config = config;
    }
    poserSession(res, resultat) {
        const { accessToken, maxAgeMs, ...reste } = resultat;
        (0, session_constants_1.poserCookieSession)(res, accessToken, maxAgeMs ?? null);
        return reste;
    }
    async register(dto, res) {
        if ((0, mode_installation_1.estSurSite)()) {
            if (!(await this.authService.premierDossierAttendu())) {
                throw new common_1.ForbiddenException("Cette installation a déjà son premier dossier · les suivants se créent depuis le dossier d'installation, fenêtre Restitution.");
            }
        }
        else if (this.config.get('INSCRIPTION_PUBLIQUE') !== 'true') {
            throw new common_1.ForbiddenException("L'ouverture d'un dossier OmegaX se fait avec VMG Consulting · écrivez à admin@vmgconsulting.net pour démarrer.");
        }
        return this.poserSession(res, await this.authService.register(dto));
    }
    inscriptionEssaiOuverte() {
        return !(0, mode_installation_1.estSurSite)() && this.config.get('INSCRIPTION_ESSAI') === 'true';
    }
    etatInscriptionEssai() {
        return { ouverte: this.inscriptionEssaiOuverte(), joursEssai: inscription_essai_1.JOURS_ESSAI };
    }
    async inscrireEnEssai(dto) {
        if (!this.inscriptionEssaiOuverte()) {
            throw new common_1.ForbiddenException("L'ouverture d'un dossier OmegaX se fait avec VMG Consulting · écrivez à admin@vmgconsulting.net pour démarrer.");
        }
        return this.authService.inscrireEnEssai(dto);
    }
    async login(dto, res, req) {
        const r = await this.authService.login(dto, req?.ip ?? null);
        if ('deuxiemeFacteurRequis' in r)
            return r;
        return this.poserSession(res, r);
    }
    async logout(res) {
        (0, session_constants_1.effacerCookiesSession)(res);
        return { deconnecte: true };
    }
    async me(user, req) {
        const session = (0, session_longue_1.sessionDeLaRequete)(req);
        return {
            ...(await this.authService.me(user.userId)),
            ...(session?.csrf ? { csrfToken: session.csrf } : {}),
            sessionLongue: session?.longue ?? false,
        };
    }
    async changerMotDePasse(user, dto, res) {
        return this.poserSession(res, await this.authService.changerMotDePasse(user.userId, dto.motDePasseActuel, dto.nouveauMotDePasse, (0, session_longue_1.sessionDeLaRequete)(res.req)));
    }
    async changerAdresse(user, dto, res) {
        return this.poserSession(res, await this.authService.changerAdresse(user.userId, dto.motDePasseActuel, dto.nouvelleAdresse, (0, session_longue_1.sessionDeLaRequete)(res.req)));
    }
    etatDoubleAuth(user) {
        return this.authService.etatDoubleAuth(user.userId);
    }
    initierDoubleAuth(user) {
        return this.authService.initierDoubleAuth(user.userId);
    }
    async activerDoubleAuth(user, dto, res) {
        return this.poserSession(res, await this.authService.activerDoubleAuth(user.userId, dto.motDePasseActuel, dto.code, undefined, (0, session_longue_1.sessionDeLaRequete)(res.req)));
    }
    async desactiverDoubleAuth(user, dto, res) {
        return this.poserSession(res, await this.authService.desactiverDoubleAuth(user.userId, dto.motDePasseActuel, dto.code, undefined, (0, session_longue_1.sessionDeLaRequete)(res.req)));
    }
    regenererCodesSecours(user, dto) {
        return this.authService.regenererCodesSecours(user.userId, dto.motDePasseActuel, dto.code);
    }
    async deconnecterPartout(user, res) {
        const resultat = await this.authService.deconnecterPartout(user.userId);
        (0, session_constants_1.effacerCookiesSession)(res);
        return resultat;
    }
    async deconnecterAutresAppareils(user, dto, res) {
        return this.poserSession(res, await this.authService.deconnecterAutresAppareils(user.userId, dto.motDePasseActuel, (0, session_longue_1.sessionDeLaRequete)(res.req)));
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 3_600_000, limit: 30 } }),
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 60 } }),
    (0, common_1.Get)('inscription-essai/etat'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "etatInscriptionEssai", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 3_600_000, limit: 5 } }),
    (0, common_1.Post)('inscription-essai'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inscription_essai_dto_1.InscriptionEssaiDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "inscrireEnEssai", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, sortie_mot_de_passe_decorator_1.SortieMotDePasseProvisoire)(),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    (0, sortie_mot_de_passe_decorator_1.SortieMotDePasseProvisoire)(),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('changer-mot-de-passe'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, changer_mot_de_passe_dto_1.ChangerMotDePasseDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changerMotDePasse", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('changer-adresse'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, changer_adresse_dto_1.ChangerAdresseDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changerAdresse", null);
__decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('double-authentification'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "etatDoubleAuth", null);
__decorate([
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('double-authentification/initier'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "initierDoubleAuth", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('double-authentification/activer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, double_authentification_dto_1.ActiverDoubleAuthDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "activerDoubleAuth", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('double-authentification/desactiver'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, double_authentification_dto_1.DesactiverDoubleAuthDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "desactiverDoubleAuth", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('double-authentification/codes-secours'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, double_authentification_dto_1.RegenererCodesSecoursDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "regenererCodesSecours", null);
__decorate([
    (0, sortie_mot_de_passe_decorator_1.SortieMotDePasseProvisoire)(),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('deconnecter-partout'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deconnecterPartout", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    (0, acces_roles_cantonnes_decorator_1.AccesRolesCantonnes)({ gestionnairePaie: true }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('deconnecter-autres-appareils'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, deconnecter_autres_appareils_dto_1.DeconnecterAutresAppareilsDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deconnecterAutresAppareils", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map