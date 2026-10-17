"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ecritureDeFacture = ecritureDeFacture;
const date_reception_1 = require("./date-reception");
const arrondi = (x) => Math.round(x * 100) / 100;
function ecritureDeFacture(f, compteGestionParDefaut) {
    if (!f.compteTiersId) {
        return { refus: 'Le tiers de la facture n’a pas de compte principal · rattachez-lui un compte au plan des tiers, ou renseignez le tiers sur la facture.' };
    }
    if (f.autresImpotsEtTaxes && f.autresImpotsEtTaxes > 0) {
        return { refus: 'La facture porte d’autres impôts et taxes · leur compte dépend de leur nature, l’écriture se passe à la main.' };
    }
    if (!f.lignes.length)
        return { refus: 'La facture n’a aucune ligne.' };
    const libelle = (0, date_reception_1.libelleDeFacture)(f.nature, f.numeroSerie, f.dateFacture, f.contrepartieNom);
    const inverse = (f.sens === 'ACHAT') !== (f.nature === 'NOTE_DE_CREDIT');
    const poser = (compteId, libelleLigne, montantAuCredit, tauxTvaId) => {
        const m = arrondi(montantAuCredit);
        const credit = inverse ? -m : m;
        return { compteId, libelle: libelleLigne.slice(0, 250), debit: credit < 0 ? -credit : 0, credit: credit > 0 ? credit : 0, ...(tauxTvaId ? { tauxTvaId } : {}) };
    };
    const gestion = new Map();
    const tva = new Map();
    for (const l of f.lignes) {
        const compte = l.compteGestionId || compteGestionParDefaut;
        if (!compte)
            return { refus: `Aucun compte de ${f.sens === 'VENTE' ? 'produit' : 'charge'} choisi pour la ligne « ${l.designation} ».` };
        gestion.set(compte, (gestion.get(compte) ?? 0) + l.montantHT);
        if (l.montantTva > 0 || (l.tauxZero && l.tauxTvaId)) {
            if (!l.compteTvaId || !l.tauxTvaId) {
                return { refus: `La ligne « ${l.designation} » porte de la TVA sans taux rattaché à un compte ${f.sens === 'VENTE' ? 'de TVA facturée' : 'de TVA récupérable'} · complétez le taux dans Taux de taxes.` };
            }
            const cle = `${l.compteTvaId}|${l.tauxTvaId}`;
            const t = tva.get(cle) ?? { compteId: l.compteTvaId, montant: 0, tauxTvaId: l.tauxTvaId };
            t.montant += l.montantTva;
            tva.set(cle, t);
        }
    }
    const lignes = [];
    for (const [compte, m] of gestion)
        lignes.push(poser(compte, libelle, m));
    for (const t of tva.values())
        lignes.push(poser(t.compteId, `TVA · ${libelle}`, t.montant, t.tauxTvaId));
    const totalAutres = arrondi(lignes.reduce((s, l) => s + l.credit - l.debit, 0));
    lignes.unshift({ compteId: f.compteTiersId, libelle, debit: totalAutres > 0 ? totalAutres : 0, credit: totalAutres < 0 ? -totalAutres : 0 });
    if (totalAutres === 0)
        return { refus: 'La facture est à zéro · il n’y a rien à passer.' };
    return { lignes, libelle };
}
//# sourceMappingURL=ecriture-facture.js.map