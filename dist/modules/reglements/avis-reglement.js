"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CADRE_AVIS_PAR_DEFAUT = void 0;
exports.motifRefusAvis = motifRefusAvis;
exports.documentAvisReglement = documentAvisReglement;
const monnaie_de_tenue_1 = require("../../common/monnaie-de-tenue");
const modeles_impression_1 = require("../tiers/modeles-impression");
exports.CADRE_AVIS_PAR_DEFAUT = '{tiers}\n{adresse}\n\nLe {date}\n\nObjet : avis de règlement\n\n{document}';
function motifRefusAvis(statut) {
    if (statut === 'ANNULE')
        return "L'ordre est annulé · il ne paie personne, aucun avis de règlement ne part.";
    if (statut === 'A_IMPRIMER') {
        return "L'ordre n'est pas encore imprimé · l'avis annoncerait un virement que la banque n'a pas reçu. Imprimez l'ordre d'abord.";
    }
    return null;
}
const montantImprime = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function documentAvisReglement(ligne, ordre, entite) {
    return [
        'Madame, Monsieur,',
        '',
        `Notre ordre de virement n° ${ordre.numero} du ${(0, modeles_impression_1.jourImprime)(ordre.date)} porte en votre faveur la somme de ` +
            `${montantImprime(ligne.montant)} ${monnaie_de_tenue_1.MONNAIE_DE_TENUE}, au crédit de votre compte ouvert auprès de ${ligne.banque}.`,
        ...(ligne.reference ? [`Référence du paiement : ${ligne.reference}.`] : []),
        ...(ligne.imputationDeclaree ? [`${ligne.imputationDeclaree}.`] : []),
        '',
        'Nous vous prions d’agréer, Madame, Monsieur, nos salutations distinguées.',
        '',
        entite,
    ].join('\n');
}
//# sourceMappingURL=avis-reglement.js.map