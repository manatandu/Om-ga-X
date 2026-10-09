/**
 * L'ARITHMÉTIQUE DÉCIMALE EXACTE D'UN SEUIL OU D'UN PALIER (second tour de
 * relecture du paquet 1, ligne C, BLOQUANT du millier).
 *
 * POURQUOI ELLE EXISTE. Le flottant additionne cinq lignes de paie qui font
 * 880 000 FC en 879 999,9999999999 ; la quote-part ouvrière et l'annualisation
 * portent ensuite le revenu net global à 10 031 999,999999998, et l'arrondi au
 * millier INFÉRIEUR de la loi n° 23/053, art. 118 le ramène à 10 031 000 au
 * lieu de 10 032 000 · cent francs de retenue en moins, figés dans le
 * bulletin, le décompte final et le 447. Un plancher, un arrondi à un palier
 * ou le signe d'un net basculent sur un écart d'un milliardième de franc, et
 * aucune tolérance ne s'en démontre sûre · arrondir d'abord au centime
 * remonterait aussi 10 031 999,996 (un revenu à la quote-part au demi-millième)
 * au millier supérieur. Ces décisions se prennent donc sur la valeur EXACTE,
 * jamais sur le flottant.
 *
 * LA VALEUR D'UN NOMBRE · c'est son écriture décimale par `String(x)`, que
 * ECMA-262 (Number::toString) définit comme la plus courte qui redonne le même
 * flottant. Un montant, un taux ou un SMIG SAISI avec au plus quinze chiffres
 * significatifs (corps JSON d'une requête, barème du cabinet, colonne
 * Decimal) se relit donc EXACTEMENT tel qu'il a été saisi · deux décimaux
 * distincts de quinze chiffres significatifs ne tombent jamais sur le même
 * flottant (DBL_DIG = 15, IEEE 754 binaire 64). Les montants que le moteur
 * forme lui-même au centime (`auCentime`, la conversion des dollars) en sont
 * aussi, sous 10^13 FC. Au-delà de quinze chiffres, la valeur retenue est la
 * plus courte écriture du flottant reçu · une lecture définie, jamais devinée.
 *
 * CE QUI N'EN SORT JAMAIS · une `bigint` ne se sérialise pas (`JSON.stringify`
 * lève), et les verdicts de la paie sont figés en JSON dans le bulletin émis.
 * Ces valeurs restent donc INTERNES au calcul · ce qui en sort vers un verdict
 * passe par `versNombre`, le flottant le plus proche de la valeur exacte.
 *
 * Module SANS IMPORT · la paie et la fiscalité l'emploient toutes deux.
 */

/** La valeur `mantisse × 10^-echelle`, l'échelle entière et positive ou nulle. */
export type DecimalExact = { readonly mantisse: bigint; readonly echelle: number };

export const ZERO: DecimalExact = { mantisse: 0n, echelle: 0 };

const puissanceDeDix = (n: number): bigint => 10n ** BigInt(n);

/** Retire les zéros de fin · la même valeur, l'échelle la plus petite. */
function normaliser(d: DecimalExact): DecimalExact {
  let { mantisse, echelle } = d;
  if (mantisse === 0n) return ZERO;
  while (echelle > 0 && mantisse % 10n === 0n) {
    mantisse /= 10n;
    echelle -= 1;
  }
  return { mantisse, echelle };
}

/**
 * La valeur exacte d'un nombre JavaScript, lue sur son écriture décimale.
 * Un nombre non fini n'a pas de valeur décimale · il lève, jamais un zéro.
 */
export function depuisNombre(x: number): DecimalExact {
  if (!Number.isFinite(x)) {
    throw new RangeError(`Valeur non finie (${x}) · elle n'a pas d'écriture décimale exacte.`);
  }
  // `String(-0)` vaut "0" · le zéro négatif est le zéro.
  const ecriture = String(x);
  const forme = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(ecriture);
  if (!forme) throw new RangeError(`Écriture décimale illisible : ${ecriture}`);
  const [, signe, entiere, fraction = '', exposant = '0'] = forme;
  let mantisse = BigInt(entiere + fraction);
  let echelle = fraction.length - Number(exposant);
  if (echelle < 0) {
    mantisse *= puissanceDeDix(-echelle);
    echelle = 0;
  }
  return normaliser({ mantisse: signe === '-' ? -mantisse : mantisse, echelle });
}

/**
 * Un nombre lu sur son écriture décimale, ou une valeur déjà exacte. Tout le
 * reste lève · un montant non chiffré (`null`) n'est jamais un zéro.
 */
export function exact(x: number | DecimalExact): DecimalExact {
  if (typeof x === 'number') return depuisNombre(x);
  if (x === null || typeof x !== 'object' || typeof x.mantisse !== 'bigint') {
    throw new RangeError(`Montant non chiffré (${String(x)}) · il n'a pas de valeur décimale.`);
  }
  return x;
}

/** Les deux valeurs portées à la même échelle. */
function aligner(a: DecimalExact, b: DecimalExact): [bigint, bigint, number] {
  const echelle = Math.max(a.echelle, b.echelle);
  return [
    a.mantisse * puissanceDeDix(echelle - a.echelle),
    b.mantisse * puissanceDeDix(echelle - b.echelle),
    echelle,
  ];
}

export function plus(a: DecimalExact, b: DecimalExact): DecimalExact {
  const [x, y, echelle] = aligner(a, b);
  return normaliser({ mantisse: x + y, echelle });
}

export function moins(a: DecimalExact, b: DecimalExact): DecimalExact {
  const [x, y, echelle] = aligner(a, b);
  return normaliser({ mantisse: x - y, echelle });
}

export function somme(valeurs: readonly DecimalExact[]): DecimalExact {
  return valeurs.reduce(plus, ZERO);
}

export function fois(a: DecimalExact, b: DecimalExact): DecimalExact {
  return normaliser({ mantisse: a.mantisse * b.mantisse, echelle: a.echelle + b.echelle });
}

/** Un pourcentage · `a × taux / 100`, la division par cent étant exacte en décimal. */
export function pourCent(a: DecimalExact, tauxPourCent: DecimalExact): DecimalExact {
  const produit = fois(a, tauxPourCent);
  return normaliser({ mantisse: produit.mantisse, echelle: produit.echelle + 2 });
}

/** Multiplié par un entier (douze mois, vingt-six jours). */
export function foisEntier(a: DecimalExact, n: number): DecimalExact {
  if (!Number.isSafeInteger(n)) throw new RangeError(`Multiplicateur non entier : ${n}`);
  return normaliser({ mantisse: a.mantisse * BigInt(n), echelle: a.echelle });
}

export function comparer(a: DecimalExact, b: DecimalExact): -1 | 0 | 1 {
  const [x, y] = aligner(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function maximum(a: DecimalExact, b: DecimalExact): DecimalExact {
  return comparer(a, b) >= 0 ? a : b;
}

/** Division entière arrondie vers moins l'infini · `/` de `bigint` tronque vers zéro. */
function diviserVersLeBas(n: bigint, d: bigint): bigint {
  const q = n / d;
  return (n % d !== 0n && (n < 0n) !== (d < 0n)) ? q - 1n : q;
}

/**
 * Le plus grand multiple de `pas` qui ne dépasse pas la valeur · l'« arrondi
 * au millier inférieur » de l'art. 118, pris sur la valeur exacte. Le pas est
 * un entier de francs.
 */
export function plancherAuMultiple(a: DecimalExact, pas: number): number {
  if (!Number.isSafeInteger(pas) || pas <= 0) throw new RangeError(`Pas non entier ou nul : ${pas}`);
  const p = BigInt(pas);
  const multiples = diviserVersLeBas(a.mantisse, p * puissanceDeDix(a.echelle));
  return Number(multiples * p);
}

/**
 * Le nombre de centimes, le demi-centime vers le haut · exactement
 * `Math.round(x × 100)`, la règle de `enCentimes` de la paie et de la passation
 * du mois (`comptabilisation-paie.ts`), mais sur la valeur exacte. Ce n'est PAS
 * l'arrondi de l'affichage (`client/src/lib/montants.ts`, demi-centime loin de
 * zéro) · les deux ne diffèrent que sur un demi-centime négatif.
 */
export function centimesDemiHaut(a: DecimalExact): bigint {
  // floor(x × 100 + 1/2) = floor((200 m + 10^e) / (2 × 10^e)).
  const d = puissanceDeDix(a.echelle);
  return diviserVersLeBas(200n * a.mantisse + d, 2n * d);
}

export function versChaine(a: DecimalExact): string {
  const negatif = a.mantisse < 0n;
  const chiffres = (negatif ? -a.mantisse : a.mantisse).toString().padStart(a.echelle + 1, '0');
  const entiere = a.echelle === 0 ? chiffres : chiffres.slice(0, -a.echelle);
  const fraction = a.echelle === 0 ? '' : `.${chiffres.slice(-a.echelle)}`;
  return `${negatif ? '-' : ''}${entiere}${fraction}`;
}

/**
 * Le flottant le plus proche de la valeur exacte · `Number(chaîne)` arrondit
 * correctement (ECMA-262, StringToNumber). C'est la seule porte de sortie vers
 * un verdict.
 */
export function versNombre(a: DecimalExact): number {
  return Number(versChaine(a));
}
