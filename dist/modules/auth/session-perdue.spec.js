"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const garde = new jwt_auth_guard_1.JwtAuthGuard(new core_1.Reflector());
function refus(fn) {
    try {
        fn();
    }
    catch (e) {
        if (e instanceof common_1.UnauthorizedException)
            return { statut: 401, corps: e.getResponse() };
        throw e;
    }
    throw new Error('aucun refus');
}
describe('F164 · la session perdue se dit et se reconnaît', () => {
    it('sans jeton, ou jeton expiré · 401 en français, marqué session perdue', () => {
        const { statut, corps } = refus(() => garde.handleRequest(null, false));
        expect(statut).toBe(401);
        expect(corps).toMatchObject({ message: jwt_auth_guard_1.MOTIF_SESSION_ABSENTE, session: jwt_auth_guard_1.SIGNAL_SESSION_PERDUE });
        expect(String(corps.message)).not.toBe('Unauthorized');
    });
    it('un refus de la stratégie garde son motif, et porte le même drapeau', () => {
        const { corps } = refus(() => garde.handleRequest(new common_1.UnauthorizedException('Session close · reconnectez-vous'), false));
        expect(corps).toMatchObject({ message: 'Session close · reconnectez-vous', session: jwt_auth_guard_1.SIGNAL_SESSION_PERDUE });
    });
    it('une autre panne n’est pas une session perdue · elle remonte telle quelle', () => {
        const panne = new Error('base injoignable');
        expect(() => garde.handleRequest(panne, false)).toThrow(panne);
        const csrf = new common_1.ForbiddenException('Jeton CSRF absent ou invalide · reconnectez-vous');
        expect(() => garde.handleRequest(csrf, false)).toThrow(csrf);
    });
    it('une session valide passe', () => {
        const user = { userId: 'u1' };
        expect(garde.handleRequest(null, user)).toBe(user);
    });
});
//# sourceMappingURL=session-perdue.spec.js.map