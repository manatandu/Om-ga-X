"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tauxDegressifLoi = tauxDegressifLoi;
exports.motifRefusModeDegressif = motifRefusModeDegressif;
exports.annuiteDegressive = annuiteDegressive;
exports.motifRefusRevision = motifRefusRevision;
exports.motifRefusRetroactive = motifRefusRetroactive;
const amortissement_degressif_1 = require("./amortissement-degressif");
function tauxDegressifLoi(dureeAns) {
    const coef = (0, amortissement_degressif_1.coefficientDegressif)(dureeAns);
    return coef === null ? null : coef / dureeAns;
}
function motifRefusModeDegressif(o) {
    if (o.referentiel !== 'SYCEBNL') {
        return "Au SYSCOHADA, le dégressif est l'option fiscale de la loi n° 23/053 (art. 31 à 35) · le bien reste au linéaire et le complément passe en amortissement dérogatoire (fenêtre Dégressif fiscal).";
    }
    if (o.numeroCompte.startsWith('21')) {
        return 'Une immobilisation incorporelle ne s\'amortit pas en dégressif · la loi n° 23/053 (art. 32) l\'exclut.';
    }
    if (o.numeroCompte.startsWith('2011')) {
        return "L'usufruit temporaire s'amortit sur la durée de la donation suivant le mode linéaire (SYCEBNL Partie 3 ch. 2 § 2.3).";
    }
    if (o.dureeAns == null || tauxDegressifLoi(o.dureeAns) === null) {
        return 'Le dégressif de la loi n° 23/053 vaut pour une durée de quatre à vingt ans entiers (art. 32 et 33) · hors de ces bornes, la loi ne donne aucun coefficient.';
    }
    return null;
}
function annuiteDegressive(reliquat, taux, anneesRestantes) {
    const lineaire = anneesRestantes <= 1 ? reliquat : reliquat / anneesRestantes;
    return Math.max(reliquat * taux, lineaire);
}
function motifRefusRevision(o) {
    if (!o.enService)
        return 'Le bien est sorti · son plan ne se révise plus.';
    if (o.nonAmortissable)
        return o.nonAmortissable;
    if (o.dureeNonLimitee) {
        return "Ce bien a une durée d'utilité non limitée · quand elle devient limitée, déclarez-le (« Durée limitée »), le plan part alors de la décision.";
    }
    if (o.uniteOeuvre) {
        return "Aux unités d'œuvre, le plan suit le total d'unités prévues, pas une durée en années · la révision de durée ne s'y applique pas.";
    }
    if (o.degressifFiscal) {
        return "Le bien porte l'option dégressive fiscale · réviser le plan comptable changerait le dérogatoire de chaque exercice. Reprenez d'abord le dérogatoire, ou passez la révision à la main.";
    }
    if (!o.debutAmortissement || o.debutAmortissement >= o.ouvertureExercice) {
        return "Le plan n'a encore couru sur aucun exercice clos · une révision ne vise qu'un plan déjà appliqué. La durée d'un bien qui commence s'établit à sa création.";
    }
    if (o.exerciceClos)
        return "La décision tombe dans un exercice clôturé · ses comptes ne s'ouvrent plus. Datez-la dans un exercice ouvert.";
    if (o.dotationDeLExercicePassee) {
        return "La dotation de l'exercice est déjà passée sur ce bien · la révision vaut pour l'exercice en cours, elle se décide avant la dotation.";
    }
    if (!Number.isInteger(o.nouvelleDureeAns) || o.nouvelleDureeAns < 1) {
        return o.nature === 'PROSPECTIVE'
            ? "La durée résiduelle se compte en années entières, une au moins."
            : 'La nouvelle durée du plan se compte en années entières, une au moins.';
    }
    if (o.degressifDureeTotale != null && tauxDegressifLoi(o.degressifDureeTotale) === null) {
        return `La révision porterait le plan à ${o.degressifDureeTotale} ans, hors des quatre à vingt ans où la loi n° 23/053 donne un coefficient (art. 32 et 33) · le dégressif n'aurait plus de taux.`;
    }
    if (!o.motif?.trim()) {
        return "La correction doit être « révélée et quantifiée, de même que les raisons de cette modification » (fiche du compte 28) · dites ce qui a changé.";
    }
    return null;
}
function motifRefusRetroactive(o) {
    if (!o.lineaire) {
        return 'La révision rétroactive rejoue un plan linéaire · pour un autre mode, révisez de façon prospective.';
    }
    if (o.amortissementAnterieur > 0.005 || o.partieDetachee > 0.005) {
        return "Le bien porte un amortissement antérieur à OmegaX ou une partie détachée · le plan passé ne se rejoue pas d'ici. Révisez de façon prospective.";
    }
    if (o.cumulDepreciation > 0.005) {
        return 'Le bien porte une dépréciation · le plan passé ne se rejoue pas sans elle. Révisez de façon prospective.';
    }
    if (!(o.cumulActuel - o.cumulRejoue > 0.005)) {
        return "La nouvelle durée n'abaisse pas le cumul des amortissements · le 798 ne porte qu'une réduction (AUDCIF, fiche du compte 79). Révisez de façon prospective.";
    }
    return null;
}
//# sourceMappingURL=revision-plan-amortissement.js.map