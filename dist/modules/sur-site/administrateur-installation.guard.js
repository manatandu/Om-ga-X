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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdministrateurInstallationGuard = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const mode_installation_1 = require("../../common/mode-installation");
const auth_service_1 = require("../auth/auth.service");
let AdministrateurInstallationGuard = class AdministrateurInstallationGuard {
    constructor(auth) {
        this.auth = auth;
    }
    async canActivate(ctx) {
        if (!(0, mode_installation_1.estSurSite)())
            throw new common_1.ForbiddenException('Ce serveur n’est pas une installation sur site.');
        const user = ctx.switchToHttp().getRequest().user;
        const installation = await this.auth.dossierDInstallation();
        if (user?.role !== client_1.RoleUtilisateur.ADMIN_CABINET || !installation || user.tenantId !== installation) {
            throw new common_1.ForbiddenException('Réservé à l’administrateur du dossier d’installation (le premier dossier créé sur ce poste) · une sauvegarde contient la base de tous les dossiers.');
        }
        return true;
    }
};
exports.AdministrateurInstallationGuard = AdministrateurInstallationGuard;
exports.AdministrateurInstallationGuard = AdministrateurInstallationGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AdministrateurInstallationGuard);
//# sourceMappingURL=administrateur-installation.guard.js.map