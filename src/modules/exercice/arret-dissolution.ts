import { jourFr } from './portefeuille-etat';

/**
 * L'ARRÊT DE L'EXERCICE À LA DATE DE DISSOLUTION (décision par la loi du
 * 2026-10-07, quatrième lot, point 1, `docs/decisions-par-la-loi-2026-10-07-quater.md`).
 *
 * L'écriture datée après la dissolution SUIT SA DATE dans l'exercice de
 * liquidation, et rien d'elle ne change · ni sa date, ni son numéro de pièce,
 * ni ses lignes, ni son statut, ni ses auteurs. L'irréversibilité de l'AUDCIF,
 * art. 22, 2° protège les données que le 1° énumère (« l'origine, du contenu
 * et de l'imputation ») · l'exercice n'en fait pas partie, c'est la période de
 * synthèse (art. 7) qui contient la date. L'art. 59 rattache à l'exercice de
 * liquidation les opérations qui lui sont propres, « et celles-là seulement ».
 * Le chemin de révision (art. 22, 6°) exige que le rattachement se voie · le
 * journal d'audit consigne l'arrêt et chaque écriture rattachée (mises à jour
 * UNITAIRES, jamais un `updateMany`, qui n'y laisserait que filtre et compte).
 *
 * UN ACTE DE MODULE QUI PORTE L'EXERCICE SUIT SON ÉCRITURE · la table
 * ci-dessous nomme, modèle par modèle, l'écriture qui DATE l'acte. Un acte que
 * l'exercice d'arrivée porte déjà (contrainte d'unicité) ne peut pas suivre ·
 * il est nommé avec son issue (annuler puis refaire), jamais un refus sans
 * issue. La liste est écrite à la main, comme celle des modules qui retiennent
 * une écriture (`detenteurs-ecriture.ts`) · une relation nouvelle oblige
 * quelqu'un à décider si son acte suit l'écriture.
 */
export interface ActeQuiSuitSonEcriture {
  /** Le modèle Prisma, tel que le délégué du client le nomme. */
  modele: string;
  /** Libellé de l'acte dans un refus. */
  libelle: string;
  /** La colonne de l'écriture qui DATE l'acte (constatation, dotation, revue). */
  colonne: string;
  /** Les champs, hors `exerciceId`, de la contrainte d'unicité qui porte l'exercice. */
  unicite: string[] | null;
  /**
   * Modèle porté par son bien, sans `tenantId` propre · borné par la relation
   * (la garde de cloisonnement ne le voit pas, la borne s'écrit donc ici).
   */
  parLeBien?: true;
}

export const ACTES_QUI_SUIVENT_LEUR_ECRITURE: readonly ActeQuiSuitSonEcriture[] = [
  { modele: 'depreciationImmobilisation', libelle: 'dépréciation d’immobilisation', colonne: 'ecritureId', unicite: ['immobilisationId', 'nature'], parLeBien: true },
  { modele: 'reclassementImmobilisation', libelle: 'reclassement d’immobilisation', colonne: 'ecritureId', unicite: null, parLeBien: true },
  { modele: 'regularisation', libelle: 'charge à payer ou produit à recevoir', colonne: 'ecritureConstatationId', unicite: null },
  // L'AFFECTATION DU RÉSULTAT N'EST PAS ICI · elle porte l'exercice dont elle
  // affecte le résultat, que la décision suppose CLÔTURÉ, et son écriture est
  // datée dans l'exercice qui suit. L'exercice qu'on arrête est ouvert, et
  // l'exercice de liquidation dont on annule l'arrêt l'est aussi · aucune
  // affectation ne peut donc porter l'un d'eux (relecture du 2026-10-07,
  // mineur 8 · l'entrée était morte).
  { modele: 'clotureLocationAcquisition', libelle: 'clôture d’un contrat de location-acquisition', colonne: 'ecritureId', unicite: ['contratId'] },
  { modele: 'reductionSubventionImmobilisation', libelle: 'réduction de subvention d’investissement', colonne: 'ecritureId', unicite: null },
  { modele: 'revisionPlanAmortissement', libelle: 'révision du plan d’amortissement', colonne: 'ecritureId', unicite: null },
  { modele: 'coutEmpruntIncorpore', libelle: 'incorporation de coûts d’emprunt', colonne: 'ecritureId', unicite: null },
  { modele: 'creanceDouteuse', libelle: 'reclassement d’une créance douteuse', colonne: 'ecritureReclassementId', unicite: null },
  { modele: 'ajustementCreanceDouteuse', libelle: 'revue d’une créance douteuse', colonne: 'ecritureId', unicite: ['creanceId', 'annuleeLe'] },
  { modele: 'mouvementCreanceDouteuse', libelle: 'mouvement d’une créance douteuse', colonne: 'ecritureId', unicite: null },
];

/**
 * LES ACTES SANS ÉCRITURE QUI PORTENT LEUR DATE SUIVENT CETTE DATE (relecture
 * du 2026-10-07, mineur 3) · une OD analytique et un engagement de dépense
 * sont datés et rattachés à l'exercice, sans écriture générale. Ils vont avec
 * leur date, comme une écriture ; un engagement que l'exercice d'arrivée porte
 * déjà sous la même référence est nommé (`motifActeQuiNePeutSuivre`). Le
 * relevé d'unités d'œuvre n'a pas de date · il ne suit rien, il est NOMMÉ au
 * résultat du geste, à revoir pour la période nouvelle (sa saisie se refait).
 */
export const ACTES_DATES_QUI_SUIVENT_LEUR_DATE: readonly ActeQuiSuitSonEcriture[] = [
  { modele: 'odAnalytique', libelle: 'OD analytique', colonne: 'date', unicite: null },
  { modele: 'engagementDepense', libelle: 'engagement de dépense', colonne: 'date', unicite: ['tenantId', 'nature', 'reference'] },
];

/**
 * LES ACTES DONT LE MONTANT DÉPEND DE LA PÉRIODE NE SUIVENT PAS (relecture du
 * 2026-10-07, bloquant 1). AUDCIF art. 59 · « Le résultat de chaque exercice
 * est indépendant de celui qui le précède et de celui qui le suit. Pour sa
 * détermination, il convient de lui rattacher et de lui imputer tous les
 * événements et opérations qui lui sont propres, et ceux-là seulement. » Une
 * dotation, un dérogatoire, une reprise de subvention, une désactualisation,
 * un impôt constaté ou une réévaluation de clôture sont CALCULÉS sur la
 * période de l'exercice qui les porte · l'arrêt change cette période. Déplacée
 * dans l'exercice de liquidation, la dotation de l'année entière s'y ajoutait
 * à celle qu'on passait ensuite au prorata de l'exercice arrêté (1 200 000
 * puis 600 000 · 1 800 000 sur l'année, sans un signal). Restée sur
 * l'exercice arrêté, elle y porterait douze mois sur cinq et demi. Aucune des
 * deux places n'est juste · l'arrêt NOMME l'acte avec son issue (l'annuler,
 * puis le refaire sur chaque exercice) et refuse tant qu'il existe, sur
 * l'exercice qu'on arrête comme sur celui dont la période change (l'exercice
 * qui suit et devient l'exercice de liquidation, l'exercice rendu par
 * l'annulation de l'arrêt, l'exercice repris rattaché à la liquidation).
 *
 * `retirable` · l'acte se retire avec son écriture AU BROUILLARD, et lui
 * seul (AUDCIF art. 22, 2° · rien n'est encore entré au livre-journal), quand
 * aucun geste du module ne l'annule · le cabinet le demande à l'arrêt
 * (`retirerActesDeLaPeriode`), jamais d'office. `issue` · le geste du module
 * qui l'annule, quand il existe.
 */
export interface ActeDeLaPeriode {
  modele: string;
  libelle: string;
  /** La colonne de l'écriture de l'acte, pour la nommer et la retirer. */
  colonne: string;
  parLeBien?: true;
  /** Filtre des actes encore en vigueur (un acte annulé ne compte plus). */
  actif?: Record<string, null>;
  /** Se retire au brouillard avec son écriture, faute de geste d'annulation. */
  retirable?: true;
  /** Le geste du module qui l'annule, quand il existe. */
  issue?: string;
}

export const ACTES_DE_LA_PERIODE: readonly ActeDeLaPeriode[] = [
  { modele: 'dotationAmortissement', libelle: 'dotation aux amortissements', colonne: 'ecritureId', parLeBien: true, retirable: true },
  { modele: 'amortissementDerogatoire', libelle: 'amortissement dérogatoire', colonne: 'ecritureId', retirable: true },
  { modele: 'repriseSubventionImmobilisation', libelle: 'reprise de subvention d’investissement', colonne: 'ecritureId', retirable: true },
  { modele: 'mouvementDemantelement', libelle: 'mouvement de la provision pour démantèlement', colonne: 'ecritureId' },
  {
    modele: 'reevaluation',
    libelle: 'réévaluation des devises',
    colonne: 'ecritureEcartsId',
    actif: { annuleeLe: null },
    issue: 'annulez-la (Devises, réévaluations, « Annuler »)',
  },
  { modele: 'reevaluationBilan', libelle: 'réévaluation des immobilisations', colonne: 'ecritureId' },
  { modele: 'repriseProvisionReevaluation', libelle: 'reprise de la provision spéciale de réévaluation', colonne: 'ecritureId' },
  {
    modele: 'constatImpotResultat',
    libelle: 'constat de l’impôt sur le résultat',
    colonne: 'ecritureId',
    actif: { annuleeLe: null },
    issue: 'annulez le constat (Résultat fiscal, « Annuler l’écriture de l’impôt »)',
  },
];

/** Un acte de la période, lu et nommé. */
export interface ActeDeLaPeriodeLu {
  modele: string;
  id: string;
  libelle: string;
  /** « OD n° 12 », ou « sans écriture ». */
  piece: string;
  /** L'exercice qui le porte, lisible (« du 01/01/2026 au 31/12/2026 »). */
  periode: string;
  /** Se retire à la demande · écriture au brouillard (ou aucune), bien non sorti. */
  retirable: boolean;
  /** L'écriture à retirer avec lui. */
  ecritureId: string | null;
  issue: string;
}

/** L'issue d'un acte de la période, dite au refus. */
export function issueActeDeLaPeriode(acte: ActeDeLaPeriode, etat: { auBrouillard: boolean; bienSorti: boolean }): string {
  if (acte.issue) return `${acte.issue}, puis refaites-la sur chaque exercice`;
  if (acte.retirable && !etat.bienSorti) {
    return (
      'relancez le geste en acceptant de retirer les actes de la période (' +
      (etat.auBrouillard ? 'son écriture au brouillard part avec lui' : 'son écriture validée s’inscrit en négatif, AUDCIF art. 20, al. 2') +
      '), puis refaites-le sur chaque exercice'
    );
  }
  return (
    'aucun geste d’OmegaX ne l’annule encore' +
    (etat.bienSorti ? ' (le bien est sorti, et l’acte tient sa sortie)' : '') +
    ' · la porte de régularisation reste au suivi, l’éditeur vous accompagne'
  );
}

/** Le refus nommé des actes de la période, ou `null`. */
export function motifActesDeLaPeriode(actes: ActeDeLaPeriodeLu[]): string | null {
  if (actes.length === 0) return null;
  const nommes = actes.slice(0, 5).map((a) => `${a.libelle} (${a.piece}, exercice ${a.periode}) · ${a.issue}`);
  return (
    `${actes.length} acte(s) dont le montant se calcule sur la période de l'exercice ne peuvent ni suivre leur ` +
    'écriture ni rester où ils sont, la période changeant (AUDCIF art. 59, chaque exercice ne reçoit que ce qui lui ' +
    `est propre) · ${nommes.join(' ; ')}${actes.length > 5 ? ' ; …' : ''}.`
  );
}

/** Ce que l'arrêt lit avant d'écrire, pour décider s'il passe. */
export interface EtatAvantArret {
  exercice: { dateDebut: Date; dateFin: Date; clos: boolean };
  dissolution: Date | null;
  /**
   * Exercices qui commencent après l'exercice à arrêter. `usages` · ce qui les
   * occupe, lu sans liquidation seulement (majeur 2), `null` s'ils ne portent
   * rien (hors report à-nouveau provisoire).
   */
  posterieurs: Array<{ dateDebut: Date; dateFin: Date; clos: boolean; usages?: string | null }>;
  /** Société dissoute sans liquidation (AUSCGIE art. 201 al. 4). */
  sansLiquidation: boolean;
  /** Écritures de l'exercice datées après la dissolution. */
  ecrituresApres: number;
  /**
   * Les actes dont le montant dépend de la période, sur les exercices dont la
   * période change (bloquant 1) · ceux que le geste retire à la demande en
   * sont ÔTÉS par l'appelant qui la porte.
   */
  actesDeLaPeriode: ActeDeLaPeriodeLu[];
}

/**
 * LE REFUS DE L'ARRÊT, ou `null` · une seule règle pour le serveur et pour la
 * proposition du bouton à l'écran (constat 15 · le bouton était proposé alors
 * que le serveur refusait). Chaque refus nomme son issue.
 */
export function motifRefusArret(e: EtatAvantArret): string | null {
  const d = e.dissolution;
  if (!d) {
    return 'Aucune dissolution n’est déclarée · déclarez sa date dans Paramètres du dossier avant d’arrêter l’exercice.';
  }
  if (e.exercice.clos) return 'Cet exercice est clôturé · ses dates ne changent plus.';
  if (d.getTime() < e.exercice.dateDebut.getTime() || d.getTime() > e.exercice.dateFin.getTime()) {
    return (
      `La dissolution du ${jourFr(d)} ne tombe pas dans cet exercice (du ${jourFr(e.exercice.dateDebut)} au ` +
      `${jourFr(e.exercice.dateFin)}) · arrêtez celui qui la contient.`
    );
  }
  if (d.getTime() === e.exercice.dateFin.getTime()) {
    return `L'exercice se termine déjà à la date de dissolution, le ${jourFr(d)}.`;
  }
  if (e.sansLiquidation) {
    if (e.ecrituresApres > 0) {
      return (
        `${e.ecrituresApres} écriture(s) de cet exercice sont datées après la dissolution · sans liquidation, le ` +
        'patrimoine passe à l’associé unique personne morale (AUSCGIE art. 201 al. 4), et ces opérations se passent ' +
        'dans sa comptabilité, pas dans celle de la société dissoute. Au brouillard, supprimez-les ; validées, ' +
        'inscrivez-les en négatif à une date qui précède la dissolution (AUDCIF art. 20, al. 2), puis arrêtez ' +
        'l’exercice.'
      );
    }
    // SANS LIQUIDATION, RIEN NE SUIT L'EXERCICE ARRÊTÉ (relecture du
    // 2026-10-07, majeur 2) · la société s'éteint à la dissolution, son
    // patrimoine transmis à l'associé unique (AUSCGIE art. 201 al. 4). Un
    // exercice postérieur laissé en vie recevait le report de la clôture et
    // ne se clôturait jamais. Vide, l'arrêt le retire ; occupé, il est NOMMÉ.
    const occupe = e.posterieurs.find((p) => p.clos || p.usages);
    if (occupe) {
      return (
        `L'exercice du ${jourFr(occupe.dateDebut)} au ${jourFr(occupe.dateFin)} suit celui-ci · sans liquidation, la ` +
        'société dissoute n’a plus d’exercice après la dissolution, son patrimoine passant à l’associé unique personne ' +
        `morale (AUSCGIE art. 201 al. 4). ${occupe.clos ? 'Il est clôturé' : `Il porte ${occupe.usages}`} · ` +
        'ce qu’il porte relève de la comptabilité de l’associé. Au brouillard, supprimez-le ; validé, inscrivez-le en ' +
        'négatif (AUDCIF art. 20, al. 2) ; l’arrêt retire ensuite l’exercice vide.'
      );
    }
    return motifActesDeLaPeriode(e.actesDeLaPeriode);
  }
  if (e.posterieurs.length > 1) {
    const [a, b] = e.posterieurs;
    return (
      `Les exercices du ${jourFr(a.dateDebut)} au ${jourFr(a.dateFin)} et du ${jourFr(b.dateDebut)} au ` +
      `${jourFr(b.dateFin)} suivent déjà celui-ci · la liquidation forme un seul exercice, du lendemain de la ` +
      'dissolution à sa clôture (AUDCIF art. 7 al. 4), et un seul d’entre eux peut le devenir. OmegaX ne retire pas ' +
      'un exercice · faites porter les écritures du dernier au précédent, ou contactez l’éditeur.'
    );
  }
  if (e.posterieurs.length === 1 && e.posterieurs[0].clos) {
    return 'L’exercice qui suit est déjà clôturé · ses dates ne changent plus, et il ne peut devenir l’exercice de liquidation.';
  }
  return motifActesDeLaPeriode(e.actesDeLaPeriode);
}

/** Le texte d'un conflit d'unicité · l'acte, l'exercice d'arrivée et l'issue. */
export function motifActeQuiNePeutSuivre(acte: ActeQuiSuitSonEcriture, piece: string): string {
  return (
    `La ${acte.libelle} de la pièce ${piece} est datée après la dissolution et doit suivre son écriture dans ` +
    'l’exercice de liquidation, qui en porte déjà une de même nature · annulez l’une des deux (puis refaites-la si ' +
    'elle reste due), et relancez l’arrêt.'
  );
}

/**
 * LA FIN DE L'EXERCICE D'ORIGINE, retrouvée pour l'annulation de l'arrêt ·
 * l'exercice coïncide avec l'année civile (AUDCIF art. 7 al. 2) · le
 * 31 décembre de l'année de la dissolution. Un premier exercice long ouvert au
 * second semestre peut finir l'année suivante · le 31 décembre de l'année de la
 * dissolution reste admis par l'art. 7 (« la même année ou la suivante »),
 * et l'état rendu est cohérent.
 */
export function finDOrigineDeLExerciceArrete(dissolution: Date): Date {
  return new Date(Date.UTC(dissolution.getUTCFullYear(), 11, 31));
}
