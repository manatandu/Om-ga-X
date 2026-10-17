"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RACINES_EN_COURS = void 0;
exports.estCompteEnCours = estCompteEnCours;
exports.racineEnCours = racineEnCours;
exports.motifSansEnCours = motifSansEnCours;
exports.motifRefusCompteEnCours = motifRefusCompteEnCours;
exports.comptesEnCoursDuBien = comptesEnCoursDuBien;
exports.compteEnCoursPropose = compteEnCoursPropose;
exports.compteInscritALaDate = compteInscritALaDate;
exports.compteInscritChargeALaDate = compteInscritChargeALaDate;
exports.motifRefusTantQueEnCours = motifRefusTantQueEnCours;
exports.RACINES_EN_COURS = {
    SYSCOHADA: { '21': '219', '22': '229', '23': '239', '24': '249' },
    SYCEBNL: { '21': '219', '22': '229', '23': '239', '24': '249' },
};
const SOURCE = {
    SYSCOHADA: 'AUDCIF, Titre VII, fiches des comptes 21 à 24',
    SYCEBNL: 'SYCEBNL, Partie 2 ch. 3, fiches des comptes 21 à 24 (219 et 229 · décision de Manasse du 2026-10-01)',
};
function estCompteEnCours(numero) {
    return /^2[1-4]9/.test(numero);
}
function racineEnCours(referentiel, numeroDefinitif) {
    if (estCompteEnCours(numeroDefinitif))
        return null;
    return exports.RACINES_EN_COURS[referentiel][numeroDefinitif.slice(0, 2)] ?? null;
}
function motifSansEnCours(referentiel, numeroDefinitif) {
    if (estCompteEnCours(numeroDefinitif)) {
        return `Le compte ${numeroDefinitif} est lui-même un compte en cours · choisissez le compte définitif du bien, l'en-cours se choisit à côté.`;
    }
    if (racineEnCours(referentiel, numeroDefinitif))
        return null;
    const division = numeroDefinitif.slice(0, 2);
    return `La division ${division} n'a pas de compte en cours au plan · le bien reste inscrit à son compte définitif.`;
}
function motifRefusCompteEnCours(referentiel, numeroDefinitif, numeroEnCours) {
    const sans = motifSansEnCours(referentiel, numeroDefinitif);
    if (sans)
        return sans;
    const racine = racineEnCours(referentiel, numeroDefinitif);
    if (!numeroEnCours.startsWith(racine)) {
        return (`Le compte ${numeroEnCours} n'est pas un compte en cours de la division ${numeroDefinitif.slice(0, 2)} · ` +
            `un bien porté au ${numeroDefinitif} s'inscrit en cours au ${racine} (${SOURCE[referentiel]}).`);
    }
    return null;
}
function comptesEnCoursDuBien(referentiel, numeroDefinitif, comptesDetail) {
    const racine = racineEnCours(referentiel, numeroDefinitif);
    if (!racine)
        return [];
    return comptesDetail.filter((c) => c.numero.startsWith(racine));
}
function compteEnCoursPropose(referentiel, numeroDefinitif, candidats) {
    if (candidats.length === 1)
        return candidats[0];
    if (referentiel === 'SYCEBNL' && numeroDefinitif.startsWith('24') && /^24[1-8]/.test(numeroDefinitif)) {
        const sousCompte = `249${numeroDefinitif.charAt(2)}`;
        const trouves = candidats.filter((c) => c.numero.startsWith(sousCompte));
        return trouves.length === 1 ? trouves[0] : null;
    }
    return null;
}
function compteInscritALaDate(immo, date) {
    if (!immo.compteEnCoursId)
        return immo.compteImmobilisationId;
    if (immo.dateMiseEnService && date >= immo.dateMiseEnService)
        return immo.compteImmobilisationId;
    return immo.compteEnCoursId;
}
function compteInscritChargeALaDate(immo, date) {
    const id = compteInscritALaDate(immo, date);
    return id !== immo.compteImmobilisationId && immo.compteEnCours ? immo.compteEnCours : immo.compteImmobilisation;
}
function motifRefusTantQueEnCours(immo, date, geste) {
    if (compteInscritALaDate(immo, date) === immo.compteImmobilisationId)
        return null;
    return immo.dateMiseEnService
        ? `Ce bien était encore inscrit en cours à cette date · il n'est mis en service que le ${immo.dateMiseEnService
            .toISOString()
            .slice(0, 10)}, et ${geste} ne peut la précéder.`
        : `Ce bien est encore inscrit en cours · mettez-le en service avant ${geste}.`;
}
//# sourceMappingURL=immobilisation-en-cours.js.map