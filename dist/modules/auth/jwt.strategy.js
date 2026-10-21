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
exports.JwtStrategy = void 0;
exports.sessionRevoquee = sessionRevoquee;
exports.extraireJetonDuCookie = extraireJetonDuCookie;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../../common/prisma.service");
const session_constants_1 = require("./session.constants");
const session_longue_1 = require("./session-longue");
function sessionRevoquee(iat, sessionsInvalidesAvant) {
    if (!sessionsInvalidesAvant)
        return false;
    if (iat === undefined)
        return true;
    return iat < Math.floor(sessionsInvalidesAvant.getTime() / 1000);
}
function extraireJetonDuCookie(req) {
    return (req.cookies?.[session_constants_1.COOKIE_SESSION] ?? req.cookies?.[session_constants_1.ANCIEN_COOKIE_SESSION]) ?? null;
}
const METHODES_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    constructor(config, prisma, jwt) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromExtractors([extraireJetonDuCookie, passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken()]),
            ignoreExpiration: false,
            secretOrKey: config.getOrThrow('JWT_SECRET'),
            passReqToCallback: true,
        });
        this.prisma = prisma;
        this.jwt = jwt;
    }
    async validate(req, payload) {
        const maintenant = Date.now();
        const porteParCookie = !req.headers.authorization && !!extraireJetonDuCookie(req);
        if (porteParCookie && METHODES_MUTANTES.has(req.method)) {
            const jetonRecu = req.headers[session_constants_1.ENTETE_CSRF];
            if (!payload.csrf || jetonRecu !== payload.csrf) {
                throw new common_1.ForbiddenException('Jeton CSRF absent ou invalide · reconnectez-vous');
            }
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: { tenant: { select: { referentiel: true, licence: true } } },
        });
        if (!user || !user.estActif) {
            throw new common_1.UnauthorizedException('Compte désactivé ou introuvable');
        }
        if (sessionRevoquee(payload.authentification ?? payload.iat, user.sessionsInvalidesAvant)) {
            throw new common_1.UnauthorizedException("Session close · reconnectez-vous. Elle a été fermée par un changement de vos accès, par vous-même ou par l'administrateur du dossier.");
        }
        const session = (0, session_longue_1.sessionDuJeton)(payload, Math.floor(maintenant / 1000));
        if (porteParCookie && this.jwt && (0, session_longue_1.prolongationDue)(session, Math.floor(maintenant / 1000))) {
            const prolonge = (0, session_longue_1.emettreSession)(this.jwt, user.id, {
                longue: true,
                origine: session.origine,
                csrf: session.csrf,
                authentification: session.authentification,
                connexionComplete: session.connexionComplete ?? null,
            }, maintenant);
            session.prolongation = { accessToken: prolonge.accessToken, maxAgeMs: prolonge.maxAgeMs ?? 0 };
        }
        req[session_longue_1.CLE_SESSION_REQUETE] = session;
        return {
            userId: user.id,
            tenantId: user.tenantId,
            email: user.email,
            role: user.role,
            doitChangerMotDePasse: user.doitChangerMotDePasse,
            referentiel: user.tenant.referentiel,
            licence: user.tenant.licence,
            estOperateurPlateforme: user.estOperateurPlateforme,
            doubleAuthentificationActive: user.doubleAuthActiveDepuis !== null,
            restreindreFonctions: user.restreindreFonctions,
            fonctionsAutorisees: user.fonctionsAutorisees,
            restreindreJournaux: user.restreindreJournaux,
            journauxAutorises: user.journauxAutorises,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        jwt_1.JwtService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map