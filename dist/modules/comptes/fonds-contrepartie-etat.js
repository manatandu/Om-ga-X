"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTES_DE_FONDS_PROJET = void 0;
exports.motifRefusFondsContrepartieEtat = motifRefusFondsContrepartieEtat;
const client_1 = require("@prisma/client");
exports.COMPTES_DE_FONDS_PROJET = ['51', '52', '53', '55', '57'];
function motifRefusFondsContrepartieEtat(c) {
    if (c.referentiel !== client_1.Referentiel.SYCEBNL || c.jeu !== client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT) {
        return "La contrepartie de l'État ne se déclare que dans un dossier SYCEBNL « projets de développement », seul à tenir le tableau emplois-ressources.";
    }
    if (!exports.COMPTES_DE_FONDS_PROJET.some((p) => c.numero.startsWith(p))) {
        return `Le compte ${c.numero} n'est pas un compte de trésorerie du tableau emplois-ressources (comptes 51, 52, 53, 55, 57).`;
    }
    if (c.typeCompte === client_1.TypeCompteDetailTotal.TOTAL) {
        return `Le compte ${c.numero} est un compte Total · la contrepartie de l'État se déclare sur le compte de détail qui la porte.`;
    }
    if (c.bailleurId) {
        return `Le compte ${c.numero} est rattaché à un bailleur (fonds bailleur, FU et FX) · un compte ne porte qu'une nature de fonds. Détachez-le du bailleur d'abord.`;
    }
    return null;
}
//# sourceMappingURL=fonds-contrepartie-etat.js.map