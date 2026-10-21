"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RACINE_DETTE_RESERVE_PROPRIETE = void 0;
exports.contrepartieAReserveDePropriete = contrepartieAReserveDePropriete;
exports.motifRefusReserveDePropriete = motifRefusReserveDePropriete;
exports.frappeDeReserveALaDate = frappeDeReserveALaDate;
exports.motifRefusReserveSurExerciceClos = motifRefusReserveSurExerciceClos;
exports.sourceReserveDePropriete = sourceReserveDePropriete;
const client_1 = require("@prisma/client");
exports.RACINE_DETTE_RESERVE_PROPRIETE = '4816';
function contrepartieAReserveDePropriete(numeroContrepartie) {
    return !!numeroContrepartie && numeroContrepartie.startsWith(exports.RACINE_DETTE_RESERVE_PROPRIETE);
}
function motifRefusReserveDePropriete(e) {
    if (!e.reserveDePropriete) {
        if (contrepartieAReserveDePropriete(e.numeroContrepartie)) {
            return (`La dette d'acquisition est portée au ${e.numeroContrepartie} « Réserve de propriété » · la fiche ne peut pas ` +
                "dire que le bien n'est pas frappé de la clause. Déclarez plutôt la date du règlement final.");
        }
        if (e.leveeLe)
            return 'Une date de règlement final ne se déclare que pour un bien frappé de la clause.';
        return null;
    }
    if (e.leveeLe && e.leveeLe < e.dateAcquisition) {
        return "Le règlement final ne peut pas précéder l'acquisition du bien.";
    }
    return null;
}
function frappeDeReserveALaDate(immo, date) {
    if (!immo.reserveDePropriete)
        return false;
    if (immo.dateAcquisition > date)
        return false;
    if (immo.dateSortie && immo.dateSortie <= date)
        return false;
    if (immo.reserveProprieteLeveeLe && immo.reserveProprieteLeveeLe <= date)
        return false;
    return true;
}
function motifRefusReserveSurExerciceClos(avant, apres, exercicesClos) {
    const nouveau = { ...avant, ...apres };
    const touche = exercicesClos.find((e) => frappeDeReserveALaDate(avant, e.dateFin) !== frappeDeReserveALaDate(nouveau, e.dateFin));
    if (!touche)
        return null;
    return (`L'exercice clos le ${touche.dateFin.toISOString().slice(0, 10)} verrait sa liste des biens sous réserve de ` +
        'propriété changée · la clause et la date du règlement final ne se déclarent que sur ce que voient les ' +
        'exercices encore ouverts.');
}
function sourceReserveDePropriete(referentiel) {
    return referentiel === client_1.Referentiel.SYSCOHADA
        ? 'AUDCIF, Titre VIII ch. 9 § 3 (Notes annexes)'
        : 'SYCEBNL, cadre conceptuel § 3.3.1.1.6 (information, le texte n’écrit pas la note)';
}
//# sourceMappingURL=reserve-propriete.js.map