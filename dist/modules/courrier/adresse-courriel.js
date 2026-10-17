"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliserAdresse = normaliserAdresse;
exports.adresseAcceptable = adresseAcceptable;
const LONGUEUR_MAXIMALE = 254;
function normaliserAdresse(brut) {
    return (brut ?? '').trim();
}
function adresseAcceptable(adresse) {
    if (adresse.length === 0 || adresse.length > LONGUEUR_MAXIMALE)
        return false;
    if (/\s/.test(adresse))
        return false;
    if (/[,;]/.test(adresse))
        return false;
    const morceaux = adresse.split('@');
    if (morceaux.length !== 2)
        return false;
    const [locale, domaine] = morceaux;
    if (locale.length === 0 || domaine.length === 0)
        return false;
    if (!domaine.includes('.'))
        return false;
    if (domaine.startsWith('.') || domaine.endsWith('.') || domaine.includes('..'))
        return false;
    return true;
}
//# sourceMappingURL=adresse-courriel.js.map