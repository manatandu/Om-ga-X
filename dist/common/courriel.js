"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliserCourriel = normaliserCourriel;
exports.CourrielNormalise = CourrielNormalise;
const class_transformer_1 = require("class-transformer");
function normaliserCourriel(adresse) {
    return adresse.trim().toLowerCase();
}
function CourrielNormalise() {
    return (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? normaliserCourriel(value) : value));
}
//# sourceMappingURL=courriel.js.map