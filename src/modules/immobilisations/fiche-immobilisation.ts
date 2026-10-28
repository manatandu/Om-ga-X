/**
 * MODIFIER, SUPPRIMER OU DUPLIQUER LA FICHE D'UN BIEN (ligne sage-l4,
 * fonction n° 66, décision D7 de la reproduction de Sage) · les règles pures.
 *
 * AUDCIF art. 20 et art. 22, 2° · ce qui a produit une écriture VALIDÉE ne se
 * retouche plus (« l'irréversibilité des traitements interdise toute
 * suppression, addition ou modification ultérieure »). D'où deux familles de
 * champs.
 *
 *  · LIBRES · désignation, numéro d'inventaire, nature au barème. Aucun
 *    effet comptable · ils se modifient à tout moment, bien sorti compris.
 *  · À EFFET · compte, contrepartie, dates, valeur, plan. Ils fondent
 *    l'écriture d'acquisition et chaque dotation · ils ne se modifient que
 *    tant qu'aucune écriture du bien n'est validée ET qu'aucun traitement ne
 *    les a lus (une dotation calculée sur l'ancienne valeur resterait au
 *    journal, la fiche disant autre chose, sans qu'aucun total ne bouge,
 *    CLAUDE.md § 10 bis). Ensuite, par les gestes qui existent · le
 *    reclassement pour le compte, la révision du plan pour la durée et le
 *    mode.
 *
 * Une écriture d'un traitement ANNULÉ (fonction n° 67) ne compte pas pour la
 * modification · origine et négatif se neutralisent et l'acte n'est plus sur
 * la fiche. Elle compte pour la suppression, qu'elle retient (son
 * enregistrement d'annulation pointe le bien).
 */

import { motifRefusEntreeApresDetention } from './detention-bien';

/** Les champs sans effet comptable. */
export const CHAMPS_LIBRES = ['designation', 'numeroInventaire', 'natureFiscaleCle'] as const;

/** Les champs qui fondent l'écriture d'acquisition et le plan. */
export const CHAMPS_A_EFFET = [
  'compteImmobilisationId',
  'compteContrepartieId',
  'dateAcquisition',
  'dateMiseEnService',
  'valeurOrigine',
  'valeurResiduelle',
  'dureeAmortissementAns',
  'modeAmortissement',
  'unitesOeuvrePrevues',
  'uniteOeuvreLibelle',
  'amortissementAnterieur',
] as const;

export type ChampAEffet = (typeof CHAMPS_A_EFFET)[number];

/** Les champs à effet que la demande porte · `undefined` vaut « inchangé ». */
export function champsAEffetDemandes(dto: Partial<Record<ChampAEffet, unknown>>): ChampAEffet[] {
  return CHAMPS_A_EFFET.filter((c) => dto[c] !== undefined);
}

/** Les usages d'un bien, nommés comme l'écran les montre (relations lues dans le schéma). */
const LIBELLES_USAGES: Record<string, string> = {
  'DotationAmortissement.immobilisationId': 'dotations',
  'DepreciationImmobilisation.immobilisationId': 'dépréciations',
  'TransfertImmobilisationGroupe.immobilisationId': 'transfert dans le groupe',
  'RevisionPlanAmortissement.immobilisationId': 'révisions du plan',
  'AmortissementDerogatoire.immobilisationId': 'amortissements dérogatoires',
  'LigneReevaluationBilan.immobilisationId': 'réévaluations',
  'RepriseSubventionImmobilisation.immobilisationId': 'reprises de subvention',
  'SubventionImmobilisation.immobilisationId': 'subventions rattachées',
  'ConsommationUniteOeuvre.immobilisationId': "relevés d'unités d'œuvre",
  'CoutEmpruntIncorpore.immobilisationId': "coûts d'emprunt incorporés",
  'MouvementDemantelement.immobilisationId': 'mouvements du démantèlement',
  'ReclassementImmobilisation.immobilisationId': 'reclassements',
  'FicheInventaire.immobilisationId': "fiches d'inventaire",
  'ContratLocationAcquisition.immobilisationId': 'contrat de location-acquisition',
  'Immobilisation.immobilisationPrincipaleId': 'composants rattachés',
  'Immobilisation.composantRemplaceId': 'composant qui le remplace',
  'AnnulationTraitementImmobilisation.immobilisationId': 'annulations de traitements',
  'DetentionBien.immobilisationId': 'détentions par un salarié',
  'RecuDetentionBien.immobilisationId': 'reçus de détention',
};

export interface UsageDuBien {
  modele: string;
  champ: string;
  nombre: number;
}

export function libelleUsage(u: UsageDuBien): string {
  return `${LIBELLES_USAGES[`${u.modele}.${u.champ}`] ?? u.modele} (${u.nombre})`;
}

/** Ce que la fiche porte, lu par le service, pour juger les deux gestes. */
export interface EtatDeLaFiche {
  sortie: boolean;
  /** Les écritures propres au bien hors acquisition (mise en service, sortie, cession, solde d'une dette aléatoire, écart de réévaluation à la sortie). */
  autresEcritures: string[];
  /** L'écriture d'acquisition · null pour un bien repris, qui n'en a pas. */
  acquisition: null | { validee: boolean; numeroPiece: number | null; nombreLignes: number; exerciceClos: boolean };
  /** Le motif de lettrage ou de pointage de l'écriture d'acquisition, s'il y en a un. */
  motifLignesTenues: string | null;
  /** Une opération qui a fait naître la fiche et que la modification ne sait pas rejouer. */
  origineParticuliere: string | null;
  /**
   * La fiche est née d'une ligne d'une écriture DÉJÀ PASSÉE au journal
   * (fonction n° 68, `ligneAcquisitionId`) · l'écriture n'est pas celle du
   * module, la fiche la retient sans l'avoir écrite.
   */
  neeDUneEcriturePassee: boolean;
  /** Usages du bien hors annulations de traitements. */
  usages: UsageDuBien[];
  /** Annulations de traitements dont une écriture reste retenue (inscrite en négatif). */
  annulationsRetenant: number;
  /**
   * La clôture (AAAA-MM-JJ) du premier exercice CLÔTURÉ du dossier qui finit
   * au plus tôt à la date d'acquisition, ou null · ce bien figure à ses états
   * (note des immobilisations, livre d'inventaire, AUDCIF art. 19). Relecture
   * M4 · un bien REPRIS n'a pas d'écriture d'acquisition, et rien ne le
   * disait porté par un exercice clos · sa valeur et son amortissement
   * antérieur se modifiaient, sa fiche se supprimait. Un exercice ne porte
   * que la fiche qui existait à sa clôture (`exerciceClosQuiPorteLaFiche`).
   */
  exerciceClosQuiLaPorte: string | null;
  /**
   * La fiche est née du RENOUVELLEMENT d'un composant (`renouveler`,
   * `composantRemplaceId`) · la désignation du composant remplacé, ou null.
   * Elle porte la trace du renouvellement (AUDCIF Titre VIII ch. 4 § 4.1) ·
   * supprimée, l'ancien composant resterait sorti sans ce qui le remplace.
   */
  renouvelle: string | null;
  /**
   * Les documents joints à la fiche (ligne sage-l6, fonction n° 22) · ce ne
   * sont pas des traitements, ils ne figent pas la fiche ; ils retiennent
   * seulement sa SUPPRESSION, qui les perdrait. Absent = aucun.
   */
  documents?: number;
  /**
   * Ligne Microfina M4 · les détentions du bien par un salarié et leurs reçus
   * numérotés. Pas des traitements (aucun montant, aucune écriture) · ils ne
   * figent ni la valeur ni le plan ; ils retiennent la SUPPRESSION, le
   * registre des détenteurs gardant qui a eu le bien en main, et la suite
   * des reçus ne se troue pas.
   */
  detentions?: number;
  /**
   * Relecture m1 · le jour de la première remise VIVANTE du bien (AAAA-MM-JJ),
   * ou null · une date d'acquisition ne se porte pas après elle.
   */
  premiereRemise?: string | null;
}

/**
 * L'EXERCICE CLOS QUI A PORTÉ LA FICHE (relecture M4, précisée) · le premier
 * exercice clôturé, finissant au plus tôt à la date d'acquisition, DONT LA
 * CLÔTURE EST POSTÉRIEURE À LA FICHE · ses états (note des immobilisations,
 * livre d'inventaire, AUDCIF art. 19) l'ont lue, et une erreur s'y corrige
 * dans l'exercice en cours (art. 20, al. 3 et 4). Une fiche créée APRÈS la
 * clôture (le bien repris oublié, saisi au bilan d'ouverture de N+1) n'a été
 * lue par aucun état arrêté · la figer d'emblée enfermait la faute de frappe
 * de sa saisie, sans modification ni retrait possibles.
 *
 * Le moment de la clôture se lit au journal d'audit (`clotures`, les
 * maillons qui ont fait passer l'exercice à CLOTURE). Un exercice sans
 * maillon de clôture a été clos avant le début du journal · il précède la
 * fiche si le journal la précède ; sinon le moment est inconnu, et la fiche
 * est tenue pour portée · le doute fige, jamais il ne délie.
 */
export function exerciceClosQuiPorteLaFiche(p: {
  ficheCreeeLe: Date;
  debutDuJournal: Date | null;
  clos: readonly { dateFin: Date; clotures: readonly Date[] }[];
}): Date | null {
  const creee = p.ficheCreeeLe.getTime();
  for (const e of p.clos) {
    if (e.clotures.some((h) => h.getTime() > creee)) return e.dateFin;
    if (e.clotures.length === 0 && (p.debutDuJournal === null || p.debutDuJournal.getTime() > creee)) return e.dateFin;
  }
  return null;
}

function motifExerciceClosQuiLaPorte(cloture: string, geste: 'modifier' | 'supprimer'): string {
  return geste === 'modifier'
    ? `L’exercice clos le ${cloture} a porté ce bien à ses états (note des immobilisations, livre d’inventaire, AUDCIF ` +
        'art. 19) · valeur, compte, dates et plan ne se modifient plus depuis la fiche ; une erreur d’un exercice clos se ' +
        'corrige dans l’exercice en cours (AUDCIF art. 20, al. 3 et 4). Le compte se change par un reclassement, la durée ' +
        'et le mode par une révision du plan.'
    : `L’exercice clos le ${cloture} a porté ce bien à ses états (note des immobilisations, livre d’inventaire, AUDCIF ` +
        'art. 19) · la fiche ne se supprime plus. Un bien qui n’existe plus se sort (mise au rebut, destruction, vol).';
}

/**
 * Pourquoi les champs à effet ne se modifient pas, ou null · le premier motif
 * qui s'applique, avec son issue.
 */
export function motifRefusModificationAEffet(e: EtatDeLaFiche): string | null {
  if (e.sortie) {
    return 'Le bien est sorti · sa fiche ne se modifie plus que pour sa désignation, son numéro d’inventaire et sa nature.';
  }
  if (e.autresEcritures.length > 0) {
    return (
      `La fiche porte déjà ${e.autresEcritures.join(', ')} · valeur, compte, dates et plan ne se modifient plus depuis la ` +
      'fiche (AUDCIF art. 22, 2°). Le compte se change par un reclassement, la durée et le mode par une révision du plan.'
    );
  }
  if (e.neeDUneEcriturePassee) {
    // La valeur, le compte et la date sont ceux de la LIGNE · la fiche n'a
    // rien écrit et ne réécrit rien (AUDCIF art. 22, 2°). Avant tout usage,
    // la voie la plus courte est de la retirer et de la recréer depuis la
    // même ligne, que le retrait rend à la liste.
    const issue =
      e.usages.length > 0 || e.annulationsRetenant > 0 || e.acquisition?.exerciceClos || e.exerciceClosQuiLaPorte
        ? 'La durée et le mode se changent par une révision du plan, le compte par un reclassement.'
        : 'Pour un autre plan, retirez la fiche (l’écriture reste au journal) et recréez-la depuis la même ligne ; ' +
          'une mise en service différée se pose par « Mettre en service ».';
    return (
      `La fiche est née d’une écriture déjà passée au journal (pièce n° ${e.acquisition?.numeroPiece ?? '·'}) · valeur, compte ` +
      `et date d’acquisition sont ceux de sa ligne, la fiche ne les retouche pas. ${issue}`
    );
  }
  if (e.acquisition?.validee) {
    return (
      `L’écriture d’acquisition (pièce n° ${e.acquisition.numeroPiece ?? '·'}) est validée · valeur, compte, dates et plan ne ` +
      'se retouchent plus depuis la fiche (AUDCIF art. 22, 2°). Le compte se change par un reclassement, la durée et le mode ' +
      'par une révision du plan.'
    );
  }
  if (e.acquisition?.exerciceClos) {
    return 'L’écriture d’acquisition est dans un exercice clôturé · la fiche ne se modifie plus (AUDCIF art. 20, al. 3).';
  }
  if (e.exerciceClosQuiLaPorte) return motifExerciceClosQuiLaPorte(e.exerciceClosQuiLaPorte, 'modifier');
  if (e.usages.length > 0) {
    return (
      `Des traitements ont lu cette fiche · ${e.usages.map(libelleUsage).join(', ')}. Ils ont été calculés sur les valeurs ` +
      'actuelles · annulez-les d’abord (onglet Traitements, du plus récent au plus ancien), puis modifiez la fiche.'
    );
  }
  if (e.origineParticuliere) {
    return `La fiche est née ${e.origineParticuliere} · la modification ne rejoue pas cette opération. Supprimez la fiche et refaites l’opération.`;
  }
  if (e.motifLignesTenues) return e.motifLignesTenues;
  return null;
}

/** Pourquoi la fiche ne se supprime pas, ou null. */
export function motifRefusSuppression(e: EtatDeLaFiche): string | null {
  if (e.sortie) return 'Le bien est sorti · sa fiche et son écriture de sortie restent au registre (AUDCIF art. 22, 2°).';
  if (e.autresEcritures.length > 0) {
    return `La fiche porte ${e.autresEcritures.join(', ')} · elle ne se supprime plus (AUDCIF art. 22, 2°).`;
  }
  // UNE FICHE NÉE D'UNE ÉCRITURE DÉJÀ PASSÉE SE RETIRE (fonction n° 68,
  // lecture de la décision D7) · l'écriture n'est pas la sienne, elle était
  // au journal avant elle et y reste intacte ; le retrait défait le seul lien
  // et rend la ligne à la liste « Créer depuis les écritures ». Le lettrage
  // ou le pointage de cette écriture ne la regarde donc pas. Ce qui la
  // retient reste ce qui retient toute fiche · une écriture du module, un
  // usage, un exercice clôturé.
  if (e.neeDUneEcriturePassee) {
    if (e.acquisition?.exerciceClos) {
      return 'L’écriture dont la fiche est née est dans un exercice clôturé · le bien figure à ses états, la fiche ne se retire plus.';
    }
    if (e.exerciceClosQuiLaPorte) {
      return `L’exercice clos le ${e.exerciceClosQuiLaPorte} a porté ce bien à ses états (AUDCIF art. 19) · la fiche ne se retire plus.`;
    }
  } else if (e.acquisition?.validee) {
    return (
      `L’écriture d’acquisition (pièce n° ${e.acquisition.numeroPiece ?? '·'}) est validée · la fiche ne se supprime plus ` +
      '(AUDCIF art. 22, 2°). Un bien qui n’existe plus se sort (mise au rebut, destruction, vol).'
    );
  }
  if (e.acquisition?.exerciceClos) return 'L’écriture d’acquisition est dans un exercice clôturé · la fiche ne se supprime plus.';
  if (e.exerciceClosQuiLaPorte) return motifExerciceClosQuiLaPorte(e.exerciceClosQuiLaPorte, 'supprimer');
  if (e.renouvelle) {
    return (
      `La fiche est née du renouvellement de « ${e.renouvelle} » et en porte la trace (AUDCIF Titre VIII ch. 4 § 4.1) · ` +
      'supprimée, le composant remplacé resterait sorti sans ce qui le remplace. Corrigez-la par la modification tant que ' +
      'son écriture d’acquisition est au brouillard.'
    );
  }
  if (e.usages.length > 0) {
    return `La fiche est utilisée · ${e.usages.map(libelleUsage).join(', ')}. Annulez ou retirez d’abord ces usages.`;
  }
  if (e.annulationsRetenant > 0) {
    return (
      `${e.annulationsRetenant} traitement(s) annulé(s) de ce bien gardent leur écriture et son négatif au journal · la fiche qui ` +
      'les retient ne se supprime pas (AUDCIF art. 22, 2°).'
    );
  }
  // Ligne Microfina M4 · un acte de détention VIVANT retient la fiche ;
  // annulé, il part détaché d'elle (relecture B1), d'où l'issue nommée.
  if ((e.detentions ?? 0) > 0) {
    return (
      `La fiche porte ${e.detentions} acte(s) de détention par un salarié encore en vigueur, avec leurs reçus numérotés · ` +
      'annulez-les d’abord depuis le volet Détenteur, du plus récent au plus ancien, puis supprimez la fiche. Un bien qui ' +
      'existe mais n’est plus utilisé se sort (mise au rebut, destruction, vol).'
    );
  }
  // Ligne sage-l6, fonction n° 22 · un document ne se perd jamais avec la
  // fiche, en silence · on le retire d'abord, de l'onglet Documents.
  if ((e.documents ?? 0) > 0) {
    return `La fiche porte ${e.documents} document(s) joint(s) · retirez-les d’abord, depuis l’onglet Documents de la fiche.`;
  }
  if (e.motifLignesTenues && !e.neeDUneEcriturePassee) return e.motifLignesTenues;
  return null;
}

/**
 * LA COPIE PROPOSÉE PAR « DUPLIQUER » · une nouvelle fiche, sans écriture,
 * dont le cabinet confirme chaque valeur. Ce que la duplication ne reprend
 * pas · le numéro d'inventaire (une étiquette par bien), les dates (un autre
 * bien, une autre acquisition), le repris (fait de l'autre bien), le
 * composant (le principal ne se déclare pas par copie).
 */
export interface FicheACopier {
  designation: string;
  compteImmobilisationId: string;
  natureFiscaleCle: string | null;
  lieuId: string | null;
  valeurOrigine: number;
  valeurResiduelle: number;
  dureeAmortissementAns: number;
  modeAmortissement: string;
  unitesOeuvrePrevues: number | null;
  uniteOeuvreLibelle: string | null;
}

export function propositionDeDuplication(f: FicheACopier) {
  return {
    designation: `${f.designation} (copie)`.slice(0, 200),
    compteImmobilisationId: f.compteImmobilisationId,
    natureFiscaleCle: f.natureFiscaleCle,
    lieuId: f.lieuId,
    valeurOrigine: f.valeurOrigine,
    valeurResiduelle: f.valeurResiduelle,
    dureeAmortissementAns: f.dureeAmortissementAns,
    modeAmortissement: f.modeAmortissement,
    unitesOeuvrePrevues: f.unitesOeuvrePrevues,
    uniteOeuvreLibelle: f.uniteOeuvreLibelle,
  };
}

/**
 * Relecture m1 · la date d'acquisition demandée ne passe pas après la
 * première remise VIVANTE du bien (`motifRefusEntreeApresDetention`). Rien à
 * juger si la date ne change pas.
 */
export function motifRefusEntreeSousLesDetentions(e: EtatDeLaFiche, dateAcquisition: string | undefined): string | null {
  if (!dateAcquisition || !e.premiereRemise) return null;
  const jour = new Date(`${dateAcquisition.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(jour.getTime())) return null;
  return motifRefusEntreeApresDetention(jour, new Date(`${e.premiereRemise}T00:00:00.000Z`));
}
