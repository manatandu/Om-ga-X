"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compteStockRecupere = compteStockRecupere;
exports.motifRefusMaterielRecupere = motifRefusMaterielRecupere;
const nomenclature_stocks_1 = require("../stocks/nomenclature-stocks");
function compteStockRecupere(referentiel) {
    return nomenclature_stocks_1.STOCK_PROVENANT_D_IMMOBILISATIONS[referentiel];
}
function motifRefusMaterielRecupere(e) {
    const stock = compteStockRecupere(e.referentiel);
    if (!(e.valeur > 0))
        return 'La valeur du matériel récupéré doit être positive.';
    if (e.cession) {
        return ("Le matériel récupéré suit une mise hors service ou au rebut (AUDCIF Titre VIII ch. 14 § 2.8) · une cession " +
            'vend le bien entier, et son prix va au 82.');
    }
    if (e.projetDeveloppement) {
        return ("Un bien de projet de développement sort tout entier par le fonds affecté qui l'a financé (SYCEBNL Partie 3 " +
            'ch. 3 § 2.5) · le texte n’y prévoit aucune reprise en stock.');
    }
    const division = e.numeroCompteBien.slice(0, 2);
    if (!['22', '23', '24'].includes(division)) {
        return (`Le compte ${stock.racine} reçoit « les éléments récupérés ou démontés d'immobilisations corporelles » ` +
            `(${stock.source}) · terrains, bâtiments et installations, matériel (22, 23, 24).`);
    }
    if (!e.numeroCompteStock || !e.numeroCompteStock.startsWith(stock.racine)) {
        return `Le matériel récupéré se reprend au ${stock.racine} « ${stock.intitule} » (${stock.source}).`;
    }
    if (!e.source?.trim()) {
        return "Indiquez d'où vient la valeur retenue pour le matériel récupéré (estimation, cours, procès-verbal) · aucun texte ne la fixe.";
    }
    if (Math.round((e.valeur - e.valeurNetteComptable) * 100) > 0) {
        return (`La valeur récupérée dépasse la valeur nette du bien à sa sortie (${e.valeurNetteComptable.toFixed(2)}) · le ` +
            `stock est débité « par le crédit du compte d'immobilisation concerné » (${stock.source}), et aucun texte ne ` +
            "donne de compte pour l'excédent.");
    }
    return null;
}
//# sourceMappingURL=materiel-recupere.js.map