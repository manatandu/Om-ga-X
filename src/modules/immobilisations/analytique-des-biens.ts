/**
 * L'ANALYTIQUE DES BIENS (ligne immos, fonction n° 70 · Sage Immobilisations,
 * « section analytique sur la famille » et ventilation des dotations, M4 B-16,
 * B-81) · les règles pures.
 *
 * AUCUN TEXTE N'IMPOSE LA VENTILATION · « l'usage des comptes 92 à 99 est
 * laissé à l'initiative des entités », qui les « subdivise à sa convenance »
 * (AUDCIF Titre VII, classe 9 ; SYCEBNL Partie 2 ch. 3, classe 9,
 * sous-section 2, en termes identiques). Ce que la ligne apporte
 * est un TRAVAIL ÉPARGNÉ · une ONG qui suit ses projets ou ses bailleurs
 * ventilait chaque année, à la main, chaque dotation du parc.
 *
 * LA FICHE PRIME SUR LA FAMILLE · la section posée sur un bien vaut pour lui ;
 * à défaut, celle de sa famille. Une seule section, sur un seul plan · la
 * dotation d'un bien partagé entre deux projets se ventile encore à la main
 * (clé de répartition, Saisie des OD analytiques).
 *
 * LA PASSATION PROPOSE, ELLE N'ENFERME PAS · la ligne de la dotation (classe
 * 6, compte 68 du bien) reçoit la ventilation entière sur la section. Une
 * section devenue impropre depuis qu'elle a été posée (mise en sommeil, plan
 * qui ne ventile plus la classe, section rendue Total) n'arrête pas la
 * dotation · elle part NON VENTILÉE, et la cause est dite, avec son issue
 * (même règle que la ventilation de la paie, ligne sage-l5, fonction 88).
 * Refuser la dotation laisserait un exercice sans charge pour une question
 * d'analytique.
 */

export interface SectionLue {
  id: string;
  code: string;
  type: 'DETAIL' | 'TOTAL';
  estActive: boolean;
  plan: { code: string; estActif: boolean; classesVentilees: string };
}

/**
 * Pourquoi une section ne reçoit pas la dotation d'un bien, ou null · lu à la
 * pose (refus nommé) comme à la passation (dotation non ventilée, dite).
 * `classeDotation` est le premier chiffre du compte de dotation (« 6 »).
 */
export function motifSectionImpropre(s: SectionLue, classeDotation: string): string | null {
  if (s.type === 'TOTAL') {
    return `La section ${s.code} est de type Total · elle regroupe ses sections Détail dans les états et ne reçoit aucune ventilation. Choisissez une section Détail.`;
  }
  if (!s.estActive) return `La section ${s.code} est en sommeil · réactivez-la ou choisissez-en une autre.`;
  if (!s.plan.estActif) return `Le plan analytique ${s.plan.code} est en sommeil · ses sections ne reçoivent plus de ventilation.`;
  const classes = s.plan.classesVentilees.split(',').map((c) => c.trim());
  if (!classes.includes(classeDotation)) {
    return (
      `Le plan ${s.plan.code} ne ventile pas la classe ${classeDotation} (classes ventilées : ${classes.join(', ')}) · ` +
      'la dotation du bien ne s’y ventile pas. Ajoutez la classe au plan, ou choisissez une section d’un autre plan.'
    );
  }
  return null;
}

/** La section qui vaut pour le bien · la sienne, sinon celle de sa famille. */
export function sectionDuBien<T>(fiche: T | null | undefined, famille: T | null | undefined): { section: T; origine: 'FICHE' | 'FAMILLE' } | null {
  if (fiche) return { section: fiche, origine: 'FICHE' };
  if (famille) return { section: famille, origine: 'FAMILLE' };
  return null;
}

export interface VentilationDeLaDotation {
  /** La ventilation à poser sur la ligne de dotation · vide si rien ne s'y ventile. */
  ventilations: { sectionId: string; debit: number }[];
  /** Ce que la réponse dit · la section retenue, et le motif d'une dotation partie non ventilée. */
  compteRendu: null | { section: string; origine: 'FICHE' | 'FAMILLE'; nonVentilee: string | null };
}

/**
 * La ventilation de la ligne de dotation · la section du bien, entière, au
 * débit · ou rien, et la cause dite.
 */
export function ventilationDeLaDotation(
  retenue: { section: SectionLue; origine: 'FICHE' | 'FAMILLE' } | null,
  classeDotation: string,
  montant: number,
): VentilationDeLaDotation {
  if (!retenue) return { ventilations: [], compteRendu: null };
  const motif = motifSectionImpropre(retenue.section, classeDotation);
  if (motif) {
    return {
      ventilations: [],
      compteRendu: { section: retenue.section.code, origine: retenue.origine, nonVentilee: `Dotation passée non ventilée · ${motif}` },
    };
  }
  if (!(montant > 0)) return { ventilations: [], compteRendu: null };
  return {
    ventilations: [{ sectionId: retenue.section.id, debit: montant }],
    compteRendu: { section: retenue.section.code, origine: retenue.origine, nonVentilee: null },
  };
}
