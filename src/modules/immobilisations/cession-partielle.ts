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

/**
 * LES CAS REFUSÉS DE LA SORTIE PARTIELLE, TRANCHÉS PAR LA LOI (ligne
 * restes-immos-budgets, point 4, 2026-10-30). Chacun a été relu dans son texte ·
 * servi quand la part des unités se déduit du texte et des règles déjà codées
 * pour la sortie entière du même cas ; gardé sinon, le motif et l'issue dits.
 *
 *  · COMPOSANT EN LOT · SERVI. AUDCIF Titre VIII ch. 4 § 3.1.4 · il est
 *    « possible, et même souhaitable, de regrouper les éléments ainsi
 *    décomposés au sein d'une même immobilisation corporelle, par échéance de
 *    renouvellement » · un lot de moteurs identiques est un composant, et la
 *    sortie entière d'un composant est déjà servie. Les unités sortent avec la
 *    part de 1/n de chacun, et leur fiche reste un composant du même principal
 *    (§ 1, « sous-compte de l'immobilisation principale »).
 *  · PRINCIPAL QUI PORTE DES COMPOSANTS EN SERVICE · GARDÉ. Ch. 4 § 1 · chaque
 *    composant a « un plan d'amortissement propre » · rien ne dit quels
 *    composants suivent les unités sorties de la structure, et la sortie
 *    entière refuse déjà un principal dont les composants sont en service
 *    (audit final F127).
 *  · UNITÉS D'ŒUVRE · GARDÉ. AUDCIF art. 45 · « AD = base amortissable ×
 *    (nombre d'unités d'œuvre consommées) / (total d'unités d'œuvre
 *    prévues) » · le total prévu et les relevés portent sur le lot ; aucun
 *    relevé ne dit ce que les unités sorties ont consommé, et le prorata des
 *    unités n'est pas celui des unités d'œuvre.
 *  · DÉGRESSIF FISCAL ET DÉROGATOIRE · GARDÉ. Loi n° 23/053, art. 31 à 35, et
 *    fiche du compte 68 (le complément fiscal « au débit du compte 85, par le
 *    crédit du compte 151 ») · le plan fiscal et le cumul du 151 se tiennent
 *    par bien, exercice par exercice ; la sortie entière exige d'abord la
 *    reprise du solde (D 151 / C 861), que le module ne passe qu'en entier.
 *  · FONDS OU SUBVENTION RATTACHÉE · GARDÉ. Ch. 17 · « la fraction de
 *    subvention non encore rapportée aux résultats est […] reprise par le
 *    compte 799 de l'exercice de cession » · la reprise est prospective et
 *    tenue par rattachement (`SubventionImmobilisation`), les fonds du SYCEBNL
 *    (167, 171, 172) par leur propre rythme · aucune répartition du
 *    rattachement entre le lot et les unités n'est codée.
 *  · RÉÉVALUATION · GARDÉ. Ch. 28 § 6 · « le solde de l'écart de réévaluation
 *    d'un bien cédé […] doit faire l'objet d'un transfert à un poste de
 *    réserve non distribuable » · les lignes de réévaluation (106, 154,
 *    supplément d'annuité, reprise de la provision spéciale) sont tenues par
 *    bien et ne se scindent pas.
 *  · LOCATION-ACQUISITION, PRIX ALÉATOIRE, DÉMANTÈLEMENT · GARDÉ. Le contrat
 *    (ch. 8), la dette de rente ou de redevances et la provision pour
 *    démantèlement (ch. 6) portent sur le bien entier · aucun texte ne les
 *    fractionne entre des unités.
 *  · DOTATION DE L'EXERCICE DÉJÀ PASSÉE · GARDÉ. Fiche du compte 81 · le
 *    complément ne court que « pour la période écoulée entre l'ouverture de
 *    l'exercice et la date de cession » · une annuité entière déjà passée
 *    amortirait les unités au-delà de leur sortie. L'issue existe et donne le
 *    montant exact · annuler la dotation (art. 20, al. 2), sortir, repasser.
 *  · EXERCICE ANTÉRIEUR OUVERT NON DOTÉ · GARDÉ. Même fiche · « sous
 *    déduction des amortissements pratiqués » · la part figée sans l'annuité
 *    de cet exercice serait fausse ; l'issue est de la passer d'abord.
 *  · SECONDE REPRISE DE DÉPRÉCIATION DANS L'EXERCICE · SERVI. Fiche du compte
 *    81, exclusions (« les dépréciations afférentes aux éléments d'actif
 *    immobilisé cédés → 29 ») et ch. 12 · chaque sortie reprend la part de
 *    ses unités dans la dépréciation que le lot porte encore · deux sorties du
 *    même exercice en reprennent chacune la leur, la clé de la base n'est plus
 *    unique pour ce seul mouvement (migration `20270243000000`).
 */

/** Ce que la fiche du lot porte, lu par le service, pour juger le geste. */
export interface FaitsDuLot {
  enService: boolean;
  quantite: number;
  quantiteSortie: number;
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
  if (f.composantsEnService > 0) {
    return (
      'Le lot porte des composants en service · chacun a son propre plan d’amortissement (AUDCIF Titre VIII ch. 4 § 1), et rien ne dit ' +
      'lesquels suivent les unités qui sortent. Sortez d’abord, de chaque composant, la part qui suit ces unités, puis passez la sortie à la main.'
    );
  }
  if (f.unitesOeuvre) {
    return (
      'Un bien amorti aux unités d’œuvre ne se fractionne pas · l’amortissement se lit sur les unités d’œuvre consommées et prévues du lot ' +
      '(AUDCIF art. 45), et aucun relevé ne dit ce que les unités sorties ont consommé. Sortez-le en entier, ou passez l’opération à la main.'
    );
  }
  if (f.degressifFiscal || f.derogatoires > 0) {
    return (
      'Le lot est au dégressif fiscal ou porte un amortissement dérogatoire (151) · le plan fiscal et le cumul du 151 se tiennent par bien ' +
      '(loi n° 23/053, art. 31 à 35 ; fiche du compte 68), et le solde ne se reprend qu’en entier (D 151 / C 861). Passez l’opération à la main.'
    );
  }
  if (f.financeeParUnFonds) {
    return (
      'Le lot est financé par un fonds ou porte une subvention rattachée · la fraction non rapportée aux résultats de la part sortie se ' +
      'reprend au 799 de l’exercice de cession (AUDCIF Titre VIII ch. 17), et le rattachement ne se répartit pas d’office entre le lot et ' +
      'les unités. Passez l’opération à la main.'
    );
  }
  if (f.reevaluee) {
    return (
      'Le lot a été réévalué · le solde de l’écart de la part sortie se transfère à une réserve non distribuable (AUDCIF Titre VIII ch. 28 ' +
      '§ 6), et les lignes de réévaluation, tenues par bien, ne se scindent pas d’office. Passez l’opération à la main.'
    );
  }
  if (f.locationAcquisition || f.acquisitionAleatoire || f.demantelement) {
    return (
      'Le lot porte un contrat de location-acquisition, une dette à prix aléatoire ou une provision pour démantèlement (AUDCIF Titre VIII ' +
      'ch. 6 et 8) · ces engagements portent sur le bien entier, et aucun texte ne les fractionne entre des unités.'
    );
  }
  if (f.dotationDejaPassee) {
    return (
      'La dotation de l’exercice de la sortie, ou d’un exercice postérieur, est déjà passée sur le lot · le complément des unités ne court ' +
      'que de l’ouverture de l’exercice à leur sortie (fiche du compte 81), et l’annuité entière les amortirait au-delà. Annulez la dotation ' +
      '(onglet Traitements de la fiche), sortez les unités, puis repassez-la.'
    );
  }
  if (f.exerciceAnterieurNonDote) return motifExerciceAnterieurNonDote(f.exerciceAnterieurNonDote, 'LOT');
  return null;
}

/**
 * UN EXERCICE ANTÉRIEUR ENCORE OUVERT SANS LA DOTATION DU BIEN · la sortie,
 * entière ou d'une partie des unités, porte au 81 « la valeur d'entrée des
 * éléments sortis sous déduction des amortissements pratiqués », le cumul
 * courant « jusqu'à la date de sa cession » (AUDCIF Titre VII, fiche du
 * compte 81, mêmes mots au SYCEBNL). N+1 s'ouvre avant la clôture de N
 * (AUDCIF art. 23) · sortir le bien en N+1 avant d'avoir doté N perdrait
 * l'annuité de N · une fois le bien sorti, le module ne la passe plus (il ne
 * dote qu'un bien en service), et le complément de N+1 se calcule sur un
 * cumul qui l'ignore. Ligne restes-l8-immos · la sortie ENTIÈRE juge comme la
 * partielle, par cette fonction · seule la sortie partielle refusait jusque-là.
 *
 * Le PREMIER exercice ouvert, finissant avant celui de la sortie, après la
 * mise en service et l'entrée dans le dossier, qui n'a pas la dotation du
 * bien · `null` si le bien n'a rien à amortir (non amortissable, rien qui
 * reste), sans quoi le refus serait inventé.
 */
export function exerciceAnterieurNonDote(
  bien: { dateMiseEnService: Date | null; debutDetention: Date | null; dotations: { exerciceId: string }[] },
  anterieursOuverts: { id: string; dateFin: Date }[],
  aAmortir: boolean,
): Date | null {
  if (!aAmortir || !bien.dateMiseEnService) return null;
  const miseEnService = bien.dateMiseEnService.getTime();
  const detention = bien.debutDetention?.getTime() ?? null;
  const nonDote = [...anterieursOuverts]
    .sort((a, b) => a.dateFin.getTime() - b.dateFin.getTime())
    .find(
      (e) =>
        miseEnService <= e.dateFin.getTime() &&
        (detention === null || detention <= e.dateFin.getTime()) &&
        !bien.dotations.some((d) => d.exerciceId === e.id),
    );
  return nonDote?.dateFin ?? null;
}

/** Le refus, nommé avec son issue · la même phrase pour le lot et pour le bien entier. */
export function motifExerciceAnterieurNonDote(fin: string, objet: 'LOT' | 'BIEN'): string {
  return objet === 'LOT'
    ? `L’exercice clos le ${fin} n’a pas reçu la dotation du lot · passez-la d’abord, sinon les unités sortiraient sans l’amortissement de cet exercice (fiche du compte 81, « sous déduction des amortissements pratiqués »).`
    : `L’exercice clos le ${fin} n’a pas reçu la dotation du bien · passez-la d’abord, sinon le bien sortirait sans l’amortissement de cet exercice (fiche du compte 81, « sous déduction des amortissements pratiqués »).`;
}
