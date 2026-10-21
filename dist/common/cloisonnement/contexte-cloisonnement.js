"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloisonnementViole = void 0;
exports.horsCloisonnement = horsCloisonnement;
exports.perimetreDeGroupe = perimetreDeGroupe;
exports.raisonHorsCloisonnement = raisonHorsCloisonnement;
exports.perimetreCourant = perimetreCourant;
const node_async_hooks_1 = require("node:async_hooks");
const stockage = new node_async_hooks_1.AsyncLocalStorage();
function estThenable(valeur) {
    return (typeof valeur === 'object' &&
        valeur !== null &&
        typeof valeur.then === 'function');
}
function dansLaPortee(portee, suite) {
    return stockage.run(portee, () => {
        const resultat = suite();
        if (!estThenable(resultat))
            return resultat;
        return new Promise((resoudre, rejeter) => resultat.then(resoudre, rejeter));
    });
}
function horsCloisonnement(raison, suite) {
    return dansLaPortee({ raison }, suite);
}
function perimetreDeGroupe(dossiers, suite) {
    const heritage = stockage.getStore()?.perimetre;
    const perimetre = new Set(dossiers);
    if (heritage)
        for (const d of heritage)
            perimetre.add(d);
    return dansLaPortee({ perimetre }, suite);
}
function raisonHorsCloisonnement() {
    return stockage.getStore()?.raison;
}
function perimetreCourant() {
    return stockage.getStore()?.perimetre;
}
class CloisonnementViole extends Error {
    constructor(message) {
        super(message);
        this.name = 'CloisonnementViole';
    }
}
exports.CloisonnementViole = CloisonnementViole;
//# sourceMappingURL=contexte-cloisonnement.js.map