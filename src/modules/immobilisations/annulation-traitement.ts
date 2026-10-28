/**
 * ANNULER UNE DOTATION OU UN TRAITEMENT D'IMMOBILISATION · ligne sage-l4,
 * fonction n° 67 de la comparaison avec Sage (M4 B-54, B-56), décision D6 de
 * la reproduction.
 *
 * LE TEXTE · AUDCIF art. 20, al. 2 · « Toute correction d'erreur commise et
 * découverte sur l'exercice en cours, s'effectue EXCLUSIVEMENT par
 * l'inscription en négatif des éléments erronés ; l'enregistrement exact est
 * ensuite opéré. » Art. 22, 2° · la validation fait entrer l'écriture au
 * livre-journal, et l'irréversibilité « interdise toute suppression » · au
 * brouillard, elle n'y est pas encore et se retire. L'article 20 n'est pas
 * dans la liste d'exclusion de l'art. 3 du SYCEBNL, l'article 22 non plus ·
 * la règle vaut aux deux référentiels.
 *
 * LE MODÈLE · celui des annulations existantes, sans en inventer un ·
 * réévaluation des devises (ligne A6, D6), revue des créances douteuses (B2),
 * négatifs de la paie (C2) · motif exigé, journal d'audit, brouillard
 * supprimé (`deleteMany` filtré sur le statut, une ligne et une seule, sinon
 * 409), validée inscrite en négatif (`inscrireEnNegatifPourAnnulation`),
 * refus dans un exercice clôturé, refus d'une ligne lettrée ou pointée
 * (`motifLignesTenues`), refus tant qu'un acte postérieur en dépend · on
 * annule à partir du plus récent, comme une réévaluation (B1 des liquidations).
 *
 * Ce fichier ne lit rien · il porte les règles, que le service nourrit.
 */

/** Les traitements qui s'annulent (énumération `NatureTraitementImmobilisation`). */
export type NatureTraitement =
  | 'DOTATION'
  | 'DEPRECIATION'
  | 'REVISION_PLAN'
  | 'DEROGATOIRE'
  | 'REEVALUATION'
  | 'REPRISE_SUBVENTION'
  | 'REPRISE_PROVISION_REEVALUATION';

/**
 * Tout ce qui s'est fait sur un bien et qu'un traitement antérieur peut
 * avoir nourri · les traitements annulables, et les gestes qui ne s'annulent
 * pas dans OmegaX (sortie, reclassement, transfert d'une dépréciation à la
 * mise en service, remplacement imprévu, réduction d'une subvention), nommés
 * pour que le refus dise où l'on est arrêté.
 */
export type NatureActe =
  | NatureTraitement
  | 'DEROGATOIRE_SOLDE'
  | 'SORTIE'
  | 'RECLASSEMENT'
  | 'TRANSFERT_DEPRECIATION'
  | 'REMPLACEMENT_IMPREVU'
  | 'REDUCTION_SUBVENTION';

/** Un acte lu sur le bien · `nature` dit sa table, `exerciceFin` et `creeLe` son rang. */
export interface ActeDuBien {
  nature: NatureActe;
  id: string;
  /** La fin de l'exercice de l'acte · l'ordre des exercices prime sur l'horloge. */
  exerciceFin: Date;
  /** L'instant de l'enregistrement · départage deux actes du même exercice. */
  creeLe: Date;
  /** Ce que l'écran et le refus en disent (« dotation de l'exercice clos le 31/12/2026 »). */
  libelle: string;
  /** Le bien nommé, pour une opération qui en porte plusieurs. */
  bien?: string;
  /** Reprise de subvention · celle de la sortie ne dépend pas de la sortie, elle la suit. */
  repriseALaSortie?: boolean;
  /**
   * L'issue propre de ce geste, quand il se défait AILLEURS que dans l'onglet
   * Traitements · la sortie par un transfert dans le groupe s'annule avec le
   * transfert, depuis le siège (ligne sage-l4, n° 73).
   */
  issue?: string;
}

/** Ligne sage-l4, n° 73 · ce que l'onglet Traitements dit d'un acte né d'un transfert dans le groupe. */
export const ISSUE_TRANSFERT_GROUPE = 'annulez le transfert depuis le siège (fenêtre Groupe, onglet « Transferts de biens »)';

/** Les natures annulables, dans l'ordre où l'écran les présente. */
export const NATURES_ANNULABLES: readonly NatureTraitement[] = [
  'DOTATION',
  'DEPRECIATION',
  'REVISION_PLAN',
  'DEROGATOIRE',
  'REEVALUATION',
  'REPRISE_SUBVENTION',
  'REPRISE_PROVISION_REEVALUATION',
];

/**
 * QUI DÉPEND DE QUOI · pour chaque traitement, les actes postérieurs qui en
 * ont lu le résultat. `strict` · seul un acte d'un exercice POSTÉRIEUR en
 * dépend (une dotation de l'exercice N ne relit pas la dépréciation de N,
 * qui se constate après elle · `passerDotation` ne lit que les dépréciations
 * des exercices antérieurs).
 *
 * Les dépendances, lues dans le code du module ·
 *  · DOTATION · la dotation suivante, la dépréciation et le plafond de sa
 *    reprise (valeur nette, plan rejoué), la révision (reliquat à
 *    l'ouverture), le dérogatoire (écart avec l'annuité comptable), la
 *    réévaluation (dotation de l'exercice exigée avant elle), la reprise de
 *    la subvention et de la provision spéciale (au rythme de la dotation), la
 *    sortie (valeur nette au 81), le reclassement (cumul viré), le
 *    remplacement imprévu (amortissements détachés au prorata).
 *  · DEPRECIATION · le plan se ré-étale sur la durée restante (ch. 12
 *    § 2.4.1), la sortie solde le 29, la reprise de subvention en deuxième
 *    méthode suit la dépréciation (§ 4.6).
 *  · REVISION_PLAN · tout ce qui relit le plan.
 *  · DEROGATOIRE · le dérogatoire suivant (cumul du 151), la reprise de la
 *    subvention (dotation globale, § 3.2), la sortie.
 *  · REEVALUATION · tout ce qui relit la valeur réévaluée.
 *  · REPRISE_SUBVENTION · la reprise suivante (cumul repris), la réduction.
 *  · REPRISE_PROVISION_REEVALUATION · la reprise suivante, la sortie (qui
 *    reprend au 861 le reste du 154).
 */
const DEPENDANTS: Record<NatureTraitement, Partial<Record<NatureActe, { strict: boolean }>>> = {
  DOTATION: {
    DOTATION: { strict: false },
    DEPRECIATION: { strict: false },
    REVISION_PLAN: { strict: true },
    DEROGATOIRE: { strict: false },
    DEROGATOIRE_SOLDE: { strict: false },
    REEVALUATION: { strict: false },
    REPRISE_SUBVENTION: { strict: false },
    REPRISE_PROVISION_REEVALUATION: { strict: false },
    SORTIE: { strict: false },
    RECLASSEMENT: { strict: false },
    REMPLACEMENT_IMPREVU: { strict: false },
  },
  DEPRECIATION: {
    DOTATION: { strict: true },
    DEPRECIATION: { strict: false },
    REVISION_PLAN: { strict: true },
    DEROGATOIRE: { strict: true },
    REEVALUATION: { strict: false },
    REPRISE_SUBVENTION: { strict: false },
    SORTIE: { strict: false },
    RECLASSEMENT: { strict: false },
    TRANSFERT_DEPRECIATION: { strict: false },
    REMPLACEMENT_IMPREVU: { strict: false },
  },
  REVISION_PLAN: {
    DOTATION: { strict: false },
    DEPRECIATION: { strict: false },
    REVISION_PLAN: { strict: false },
    DEROGATOIRE: { strict: false },
    REEVALUATION: { strict: false },
    REPRISE_SUBVENTION: { strict: false },
    REPRISE_PROVISION_REEVALUATION: { strict: false },
    SORTIE: { strict: false },
    RECLASSEMENT: { strict: false },
    REMPLACEMENT_IMPREVU: { strict: false },
  },
  DEROGATOIRE: {
    DEROGATOIRE: { strict: false },
    DEROGATOIRE_SOLDE: { strict: false },
    REPRISE_SUBVENTION: { strict: false },
    SORTIE: { strict: false },
  },
  REEVALUATION: {
    DOTATION: { strict: true },
    DEPRECIATION: { strict: false },
    REVISION_PLAN: { strict: false },
    REEVALUATION: { strict: false },
    // La reprise de subvention du MÊME exercice, passée après la réévaluation,
    // relit le brut et le cumul réévalués (`RepriseSubventionService`, valeur
    // d'origine et amortissements hors dotations) · annulée la réévaluation,
    // elle resterait au 799 sur une valeur que la fiche ne porte plus. Elle
    // s'annule donc d'abord. La reprise de la provision spéciale, elle, ne lit
    // que les réévaluations des exercices ANTÉRIEURS (`lignesReevaluation`
    // filtrées sur `dateFin < clôture`) · seule celle d'un exercice postérieur
    // en dépend.
    REPRISE_SUBVENTION: { strict: false },
    REPRISE_PROVISION_REEVALUATION: { strict: true },
    SORTIE: { strict: false },
    RECLASSEMENT: { strict: false },
    REMPLACEMENT_IMPREVU: { strict: false },
  },
  REPRISE_SUBVENTION: {
    REPRISE_SUBVENTION: { strict: false },
    REDUCTION_SUBVENTION: { strict: false },
    SORTIE: { strict: false },
  },
  REPRISE_PROVISION_REEVALUATION: {
    REPRISE_PROVISION_REEVALUATION: { strict: false },
    SORTIE: { strict: false },
  },
};

/**
 * Le dérogatoire SOLDÉ à la sortie se lit comme un dérogatoire · seuls le
 * dérogatoire suivant et la sortie qu'il prépare en dépendent.
 */
const DEPENDANTS_SOLDE_DEROGATOIRE: Partial<Record<NatureActe, { strict: boolean }>> = {
  DEROGATOIRE: { strict: false },
  DEROGATOIRE_SOLDE: { strict: false },
  SORTIE: { strict: false },
};

/** B est-il postérieur à A · exercice plus tardif, ou même exercice enregistré après. */
function estPosterieur(a: ActeDuBien, b: ActeDuBien, strict: boolean): boolean {
  const fa = a.exerciceFin.getTime();
  const fb = b.exerciceFin.getTime();
  if (fb > fa) return true;
  if (strict) return false;
  return fb === fa && b.creeLe.getTime() > a.creeLe.getTime();
}

/**
 * LES ACTES QUI DÉPENDENT DE CELUI QU'ON ANNULE · ceux qui ont lu son
 * résultat. Une sortie dépend de tout ce qui l'a précédée, quelle que soit
 * l'heure · c'est le dernier geste de la vie d'un bien. La reprise de
 * subvention passée À LA SORTIE ne dépend pas de la sortie, elle la suit ·
 * elle s'annule donc d'abord.
 */
export function actesQuiEnDependent(cible: ActeDuBien & { soldeDerogatoire?: boolean }, actes: readonly ActeDuBien[]): ActeDuBien[] {
  const nature = cible.nature as NatureTraitement;
  const table = cible.soldeDerogatoire ? DEPENDANTS_SOLDE_DEROGATOIRE : DEPENDANTS[nature];
  if (!table) return [];
  return actes.filter((b) => {
    if (b.id === cible.id && b.nature === cible.nature) return false;
    const regle = table[b.nature];
    if (!regle) return false;
    if (b.nature === 'SORTIE') return !(cible.nature === 'REPRISE_SUBVENTION' && cible.repriseALaSortie);
    return estPosterieur(cible, b, regle.strict);
  });
}

/** Les gestes qu'OmegaX n'annule pas · le refus le dit, au lieu de promettre une issue. */
const NON_ANNULABLES = new Set<NatureActe>(['SORTIE', 'RECLASSEMENT', 'TRANSFERT_DEPRECIATION', 'REMPLACEMENT_IMPREVU', 'REDUCTION_SUBVENTION']);

/**
 * LE MOTIF DU REFUS, OU `null` · dans l'ordre où le cabinet doit lire les
 * causes · déjà annulé, exercice clôturé, nature non annulable, puis l'acte
 * postérieur qui dépend de celui-ci, nommé, avec l'issue.
 */
export function motifRefusAnnulation(entree: {
  /** L'exercice de l'acte est clôturé · son erreur relève du report à nouveau (art. 20, al. 3). */
  exerciceClos: boolean;
  /** Transfert de dépréciation à la mise en service · il appartient à ce geste-là. */
  transfertMiseEnService?: boolean;
  /** Dotation ou dépréciation née d'un transfert dans le groupe · elle s'annule avec lui. */
  transfertGroupe?: boolean;
  /** Révision posée par une réévaluation libre (méthode 2) · elle suit son opération. */
  revisionDeReevaluation?: boolean;
  dependants: readonly ActeDuBien[];
}): string | null {
  if (entree.exerciceClos) {
    // AUDCIF art. 20, relu dans la compétence · al. 2, l'inscription en négatif
    // pour l'erreur « commise et découverte sur l'exercice en cours » ; al. 3,
    // l'erreur SIGNIFICATIVE d'un exercice antérieur « par ajustement du compte
    // report à nouveau » ; al. 4, l'information dans les Notes annexes.
    return (
      "L'exercice de ce traitement est clôturé · son erreur ne se corrige plus par inscription en négatif, qui ne vaut que " +
      "pour l'erreur « commise et découverte sur l'exercice en cours » (AUDCIF art. 20, al. 2). Significative, elle se " +
      'corrige par ajustement du report à nouveau (al. 3) ; dans tous les cas, elle fait l’objet d’une information dans les ' +
      'Notes annexes (al. 4).'
    );
  }
  if (entree.transfertGroupe) {
    return (
      'Ce mouvement est né du transfert du bien dans le groupe (dotation complémentaire chez celui qui cède, dépréciation qui a ' +
      `suivi le bien chez celui qui reçoit) · il fait partie de ce geste et ne s’annule pas seul · ${ISSUE_TRANSFERT_GROUPE}.`
    );
  }
  if (entree.transfertMiseEnService) {
    return (
      'Ce mouvement transfère la dépréciation du bien en cours à son compte définitif, à la mise en service · il fait partie ' +
      'de ce geste et ne s’annule pas seul.'
    );
  }
  if (entree.revisionDeReevaluation) {
    return (
      'Cette révision a été posée par la réévaluation libre (méthode 2, AUDCIF Titre VIII ch. 28 § 4.3.2) · elle s’annule ' +
      'avec la réévaluation, jamais seule.'
    );
  }
  if (entree.dependants.length > 0) {
    const premier = [...entree.dependants].sort((a, b) => b.exerciceFin.getTime() - a.exerciceFin.getTime() || b.creeLe.getTime() - a.creeLe.getTime())[0];
    const liste = entree.dependants
      .slice(0, 5)
      .map((a) => `${a.libelle}${a.bien ? ` (${a.bien})` : ''}`)
      .join(' ; ');
    const reste = entree.dependants.length > 5 ? ` et ${entree.dependants.length - 5} autre(s)` : '';
    const bloquants = entree.dependants.filter((a) => NON_ANNULABLES.has(a.nature) && !a.issue);
    const ailleurs = entree.dependants.filter((a) => !!a.issue);
    const issue =
      ailleurs.length > 0
        ? ` ${ailleurs.map((a) => a.libelle).join(' ; ')} · ${ailleurs[0].issue}, puis annulez celui-ci.`
        : bloquants.length > 0
          ? ` ${bloquants.map((a) => a.libelle).join(' ; ')} ne s’annule pas dans OmegaX · la correction passe alors par une ` +
            'écriture en négatif saisie par le cabinet, avec son motif (AUDCIF art. 20, al. 2).'
          : ` Annulez d’abord le plus récent (${premier.libelle}${premier.bien ? `, ${premier.bien}` : ''}), puis celui-ci.`;
    return (
      `Un traitement postérieur a lu le résultat de celui-ci · ${liste}${reste}. L’annuler seul laisserait ces actes ` +
      `calculés sur un montant que le journal ne porte plus, sans qu’aucun total ne le signale.${issue}`
    );
  }
  return null;
}

/** Le motif saisi · trois caractères au moins, cinq cents au plus, comme les autres annulations. */
export function motifRefusMotifAnnulation(motif: string | undefined | null): string | null {
  const m = (motif ?? '').trim();
  if (m.length < 3) return "Indiquez le motif de l'annulation (trois caractères au moins) · il est gardé avec l'acte et au journal d'audit.";
  if (m.length > 500) return "Le motif de l'annulation ne dépasse pas cinq cents caractères.";
  return null;
}

/**
 * L'ÉCART DE RÉÉVALUATION QU'UNE DÉPRÉCIATION AVAIT CONSOMMÉ · rendu aux
 * lignes. La dépréciation l'a imputé dans l'ordre des réévaluations, la plus
 * ancienne d'abord (`imputationSurEcart`, ch. 12 § 2.5) ; on l'annule à
 * partir du plus récent, donc on rend dans l'ordre inverse, la dernière ligne
 * entamée d'abord. Rend `null` si les lignes ne portent plus de quoi rendre
 * le montant au centime · l'état a changé, rien ne se rend en silence.
 */
export function rendreEcartImpute(
  lignes: ReadonlyArray<{ id: string; ecartImpute: number }>,
  montant: number,
): Array<{ id: string; montant: number }> | null {
  let reste = Math.round(montant * 100);
  const rendu: Array<{ id: string; montant: number }> = [];
  for (const l of [...lignes].reverse()) {
    if (reste <= 0) break;
    const dispo = Math.round(l.ecartImpute * 100);
    if (dispo <= 0) continue;
    const pris = Math.min(dispo, reste);
    rendu.push({ id: l.id, montant: pris / 100 });
    reste -= pris;
  }
  return reste === 0 ? rendu : null;
}

/** La révision telle que l'état de la fiche la relit. */
export interface RevisionLue {
  id: string;
  nature: 'PROSPECTIVE' | 'RETROACTIVE';
  dureeApresAns: number;
  creeLe: Date;
  /** Ouverture de l'exercice de la décision · la date d'effet d'une révision prospective. */
  ouvertureExercice: Date;
  /** Posée par une réévaluation libre (méthode 2) · effet à l'ouverture de l'exercice SUIVANT. */
  ouvertureSuivante: Date | null;
}

/**
 * L'ÉTAT DU PLAN QUE LES RÉVISIONS RESTANTES DONNENT · une révision
 * prospective pose la date d'effet et la durée résiduelle (`reviserPlan`, ou
 * la réévaluation libre en méthode 2 à l'ouverture de l'exercice suivant) ;
 * une rétroactive les remet à nul. La plus récente fait donc l'état · c'est
 * lui que l'annulation de la dernière rétablit.
 */
export function etatDuPlanApres(revisionsRestantes: readonly RevisionLue[]): { dateEffetRevisionPlan: Date | null; dureeResiduelleRevisee: number | null } {
  const derniere = [...revisionsRestantes].sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime())[0];
  if (!derniere || derniere.nature === 'RETROACTIVE') return { dateEffetRevisionPlan: null, dureeResiduelleRevisee: null };
  return { dateEffetRevisionPlan: derniere.ouvertureSuivante ?? derniere.ouvertureExercice, dureeResiduelleRevisee: derniere.dureeApresAns };
}

/**
 * LA VALEUR RÉSIDUELLE D'AVANT LA RÉÉVALUATION · gardée sur la ligne depuis la
 * ligne sage-l4. Sur une réévaluation plus ancienne, une valeur résiduelle
 * nulle l'était aussi avant (k' × 0 = 0) ; une valeur non nulle ne se
 * retrouve pas au centime par une division · `null`, et le refus le dit.
 */
export function valeurResiduelleAvant(gardee: number | null, actuelle: number): number | null {
  if (gardee !== null) return gardee;
  return Math.abs(actuelle) < 0.005 ? 0 : null;
}
