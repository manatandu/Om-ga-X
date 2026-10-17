"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jourFr = jourFr;
exports.veilleDe = veilleDe;
exports.libellePeriode = libellePeriode;
exports.motifPeriodeHorsExercice = motifPeriodeHorsExercice;
exports.periodeDeLExtrait = periodeDeLExtrait;
exports.ecrituresAvantLaPeriode = ecrituresAvantLaPeriode;
exports.ecrituresDansLaPeriode = ecrituresDansLaPeriode;
exports.periodeServie = periodeServie;
const common_1 = require("@nestjs/common");
const echeance_1 = require("../../common/echeance");
const periode_de_liste_1 = require("../../common/periode-de-liste");
const UN_JOUR_MS = 24 * 60 * 60 * 1000;
function jourFr(d) {
    return d.toISOString().slice(0, 10).split('-').reverse().join('/');
}
function veilleDe(d) {
    return new Date((0, echeance_1.jourUtc)(d).getTime() - UN_JOUR_MS);
}
function libellePeriode(p) {
    return `du ${jourFr(p.du)} au ${jourFr(p.au)}`;
}
function motifPeriodeHorsExercice(exercice) {
    return (`La période doit tenir dans l'exercice, ${libellePeriode({ du: exercice.dateDebut, au: exercice.dateFin })} · ` +
        "à cheval sur deux exercices, l'à-nouveau du second porterait une seconde fois ce que le premier a déjà " +
        "mouvementé. Choisissez l'exercice de la période, puis ses dates.");
}
function periodeDeLExtrait(exercice, demande) {
    const lue = (0, periode_de_liste_1.lirePeriodeDeListe)({ du: demande.du, au: demande.au });
    if (lue.du === null && lue.au === null)
        return null;
    const debut = (0, echeance_1.jourUtc)(exercice.dateDebut);
    const fin = (0, echeance_1.jourUtc)(exercice.dateFin);
    const du = lue.du !== null ? new Date(`${lue.du}T00:00:00.000Z`) : debut;
    const au = lue.au !== null ? new Date(`${lue.au}T00:00:00.000Z`) : fin;
    if (du.getTime() < debut.getTime() || au.getTime() > fin.getTime() || du.getTime() > fin.getTime() || au.getTime() < debut.getTime()) {
        throw new common_1.BadRequestException(motifPeriodeHorsExercice(exercice));
    }
    if (du.getTime() > au.getTime()) {
        throw new common_1.BadRequestException('La date de début de la période dépasse sa date de fin.');
    }
    if (du.getTime() === debut.getTime() && au.getTime() === fin.getTime())
        return null;
    return { du, au, finExclue: new Date(au.getTime() + UN_JOUR_MS), finExercice: fin };
}
function ecrituresAvantLaPeriode(p) {
    const ouverture = ouvertureDuPremierJour(p);
    return ouverture ? { OR: [{ date: { lt: p.du } }, ouverture] } : { date: { lt: p.du } };
}
function ecrituresDansLaPeriode(p) {
    const dates = { date: { gte: p.du, lt: p.finExclue } };
    if (!ouvertureDuPremierJour(p))
        return dates;
    const lendemain = new Date(p.du.getTime() + UN_JOUR_MS);
    return { AND: [dates, { OR: [{ date: { gte: lendemain } }, { estGenereeParCloture: false }, { estSoldeDesComptesDeGestion: true }] }] };
}
function ouvertureDuPremierJour(p) {
    if (p.du.getTime() >= (0, echeance_1.jourUtc)(p.finExercice).getTime())
        return null;
    const lendemain = new Date(p.du.getTime() + UN_JOUR_MS);
    return { estGenereeParCloture: true, estSoldeDesComptesDeGestion: false, date: { gte: p.du, lt: lendemain } };
}
function periodeServie(p) {
    return p ? { du: p.du.toISOString().slice(0, 10), au: p.au.toISOString().slice(0, 10) } : null;
}
//# sourceMappingURL=periode-extrait.js.map