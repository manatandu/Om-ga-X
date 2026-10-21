"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperateurPlateformeGuard = exports.MOTIF_CONSOLE_SANS_DOUBLE_AUTH = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const session_longue_1 = require("../auth/session-longue");
exports.MOTIF_CONSOLE_SANS_DOUBLE_AUTH = 'La console exige la double authentification · activez-la dans Fichier > Mon compte…, puis revenez.';
let OperateurPlateformeGuard = class OperateurPlateformeGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        if (request.user?.estOperateurPlateforme !== true) {
            throw new common_1.ForbiddenException('Réservé à l’opérateur de la plateforme');
        }
        if (request.user?.doubleAuthentificationActive !== true) {
            throw new common_1.ForbiddenException(exports.MOTIF_CONSOLE_SANS_DOUBLE_AUTH);
        }
        if ((0, session_longue_1.authentificationTropAnciennePourLaConsole)((0, session_longue_1.sessionDeLaRequete)(request), Math.floor(Date.now() / 1000))) {
            throw (0, jwt_auth_guard_1.refusDeSession)(session_longue_1.MOTIF_CONSOLE_AUTHENTIFICATION_ANCIENNE);
        }
        return true;
    }
};
exports.OperateurPlateformeGuard = OperateurPlateformeGuard;
exports.OperateurPlateformeGuard = OperateurPlateformeGuard = __decorate([
    (0, common_1.Injectable)()
], OperateurPlateformeGuard);
//# sourceMappingURL=operateur-plateforme.guard.js.map