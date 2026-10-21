"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZERO = void 0;
exports.depuisNombre = depuisNombre;
exports.exact = exact;
exports.plus = plus;
exports.moins = moins;
exports.somme = somme;
exports.fois = fois;
exports.pourCent = pourCent;
exports.foisEntier = foisEntier;
exports.comparer = comparer;
exports.maximum = maximum;
exports.plancherAuMultiple = plancherAuMultiple;
exports.centimesLoinDeZero = centimesLoinDeZero;
exports.versChaine = versChaine;
exports.versNombre = versNombre;
exports.ZERO = { mantisse: 0n, echelle: 0 };
const puissanceDeDix = (n) => 10n ** BigInt(n);
function normaliser(d) {
    let { mantisse, echelle } = d;
    if (mantisse === 0n)
        return exports.ZERO;
    while (echelle > 0 && mantisse % 10n === 0n) {
        mantisse /= 10n;
        echelle -= 1;
    }
    return { mantisse, echelle };
}
function depuisNombre(x) {
    if (!Number.isFinite(x)) {
        throw new RangeError(`Valeur non finie (${x}) · elle n'a pas d'écriture décimale exacte.`);
    }
    const ecriture = String(x);
    const forme = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(ecriture);
    if (!forme)
        throw new RangeError(`Écriture décimale illisible : ${ecriture}`);
    const [, signe, entiere, fraction = '', exposant = '0'] = forme;
    let mantisse = BigInt(entiere + fraction);
    let echelle = fraction.length - Number(exposant);
    if (echelle < 0) {
        mantisse *= puissanceDeDix(-echelle);
        echelle = 0;
    }
    return normaliser({ mantisse: signe === '-' ? -mantisse : mantisse, echelle });
}
function exact(x) {
    if (typeof x === 'number')
        return depuisNombre(x);
    if (x === null || typeof x !== 'object' || typeof x.mantisse !== 'bigint') {
        throw new RangeError(`Montant non chiffré (${String(x)}) · il n'a pas de valeur décimale.`);
    }
    return x;
}
function aligner(a, b) {
    const echelle = Math.max(a.echelle, b.echelle);
    return [
        a.mantisse * puissanceDeDix(echelle - a.echelle),
        b.mantisse * puissanceDeDix(echelle - b.echelle),
        echelle,
    ];
}
function plus(a, b) {
    const [x, y, echelle] = aligner(a, b);
    return normaliser({ mantisse: x + y, echelle });
}
function moins(a, b) {
    const [x, y, echelle] = aligner(a, b);
    return normaliser({ mantisse: x - y, echelle });
}
function somme(valeurs) {
    return valeurs.reduce(plus, exports.ZERO);
}
function fois(a, b) {
    return normaliser({ mantisse: a.mantisse * b.mantisse, echelle: a.echelle + b.echelle });
}
function pourCent(a, tauxPourCent) {
    const produit = fois(a, tauxPourCent);
    return normaliser({ mantisse: produit.mantisse, echelle: produit.echelle + 2 });
}
function foisEntier(a, n) {
    if (!Number.isSafeInteger(n))
        throw new RangeError(`Multiplicateur non entier : ${n}`);
    return normaliser({ mantisse: a.mantisse * BigInt(n), echelle: a.echelle });
}
function comparer(a, b) {
    const [x, y] = aligner(a, b);
    return x < y ? -1 : x > y ? 1 : 0;
}
function maximum(a, b) {
    return comparer(a, b) >= 0 ? a : b;
}
function diviserVersLeBas(n, d) {
    const q = n / d;
    return (n % d !== 0n && (n < 0n) !== (d < 0n)) ? q - 1n : q;
}
function plancherAuMultiple(a, pas) {
    if (!Number.isSafeInteger(pas) || pas <= 0)
        throw new RangeError(`Pas non entier ou nul : ${pas}`);
    const p = BigInt(pas);
    const multiples = diviserVersLeBas(a.mantisse, p * puissanceDeDix(a.echelle));
    return Number(multiples * p);
}
function centimesLoinDeZero(a) {
    const d = puissanceDeDix(a.echelle);
    const absolu = a.mantisse < 0n ? -a.mantisse : a.mantisse;
    const centimes = (200n * absolu + d) / (2n * d);
    return a.mantisse < 0n ? -centimes : centimes;
}
function versChaine(a) {
    const negatif = a.mantisse < 0n;
    const chiffres = (negatif ? -a.mantisse : a.mantisse).toString().padStart(a.echelle + 1, '0');
    const entiere = a.echelle === 0 ? chiffres : chiffres.slice(0, -a.echelle);
    const fraction = a.echelle === 0 ? '' : `.${chiffres.slice(-a.echelle)}`;
    return `${negatif ? '-' : ''}${entiere}${fraction}`;
}
function versNombre(a) {
    return Number(versChaine(a));
}
//# sourceMappingURL=decimal-exact.js.map