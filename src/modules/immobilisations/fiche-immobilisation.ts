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
  /** Usages du bien hors annulations de traitements. */
  usages: UsageDuBien[];
  /** Annulations de traitements dont une écriture reste retenue (inscrite en négatif). */
  annulationsRetenant: number;
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
  if (e.acquisition?.validee) {
    return (
      `L’écriture d’acquisition (pièce n° ${e.acquisition.numeroPiece ?? '·'}) est validée · la fiche ne se supprime plus ` +
      '(AUDCIF art. 22, 2°). Un bien qui n’existe plus se sort (mise au rebut, destruction, vol).'
    );
  }
  if (e.acquisition?.exerciceClos) return 'L’écriture d’acquisition est dans un exercice clôturé · la fiche ne se supprime plus.';
  if (e.usages.length > 0) {
    return `La fiche est utilisée · ${e.usages.map(libelleUsage).join(', ')}. Annulez ou retirez d’abord ces usages.`;
  }
  if (e.annulationsRetenant > 0) {
    return (
      `${e.annulationsRetenant} traitement(s) annulé(s) de ce bien gardent leur écriture et son négatif au journal · la fiche qui ` +
      'les retient ne se supprime pas (AUDCIF art. 22, 2°).'
    );
  }
  if (e.motifLignesTenues) return e.motifLignesTenues;
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
