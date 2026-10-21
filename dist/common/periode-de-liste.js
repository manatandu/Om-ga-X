"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lirePeriodeDeListe = lirePeriodeDeListe;
const common_1 = require("@nestjs/common");
const FORMAT_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
function lireJour(valeur, nom) {
    const m = FORMAT_JOUR.exec(valeur);
    const jour = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
    if (!jour || jour.toISOString().slice(0, 10) !== valeur) {
        throw new common_1.BadRequestException(`Date « ${nom} » illisible : « ${valeur} » (AAAA-MM-JJ attendu).`);
    }
    return jour;
}
function lirePeriodeDeListe(filtre = {}) {
    const du = filtre.du ? lireJour(filtre.du, 'du') : null;
    const au = filtre.au ? lireJour(filtre.au, 'au') : null;
    if (du && au && du.getTime() > au.getTime()) {
        throw new common_1.BadRequestException('La date de début de la période dépasse sa date de fin.');
    }
    const lendemainDeAu = au ? new Date(au.getTime() + 24 * 60 * 60 * 1000) : null;
    return {
        du: du ? filtre.du : null,
        au: au ? filtre.au : null,
        bornes: du || lendemainDeAu ? { ...(du ? { gte: du } : {}), ...(lendemainDeAu ? { lt: lendemainDeAu } : {}) } : undefined,
    };
}
//# sourceMappingURL=periode-de-liste.js.map