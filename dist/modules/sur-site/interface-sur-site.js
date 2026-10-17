"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLITIQUE_INTERFACE = void 0;
exports.entetesInterface = entetesInterface;
exports.servirInterfaceSurSite = servirInterfaceSurSite;
const fs_1 = require("fs");
const path_1 = require("path");
const express_1 = require("express");
exports.POLITIQUE_INTERFACE = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; " +
    "object-src 'none'; manifest-src 'self'; worker-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
function entetesInterface(res, chemin) {
    res.setHeader('Content-Security-Policy', exports.POLITIQUE_INTERFACE);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const immuable = /[\\/](assets|polices)[\\/]/.test(chemin);
    res.setHeader('Cache-Control', immuable ? 'public, max-age=31536000, immutable' : 'no-cache');
}
function servirInterfaceSurSite(app, dossier) {
    if (!dossier || !(0, fs_1.existsSync)((0, path_1.join)(dossier, 'index.html')))
        return false;
    app.use((0, express_1.static)(dossier, { index: 'index.html', setHeaders: entetesInterface }));
    return true;
}
//# sourceMappingURL=interface-sur-site.js.map