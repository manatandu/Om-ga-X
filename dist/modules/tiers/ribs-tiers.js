"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusRibTiers = motifRefusRibTiers;
exports.coordonneesImprimees = coordonneesImprimees;
exports.motifRefusDeviseDonneur = motifRefusDeviseDonneur;
exports.motifRefusImpression = motifRefusImpression;
exports.motifRefusAnnulation = motifRefusAnnulation;
const banques_1 = require("../banques/banques");
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const vide = (v) => !v || !v.trim();
function motifRefusRibTiers(rib) {
    if (vide(rib.banque))
        return "La banque du tiers est obligatoire · l'ordre de virement la nomme.";
    if (vide(rib.iban) && vide(rib.numeroCompte)) {
        return "Un RIB sans IBAN ni numéro de compte ne permet pas de payer · renseignez l'un des deux.";
    }
    if (!vide(rib.iban) && !(0, banques_1.ibanValide)(rib.iban)) {
        return "IBAN invalide · la clé de contrôle (ISO 13616, modulo 97) ne correspond pas. Vérifiez la saisie.";
    }
    return null;
}
function coordonneesImprimees(rib) {
    if (!vide(rib.iban)) {
        const iban = (0, banques_1.normaliserIban)(rib.iban);
        return `IBAN ${iban.replace(/(.{4})/g, '$1 ').trim()}`;
    }
    return [rib.codeBanque, rib.codeGuichet, rib.numeroCompte, rib.cle]
        .filter((v) => !vide(v))
        .map((v) => v.trim())
        .join(' ');
}
function motifRefusDeviseDonneur(devise, journalCode) {
    if (vide(devise))
        return null;
    const code = devise.trim().toUpperCase();
    if (code === monnaie_de_tenue_1.MONNAIE_DE_TENUE)
        return null;
    return (`Le RIB du journal ${journalCode} est tenu en ${code} · les règlements sont en ${monnaie_de_tenue_1.MONNAIE_DE_TENUE}, ` +
        "monnaie de tenue. Un ordre de virement ne s'émet que sur un compte en " +
        `${monnaie_de_tenue_1.MONNAIE_DE_TENUE}.`);
}
function motifRefusImpression(statut) {
    return statut === 'ANNULE' ? "L'ordre est annulé · il ne se réimprime pas." : null;
}
function motifRefusAnnulation(statut, motif) {
    if (statut === 'ANNULE')
        return "L'ordre est déjà annulé.";
    if (vide(motif))
        return "Le motif d'annulation est obligatoire · un ordre remis à la banque et retiré doit laisser sa raison.";
    return null;
}
//# sourceMappingURL=ribs-tiers.js.map