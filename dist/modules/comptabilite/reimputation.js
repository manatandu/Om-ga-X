"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusLigne = motifRefusLigne;
exports.lignesDeReimputation = lignesDeReimputation;
exports.motifRefusFusionComptes = motifRefusFusionComptes;
exports.dateDansExercice = dateDansExercice;
const ligne_lettree_1 = require("../lettrage/ligne-lettree");
function motifRefusLigne(l, compteCibleId) {
    const q = `La ligne du ${l.compteNumero}`;
    if (l.compteId === compteCibleId)
        return `${q} est déjà sur le compte cible.`;
    if (l.exerciceClos) {
        return `${q} appartient à un exercice clôturé · une erreur d'un exercice antérieur se corrige par le report à nouveau (AUDCIF art. 20, al. 3).`;
    }
    if (l.estGenereeParCloture) {
        return `${q} vient de la clôture (report à-nouveau) · la réimputer désaccorderait le bilan d'ouverture.`;
    }
    if (l.tenueParImmobilisation) {
        return `${q} porte une immobilisation · la réimputer laisserait la fiche et son plan d'amortissement sans écriture en face. Passez par le module Immobilisations.`;
    }
    if ((0, ligne_lettree_1.estTenueParUnLettrage)(l))
        return `${q} est lettrée (${(0, ligne_lettree_1.designationLettrage)(l)}) · délettrez-la d'abord.`;
    if (l.rapprochementId)
        return `${q} est pointée dans un rapprochement bancaire · dépointez-la d'abord.`;
    if (l.tauxTvaId) {
        return `${q} porte un taux de TVA · la déplacer changerait la déclaration. Corrigez la pièce entière (inscription en négatif).`;
    }
    return null;
}
function lignesDeReimputation(l, compteCibleId) {
    return [
        { compteId: l.compteId, debit: -l.debit, credit: -l.credit, signeAnalytique: -1 },
        { compteId: compteCibleId, debit: l.debit, credit: l.credit, signeAnalytique: 1 },
    ];
}
function motifRefusFusionComptes(source, cible) {
    if (source.id === cible.id)
        return 'Un compte ne se fusionne pas avec lui-même.';
    if (source.typeCompte !== 'DETAIL' || cible.typeCompte !== 'DETAIL') {
        return 'Seuls deux comptes de détail se fusionnent · un compte Total ne porte aucune écriture.';
    }
    if (source.classe !== cible.classe) {
        return (`${source.numero} et ${cible.numero} ne sont pas de la même classe · une fusion réunit deux comptes de même ` +
            "nature. Déplacer des lignes d'une classe à l'autre est une réimputation, ligne par ligne, depuis le journal.");
    }
    if (!cible.estActif)
        return `Le ${cible.numero} est en sommeil · réactivez-le avant d'y fusionner.`;
    return null;
}
function dateDansExercice(aujourdhui, exercice) {
    if (aujourdhui < exercice.dateDebut)
        return exercice.dateDebut;
    if (aujourdhui > exercice.dateFin)
        return exercice.dateFin;
    return aujourdhui;
}
//# sourceMappingURL=reimputation.js.map