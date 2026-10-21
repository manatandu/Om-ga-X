"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPTIONS_COOKIE_SESSION = exports.ENTETE_CSRF = exports.ANCIEN_COOKIE_SESSION = exports.COOKIE_SESSION = void 0;
exports.optionsCookieSession = optionsCookieSession;
exports.estHttpLocal = estHttpLocal;
exports.poserCookieSession = poserCookieSession;
exports.effacerCookiesSession = effacerCookiesSession;
const mode_installation_1 = require("../../common/mode-installation");
exports.COOKIE_SESSION = '__session';
exports.ANCIEN_COOKIE_SESSION = 'omegax_session';
exports.ENTETE_CSRF = 'x-csrf-token';
exports.OPTIONS_COOKIE_SESSION = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
};
function optionsCookieSession(surSite = (0, mode_installation_1.estSurSite)(), httpLocal = false) {
    return surSite || httpLocal ? { ...exports.OPTIONS_COOKIE_SESSION, secure: false, sameSite: 'lax' } : exports.OPTIONS_COOKIE_SESSION;
}
function estHttpLocal(req) {
    return !!req && !req.secure && ['localhost', '127.0.0.1', '::1'].includes(req.hostname ?? '');
}
function poserCookieSession(res, jeton, maxAgeMs) {
    const base = optionsCookieSession((0, mode_installation_1.estSurSite)(), estHttpLocal(res.req));
    res.cookie(exports.COOKIE_SESSION, jeton, maxAgeMs === null ? base : { ...base, maxAge: maxAgeMs });
}
function effacerCookiesSession(res) {
    const base = { ...optionsCookieSession((0, mode_installation_1.estSurSite)(), estHttpLocal(res.req)), maxAge: undefined };
    res.clearCookie(exports.COOKIE_SESSION, base);
    res.clearCookie(exports.ANCIEN_COOKIE_SESSION, base);
}
//# sourceMappingURL=session.constants.js.map