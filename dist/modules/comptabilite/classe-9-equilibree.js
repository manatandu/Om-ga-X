"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RACINES_HORS_BILAN = void 0;
exports.ecartClasse9 = ecartClasse9;
exports.motifRefusClasse9 = motifRefusClasse9;
const client_1 = require("@prisma/client");
exports.RACINES_HORS_BILAN = ['90', '91'];
function ecartClasse9(lignes) {
    const ecart = lignes
        .filter((l) => exports.RACINES_HORS_BILAN.some((r) => l.numero.startsWith(r)))
        .reduce((s, l) => s + (l.debit ?? 0) - (l.credit ?? 0), 0);
    return Math.abs(ecart) > 0.005 ? Math.round(ecart * 100) / 100 : 0;
}
function motifRefusClasse9(referentiel, ecart) {
    if (ecart === 0)
        return null;
    const texte = referentiel === client_1.Referentiel.SYSCOHADA
        ? "AUDCIF, Titre VII, classe 9 · les 901 à 904 ont pour contrepartie les 911 à 914, les 905 à 908 les 915 à 918"
        : 'SYCEBNL, Partie 2 ch. 1 et ch. 3, classe 9 · les contributions volontaires en nature « ne doi[vent] pas ' +
            'impacter le bilan et le compte de résultat », les 900 à 904 se débitant par le crédit des 910 à 914';
    return (`Les lignes sur les comptes 90 et 91 ne s'équilibrent pas entre elles (écart ${ecart.toFixed(2)}) · la ` +
        `classe 9 ne se solde pas contre un compte des classes 1 à 8. ${texte}.`);
}
//# sourceMappingURL=classe-9-equilibree.js.map