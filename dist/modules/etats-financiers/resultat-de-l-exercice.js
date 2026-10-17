"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPTES_RESULTAT_DE_L_EXERCICE = void 0;
exports.estCompteDuResultatDeLExercice = estCompteDuResultatDeLExercice;
exports.estResultatEnInstanceDAffectation = estResultatEnInstanceDAffectation;
exports.resultatEnInstanceAuBilan = resultatEnInstanceAuBilan;
exports.resultatAuBilan = resultatAuBilan;
exports.resultatDeLExerciceAuxClassesDeGestion = resultatDeLExerciceAuxClassesDeGestion;
exports.partsDuResultatAuBilan = partsDuResultatAuBilan;
exports.resultatAnterieurNonVire = resultatAnterieurNonVire;
exports.resultatAnterieurNonVireDuComparatif = resultatAnterieurNonVireDuComparatif;
exports.COMPTES_RESULTAT_DE_L_EXERCICE = ['131', '132', '133', '134', '135', '136', '137', '138', '139'];
function estCompteDuResultatDeLExercice(numero) {
    return exports.COMPTES_RESULTAT_DE_L_EXERCICE.some((p) => numero.startsWith(p));
}
function estResultatEnInstanceDAffectation(numero) {
    return numero.startsWith('130');
}
function resultatEnInstanceAuBilan(lignes) {
    const montant = Math.round(-lignes.filter((l) => estResultatEnInstanceDAffectation(l.numero)).reduce((s, l) => s + l.solde, 0) * 100) / 100;
    return Math.abs(montant) < 0.005 ? null : montant;
}
function resultatAuBilan(resultatClasses678, resultatCompte13) {
    return resultatClasses678 + resultatCompte13;
}
function resultatDeLExerciceAuxClassesDeGestion(gestionNonSoldee, mouvementPropre13) {
    return gestionNonSoldee || !mouvementPropre13;
}
const EPSILON_RESULTAT = 0.005;
function partsDuResultatAuBilan(resultatClasses678, resultatCompte13, lignes678, lignes13) {
    const gestionNonSoldee = lignes678.some((l) => Math.abs(l.solde) > EPSILON_RESULTAT);
    const mouvementPropre13 = lignes13.some((l) => Math.abs(l.mouvementDebit) > EPSILON_RESULTAT || Math.abs(l.mouvementCredit) > EPSILON_RESULTAT);
    if (resultatDeLExerciceAuxClassesDeGestion(gestionNonSoldee, mouvementPropre13)) {
        return { resultatDeLExercice: resultatClasses678, resultatAnterieurNonAffecte: resultatCompte13 };
    }
    return { resultatDeLExercice: resultatAuBilan(resultatClasses678, resultatCompte13), resultatAnterieurNonAffecte: 0 };
}
const MONTANT_FR = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function resultatAnterieurNonVire(exerciceCloture, resultatAnterieurNonAffecte, poste, referentiel) {
    if (!exerciceCloture || Math.abs(resultatAnterieurNonAffecte) <= EPSILON_RESULTAT)
        return null;
    const montant = Math.round(resultatAnterieurNonAffecte * 100) / 100;
    const fiche = referentiel === 'SYCEBNL' ? 'SYCEBNL, Partie 2 ch. 3, compte 13' : 'AUDCIF, Titre VII, compte 13';
    const sens = referentiel === 'SYCEBNL' ? (montant < 0 ? 'un déficit' : 'un excédent') : montant < 0 ? 'une perte' : 'un bénéfice';
    return {
        montant,
        poste,
        motif: `Exercice clôturé sans le virement du résultat de l'exercice précédent non affecté · ${sens} de ` +
            `${MONTANT_FR.format(Math.abs(montant))} reste au compte 13, et le poste ${poste} l'additionne au résultat de l'exercice, ` +
            `alors que ce résultat antérieur est viré au report à nouveau en fin d'exercice (${fiche}). Rien n'est corrigé d'office · ` +
            "l'exercice suivant le reprend au compte 13 à l'ouverture, et sa clôture le vire au report à nouveau si l'affectation ne l'a pas soldé avant.",
    };
}
function resultatAnterieurNonVireDuComparatif(provenanceComparatif, exercicePrecedentCloture, resultatAnterieurNonAffecteN1, poste, referentiel) {
    if (provenanceComparatif !== 'EXERCICE_N1')
        return null;
    const avis = resultatAnterieurNonVire(exercicePrecedentCloture, resultatAnterieurNonAffecteN1, poste, referentiel);
    if (!avis)
        return null;
    const fiche = referentiel === 'SYCEBNL' ? 'SYCEBNL, Partie 2 ch. 3, compte 13' : 'AUDCIF, Titre VII, compte 13';
    const comparatif = referentiel === 'SYCEBNL' ? 'SYCEBNL art. 16, 7)' : 'AUDCIF art. 34';
    const sens = referentiel === 'SYCEBNL' ? (avis.montant < 0 ? 'un déficit' : 'un excédent') : avis.montant < 0 ? 'une perte' : 'un bénéfice';
    return {
        ...avis,
        motif: "Colonne N-1 · l'exercice précédent a été clôturé sans le virement du résultat de l'exercice qui le précède, non affecté · " +
            `${sens} de ${MONTANT_FR.format(Math.abs(avis.montant))} restait à son compte 13, et le poste ${poste} de la colonne N-1 ` +
            `l'additionne au résultat de l'exercice précédent, alors que ce résultat antérieur est viré au report à nouveau en fin ` +
            `d'exercice (${fiche}). Rien n'est recalculé · la colonne N-1 reprend le chiffre du poste tel que l'exercice précédent l'a ` +
            `présenté (${comparatif}) ; le dire dans les notes annexes.`,
    };
}
//# sourceMappingURL=resultat-de-l-exercice.js.map