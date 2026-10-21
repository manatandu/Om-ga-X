"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bootstrap_1 = require("./bootstrap");
const jwt_strategy_1 = require("./modules/auth/jwt.strategy");
describe('l’API sous l’adresse du site', () => {
    it('retire le préfixe /api, et lui seul', () => {
        expect((0, bootstrap_1.retirerPrefixeApi)('/api/auth/login')).toBe('/auth/login');
        expect((0, bootstrap_1.retirerPrefixeApi)('/api/ecritures?page=2')).toBe('/ecritures?page=2');
        expect((0, bootstrap_1.retirerPrefixeApi)('/api')).toBe('/');
        expect((0, bootstrap_1.retirerPrefixeApi)('/auth/login')).toBe('/auth/login');
        expect((0, bootstrap_1.retirerPrefixeApi)('/apiculture')).toBe('/apiculture');
        expect((0, bootstrap_1.retirerPrefixeApi)('/health')).toBe('/health');
    });
    it('le cookie __session est lu, et l’ancien nom le temps de la transition', () => {
        expect((0, jwt_strategy_1.extraireJetonDuCookie)({ cookies: { __session: 'neuf' } })).toBe('neuf');
        expect((0, jwt_strategy_1.extraireJetonDuCookie)({ cookies: { omegax_session: 'ancien' } })).toBe('ancien');
        expect((0, jwt_strategy_1.extraireJetonDuCookie)({ cookies: { __session: 'neuf', omegax_session: 'ancien' } })).toBe('neuf');
    });
});
//# sourceMappingURL=prefixe-api.spec.js.map