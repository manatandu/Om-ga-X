"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUREE_CACHE_CONTROLE_CORS = void 0;
exports.retirerPrefixeApi = retirerPrefixeApi;
exports.configurerApplication = configurerApplication;
exports.optionsCors = optionsCors;
const common_1 = require("@nestjs/common");
const express_1 = require("express");
const helmet_1 = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const sauts_de_confiance_1 = require("./common/sauts-de-confiance");
function retirerPrefixeApi(url) {
    if (url === '/api')
        return '/';
    if (url.startsWith('/api?'))
        return `/${url.slice(4)}`;
    return url.startsWith('/api/') ? url.slice(4) : url;
}
function configurerApplication(app) {
    app.use((req, _res, next) => {
        req.url = retirerPrefixeApi(req.url);
        next();
    });
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    app.getHttpAdapter().getInstance().set('trust proxy', (0, sauts_de_confiance_1.sautsDeConfiance)() || false);
    app.use(compression());
    app.use((0, express_1.json)({ limit: '12mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '12mb' }));
    app.use(cookieParser());
    const ORIGINES_SITE = ['https://oomega.web.app', 'https://oomega.firebaseapp.com', 'https://omegax.vmgconsulting.net'];
    const configurees = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
    const enProduction = process.env.NODE_ENV === 'production';
    const origines = configurees
        ? [...new Set([...configurees, ...ORIGINES_SITE])]
        : enProduction
            ? ORIGINES_SITE
            : undefined;
    app.enableCors(optionsCors(origines));
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    return app;
}
exports.DUREE_CACHE_CONTROLE_CORS = 7200;
function optionsCors(origines) {
    return {
        origin: origines ?? true,
        credentials: true,
        maxAge: exports.DUREE_CACHE_CONTROLE_CORS,
    };
}
//# sourceMappingURL=bootstrap.js.map