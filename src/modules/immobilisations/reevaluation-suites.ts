/**
 * LES SUITES D'UNE RÉÉVALUATION (ligne A15) · règles pures, sans base.
 *
 * Le lot 14 passe l'opération (`reevaluation-bilan.ts`). Ce qui la suit ·
 * l'information des notes annexes, le tableau des amortissements, la
 * déclaration spéciale et le sort de l'écart quand le bien sort.
 *
 * SOURCES LUES · AUDCIF Titre VIII ch. 28 § 4.2.2, § 4.2.4.2, § 6 et § 8 ;
 * Titre IX ch. 6, NOTE 3E ; Titre VII, fiches des comptes 106, 11 et 15 ;
 * SYCEBNL Partie 2 ch. 2 (plan), Partie 4 ch. 2, NOTE 5H, et fiches des
 * comptes 10, 11 et 15 ; loi
 * n° 23/053, art. 19, 129, 132 à 138 (compilation DGI au 19 juillet 2026).
 */

export type Ref = 'SYSCOHADA' | 'SYCEBNL';

const EPSILON = 0.005;
const centimes = (x: number) => Math.round(x * 100) / 100;

/**
 * LA PART DE LA DOTATION DUE À LA RÉÉVALUATION · ch. 28 § 4.2.2, « Les
 * amortissements nouveaux sont donc égaux à ceux qui étaient initialement
 * prévus, multipliés par le coefficient k (ou k') ». La dotation de
 * l'exercice porte TOUTES les réévaluations antérieures du bien, d'où
 * D × (1 − 1/∏k') · la même chaîne que la reprise de la provision spéciale
 * (`partsDuSupplement`), sans la borne du reste à reprendre, puisqu'ici on
 * MONTRE l'amortissement supplémentaire (ch. 28 § 8, « les amortissements
 * supplémentaires résultant de la réévaluation » ; loi n° 23/053, art. 135),
 * qu'il soit au 106 ou au 154.
 *
 * Seules les réévaluations d'exercices ANTÉRIEURS comptent · la dotation de
 * l'exercice de réévaluation se passe avant elle, sur les valeurs anciennes
 * (art. 63 ; ch. 28 § 3.2), elle n'a donc aucun supplément.
 */
export function supplementDeLaDotation(dotation: number, coefficientsAnterieurs: number[]): number {
  const produit = coefficientsAnterieurs.reduce((p, k) => p * k, 1);
  if (!(produit > 1 + 1e-9) || !(Math.abs(dotation) > EPSILON)) return 0;
  return centimes(dotation * (1 - 1 / produit));
}

/** Une ligne de réévaluation d'un bien, telle que le module la garde. */
export interface LigneEcartDuBien {
  id: string;
  compteEcart: string | null;
  ecart: number;
  provisionReprise: number;
  ecartImpute: number;
  ecartTransfere: number;
}

export type TraitementALaSortie = 'RESERVE' | 'REPRISE_861';

export interface SortDeLEcart {
  ligneId: string;
  compteEcart: string;
  montant: number;
  traitement: TraitementALaSortie;
}

/**
 * LE SORT DE L'ÉCART QUAND LE BIEN SORT, ligne par ligne, QUELLE QUE SOIT LA
 * SORTIE (cession, mise au rebut, destruction, vol, disparition, échange,
 * remise, restitution, renouvellement d'un composant, option non levée), aux
 * DEUX référentiels. Décisions de Manasse du 2026-10-04, chacune tranchée par
 * la loi telle qu'elle se lit (ligne A15 bis).
 *
 * 154 · LE RESTE NON REPRIS DU BIEN SE REPREND EN ENTIER AU 861, jamais vers
 * une réserve. Trois lectures concordent.
 *  (1) La fiche du compte 15 ne laisse qu'une sortie · AUDCIF Titre VII, les
 *      provisions réglementées sont « créées ou augmentées exclusivement par
 *      “Dotations H.A.O.” et réduites ou annulées exclusivement par “Reprises
 *      H.A.O.” », le compte 15 étant « débité de l'annulation ou de la
 *      variation en diminution des provisions réglementées, par le crédit du
 *      compte 86 (Reprises H.A.O.) » ; SYCEBNL Partie 2 ch. 3, fiche du compte
 *      15, même fonctionnement (« est débité le compte 15 ; par le crédit du
 *      compte 86 – Reprises H.A.O. »).
 *  (2) La loi fiscale veut la neutralité jusqu'au bout · loi n° 23/053, art.
 *      132 al. 1er, « La constatation de l'écart de réévaluation doit rester
 *      sans influence sur le résultat comptable et fiscal de l'entreprise » ;
 *      art. 133 al. 2, l'augmentation de l'annuité « ne doit pas entraîner de
 *      diminution du bénéfice comptable et du bénéfice fiscal » ; art. 133
 *      al. 3, à la cession, la réduction de la plus-value « doit être
 *      exactement compensée par la réintégration du solde de la plus-value de
 *      réévaluation se rapportant à l'immobilisation cédée ».
 *  (3) Le § 6 de l'AUDCIF (Titre VIII ch. 28, « transfert à un poste de
 *      réserve non distribuable ») vise l'ÉCART, porté au 1061 ; le 154 est
 *      une provision réglementée créditée « au lieu du 1061 Écarts de
 *      réévaluation légale » quand la loi fiscale impose la neutralité
 *      (§ 4.2.4.1), reprise chaque année « par le biais du compte 861 »
 *      (§ 4.2.4.2). Ce n'est pas un écart, le § 6 ne le vise pas.
 * POURQUOI LA MISE HORS SERVICE SUIT LA MÊME REPRISE, alors que l'art. 133
 * al. 3 ne nomme que la cession · le 81 reçoit la valeur nette RÉÉVALUÉE
 * (art. 132 al. 2), dont la part due à la réévaluation charge le résultat ;
 * sans reprise, la réévaluation influerait sur lui, ce que l'art. 132 al. 1er
 * interdit en toute hypothèse. Un 154 laissé au bilan après le bien n'aurait
 * plus d'objet (plus aucun supplément d'amortissement à neutraliser, § 4.2.4.2)
 * et la fiche du compte 15 ne lui ouvre aucune autre issue que le 86.
 * Le montant · l'écart de la ligne moins ce que le module a déjà repris
 * (`provisionReprise`, tenu par la reprise annuelle du lot 14 et par la
 * sortie elle-même).
 *
 * 106 · TOUTE SORTIE · ch. 28 § 6, « Le solde de l'écart de réévaluation d'un
 * bien cédé ou mis hors service doit faire l'objet d'un transfert à un poste
 * de réserve non distribuable ». Le solde est l'écart de la ligne moins la
 * perte de valeur déjà imputée sur lui (ch. 12 § 2.5) et ce qui a déjà été
 * transféré. AU SYCEBNL, MÊME RÈGLE · son texte se tait (ni la fiche du compte
 * 10, ni la Partie 3 ch. 1 § 2.1.1.3 ne disent ce que devient le 106 d'un bien
 * sorti) ; décision de Manasse du 2026-10-04, dans le silence du texte
 * SYCEBNL, par analogie avec l'AUDCIF ch. 28 § 6, vers le 118 Autres réserves
 * IMPOSÉ (`COMPTE_RESERVE_SYCEBNL`), le 1062 « sur des biens avec droit de
 * reprise » compris, aucun texte du SYCEBNL n'en disant autre chose. Au
 * SYSCOHADA, la réserve se choisit (`RACINES_RESERVE_NON_DISTRIBUABLE`).
 *
 * L'art. 133 al. 3 veut AUSSI le résultat comptable inchangé à la cession,
 * ce qu'un transfert du 106 à une réserve ne fait pas · mais le 106 « n'est
 * comptabilisé ni dans le Résultat, ni dans les Réserves » (ch. 28 § 5.1), et
 * la loi elle-même renvoie la comptabilisation aux art. 62 à 65 de l'AUDCIF
 * (art. 129, al. 1er). La compensation de l'art. 133 al. 3 et l'imposition
 * de l'art. 19 (« Si le bien est aliéné de quelque manière que ce soit, la
 * plus-value est imposable ») relèvent alors du résultat FISCAL · dites, jamais
 * retraitées ici (`catalogue-retraitements.ts`, le logiciel ne qualifie pas).
 */
export function sortDesEcarts(o: { lignes: LigneEcartDuBien[] }): SortDeLEcart[] {
  const sorts: SortDeLEcart[] = [];
  for (const l of o.lignes) {
    if (!l.compteEcart) continue;
    if (l.compteEcart.startsWith('154')) {
      const reste = centimes(l.ecart - l.provisionReprise);
      if (reste <= EPSILON) continue;
      sorts.push({ ligneId: l.id, compteEcart: l.compteEcart, montant: reste, traitement: 'REPRISE_861' });
    } else if (l.compteEcart.startsWith('106')) {
      const solde = centimes(l.ecart - l.ecartImpute - l.ecartTransfere);
      if (solde <= EPSILON) continue;
      sorts.push({ ligneId: l.id, compteEcart: l.compteEcart, montant: solde, traitement: 'RESERVE' });
    }
  }
  return sorts;
}

/**
 * LA RÉSERVE NON DISTRIBUABLE QUI REÇOIT LE 106, par référentiel · le ch. 28
 * § 6 ne nomme pas le compte.
 *
 * SYSCOHADA · la fiche du compte 11 le circonscrit · « réserves indisponibles
 * (légales, réglementées, statutaires) et réserves libres ou facultatives » ·
 * d'où 111 Réserve légale, 112 Réserves statutaires ou contractuelles et,
 * parmi les réglementées, le seul 1138 « Autres réserves réglementées ». Les
 * 1131 à 1134 ont chacun leur objet nommé par la même fiche (plus-values
 * nettes à long terme, attribution gratuite d'actions, subventions
 * d'investissement, valeurs mobilières donnant accès au capital) · y verser un
 * écart de réévaluation le rangerait sous un objet qui n'est pas le sien
 * (seconde relecture A15). Le 118 « Autres réserves » (1181 Réserves
 * facultatives, 1188 Réserves diverses) porte les réserves LIBRES · refusé.
 *
 * SYCEBNL · son plan n'ouvre au compte 11 que « 112 Réserves statutaires ou
 * contractuelles » et « 118 Autres réserves » (Partie 2 ch. 2 ; fiche du
 * compte 11, mêmes subdivisions), ni 111 ni 113, et ne dit nulle part qu'une
 * réserve soit « non distribuable ». Le 118 est IMPOSÉ, sans choix · décision
 * de Manasse du 2026-10-04, dans le silence du texte SYCEBNL, par analogie avec
 * l'AUDCIF ch. 28 § 6. Le 112 porte ce que les statuts ou un contrat imposent
 * de mettre en réserve (fiche du compte 11, « l'obligation de constituer des
 * réserves résulte des dispositions statutaires ») · un écart de réévaluation
 * n'en vient pas. Le semis SYCEBNL ouvre le 118 sans subdivision, au compte de
 * détail 11800000 (`compte-seed.ts`), seul admis. Un numéro, deux sens · le 118
 * refusé au SYSCOHADA (réserves libres) est le compte imposé au SYCEBNL.
 *
 * Au SYSCOHADA, le choix est celui du cabinet (décision des organes,
 * statuts), jamais présumé.
 */
export const RACINES_RESERVE_NON_DISTRIBUABLE = ['111', '112', '1138'] as const;
export const COMPTE_RESERVE_SYCEBNL = '11800000';

export function motifRefusCompteReserve(numero: string | null | undefined, referentiel: Ref = 'SYSCOHADA'): string | null {
  if (referentiel === 'SYCEBNL') {
    // Rien de choisi · le serveur impose le 118 (`COMPTE_RESERVE_SYCEBNL`).
    if (!numero || numero === COMPTE_RESERVE_SYCEBNL) return null;
    return (
      `Le compte ${numero} ne peut pas recevoir l’écart · au SYCEBNL, le solde de l’écart de réévaluation d’un bien ` +
      `sorti va au ${COMPTE_RESERVE_SYCEBNL} Autres réserves, imposé (décision du cabinet éditeur du 2026-10-04, dans ` +
      'le silence du texte SYCEBNL, par analogie avec l’AUDCIF Titre VIII ch. 28 § 6) · ne choisissez aucune réserve.'
    );
  }
  if (!numero) {
    return (
      'Choisissez la réserve non distribuable qui reçoit le solde de l’écart de réévaluation (AUDCIF Titre VIII ' +
      'ch. 28 § 6) · un compte sous 111, 112 ou 1138, réserves indisponibles de la fiche du compte 11.'
    );
  }
  if (/^113[1-4]/.test(numero)) {
    return (
      `Le compte ${numero} a son propre objet (fiche du compte 11 · 1131 plus-values nettes à long terme, 1132 ` +
      'attribution gratuite d’actions, 1133 subventions d’investissement, 1134 valeurs mobilières donnant accès au ' +
      'capital) · parmi les réserves réglementées, l’écart de réévaluation va au 1138 « Autres réserves réglementées » ' +
      '(AUDCIF Titre VIII ch. 28 § 6).'
    );
  }
  if (!RACINES_RESERVE_NON_DISTRIBUABLE.some((r) => numero.startsWith(r))) {
    return (
      `Le compte ${numero} n’est pas une réserve non distribuable · le solde de l’écart de réévaluation va à une ` +
      'réserve indisponible (111 Réserve légale, 112 Réserves statutaires ou contractuelles, 1138 Autres réserves ' +
      'réglementées · fiche du compte 11), jamais au 118, qui porte les réserves libres (AUDCIF Titre VIII ch. 28 § 6).'
    );
  }
  return null;
}

/**
 * LES LIGNES DE L'ÉCRITURE QUI SOLDE L'ÉCART À LA SORTIE · par compte, deux
 * paires · D 106x / C réserve, D 154 / C 861. Les montants d'une même racine
 * s'additionnent par compte (un bien réévalué deux fois au même 1061).
 */
export function lignesSortDeLEcart(
  sorts: SortDeLEcart[],
): { reserve: Array<{ compteEcart: string; montant: number }>; reprise: number } {
  const parCompte = new Map<string, number>();
  let reprise = 0;
  for (const s of sorts) {
    if (s.traitement === 'RESERVE') parCompte.set(s.compteEcart, centimes((parCompte.get(s.compteEcart) ?? 0) + s.montant));
    else reprise = centimes(reprise + s.montant);
  }
  return {
    reserve: [...parCompte.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([compteEcart, montant]) => ({ compteEcart, montant })),
    reprise,
  };
}

/** Une rubrique de note qui range les comptes · libellé, préfixes et exclusions. */
export interface RubriquePoste {
  libelle: string;
  comptes?: readonly string[];
  exclusions?: readonly string[];
}

/**
 * LE POSTE DU BILAN D'UN BIEN · la rubrique de la note des immobilisations
 * brutes du jeu (NOTE 3A au SYSCOHADA, 5B des associations) qui lit son
 * compte, par la même règle que le calcul de la note (`correspond`, passée
 * par l'appelant). Aucun numéro écrit ici · un bien qu'aucune rubrique ne lit
 * garde son compte, jamais rangé ailleurs en silence.
 */
export function posteDuBien(
  numero: string,
  rubriques: readonly RubriquePoste[],
  correspond: (numero: string, prefixes: readonly string[], exclusions?: readonly string[]) => boolean,
): string {
  for (const r of rubriques) {
    if (r.comptes?.length && correspond(numero, r.comptes, r.exclusions ?? [])) return r.libelle;
  }
  return `Compte ${numero} (aucune rubrique de la note ne le lit)`;
}

/** Une réévaluation portée par un bien, telle que le tableau des amortissements la relit. */
export interface ReevaluationPortee {
  dateReevaluation: Date;
  coefficientRetenu: number;
  brutAvant: number;
  brutApres: number;
  amortissementsAvant: number;
  amortissementsApres: number;
}

/**
 * LE BIEN VU D'UN EXERCICE · la fiche porte la valeur d'AUJOURD'HUI, toutes
 * réévaluations passées comprises (`reevaluer` la met à jour). Le tableau des
 * amortissements d'un exercice la relit telle qu'ELLE ÉTAIT · sans les
 * réévaluations postérieures, qui n'existaient pas encore ; et la hausse (ou
 * l'élimination, méthode 2) du cumul par la réévaluation de l'exercice est
 * passée à sa CLÔTURE (art. 63 ; ch. 28 § 3.2), après la dotation (décision
 * D-38) · comptée dans le cumul d'ouverture, elle ferait dire au tableau un
 * cumul que la balance n'a jamais porté à l'ouverture.
 *
 * `produitAnterieur` · le produit des k' des réévaluations des exercices
 * antérieurs, qui multiplie l'annuité de celui-ci (ch. 28 § 4.2.2).
 */
export function vueDeLExercice(portees: ReevaluationPortee[], exercice: { dateDebut: Date; dateFin: Date }) {
  let produitAnterieur = 1;
  let produitPosterieur = 1;
  let ajustementCumulExercice = 0;
  let cumulPosterieur = 0;
  let brutPosterieur = 0;
  for (const r of portees) {
    const deltaCumul = r.amortissementsApres - r.amortissementsAvant;
    if (r.dateReevaluation < exercice.dateDebut) {
      produitAnterieur *= r.coefficientRetenu;
    } else if (r.dateReevaluation <= exercice.dateFin) {
      ajustementCumulExercice += deltaCumul;
    } else {
      cumulPosterieur += deltaCumul;
      brutPosterieur += r.brutApres - r.brutAvant;
      produitPosterieur *= r.coefficientRetenu;
    }
  }
  return {
    produitAnterieur,
    produitPosterieur,
    ajustementCumulExercice: centimes(ajustementCumulExercice),
    cumulPosterieur: centimes(cumulPosterieur),
    brutPosterieur: centimes(brutPosterieur),
  };
}
