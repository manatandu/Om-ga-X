"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusLot = motifRefusLot;
const reglement_tiers_1 = require("./reglement-tiers");
const decimales_1 = require("../../common/decimales");
function motifRefusLot(nom, lignes, comptes) {
    if (!nom.trim())
        return 'Un lot porte un nom.';
    if (lignes.length === 0)
        return 'Un lot porte au moins un fournisseur.';
    const vus = new Set();
    for (const l of lignes) {
        if (vus.has(l.compteId))
            return 'Un fournisseur ne figure qu’une fois dans un lot · son montant se règle à chaque rappel.';
        vus.add(l.compteId);
        if (!(l.montant > 0) || (0, decimales_1.nombreDeDecimales)(l.montant) > 2) {
            return 'Le montant habituel est positif, à deux décimales au plus.';
        }
        const c = comptes.find((x) => x.id === l.compteId);
        if (!c)
            return 'Compte introuvable dans ce dossier.';
        if (c.typeCompte !== 'DETAIL')
            return `Le compte ${c.numero} est un compte Total · un règlement porte sur un compte de détail.`;
        if (!(0, reglement_tiers_1.estEcheanceAReglerSur)(c.numero, 'FOURNISSEUR')) {
            return `Le compte ${c.numero} n'est pas un compte fournisseur réglable (40, hors 408 et 409) · un virement règle une dette fournisseur.`;
        }
    }
    return null;
}
//# sourceMappingURL=lots-virement.js.map