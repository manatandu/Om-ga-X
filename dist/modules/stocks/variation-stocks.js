"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proposerVariations = proposerVariations;
exports.lignesDeLEcriture = lignesDeLEcriture;
exports.totaux = totaux;
const nomenclature_stocks_1 = require("./nomenclature-stocks");
function proposerVariations(comptes, referentiel) {
    const retenues = [];
    const refusees = [];
    const sansMouvement = [];
    const avertissements = [];
    for (const c of comptes) {
        const hors = (0, nomenclature_stocks_1.motifHorsVariation)(c.numero, referentiel);
        if (hors) {
            refusees.push({
                numero: c.numero,
                motif: 'HORS_VARIATION_AUTOMATIQUE',
                explication: `${hors.intitule} · ${hors.motif}`,
            });
            continue;
        }
        const correspondance = (0, nomenclature_stocks_1.variationDuCompte)(c.numero, referentiel);
        if (!correspondance) {
            refusees.push({
                numero: c.numero,
                motif: 'PAS_UN_COMPTE_DE_STOCK',
                explication: `Le compte ${c.numero} ne correspond à aucun compte de stock du plan ` +
                    `${referentiel}. Les nomenclatures des deux référentiels ne se transposent pas : ` +
                    "vérifiez le compte dans le plan du dossier avant de l'inventorier.",
            });
            continue;
        }
        if (c.stockFinal === null) {
            refusees.push({
                numero: c.numero,
                motif: 'STOCK_FINAL_NON_COMPTE',
                explication: `Le stock final du compte ${c.numero} (${correspondance.intitule}) n'a pas été ` +
                    "constaté. Les deux textes le veulent « déterminé par inventaire extra-comptable » · " +
                    'le lire comme zéro solderait le stock entier en charge.',
            });
            continue;
        }
        if (c.stockFinal < 0) {
            refusees.push({
                numero: c.numero,
                motif: 'STOCK_FINAL_NEGATIF',
                explication: `Le stock final du compte ${c.numero} est négatif. Un stock est un ACTIF : il se ` +
                    "compte en quantités détenues, qui ne descendent pas sous zéro. Un montant négatif " +
                    "vient d'une erreur de comptage ou de valorisation.",
            });
            continue;
        }
        if (!c.source.trim()) {
            refusees.push({
                numero: c.numero,
                motif: 'SOURCE_ABSENTE',
                explication: `Le stock final du compte ${c.numero} est chiffré sans sa source. Un montant ` +
                    "d'inventaire extra-comptable ne se vérifie que par le document qui le porte · " +
                    "campagne d'inventaire, feuille de comptage, état du magasin.",
            });
            continue;
        }
        if (c.soldeInitial < 0) {
            avertissements.push(`Le compte ${c.numero} (${c.intitule}) présente un solde CRÉDITEUR de ` +
                `${Math.abs(c.soldeInitial)}. Un compte de stock est un compte d'actif, son solde est ` +
                "débiteur. Vérifiez les imputations avant de passer la variation : l'écriture " +
                'proposée ci-dessous reprend ce solde tel quel.');
        }
        if (c.soldeInitial === 0 && c.stockFinal === 0) {
            sansMouvement.push(c.numero);
            continue;
        }
        const lignes = [];
        if (c.soldeInitial !== 0) {
            lignes.push({
                compte: c.numero,
                sens: c.soldeInitial > 0 ? 'CREDIT' : 'DEBIT',
                montant: Math.abs(c.soldeInitial),
                libelle: `Annulation du stock initial · ${correspondance.intitule}`,
            });
            lignes.push({
                compte: correspondance.variation,
                sens: c.soldeInitial > 0 ? 'DEBIT' : 'CREDIT',
                montant: Math.abs(c.soldeInitial),
                libelle: `Annulation du stock initial · ${correspondance.intitule}`,
            });
        }
        if (c.stockFinal !== 0) {
            lignes.push({
                compte: c.numero,
                sens: 'DEBIT',
                montant: c.stockFinal,
                libelle: `Stock final au ${correspondance.intitule} · ${c.source}`,
            });
            lignes.push({
                compte: correspondance.variation,
                sens: 'CREDIT',
                montant: c.stockFinal,
                libelle: `Stock final au ${correspondance.intitule} · ${c.source}`,
            });
        }
        retenues.push({
            numero: c.numero,
            correspondance,
            soldeInitial: c.soldeInitial,
            stockFinal: c.stockFinal,
            source: c.source,
            lignes,
        });
    }
    return { retenues, refusees, sansMouvement, avertissements };
}
function lignesDeLEcriture(proposition) {
    return proposition.retenues.flatMap((r) => r.lignes);
}
function totaux(lignes) {
    return lignes.reduce((acc, l) => ({
        debit: acc.debit + (l.sens === 'DEBIT' ? l.montant : 0),
        credit: acc.credit + (l.sens === 'CREDIT' ? l.montant : 0),
    }), { debit: 0, credit: 0 });
}
//# sourceMappingURL=variation-stocks.js.map