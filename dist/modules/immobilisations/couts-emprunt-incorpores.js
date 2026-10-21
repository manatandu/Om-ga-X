"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compteCreditIncorporation = compteCreditIncorporation;
exports.montantIncorporable = montantIncorporable;
exports.motifRefusIncorporation = motifRefusIncorporation;
exports.motifRefusMiseEnServiceAvantIncorporation = motifRefusMiseEnServiceAvantIncorporation;
exports.motifRefusPlafond = motifRefusPlafond;
const mois_entre_1 = require("../../common/mois-entre");
const EPSILON = 0.005;
const centimes = (x) => Math.round(x * 100) / 100;
function compteCreditIncorporation(referentiel, numeroBien) {
    if (referentiel === 'SYCEBNL')
        return '78700000';
    if (numeroBien.startsWith('21'))
        return '72100000';
    return numeroBien.startsWith('246') ? '72220000' : '72210000';
}
function montantIncorporable(o) {
    return centimes((o.base * o.tauxPourcent) / 100 * (o.mois / 12) - o.produitsPlacement);
}
function motifRefusIncorporation(o) {
    if (!o.enService)
        return 'Le bien est sorti · aucun coût ne s’incorpore plus à son coût.';
    if (!/^2[1-4]/.test(o.numeroBien)) {
        return 'Seule une immobilisation incorporelle ou corporelle (21 à 24) peut être un actif qualifié · ni les avances, ni les titres, ni les prêts et autres créances (AUDCIF Titre VIII ch. 7 § 1.2).';
    }
    if (o.referentiel === 'SYCEBNL' && o.nature === 'GENERAL') {
        return "Le SYCEBNL ne capitalise que les frais des emprunts « exclusivement affectés au financement de la fabrication » (fiche du compte 72) · la voie des emprunts généraux ne s'y applique pas.";
    }
    if (o.aDesDotations) {
        return "Le bien est déjà amorti · l'incorporation cesse quand l'actif est prêt à être utilisé (AUDCIF Titre VIII ch. 7 § 2.2.3).";
    }
    if (!(o.finPreparation > o.debutPreparation))
        return 'La fin de la préparation de l’actif suit son début.';
    if ((0, mois_entre_1.moisEntre)(o.debutPreparation, o.finPreparation) < 12 && !(o.justificationPeriodeCourte && o.justificationPeriodeCourte.trim().length >= 3)) {
        return "Une préparation de moins de douze mois ne fait un actif qualifié que si l'entité la juge significative, et elle doit le justifier aux Notes annexes (AUDCIF Titre VIII ch. 7 § 1.2) · écrivez la justification.";
    }
    if (o.dateFin < o.dateDebut)
        return 'La fin de la période d’incorporation suit son début.';
    if (o.dateDebut < o.exercice.dateDebut || o.dateFin > o.exercice.dateFin) {
        return "La période d'incorporation se lit dans l'exercice · un exercice suivant porte sa propre incorporation.";
    }
    if (o.dateDebut < o.debutPreparation || o.dateFin > o.finPreparation) {
        return "L'incorporation ne court que pendant la préparation de l'actif · elle commence avec les travaux et cesse quand ils sont pratiquement terminés (AUDCIF Titre VIII ch. 7 § 2.2).";
    }
    if (o.dateMiseEnService && o.dateFin > o.dateMiseEnService) {
        return "L'incorporation cesse à la mise en service · l'actif est alors prêt à être utilisé (AUDCIF Titre VIII ch. 7 § 2.2.3).";
    }
    if (!(o.base > 0)) {
        return o.nature === 'SPECIFIQUE' ? 'Indiquez le capital de l’emprunt spécifique.' : 'Indiquez les dépenses relatives à l’actif, nettes des acomptes et subventions reçus.';
    }
    if (!(o.tauxPourcent > 0) || o.tauxPourcent > 100) {
        return o.nature === 'SPECIFIQUE' ? "Le taux de l'emprunt est compris entre 0 et 100 %." : 'Le taux de capitalisation est compris entre 0 et 100 %.';
    }
    if (o.produitsPlacement < 0)
        return 'Les produits du placement temporaire ne sont pas négatifs.';
    if (o.nature === 'GENERAL' && o.produitsPlacement > EPSILON) {
        return 'Les produits de placement ne se déduisent que des fonds empruntés spécifiquement (AUDCIF Titre VIII ch. 7 § 2.1).';
    }
    const montant = montantIncorporable({ base: o.base, tauxPourcent: o.tauxPourcent, mois: (0, mois_entre_1.moisEntre)(o.dateDebut, o.dateFin), produitsPlacement: o.produitsPlacement });
    if (!(montant > EPSILON))
        return 'Les produits du placement couvrent les coûts de la période · rien ne s’incorpore.';
    return null;
}
function motifRefusMiseEnServiceAvantIncorporation(dateMiseEnService, finDerniereIncorporation) {
    if (!finDerniereIncorporation || !(dateMiseEnService < finDerniereIncorporation))
        return null;
    return (`Des coûts d'emprunt sont incorporés à ce bien jusqu'au ${finDerniereIncorporation.toISOString().slice(0, 10)} · ` +
        "l'incorporation cesse quand l'actif est prêt à être utilisé (AUDCIF Titre VIII ch. 7 § 2.2.3), la mise en service ne peut donc pas la précéder.");
}
function motifRefusPlafond(o) {
    const reste = centimes(o.coutsSupportes - o.dejaIncorpores);
    if (o.montant > reste + EPSILON) {
        return (`Les coûts incorporés de l'exercice (${centimes(o.dejaIncorpores + o.montant).toFixed(2)}) dépasseraient les coûts d'emprunt supportés au cours de l'exercice ` +
            `(${centimes(o.coutsSupportes).toFixed(2)}, intérêts des emprunts et de location-acquisition au journal) · AUDCIF Titre VIII ch. 7 § 2.1. ` +
            'Passez d’abord les intérêts au 671 ou au 672.');
    }
    return null;
}
//# sourceMappingURL=couts-emprunt-incorpores.js.map