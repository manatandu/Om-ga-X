"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIF_JOUR_AAAA_MM_JJ = void 0;
exports.dateSaisieOuEffacement = dateSaisieOuEffacement;
exports.jourSaisiOuEffacement = jourSaisiOuEffacement;
const common_1 = require("@nestjs/common");
function dateSaisieOuEffacement(valeur) {
    if (valeur === undefined)
        return undefined;
    if (valeur === null)
        return null;
    if (valeur.trim() === '')
        return null;
    const date = new Date(valeur);
    if (Number.isNaN(date.getTime()) || !jourDuCalendrier(valeur)) {
        throw new common_1.BadRequestException('Date illisible ou absente du calendrier · saisir une date au format AAAA-MM-JJ.');
    }
    return date;
}
function jourDuCalendrier(valeur) {
    const tete = /^(\d{4})-(\d{2})-(\d{2})/.exec(valeur);
    if (!tete)
        return true;
    const [annee, mois, jour] = [Number(tete[1]), Number(tete[2]), Number(tete[3])];
    const d = new Date(0);
    d.setUTCFullYear(annee, mois - 1, jour);
    return d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour;
}
exports.MOTIF_JOUR_AAAA_MM_JJ = 'Un jour se déclare au format AAAA-MM-JJ, sans heure ni fuseau · « 2026-10-06T23:30:00Z » est déjà le 7 à ' +
    'Kinshasa, et sa lecture donnait le 6.';
function jourSaisiOuEffacement(valeur) {
    if (valeur === undefined)
        return undefined;
    if (valeur === null || valeur.trim() === '')
        return null;
    const tete = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur.trim());
    if (!tete)
        throw new common_1.BadRequestException(exports.MOTIF_JOUR_AAAA_MM_JJ);
    dateSaisieOuEffacement(valeur.trim());
    const d = new Date(0);
    d.setUTCFullYear(Number(tete[1]), Number(tete[2]) - 1, Number(tete[3]));
    return d;
}
//# sourceMappingURL=date-effacable.js.map