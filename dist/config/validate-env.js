"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
function validateEnv(config) {
    const secret = config.JWT_SECRET;
    if (typeof secret !== 'string' || secret.trim().length === 0) {
        throw new Error("JWT_SECRET est obligatoire et doit être défini dans l'environnement (.env en local, " +
            'variable de déploiement en production) · aucun repli silencieux, voir validate-env.ts.');
    }
    const VALEURS_CONNUES = ['change-me', 'dev-secret-change-me'];
    if (VALEURS_CONNUES.includes(secret) || secret.length < 32) {
        console.warn('⚠ JWT_SECRET utilise une valeur de développement ou trop courte (< 32 caractères). ' +
            'À ne JAMAIS utiliser en production · générez une valeur aléatoire dédiée par environnement.');
    }
    return config;
}
//# sourceMappingURL=validate-env.js.map