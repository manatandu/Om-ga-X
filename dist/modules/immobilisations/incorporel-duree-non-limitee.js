"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estFondsCommercial = exports.MOTIF_NON_AMORTI = exports.JUSTIFICATION_PRESUMEE_FONDS_COMMERCIAL = exports.INCORPORELS_TOUJOURS_AMORTIS = void 0;
exports.motifRefusDureeNonLimitee = motifRefusDureeNonLimitee;
exports.motifRefusDureeDixAns = motifRefusDureeDixAns;
exports.motifRefusBascule = motifRefusBascule;
exports.debutAmortissement = debutAmortissement;
exports.INCORPORELS_TOUJOURS_AMORTIS = [
    { racine: '211', motif: "Les frais de développement s'amortissent sur leur durée d'utilisation (AUDCIF Titre VIII ch. 1 § 2.2.2)." },
    { racine: '2121', motif: 'Un brevet bénéficie d\'une protection juridique, sa durée est déterminable · « les brevets sont amortissables » (ch. 2 § 1.1.3).' },
    { racine: '2122', motif: "Une licence s'amortit sur sa durée probable d'utilisation, qui « ne peut excéder la durée de l'autorisation » (ch. 2 § 1.2.3)." },
    { racine: '2131', motif: "Un logiciel se répartit « sur sa durée probable d'utilisation, selon un plan d'amortissement » (ch. 2 § 2.4)." },
    { racine: '216', motif: 'Le droit au bail « doit être amorti sur la durée du bail » (ch. 2 § 5.1).' },
    { racine: '2182', motif: 'Les coûts d\'obtention du contrat sont « amortis sur une base systématique » (ch. 2 § 8).' },
];
const MOTIF_SITE_INTERNET = "Un site internet s'amortit sur sa « durée réelle d'utilisation, en principe courte » (ch. 2 § 3.2.2 c) · seul le nom de domaine, dont l'usage n'est pas limité dans le temps, ne s'amortit pas. Déclarez-le comme nom de domaine.";
exports.JUSTIFICATION_PRESUMEE_FONDS_COMMERCIAL = 'Fonds commercial · durée d\'utilité présumée non limitée (AUDCIF Titre VIII ch. 2 § 7.2.2.1).';
exports.MOTIF_NON_AMORTI = "Durée d'utilité non limitée · l'incorporel n'est pas amorti tant que sa durée n'a pas de fin prévisible (AUDCIF Titre VIII ch. 2 § 4.2.2). La dépréciation reste ouverte ; quand la durée devient limitée, déclarez-le.";
const estFondsCommercial = (numero) => numero.startsWith('215');
exports.estFondsCommercial = estFondsCommercial;
function motifRefusDureeNonLimitee(o) {
    if (o.referentiel !== 'SYSCOHADA') {
        return "La durée d'utilité non limitée vient du Titre VIII de l'AUDCIF (ch. 2) · le SYCEBNL n'en écrit aucune, l'incorporel s'y amortit sur sa durée d'utilité.";
    }
    if (!o.numeroCompte.startsWith('21')) {
        return "Seule une immobilisation incorporelle (21) peut avoir une durée d'utilité non limitée · un bien corporel s'amortit, ou ne s'amortit pas selon son compte (terrain).";
    }
    if (o.numeroCompte.startsWith('219')) {
        return "Une immobilisation incorporelle en cours n'est pas encore en service · sa durée d'utilité se déclare à l'achèvement.";
    }
    const exclu = exports.INCORPORELS_TOUJOURS_AMORTIS.find((e) => o.numeroCompte.startsWith(e.racine));
    if (exclu)
        return exclu.motif;
    if (o.numeroCompte.startsWith('2132') && !o.nomDeDomaine)
        return MOTIF_SITE_INTERNET;
    if (!(0, exports.estFondsCommercial)(o.numeroCompte) && !o.justification?.trim()) {
        return "Démontrez que l'incorporel n'a pas de fin prévisible et que ses avantages économiques devraient perdurer (AUDCIF Titre VIII ch. 2 § 4.2.2) · la justification est exigée.";
    }
    return null;
}
function motifRefusDureeDixAns(o) {
    if (!(0, exports.estFondsCommercial)(o.numeroCompte)) {
        return 'Les dix ans du § 7.2.2.1 ne visent que le fonds commercial (215).';
    }
    if (o.dureeAns !== 10)
        return 'Ce fondement fixe la durée à dix ans · « le dixième de la base amortissable » (ch. 2 § 7.2.2.1).';
    if (o.fondement === 'SIMPLIFICATION_SMT' && !o.systemeMinimal) {
        return 'La simplification des dix ans est ouverte aux « petites entités assujetties au Système minimal de trésorerie » (ch. 2 § 7.2.2.1) · ce dossier tient le Système normal.';
    }
    return null;
}
function motifRefusBascule(o) {
    if (!o.dureeNonLimitee)
        return "La durée d'utilité de ce bien est déjà limitée · elle se révise, elle ne bascule pas.";
    if (!o.enService)
        return 'Le bien est sorti · sa durée ne se déclare plus.';
    if (!o.debutPossible)
        return "Le bien n'est pas encore mis en service · la durée se déclare avec la mise en service.";
    if (o.dateDecision < o.debutPossible)
        return 'La décision précède la mise en service du bien.';
    if (!(o.dureeResiduelleAns >= 1))
        return "La durée d'utilité résiduelle se compte en années entières, une au moins.";
    if (!o.motif?.trim())
        return "Dites ce qui rend la durée limitée (décision d'arrêter, contrat, autorisation) · AUDCIF Titre VIII ch. 2 § 7.2.2.1.";
    if (!o.testDepreciation?.trim()) {
        return "« Un test de dépréciation est réalisé » à la date du changement d'estimation (ch. 2 § 4.2.2) · indiquez son résultat, et passez d'abord la dépréciation s'il y en a une.";
    }
    return null;
}
function debutAmortissement(i) {
    return i.dateDebutAmortissement ?? i.dateMiseEnService;
}
//# sourceMappingURL=incorporel-duree-non-limitee.js.map