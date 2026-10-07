import type { FormeJuridiqueSyscohada, Referentiel } from './types';

/**
 * CE QUE L'ÉCRAN DES PARAMÈTRES PROPOSE SELON LA FORME · miroir des règles du
 * serveur (`src/modules/tenant/mentions-societe.ts`), qui seul refuse.
 * Masquer n'est pas refuser (CLAUDE.md § 6) · l'écran évite seulement de
 * proposer un geste que la route rejettera.
 */

/**
 * AUSCGIE art. 269-1 · la clause de variabilité n'est ouverte qu'aux
 * « sociétés anonymes ne faisant pas appel public à l'épargne et sociétés
 * par actions simplifiées ». Miroir de `FORMES_CAPITAL_VARIABLE`.
 */
export const FORMES_CAPITAL_VARIABLE: readonly FormeJuridiqueSyscohada[] = [
  'SOCIETE_ANONYME',
  'SOCIETE_PAR_ACTIONS_SIMPLIFIEE',
];

/** Les cinq sociétés commerciales de l'AUSCGIE art. 6, que vise l'art. 17. */
const SOCIETES_COMMERCIALES: readonly FormeJuridiqueSyscohada[] = [
  'SOCIETE_ANONYME',
  'SOCIETE_PAR_ACTIONS_SIMPLIFIEE',
  'SOCIETE_RESPONSABILITE_LIMITEE',
  'SOCIETE_NOM_COLLECTIF',
  'SOCIETE_COMMANDITE_SIMPLE',
];

export const estCooperative = (forme: FormeJuridiqueSyscohada | null | undefined) => forme === 'SOCIETE_COOPERATIVE';

/** La case « À capital variable » n'est proposée qu'à la SA et à la SAS. */
export const proposeCapitalVariable = (forme: FormeJuridiqueSyscohada | null | undefined) =>
  !!forme && FORMES_CAPITAL_VARIABLE.includes(forme);

/**
 * Le champ « Adresse » est celle du SIÈGE SOCIAL pour qui l'imprime à ce titre
 * · AUSCGIE art. 17 et 23 à 25 pour une société commerciale, AUSCOOP art. 19
 * pour la coopérative. Une ville seule n'en est pas une (art. 25).
 */
export function libelleAdresse(referentiel: Referentiel | undefined, forme: FormeJuridiqueSyscohada | null | undefined): string {
  if (referentiel !== 'SYSCOHADA' || !forme) return 'Adresse';
  return SOCIETES_COMMERCIALES.includes(forme) || estCooperative(forme) ? 'Adresse du siège social' : 'Adresse';
}

/** L'une des cinq sociétés commerciales de l'AUSCGIE art. 6. */
export const estSocieteCommerciale = (forme: FormeJuridiqueSyscohada | null | undefined) =>
  !!forme && SOCIETES_COMMERCIALES.includes(forme);

/**
 * LES FAITS DE LA DÉNOMINATION QUE CHAQUE FORME PORTE · miroir des refus de
 * `TenantService.modifierIdentite`. Le mode d'administration est celui de la
 * SA (AUSCGIE art. 386 et 414), l'associé unique celui de la SAS (art. 853-2),
 * la dissolution et les liquidateurs ceux des cinq sociétés commerciales
 * (art. 203 et 204) et de la coopérative (AUSCOOP art. 183).
 */
export function faitsDeLaForme(forme: FormeJuridiqueSyscohada | null | undefined): {
  modeAdministration: boolean;
  associeUnique: boolean;
  dissolution: boolean;
  /**
   * Nomination, régime, clôture de la liquidation et cotisations spéciales ·
   * AUSCGIE art. 203, 216, 223 et 266 pour les sociétés commerciales ; AUSCOOP
   * art. 182, 185 et 196 pour la coopérative, et loi n° 23/053, art. 3 et 13,
   * qui range les coopératives parmi les sociétés redevables (décision par la
   * loi du 2026-10-07, quatrième lot, points 6 et 7).
   */
  liquidation: boolean;
  /** L'associé unique personne morale · AUSCGIE art. 201 al. 4, sociétés commerciales seules. */
  associeUniquePm: boolean;
} {
  return {
    modeAdministration: forme === 'SOCIETE_ANONYME',
    associeUnique: forme === 'SOCIETE_PAR_ACTIONS_SIMPLIFIEE',
    dissolution: estSocieteCommerciale(forme) || estCooperative(forme),
    liquidation: estSocieteCommerciale(forme) || estCooperative(forme),
    associeUniquePm: estSocieteCommerciale(forme),
  };
}

export type RegimeLiquidationSaisi =
  | 'AMIABLE_STATUTAIRE'
  | 'ARTICLE_223_1'
  | 'ARTICLE_223_2_JUDICIAIRE'
  | 'PROCEDURE_COLLECTIVE'
  | 'PAS_ENCORE_DIT';

export type ModeAdministrationSaisi = 'CONSEIL_ADMINISTRATION' | 'ADMINISTRATEUR_GENERAL' | 'PAS_ENCORE_DIT';
export type ReponseFaitSaisie = 'OUI' | 'NON' | 'PAS_ENCORE_DIT';

/**
 * Le corps que l'écran envoie à PATCH /dossier/identite pour une société ou
 * une coopérative · un fait n'est envoyé qu'à la forme qui le porte, sans quoi
 * la route le refuserait (ou, laissé à « pas encore dit », l'écran effacerait
 * en aveugle une réponse héritée d'une autre forme).
 */
export function faitsDeLaFormeAEnvoyer(
  forme: FormeJuridiqueSyscohada | null | undefined,
  saisie: {
    modeAdministrationSa: ModeAdministrationSaisi;
    associeUniqueSas: ReponseFaitSaisie;
    dateDissolution: string;
    liquidateurs: string;
    dateNominationLiquidateur?: string;
    regimeLiquidation?: RegimeLiquidationSaisi;
    associeUniquePersonneMorale?: ReponseFaitSaisie;
    /**
     * Clôture de la liquidation et dépôt des deux cotisations spéciales
     * (décision par la loi du 2026-10-07, point 2 · loi n° 23/053, art. 13 ;
     * LPF art. 16) · la chaîne vide efface.
     */
    dateClotureLiquidation?: string;
    dateDeclarationCotisationActivite?: string;
    dateDeclarationCotisationLiquidation?: string;
  },
): Record<string, string> {
  const faits = faitsDeLaForme(forme);
  return {
    ...(faits.modeAdministration ? { modeAdministrationSa: saisie.modeAdministrationSa } : {}),
    ...(faits.associeUnique ? { associeUniqueSas: saisie.associeUniqueSas } : {}),
    ...(faits.dissolution ? { dateDissolution: saisie.dateDissolution, liquidateurs: saisie.liquidateurs } : {}),
    // La liquidation · sociétés commerciales et coopérative ; l'associé unique
    // personne morale, sociétés commerciales seules (art. 201 al. 4).
    ...(faits.liquidation && saisie.dateNominationLiquidateur !== undefined
      ? { dateNominationLiquidateur: saisie.dateNominationLiquidateur }
      : {}),
    ...(faits.liquidation && saisie.regimeLiquidation !== undefined ? { regimeLiquidation: saisie.regimeLiquidation } : {}),
    ...(faits.associeUniquePm && saisie.associeUniquePersonneMorale !== undefined
      ? { associeUniquePersonneMorale: saisie.associeUniquePersonneMorale }
      : {}),
    ...(faits.liquidation && saisie.dateClotureLiquidation !== undefined
      ? { dateClotureLiquidation: saisie.dateClotureLiquidation }
      : {}),
    ...(faits.liquidation && saisie.dateDeclarationCotisationActivite !== undefined
      ? { dateDeclarationCotisationActivite: saisie.dateDeclarationCotisationActivite }
      : {}),
    ...(faits.liquidation && saisie.dateDeclarationCotisationLiquidation !== undefined
      ? { dateDeclarationCotisationLiquidation: saisie.dateDeclarationCotisationLiquidation }
      : {}),
  };
}

/**
 * La QUOTE-PART DE L'ÉTAT saisie (décision par la loi du 2026-10-07, point 3 ·
 * arrêté interministériel du 10 décembre 2025, art. 1er, point 2) · un
 * pourcentage de 0 à 100, virgule ou point, quatre décimales au plus. Vide ·
 * `null`, l'effacement. Illisible · `undefined`, jamais envoyé · JSON.stringify
 * écrit `NaN` en `null`, et une saisie fausse EFFACERAIT la quote-part.
 */
export function lireQuotePart(texte: string): number | null | undefined {
  const t = texte.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(t)) return undefined;
  const n = Number(t);
  return n >= 0 && n <= 100 ? n : undefined;
}

/**
 * Le corps du PORTEFEUILLE DE L'ÉTAT · la qualité, et sous elle seulement le
 * secteur minier et la quote-part avec sa source (le serveur les refuse hors
 * du portefeuille déclaré). Hors « oui », rien de plus n'est envoyé · ce qui
 * reste en base n'est lu nulle part tant que la qualité n'est pas « oui ».
 */
export function portefeuilleAEnvoyer(saisie: {
  portefeuille: ReponseFaitSaisie;
  secteurMinier: ReponseFaitSaisie;
  quotePart: number | null;
  sourceQuotePart: string;
}): Record<string, string | number | null> {
  return {
    entreprisePortefeuilleEtat: saisie.portefeuille,
    ...(saisie.portefeuille === 'OUI'
      ? {
          portefeuilleSecteurMinier: saisie.secteurMinier,
          quotePartEtatCapital: saisie.quotePart,
          sourceQuotePartEtat: saisie.quotePart === null ? null : saisie.sourceQuotePart,
        }
      : {}),
  };
}

/**
 * Une TRANSFORMATION au sens de l'AUSCGIE art. 181 change une société
 * commerciale en une autre · miroir de `motifRefusTransformation`. Ailleurs,
 * le changement de forme ne se date pas (une correction vaut pour tous les
 * exercices, et le passage vers une forme qui n'est pas une société relève de
 * l'art. 188).
 */
export const transformationDatable = (
  ancienne: FormeJuridiqueSyscohada | null | undefined,
  nouvelle: FormeJuridiqueSyscohada,
) => !!ancienne && ancienne !== nouvelle && estSocieteCommerciale(ancienne) && estSocieteCommerciale(nouvelle);
