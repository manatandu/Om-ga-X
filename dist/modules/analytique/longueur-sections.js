"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleveLongueurs = exports.SECTIONS_NOMMEES_AU_PLUS = exports.LONGUEUR_SECTIONS_MAX = exports.LONGUEUR_SECTIONS_MIN = void 0;
exports.longueurDuCode = longueurDuCode;
exports.motifRefusBornesLongueur = motifRefusBornesLongueur;
exports.ecartALaLongueur = ecartALaLongueur;
exports.motifRefusCodeSection = motifRefusCodeSection;
exports.motifRefusLongueurSections = motifRefusLongueurSections;
const client_1 = require("@prisma/client");
exports.LONGUEUR_SECTIONS_MIN = 2;
exports.LONGUEUR_SECTIONS_MAX = 13;
exports.SECTIONS_NOMMEES_AU_PLUS = 20;
function longueurDuCode(code) {
    return Array.from(code).length;
}
function motifRefusBornesLongueur(longueur) {
    if (!Number.isInteger(longueur) || longueur < exports.LONGUEUR_SECTIONS_MIN || longueur > exports.LONGUEUR_SECTIONS_MAX) {
        return `La longueur des codes de section va de ${exports.LONGUEUR_SECTIONS_MIN} à ${exports.LONGUEUR_SECTIONS_MAX} caractères.`;
    }
    return null;
}
function ecartALaLongueur(section, longueur) {
    const n = longueurDuCode(section.code);
    if (section.type === client_1.TypeCompteDetailTotal.TOTAL) {
        return n < longueur ? null : `rubrique de ${n} caractère${n > 1 ? 's' : ''}, qui doit être plus courte que ${longueur}`;
    }
    return n === longueur ? null : `section Détail de ${n} caractère${n > 1 ? 's' : ''} au lieu de ${longueur}`;
}
function motifRefusCodeSection(section, longueur) {
    if (longueur === null)
        return null;
    const ecart = ecartALaLongueur(section, longueur);
    if (!ecart)
        return null;
    return section.type === client_1.TypeCompteDetailTotal.TOTAL
        ? `Le code ${section.code} est une ${ecart} · dans ce plan, les codes des sections Détail font ${longueur} caractères, et une rubrique ne regroupe que des codes plus longs qu'elle.`
        : `Le code ${section.code} est une ${ecart} · dans ce plan, les codes des sections Détail font exactement ${longueur} caractères.`;
}
class ReleveLongueurs {
    constructor(longueur) {
        this.longueur = longueur;
        this.horsLongueur = [];
        this.nombreHorsLongueur = 0;
        this.nombreSections = 0;
        this.longueursDetail = new Set();
        this.longueurTotalMax = 0;
    }
    ajouter(section) {
        this.nombreSections++;
        const n = longueurDuCode(section.code);
        if (section.type === client_1.TypeCompteDetailTotal.TOTAL)
            this.longueurTotalMax = Math.max(this.longueurTotalMax, n);
        else
            this.longueursDetail.add(n);
        if (this.longueur === null)
            return;
        const ecart = ecartALaLongueur(section, this.longueur);
        if (!ecart)
            return;
        this.nombreHorsLongueur++;
        if (this.horsLongueur.length < exports.SECTIONS_NOMMEES_AU_PLUS)
            this.horsLongueur.push({ code: section.code, type: section.type, ecart });
    }
    get proposee() {
        if (this.longueursDetail.size !== 1)
            return null;
        const [n] = [...this.longueursDetail];
        if (n < exports.LONGUEUR_SECTIONS_MIN || n > exports.LONGUEUR_SECTIONS_MAX || this.longueurTotalMax >= n)
            return null;
        return n;
    }
}
exports.ReleveLongueurs = ReleveLongueurs;
function motifRefusLongueurSections(planCode, longueur, releve) {
    if (longueur === null)
        return null;
    const bornes = motifRefusBornesLongueur(longueur);
    if (bornes)
        return bornes;
    if (releve.nombreHorsLongueur === 0)
        return null;
    const noms = releve.horsLongueur.map((s) => `${s.code} (${s.ecart})`).join(', ');
    const reste = releve.nombreHorsLongueur - releve.horsLongueur.length;
    return (`Le plan ${planCode} ne peut pas passer à des codes de ${longueur} caractères · ` +
        `${releve.nombreHorsLongueur} section${releve.nombreHorsLongueur > 1 ? 's' : ''} ne la respecte${releve.nombreHorsLongueur > 1 ? 'nt' : ''} pas : ${noms}` +
        (reste > 0 ? `, et ${reste} autre${reste > 1 ? 's' : ''}` : '') +
        '. Aucun code n’est renuméroté · retirez les sections qui ne servent pas, ou gardez le plan en longueur libre.');
}
//# sourceMappingURL=longueur-sections.js.map