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
exports.JwtAuthGuard = exports.SIGNAL_SESSION_PERDUE = exports.MOTIF_SESSION_ABSENTE = void 0;
exports.refusDeSession = refusDeSession;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const client_1 = require("@prisma/client");
const passport_1 = require("@nestjs/passport");
const acces_roles_cantonnes_decorator_1 = require("../../common/decorators/acces-roles-cantonnes.decorator");
const mot_de_passe_a_changer_guard_1 = require("../../common/guards/mot-de-passe-a-changer.guard");
const roles_cantonnes_1 = require("../../common/guards/roles-cantonnes");
const fonctions_metier_1 = require("../../common/fonctions/fonctions-metier");
const session_longue_1 = require("./session-longue");
const session_constants_1 = require("./session.constants");
exports.MOTIF_SESSION_ABSENTE = 'Session absente ou expirée · reconnectez-vous.';
exports.SIGNAL_SESSION_PERDUE = 'perdue';
function refusDeSession(message = exports.MOTIF_SESSION_ABSENTE) {
    return new common_1.UnauthorizedException({ statusCode: 401, error: 'Unauthorized', message, session: exports.SIGNAL_SESSION_PERDUE });
}
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    constructor(reflector) {
        super();
        this.reflector = reflector;
    }
    handleRequest(err, user) {
        if (!err && user)
            return user;
        if (err && !(err instanceof common_1.UnauthorizedException))
            throw err;
        throw refusDeSession(err instanceof common_1.UnauthorizedException ? err.message : exports.MOTIF_SESSION_ABSENTE);
    }
    async canActivate(contexte) {
        const authentifie = (await super.canActivate(contexte));
        if (!authentifie)
            return false;
        new mot_de_passe_a_changer_guard_1.MotDePasseAChangerGuard(this.reflector).canActivate(contexte);
        const utilisateur = contexte.switchToHttp().getRequest()?.user;
        const role = utilisateur?.role;
        if (role && roles_cantonnes_1.ROLES_CANTONNES.includes(role)) {
            const acces = this.reflector.getAllAndOverride(acces_roles_cantonnes_decorator_1.CLE_ACCES_ROLES_CANTONNES, [
                contexte.getHandler(),
                contexte.getClass(),
            ]);
            if (!(0, roles_cantonnes_1.routeOuverteAuRoleCantonne)(role, acces)) {
                throw new common_1.ForbiddenException(role === client_1.RoleUtilisateur.GESTIONNAIRE_PAIE
                    ? 'Votre rôle est cantonné au personnel et à la paie · cette fonction ne vous est pas ouverte.'
                    : "Cette fonction est réservée au comptable · l'aide-comptable saisit au brouillard, sans valider ni passer la paie.");
            }
        }
        if (utilisateur) {
            const requete = contexte.switchToHttp().getRequest();
            const fonction = (0, fonctions_metier_1.fonctionDeRoute)(contexte.getClass().name, contexte.getHandler().name, utilisateur.role);
            const motif = (0, fonctions_metier_1.motifRefusFonction)(utilisateur, requete?.method ?? 'GET', fonction);
            if (motif)
                throw new common_1.ForbiddenException(motif);
        }
        const prolongation = (0, session_longue_1.sessionDeLaRequete)(contexte.switchToHttp().getRequest())?.prolongation;
        if (prolongation) {
            (0, session_constants_1.poserCookieSession)(contexte.switchToHttp().getResponse(), prolongation.accessToken, prolongation.maxAgeMs);
        }
        return true;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map