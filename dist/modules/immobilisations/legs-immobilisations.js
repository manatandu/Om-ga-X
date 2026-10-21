"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repartirDettesLegs = repartirDettesLegs;
exports.motifRefusLegs = motifRefusLegs;
const centimes = (x) => Math.round(x * 100) / 100;
function repartirDettesLegs(valeurs, dettes) {
    const total = valeurs.reduce((t, v) => t + v, 0);
    let reparti = 0;
    return valeurs.map((v, i) => {
        const part = i === valeurs.length - 1 ? centimes(dettes - reparti) : total > 0 ? centimes((dettes * v) / total) : 0;
        reparti = centimes(reparti + part);
        return part;
    });
}
function motifRefusLegs(o) {
    if (o.referentiel !== 'SYCEBNL') {
        return "Le legs d'immobilisations au 167 et au 4861 est propre au SYCEBNL (Partie 3 ch. 2 § 1.2.2) · au SYSCOHADA, le 167 et le 486 n'ont pas ce sens.";
    }
    if (!o.numeroFonds.startsWith('167') || o.numeroFonds.startsWith('1679')) {
        return "Le fonds d'un legs à conserver est un 167 « Fonds provenant des dons et legs d'immobilisations » · le 1679 porte l'engagement auprès du donateur, pas le fonds reçu (SYCEBNL Partie 3 ch. 2 § 1.2.2).";
    }
    if (o.valeurs.length === 0)
        return "Un legs d'immobilisations porte au moins un bien.";
    if (o.valeurs.some((v) => !(v > 0)))
        return "Chaque bien du legs a une valeur d'entrée positive.";
    if (o.dettes < 0)
        return 'Les dettes du legs ne sont pas négatives.';
    if (o.dettes > 0) {
        if (!o.numeroDettes || !o.numeroDettes.startsWith('4861')) {
            return 'Les dettes reprises avec le legs vont au 4861 « Dettes des dons et legs d\'immobilisations » (SYCEBNL Partie 3 ch. 2 § 1.2.2).';
        }
        const total = o.valeurs.reduce((t, v) => t + v, 0);
        if (centimes(o.dettes) >= centimes(total)) {
            return "Les dettes égalent ou dépassent la valeur des biens · l'actif net reçu n'est pas positif, et le 167 n'aurait rien à porter.";
        }
    }
    return null;
}
//# sourceMappingURL=legs-immobilisations.js.map