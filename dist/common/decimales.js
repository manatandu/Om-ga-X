"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nombreDeDecimales = nombreDeDecimales;
function nombreDeDecimales(x) {
    const t = String(x);
    if (/e/i.test(t))
        return Number.isInteger(x) ? 0 : Number.POSITIVE_INFINITY;
    const i = t.indexOf('.');
    return i < 0 ? 0 : t.length - i - 1;
}
//# sourceMappingURL=decimales.js.map