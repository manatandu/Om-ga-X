"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estSystemeMinimal = estSystemeMinimal;
exports.motifRefusDepreciationSmt = motifRefusDepreciationSmt;
exports.motifRefusAmortissementNonLineaireSmt = motifRefusAmortissementNonLineaireSmt;
exports.motifRefusProvisionSmt = motifRefusProvisionSmt;
const client_1 = require("@prisma/client");
function estSystemeMinimal(t) {
    return t.referentiel === client_1.Referentiel.SYCEBNL
        ? t.jeuEtatsFinanciersSycebnl === client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE
        : t.systemeComptableSyscohada === client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE;
}
function sourceModele(referentiel) {
    return referentiel === client_1.Referentiel.SYCEBNL
        ? 'SYCEBNL, Partie 4 ch. 4 (bilan GA à HZ, ligne JG « Dotations aux amortissements »)'
        : 'AUDCIF, Titre X ch. 2 (bilan et compte de résultat du SMT, lettre F « Dotations amortissements »)';
}
function motifRefusDepreciationSmt(t) {
    if (!estSystemeMinimal(t))
        return null;
    return ("Ce dossier tient le Système minimal de trésorerie : son modèle d'états n'ouvre aucun poste de dépréciation, " +
        `et la seule charge calculée qu'il présente est l'amortissement (${sourceModele(t.referentiel)}). ` +
        'Une dépréciation y serait publiée comme un amortissement.');
}
function motifRefusAmortissementNonLineaireSmt(t, objet) {
    if (t.referentiel !== client_1.Referentiel.SYSCOHADA || !estSystemeMinimal(t))
        return null;
    return (`${objet} est refusé à un dossier au Système minimal de trésorerie · AUDCIF Titre X ch. 1 § 1, « chaque ` +
        "immobilisation doit faire l'objet d'un tableau d'amortissement basé sur le mode linéaire sans prorata temporis ».");
}
function motifRefusProvisionSmt(t) {
    if (!estSystemeMinimal(t))
        return null;
    return ("Ce dossier tient le Système minimal de trésorerie : son modèle d'états n'ouvre aucun poste de provision pour " +
        `risques et charges (19), et la seule charge calculée qu'il présente est l'amortissement (${sourceModele(t.referentiel)}). ` +
        'Une provision pour démantèlement y serait publiée sous un poste qui n’est pas le sien.');
}
//# sourceMappingURL=systeme-minimal.js.map