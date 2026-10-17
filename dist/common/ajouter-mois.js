"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ajouterMois = ajouterMois;
function ajouterMois(date, n, options = {}) {
    const an = date.getUTCFullYear();
    const mois = date.getUTCMonth();
    const jour = date.getUTCDate();
    const dernierDu = (a, m) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
    const cible = new Date(Date.UTC(an, mois + n, 1));
    const dernierCible = dernierDu(cible.getUTCFullYear(), cible.getUTCMonth());
    const finDeMois = options.finDeMoisSuit === true && jour === dernierDu(an, mois);
    return new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), finDeMois ? dernierCible : Math.min(jour, dernierCible), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}
//# sourceMappingURL=ajouter-mois.js.map