"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.valeurActualiseeDemantelement = valeurActualiseeDemantelement;
exports.motifRefusParametresDemantelement = motifRefusParametresDemantelement;
exports.moisDeDesactualisation = moisDeDesactualisation;
exports.resteADesactualiser = resteADesactualiser;
exports.desactualisationExercice = desactualisationExercice;
exports.motifRefusDesactualisation = motifRefusDesactualisation;
exports.ventilationReprise = ventilationReprise;
exports.motifRefusReprise = motifRefusReprise;
const mois_entre_1 = require("../../common/mois-entre");
const centimes = (x) => Math.round(x * 100) / 100;
function valeurActualiseeDemantelement(coutFutur, tauxPourcent, annees) {
    return centimes(coutFutur * Math.pow(1 + tauxPourcent / 100, -annees));
}
function motifRefusParametresDemantelement(p) {
    const donnes = p.coutFutur != null || p.tauxPourcent != null;
    if (!donnes)
        return null;
    if (!p.estComposantDemantelement) {
        return "Le coût attendu et le taux d'actualisation ne se déclarent que pour un composant démantèlement (AUDCIF Titre VIII ch. 6).";
    }
    if (p.tauxPourcent == null) {
        return "Indiquez le taux d'actualisation avec le coût attendu · sans lui, la provision n'est pas actualisée et rien n'est à désactualiser (§ 2.3).";
    }
    if (p.coutFutur != null && p.valeurOrigine - p.coutFutur > 0.005) {
        return "La valeur d'entrée du composant dépasse le coût attendu au terme · une provision actualisée ne peut pas l'excéder (§ 2.3).";
    }
    return null;
}
function moisDeDesactualisation(exercice, dateEntree, arreteAu) {
    const debut = dateEntree > exercice.dateDebut ? dateEntree : exercice.dateDebut;
    const fin = arreteAu && arreteAu < exercice.dateFin ? arreteAu : exercice.dateFin;
    return Math.max(0, (0, mois_entre_1.moisEntre)(debut, fin));
}
function resteADesactualiser(p) {
    if (p.tauxPourcent == null || !(p.tauxPourcent > 0))
        return false;
    return !(p.coutFutur != null && p.provision >= p.coutFutur - 0.005);
}
const MOTIF_COMPOSANT_REPRIS = "Composant repris au bilan d'ouverture · la provision 1984 vient de l'à-nouveau, et le module ne connaît ni la part " +
    "intégrée au coût ni les désactualisations passées avant la reprise du dossier. Passez sa désactualisation et sa reprise " +
    'par une écriture ordinaire (D 6971 / C 1984 ; D 1984 / C 7911 et C 7971 · AUDCIF Titre VIII ch. 6 § 2.3 et § 4).';
function desactualisationExercice(p) {
    if (p.mois <= 0 || p.provisionOuverture <= 0)
        return 0;
    let d = p.provisionOuverture * (Math.pow(1 + p.tauxPourcent / 100, p.mois / 12) - 1);
    if (p.coutFutur != null)
        d = Math.min(d, Math.max(0, p.coutFutur - p.provisionOuverture));
    return centimes(d);
}
function motifRefusDesactualisation(e) {
    if (!e.estComposantDemantelement)
        return "Seul un composant démantèlement porte une provision à désactualiser (AUDCIF Titre VIII ch. 6).";
    if (e.refusSystemeMinimal)
        return e.refusSystemeMinimal;
    if (e.repris)
        return MOTIF_COMPOSANT_REPRIS;
    if (!e.entreParLaProvision) {
        return "Ce composant n'est pas entré par le crédit du 1984 · aucune provision pour démantèlement n'est rattachée à lui (§ 2.1).";
    }
    if (e.tauxPourcent == null)
        return "Aucun taux d'actualisation déclaré sur le composant · la provision n'est pas actualisée, rien à désactualiser (§ 2.3).";
    if (!e.exerciceOuvert)
        return 'Exercice clôturé · aucune écriture ne peut y entrer (AUDCIF art. 20).';
    if (e.repriseFaite)
        return "La provision a été reprise · l'obligation est éteinte, plus rien ne se désactualise (§ 4).";
    if (!e.enService)
        return "Le bien est sorti · reprenez la provision (§ 4.2), elle ne se désactualise plus.";
    if (e.dejaPassee)
        return 'La désactualisation de cet exercice est déjà passée.';
    if (e.mois <= 0)
        return "Le composant est entré après la fin de cet exercice · rien n'y court.";
    if (e.exercicesManquants.length) {
        return (`Désactualisation non passée pour ${e.exercicesManquants.join(', ')} · passez-la d'abord, dans l'ordre ; ` +
            "la provision d'ouverture de cet exercice serait sinon trop faible.");
    }
    return null;
}
function ventilationReprise(provisionInitiale, desactualisations) {
    const exploitation = centimes(provisionInitiale);
    const financiere = centimes(desactualisations.reduce((s, d) => s + d, 0));
    return { exploitation, financiere, total: centimes(exploitation + financiere) };
}
function motifRefusReprise(e) {
    if (!e.estComposantDemantelement)
        return "Seul un composant démantèlement porte une provision à reprendre (AUDCIF Titre VIII ch. 6).";
    if (e.repris)
        return MOTIF_COMPOSANT_REPRIS;
    if (!e.entreParLaProvision) {
        return "Ce composant n'est pas entré par le crédit du 1984 · aucune provision pour démantèlement n'est rattachée à lui (§ 2.1).";
    }
    if (!e.exerciceOuvert)
        return 'Exercice clôturé · aucune écriture ne peut y entrer (AUDCIF art. 20).';
    if (e.repriseFaite)
        return 'La provision de ce composant a déjà été reprise.';
    if (!e.dateDansExercice)
        return "La date de la reprise doit tomber dans l'exercice choisi.";
    if (e.exercicesManquants?.length) {
        return (`Désactualisation non passée pour ${e.exercicesManquants.join(', ')} · passez-la d'abord, dans l'ordre ; ` +
            'reprise sans elle, la provision serait soldée trop faible et la charge financière courue jamais constatée (§ 2.3).');
    }
    if (e.desactualiseeJusquAu) {
        return (`La désactualisation de cet exercice est déjà passée jusqu'au ${e.desactualiseeJusquAu}, après la date de reprise · ` +
            "elle courrait au-delà de l'extinction de l'obligation. La reprise ne peut précéder cette date.");
    }
    return null;
}
//# sourceMappingURL=demantelement.js.map