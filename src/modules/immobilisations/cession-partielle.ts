/**
 * LA QUANTITÉ D'UN BIEN ET LA SORTIE D'UNE PARTIE DE SES UNITÉS (ligne immos,
 * fonction n° 65 · Sage Immobilisations, quantité, fractionnement et cession
 * partielle, M4 A-18, A-19, A-24, B-59) · les règles pures.
 *
 * UNE FICHE PEUT PORTER UN LOT D'UNITÉS IDENTIQUES (vingt chaises, dix
 * ordinateurs du même achat). Le texte ne parle pas de quantité · la fiche du
 * compte 81 des deux plans sort « la valeur d'entrée des éléments sortis sous
 * déduction des amortissements pratiqués », et c'est l'ÉLÉMENT qui sort, pas
 * la fiche. Lecture d'OmegaX · des unités identiques acquises ensemble ont
 * chacune la même part de la valeur d'entrée, des amortissements et de la
 * dépréciation du lot · une unité sortie emporte 1/n de chacun. Des unités qui
 * ne sont pas identiques ne se mettent pas en lot (une fiche par bien,
 * « Dupliquer » le permet) · le prorata serait faux, et c'est dit dans l'aide.
 *
 * LE CENTIME ET LE RESTE · chaque part sortie est arrondie au centime, et la
 * fiche qui reste garde la DIFFÉRENCE · la dernière unité prend le reste,
 * jamais une part arrondie de plus, sans quoi le brut restant et le compte
 * 2x divergeraient d'un centime sur une balance bouclée. Tout se compte en
 * centimes entiers.
 *
 * LE GESTE · les unités sorties deviennent une fiche à part (le fractionnement
 * de Sage), née de la fiche du lot (`fractionDeId`), qui sort aussitôt par le
 * chemin ordinaire de la sortie (`sortir`) · même pièce, même nature, mêmes
 * comptes, même prix pour une cession. Sa dotation complémentaire est la part
 * des unités dans le complément du LOT jusqu'à la date de sortie, imposée ·
 * recalculée sur la seule fiche des unités, elle oublierait le ré-étalement
 * d'une dépréciation du lot. La dépréciation des unités sortantes est reprise
 * sur le lot (D 29 / C 79, `CESSION_PARTIELLE`) · la même écriture que la
 * sortie entière porte sur ses lignes (fiche du compte 81, exclusions · « les
 * dépréciations afférentes aux éléments d'actif immobilisé cédés → 29 »).
 */

export interface LotAFractionner {
  /** Centimes entiers. */
  brut: number;
  valeurResiduelle: number;
  /** Cumul d'amortissement à l'ouverture de l'exercice de la sortie (dotations antérieures et hors dotations). */
  cumulOuverture: number;
  /** Dépréciation nette inscrite au 29 sur le lot. */
  depreciation: number;
  /** Le complément de dotation du lot, de l'ouverture à la date de sortie. */
  complement: number;
  quantite: number;
}

export interface PartSortie {
  brut: number;
  valeurResiduelle: number;
  cumulOuverture: number;
  depreciation: number;
  complement: number;
}

const enCentimes = (x: number) => Math.round(x * 100);

/** La part de k unités sur n, au centime · arrondie au plus proche, la moitié loin de zéro. */
function part(centimes: number, k: number, n: number): number {
  const exacte = (centimes * k) / n;
  return Math.sign(exacte) * Math.round(Math.abs(exacte));
}

/**
 * La part des unités sortantes, en francs au centime · le lot garde la
 * différence (`resteDuLot`).
 */
export function partDesUnites(lot: LotAFractionner, k: number): PartSortie {
  const n = lot.quantite;
  const c = (x: number) => part(enCentimes(x), k, n) / 100;
  return {
    brut: c(lot.brut),
    valeurResiduelle: c(lot.valeurResiduelle),
    cumulOuverture: c(lot.cumulOuverture),
    depreciation: c(lot.depreciation),
    complement: c(lot.complement),
  };
}

/** Ce que le lot garde · la différence exacte, jamais une seconde part arrondie. */
export function resteDuLot(lot: LotAFractionner, p: PartSortie) {
  const d = (a: number, b: number) => (enCentimes(a) - enCentimes(b)) / 100;
  return {
    brut: d(lot.brut, p.brut),
    valeurResiduelle: d(lot.valeurResiduelle, p.valeurResiduelle),
    cumulOuverture: d(lot.cumulOuverture, p.cumulOuverture),
    depreciation: d(lot.depreciation, p.depreciation),
  };
}

/** Ce que la fiche du lot porte, lu par le service, pour juger le geste. */
export interface FaitsDuLot {
  enService: boolean;
  quantite: number;
  quantiteSortie: number;
  estComposant: boolean;
  composantsEnService: number;
  unitesOeuvre: boolean;
  degressifFiscal: boolean;
  derogatoires: number;
  financeeParUnFonds: boolean;
  reevaluee: boolean;
  locationAcquisition: boolean;
  acquisitionAleatoire: boolean;
  demantelement: boolean;
  /** La dotation de l'exercice de la sortie, ou d'un exercice postérieur, est passée sur le lot. */
  dotationDejaPassee: boolean;
  /** La fin (AAAA-MM-JJ) d'un exercice antérieur encore ouvert qui n'a pas reçu la dotation du lot, ou null. */
  exerciceAnterieurNonDote: string | null;
  /** Une reprise de dépréciation de cession partielle est déjà passée sur le lot dans cet exercice. */
  repriseDejaPasseeCetExercice: boolean;
  /** Le lot porte une dépréciation nette non nulle. */
  deprecie: boolean;
}

/** Pourquoi une partie des unités ne sort pas, ou null · le premier motif, avec son issue. */
export function motifRefusSortiePartielle(f: FaitsDuLot): string | null {
  if (!f.enService) return 'Ce bien est déjà sorti.';
  if (!Number.isInteger(f.quantiteSortie) || f.quantiteSortie < 1) return 'Indiquez le nombre d’unités qui sortent · un entier, au moins une.';
  if (f.quantite < 2) {
    return 'La fiche porte une seule unité · elle sort en entier par « Sortir ». Si elle porte en réalité un lot, déclarez d’abord sa quantité sur la fiche (onglet Général).';
  }
  if (f.quantiteSortie >= f.quantite) {
    return `La fiche porte ${f.quantite} unités · les sortir toutes, c’est sortir le bien en entier, par « Sortir ».`;
  }
  if (f.estComposant || f.composantsEnService > 0) {
    return 'Un composant, ou un bien qui porte des composants, ne se fractionne pas · chaque composant a son propre plan (AUDCIF Titre VIII ch. 4) et sort par sa propre fiche.';
  }
  if (f.unitesOeuvre) {
    return 'Un bien amorti aux unités d’œuvre ne se fractionne pas · son total d’unités prévues et ses relevés portent sur le lot entier. Sortez-le en entier, ou passez l’opération à la main.';
  }
  if (f.degressifFiscal || f.derogatoires > 0) {
    return 'Le lot est au dégressif fiscal ou porte un amortissement dérogatoire (151) · sa part ne se répartit pas d’office. Passez l’opération à la main.';
  }
  if (f.financeeParUnFonds) {
    return 'Le lot est financé par un fonds ou porte une subvention rattachée · la reprise de la part sortie ne se répartit pas d’office. Passez l’opération à la main.';
  }
  if (f.reevaluee) {
    return 'Le lot a été réévalué · l’écart de réévaluation de la part sortie (AUDCIF Titre VIII ch. 28 § 6) ne se répartit pas d’office. Passez l’opération à la main.';
  }
  if (f.locationAcquisition || f.acquisitionAleatoire || f.demantelement) {
    return 'Le lot porte un contrat de location-acquisition, une dette à prix aléatoire ou un démantèlement · ces engagements portent sur le bien entier et ne se fractionnent pas.';
  }
  if (f.dotationDejaPassee) {
    return 'La dotation de l’exercice de la sortie, ou d’un exercice postérieur, est déjà passée sur le lot · les unités sortent avant elle, sinon leur annuité serait comptée deux fois. Annulez la dotation (onglet Traitements de la fiche), sortez les unités, puis repassez-la.';
  }
  if (f.exerciceAnterieurNonDote) {
    return `L’exercice clos le ${f.exerciceAnterieurNonDote} n’a pas reçu la dotation du lot · passez-la d’abord, sinon les unités sortiraient sans l’amortissement de cet exercice.`;
  }
  if (f.deprecie && f.repriseDejaPasseeCetExercice) {
    return 'Une sortie partielle de ce lot a déjà repris sa part de dépréciation dans cet exercice · une seconde se passe à l’exercice suivant, ou sortez le reste du lot en entier.';
  }
  return null;
}
