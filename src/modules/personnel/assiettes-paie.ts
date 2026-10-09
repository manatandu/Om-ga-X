/**
 * LES DEUX ASSIETTES D'UN BULLETIN, ET LA RAISON POUR LAQUELLE ELLES NE SE
 * SERVENT JAMAIS L'UNE POUR L'AUTRE.
 *
 * SOURCES · Code du travail (loi n° 015/2002), article 7, point 8, pour la
 * RÉMUNÉRATION, qui est l'assiette sociale · loi n° 23/053 du 30 novembre
 * 2023, articles 68 à 71, pour l'assiette FISCALE.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA DÉCOUVERTE DE CE CHANTIER · LES DEUX LISTES D'EXCLUSION SE RESSEMBLENT
 * MOT POUR MOT, ET ELLES N'ONT PAS LA MÊME FORME.
 *
 * Le Code du travail sort CINQ choses de la rémunération, SANS AUCUNE
 * CONDITION · « Ne sont pas éléments de la rémunération : les soins de santé ;
 * l'indemnité de logement ou le logement en nature ; les allocations
 * familiales légales ; l'indemnité de transport ; les frais de voyage ainsi
 * que les avantages accordés exclusivement en vue de faciliter au travailleur
 * l'accomplissement de ses fonctions. »
 *
 * La loi fiscale nomme LES MÊMES CHOSES et les traite autrement. Son article
 * 68 les fait d'abord ENTRER dans l'imposable (« ainsi que TOUS les avantages
 * en argent et en nature »), puis son article 69 les immunise SOUS CONDITION.
 *
 * SERVIR LA LISTE SOCIALE À L'ASSIETTE FISCALE SOUS-IMPOSERAIT, sans qu'aucun
 * total du bulletin ne bouge · une indemnité de logement de 50 % du salaire
 * sort de l'assiette sociale de plein droit, et elle NE SORT PAS de l'assiette
 * fiscale, puisque la condition de l'article 69, 8, a) n'est pas remplie.
 * C'est la doctrine que le dépôt a payée à P1 : une liste d'exclusion se nomme
 * par sa FIN, jamais par sa forme.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ET LA LOI FISCALE EMPLOIE TROIS FORMULATIONS QUI NE VEULENT PAS DIRE LA MÊME
 * CHOSE. C'est elle-même qui les distingue, dans le même titre :
 *
 *  · « DANS LA LIMITE DE 5 % du revenu brut imposable » (art. 116, 1) · un
 *    PLAFOND · au-delà, seul l'excédent est repris ;
 *  · « DANS LA MESURE OÙ elles ne dépassent pas les taux légaux » (art. 69, 1)
 *    · un PLAFOND lui aussi · la mesure est ce qui reste sous le taux légal ;
 *  · « POUR AUTANT QUE l'indemnité de logement NE DÉPASSE 30 % de la
 *    rémunération » (art. 69, 8, a) · une CONDITION · remplie, l'immunité
 *    joue tout entière ; non remplie, elle ne joue pas du tout.
 *
 * LA LECTURE N'EST PAS UNE OPINION · c'est le même législateur qui écrit
 * « dans la limite de » quand il veut un plafond, à trois articles de là. Lire
 * l'article 69, 8, a) comme un plafond, ce que la pratique fait souvent,
 * reviendrait à écrire dans le texte des mots qu'il emploie ailleurs et pas
 * ici. OmegaX applique la condition, et NOMME l'autre lecture avec le montant
 * qu'elle changerait, plutôt que de trancher en silence.
 *
 * CE FICHIER NE CALCULE AUCUN IMPÔT · le barème est dans `bareme-irpp.ts`.
 * Il ne calcule aucune cotisation non plus · les taux et leurs dates d'effet
 * sont dans `cotisations-paie.ts`, qui s'assied sur l'assiette sociale rendue
 * ici.
 */

import { auCentime, enCentimes } from './au-centime';
import {
  ZERO,
  depuisNombre,
  maximum,
  moins,
  plus,
  versNombre,
  type DecimalExact,
} from '../../common/decimal-exact';

/**
 * Les natures qu'un élément de paie peut prendre. La liste d'INCLUSION du
 * Code du travail est ouverte (« Elle comprend NOTAMMENT ») ; sa liste
 * d'EXCLUSION est fermée. Une nature inconnue tombe donc DANS la rémunération,
 * conformément à la phrase qui ouvre l'article 7, point 8 · « la somme
 * représentative de l'ensemble des gains susceptibles d'être évalués en
 * espèces ». C'est le sens sûr : présumer l'exclusion minorerait l'assiette
 * sociale, donc les droits du travailleur.
 */
export type NatureElementPaie =
  // Les dix que l'article 7, point 8 énumère comme éléments de la rémunération.
  | 'SALAIRE_OU_TRAITEMENT'
  | 'COMMISSION'
  | 'INDEMNITE_DE_VIE_CHERE'
  | 'PRIME'
  | 'PARTICIPATION_AUX_BENEFICES'
  | 'GRATIFICATION_OU_MOIS_COMPLEMENTAIRE'
  | 'PRESTATION_SUPPLEMENTAIRE'
  | 'AVANTAGE_EN_NATURE'
  | 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE'
  | 'INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT'
  // A8 · L'INDEMNITÉ DE FIN DE CONTRAT, servie par le seul décompte final
  // (préavis non observé, art. 63 al. 3 ; dommages-intérêts de l'art. 70 ;
  // somme convenue de l'art. 61 bis). Elle est dans l'assiette sociale PAR LE
  // TEXTE (décision T7 du 2026-10-07) · gain fixé par un accord ou une
  // disposition légale, dû en vertu du contrat (art. 7, point 8, liste
  // d'éléments ouverte, liste d'exclusion FERMÉE), la rémunération du délai
  // pour le préavis (art. 63, al. 3), et les cotisations sont dues pour toute
  // période dont l'employeur doit la rémunération (arrêté n° 146/2018,
  // art. 20) · `FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE`. Ses avantages en
  // transport, que l'art. 7 exclut nommément, sont ventilés sous leur nature.
  // Fiscalement imposable · loi n° 23/053, art. 68, 6° (« les sommes payées
  // par l'employeur [...] par suite de cessation de travail ou de rupture de
  // contrat d'emploi »), aucune immunité de l'art. 69 ne la vise. Elle n'est
  // ouverte NI au DTO d'un élément NI aux rubriques du cabinet · une
  // indemnité de rupture sur un bulletin ordinaire n'aurait pas de rupture.
  | 'INDEMNITE_DE_FIN_DE_CONTRAT'
  // Les cinq que le même point sort de la rémunération.
  | 'SOINS_DE_SANTE'
  | 'LOGEMENT_OU_SON_INDEMNITE'
  | 'ALLOCATIONS_FAMILIALES_LEGALES'
  | 'INDEMNITE_DE_TRANSPORT'
  | 'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION';

/**
 * Les cinq exclusions de l'article 7, point 8, recopiées. La liste est FERMÉE
 * et le test la tient à cinq · y ajouter une nature retirerait des droits au
 * travailleur (l'assiette sociale commande la pension), sur un bulletin dont
 * le net ne bougerait pas.
 */
export const HORS_REMUNERATION_ARTICLE_7: readonly NatureElementPaie[] = [
  'SOINS_DE_SANTE',
  'LOGEMENT_OU_SON_INDEMNITE',
  'ALLOCATIONS_FAMILIALES_LEGALES',
  'INDEMNITE_DE_TRANSPORT',
  'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION',
] as const;

/** La forme que prend une immunité de l'article 69. Voir l'en-tête du fichier. */
export type FormeImmunite =
  /** « dans la mesure où » · seul l'excédent est repris. */
  | 'PLAFOND'
  /** « pour autant que » · tout ou rien. */
  | 'CONDITION'
  /** Aucune condition dans le texte. */
  | 'TOTALE';

export type ImmuniteArticle69 = {
  readonly nature: NatureElementPaie;
  readonly point: string;
  readonly forme: FormeImmunite;
  readonly texte: string;
  /**
   * Vrai lorsque la condition ne se lit dans AUCUNE donnée qu'OmegaX détient ·
   * elle doit alors être attestée par le cabinet, et l'élément est mis en
   * abstention à défaut.
   */
  readonly conditionNonVerifiableParLeLogiciel: boolean;
};

/**
 * Ce que l'article 69 immunise parmi ce qu'un employeur verse. Les points 2 à
 * 7 (pensions, militaires, policiers, pensions alimentaires, bourses) ne sont
 * pas ici · aucun n'est un élément de paie versé par un employeur ordinaire,
 * et les faire figurer les ferait proposer à la saisie.
 */
export const IMMUNITES_ARTICLE_69: readonly ImmuniteArticle69[] = [
  {
    nature: 'ALLOCATIONS_FAMILIALES_LEGALES',
    point: 'article 69, 1',
    forme: 'PLAFOND',
    texte:
      "« les indemnités ou allocations familiales réellement accordées aux employés dans la mesure où elles ne dépassent pas les taux légaux »",
    conditionNonVerifiableParLeLogiciel: false,
  },
  {
    nature: 'LOGEMENT_OU_SON_INDEMNITE',
    point: 'article 69, 8, a)',
    forme: 'CONDITION',
    texte: "« pour autant que l'indemnité de logement ne dépasse 30 % de la rémunération »",
    conditionNonVerifiableParLeLogiciel: false,
  },
  {
    nature: 'INDEMNITE_DE_TRANSPORT',
    point: 'article 69, 8, b)',
    forme: 'CONDITION',
    texte:
      "« l'indemnité journalière de transport soit égale au coût du billet pratiqué localement avec un maximum de six courses de taxi pour les cadres et six courses de bus pour les autres membres du personnel. Dans tous les cas, la réalité et la nécessité du transport alloué à l'employé doivent être démontrées »",
    conditionNonVerifiableParLeLogiciel: true,
  },
  {
    nature: 'SOINS_DE_SANTE',
    point: 'article 69, 8, c)',
    forme: 'CONDITION',
    texte: "« les frais médicaux soient justifiés par les documents probants »",
    conditionNonVerifiableParLeLogiciel: true,
  },
] as const;

/** Article 69, 8, a) · le seul chiffre que le point porte. */
export const PLAFOND_LOGEMENT_POUR_CENT = 30;

/**
 * LEQUEL DES DEUX MONTANTS EST « LE TAUX LÉGAL » DE L'ARTICLE 69, 1 ·
 * LA QUESTION EST TRANCHÉE, ET ELLE ÉTAIT MAL POSÉE.
 *
 * P2a l'avait laissée ouverte en la formulant ainsi : « le corpus porte deux
 * montants d'allocation familiale, lequel vaut ? ». La réponse est qu'il n'y
 * a PAS DEUX LECTURES D'UNE MÊME RÈGLE · IL Y A DEUX OBLIGATIONS, portées
 * par DEUX DÉBITEURS DIFFÉRENTS, qui se trouvent partager un nom.
 *
 *  · LES 8 100 FC PAR MOIS ET PAR ENFANT · arrêté ministériel n° 137/2018,
 *    article 3. Son article 4 dit ce qu'il en est : « Les allocations
 *    familiales sont SERVIES DIRECTEMENT PAR LA CAISSE par voie bancaire ou
 *    par guichet espèces. » L'arrêté n° 143/2018 le redit à son article 1er,
 *    et son article 3 achève la démonstration pour le cas exceptionnel où
 *    l'employeur paie : « LA CAISSE MET À LA DISPOSITION DE L'EMPLOYEUR
 *    chargé du paiement […] le montant total des sommes à payer ». Même
 *    alors, l'employeur est un GUICHET, jamais le débiteur. Cette somme
 *    n'est donc pas versée par l'employeur, elle n'entre pas dans le revenu
 *    professionnel de l'article 68, et il n'y a rien à immuniser.
 *
 *  · LA COLONNE 19 DES ANNEXES DU DÉCRET n° 25/22 · les « ALLOCATIONS
 *    FAMILIALES MINIMA » que le titre du décret annonce, fondées sur
 *    l'article 87 du Code du travail. Celles-là, l'EMPLOYEUR les doit.
 *    C'est cela qu'un bulletin porte, et c'est donc cela que l'article 69, 1
 *    vise.
 *
 * LE MOT QUI TRANCHE EST DANS L'ARTICLE 69, 1 LUI-MÊME · il immunise les
 * allocations familiales « RÉELLEMENT ACCORDÉES AUX EMPLOYÉS ». Une
 * prestation servie par la Caisse n'est pas accordée par l'employeur. Le
 * plafond d'une immunité se lit sur le DÉBITEUR de la somme qu'il borne.
 */
export const RESOLUTION_TAUX_LEGAL_ALLOCATIONS =
  "ARTICLE 69, 1 · le « taux légal » qui borne l'immunité est celui de la COLONNE 19 des annexes du décret " +
  "n° 25/22, converti au mois par le multiplicateur de l'article 7 et multiplié par le nombre d'enfants " +
  "bénéficiaires. Ce n'est PAS le montant de 8 100 FC de l'article 3 de l'arrêté ministériel n° 137/2018 : " +
  "celui-là est une prestation SERVIE DIRECTEMENT PAR LA CAISSE (art. 4 du même arrêté, art. 1er de " +
  "l'arrêté n° 143/2018), que l'employeur n'accorde pas et qui n'entre donc jamais dans le revenu " +
  "professionnel de l'article 68. L'article 69, 1 ne vise que ce qui est « RÉELLEMENT ACCORDÉ AUX EMPLOYÉS ».";

export type ElementPaie = {
  readonly nature: NatureElementPaie;
  readonly libelle: string;
  readonly montantFc: number;
  /**
   * Article 68, 1 · sont imposables les traitements et indemnités « QUI NE
   * REPRÉSENTENT PAS le remboursement de dépenses professionnelles
   * effectives ». C'est une QUALIFICATION du cabinet, jamais une déduction
   * d'un libellé · elle se déclare.
   */
  readonly remboursementDeDepenseProfessionnelleEffective?: boolean;
  /**
   * Articles 69, 8, b) et c) · la réalité du transport et les documents
   * probants des frais médicaux ne sont dans aucun livre. `true` atteste que
   * la condition est remplie, `false` qu'elle ne l'est pas, `null` ou absent
   * met l'élément en ABSTENTION · jamais en immunité par défaut.
   */
  readonly conditionArticle69Attestee?: boolean | null;
  /**
   * Logement, transport ou soins FOURNIS EN NATURE (passe F5) · la nature
   * reste celle de l'article 7, point 8, et de l'article 69, 8° de la loi
   * n° 23/053, qui vise « les indemnités ET AVANTAGES EN NATURE concernant le
   * logement, le transport et les frais médicaux » · les deux assiettes ne
   * changent donc pas. Ce qui change est le PAIEMENT · rien n'est versé au
   * travailleur, qui occupe déjà le logement ou emprunte déjà la navette. Le
   * net, le 422 et la passation le lisent (`estVerseEnEspeces`).
   */
  readonly enNature?: boolean;
};

/** Les trois natures que l'art. 69, 8° admet EN NATURE comme en indemnité. */
export const NATURES_FOURNIES_EN_NATURE: readonly NatureElementPaie[] = [
  'LOGEMENT_OU_SON_INDEMNITE',
  'INDEMNITE_DE_TRANSPORT',
  'SOINS_DE_SANTE',
] as const;

export type ElementHorsRemuneration = {
  readonly libelle: string;
  readonly montantFc: number;
  readonly motif: string;
};

export type SortFiscal = {
  readonly libelle: string;
  readonly montantFc: number;
  readonly imposableFc: number | null;
  readonly motif: string;
};

export type MotifAbstentionFiscale =
  | 'CONDITION_ARTICLE_69_NON_ATTESTEE'
  | 'TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI';

export type Abstention = {
  readonly motif: MotifAbstentionFiscale;
  readonly libelle: string;
  readonly montantFc: number;
  readonly explication: string;
};

export type VerdictAssiettes = {
  /**
   * La rémunération au sens de l'article 7, point 8 du Code du travail ·
   * c'est elle que les cotisations sociales frappent, et c'est elle que
   * l'arrêté n° 146/2018 reprend à son article 17.
   */
  readonly assietteSocialeFc: number;
  readonly horsRemuneration: readonly ElementHorsRemuneration[];
  /**
   * L'assiette fiscale AVANT les retenues de l'article 71 · articles 68 et 69.
   * `null` lorsqu'au moins une abstention empêche de la chiffrer.
   */
  readonly assietteFiscaleBruteFc: number | null;
  readonly sortsFiscaux: readonly SortFiscal[];
  /** Article 71 · ce qui se déduit du brut. */
  readonly retenuesArticle71Fc: number;
  /** Article 70 · la base d'imposition, nette des retenues de l'article 71. */
  readonly assietteFiscaleNetteFc: number | null;
  /**
   * Pourquoi la base NETTE n'est pas chiffrée alors que la brute l'est · la
   * quote-part ouvrière de la CNSS, à déduire (art. 71), n'est pas chiffrée
   * (constat C1). `null` quand rien ne l'empêche.
   */
  readonly motifAssietteNetteNonChiffree: string | null;
  readonly abstentions: readonly Abstention[];
  readonly reserves: readonly string[];
};

/**
 * Les deux raisons pour lesquelles le « taux légal » de l'article 69, 1 ne se
 * calcule pas · le nombre d'enfants bénéficiaires n'est pas renseigné, ou
 * aucune grille du SMIG ne couvre le mois de paie (`raison` dit pourquoi, telle
 * que la grille la rend).
 */
export type TauxLegalNonCalcule =
  | { readonly cause: 'ENFANTS_BENEFICIAIRES_NON_RENSEIGNES' }
  | { readonly cause: 'MOIS_SANS_GRILLE_DU_SMIG'; readonly raison: string };

export type ParametresAssiettes = {
  /**
   * Article 69, 1 · le « taux légal » des allocations familiales, POUR LA
   * PÉRIODE DE PAIE ET POUR L'EFFECTIF D'ENFANTS CONCERNÉ. Voir
   * `RESOLUTION_TAUX_LEGAL_ALLOCATIONS` plus bas : la question des deux
   * montants est TRANCHÉE, et c'est la colonne 19 du décret n° 25/22 qui la
   * borne. Le service le calcule ; ce champ reste ouvert pour le cas où le
   * mois de paie sort des annexes, et l'absence vaut alors abstention.
   */
  readonly tauxLegalAllocationsFamilialesFc?: number | null;
  /**
   * POURQUOI le taux légal n'est pas chiffré, quand il ne l'est pas · le
   * service le sait (grille du mois, enfants renseignés), le moteur non. Il
   * ne sert qu'à DIRE à l'utilisateur ce qui manque et quoi faire (paquet 1,
   * C2) ; absent, l'explication nomme les deux causes possibles.
   */
  readonly tauxLegalAllocationsNonCalcule?: TauxLegalNonCalcule | null;
  /**
   * Article 71 · « les versements réellement effectués à titre définitif, soit
   * à des caisses de pension officielles, soit obligatoirement sous le
   * patronage de l'employeur […] en vue de la constitution au profit du
   * redevable d'une rente viagère, d'une pension, d'une assurance-maladie ou
   * d'une assurance-chômage ». La quote-part ouvrière de la CNSS y entre : le
   * régime général est une caisse de pension officielle et le versement est
   * définitif. C'est le texte qui le dit, pas le livre de cours.
   */
  readonly retenuesArticle71Fc?: number;
  /**
   * Le motif pour lequel la quote-part ouvrière de la CNSS n'est pas chiffrée
   * (`VerdictCotisations.quotePartOuvriereNonChiffree`). Présent, la base
   * nette ne se ferme pas · elle vaut `null`, et l'impôt et le net avec elle
   * (constat C1 · la simulation servait l'impôt d'une base que l'article 71
   * n'avait pas encore diminuée).
   */
  readonly quotePartOuvriereNonChiffree?: string | null;
};

/**
 * L'EXPLICATION DE L'ABSTENTION SUR LES ALLOCATIONS FAMILIALES, servie telle
 * quelle à l'écran (paquet 1, C2, passe V1 n° 2). Elle renvoyait l'utilisateur
 * au NOM d'une constante du code, qu'aucun écran ne montre · elle dit
 * désormais, en français, ce qui manque et le geste qui le lève. La constante
 * `RESOLUTION_TAUX_LEGAL_ALLOCATIONS` reste la référence du code (quel
 * montant borne l'immunité), elle n'est plus citée à l'utilisateur.
 *
 * DEUX CAUSES, DEUX GESTES · enfants non renseignés, on les renseigne ; mois
 * qu'aucune grille du SMIG ne couvre, renseigner les enfants n'y change rien,
 * seul un taux légal SAISI lève l'abstention (le service le laisse primer).
 * Cause inconnue · les deux, dans cet ordre.
 */
export function explicationTauxLegalNonChiffre(
  immunite: Pick<ImmuniteArticle69, 'point' | 'texte'>,
  nonCalcule: TauxLegalNonCalcule | null,
): string {
  const regle =
    `L'${immunite.point} de la loi n° 23/053 immunise ${immunite.texte}. Ce « taux légal » est ` +
    "l'allocation familiale journalière par enfant de la colonne 19 de la grille du SMIG du mois (décret " +
    "n° 25/22), multipliée par les jours ouvrant droit (vingt-six pour un mois entier) et par le nombre " +
    "d'enfants bénéficiaires.";
  if (nonCalcule?.cause === 'ENFANTS_BENEFICIAIRES_NON_RENSEIGNES') {
    return (
      `${regle} Le nombre d'enfants bénéficiaires n'est pas renseigné, et le plafond ne se place donc pas. ` +
      "Renseignez le nombre d'enfants bénéficiaires des allocations familiales (il ne se confond pas avec les " +
      "personnes à charge de l'impôt)."
    );
  }
  if (nonCalcule?.cause === 'MOIS_SANS_GRILLE_DU_SMIG') {
    return (
      `${regle} OmegaX n'a aucune grille du SMIG pour ce mois de paie. ${nonCalcule.raison} Le plafond ne ` +
      "se calcule donc pas. Saisissez le taux légal du mois, montant mensuel pour l'ensemble des enfants " +
      "bénéficiaires, tiré du barème qui régissait cette paie."
    );
  }
  return (
    `${regle} Le nombre d'enfants bénéficiaires n'est pas renseigné, ou OmegaX n'a aucune grille du SMIG pour ` +
    "ce mois de paie · le plafond ne se place donc pas. Renseignez le nombre d'enfants bénéficiaires ; pour un " +
    "mois qu'aucune grille ne couvre, saisissez le taux légal du mois."
  );
}

const estHorsRemuneration = (nature: NatureElementPaie): boolean =>
  HORS_REMUNERATION_ARTICLE_7.includes(nature);

const MOTIF_HORS_REMUNERATION: Readonly<Record<string, string>> = {
  SOINS_DE_SANTE: 'les soins de santé',
  LOGEMENT_OU_SON_INDEMNITE: "l'indemnité de logement ou le logement en nature",
  ALLOCATIONS_FAMILIALES_LEGALES: 'les allocations familiales légales',
  INDEMNITE_DE_TRANSPORT: "l'indemnité de transport",
  FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION:
    "les frais de voyage ainsi que les avantages accordés exclusivement en vue de faciliter au travailleur l'accomplissement de ses fonctions",
};

/**
 * L'ASSIETTE SOCIALE · article 7, point 8 du Code du travail, repris par
 * l'article 17 de l'arrêté ministériel n° 146/2018.
 *
 * Elle est INCONDITIONNELLE. Aucune des cinq exclusions ne porte de seuil, de
 * plafond ni de justification à produire · leur montant ne change rien, leur
 * nature suffit. C'est exactement ce qui la distingue de l'assiette fiscale,
 * et le seul moyen de ne pas les confondre est de ne jamais les calculer au
 * même endroit.
 */
export function assietteSociale(elements: readonly ElementPaie[]): {
  montantFc: number;
  horsRemuneration: readonly ElementHorsRemuneration[];
} {
  const { montant, horsRemuneration } = assietteSocialeExacte(elements);
  return { montantFc: versNombre(montant), horsRemuneration };
}

/**
 * LA MÊME ASSIETTE, EN VALEUR EXACTE (second tour de relecture du paquet 1,
 * ligne C, BLOQUANT du millier). Cinq lignes qui font 880 000 FC
 * s'additionnaient en flottant à 879 999,9999999999 · la base de l'impôt qui
 * en descend (art. 70 et 71) tombait sous son millier à l'arrondi de
 * l'art. 118. La somme se prend en décimal exact (`common/decimal-exact.ts`) ;
 * le verdict n'en reçoit que le flottant le plus proche.
 */
function assietteSocialeExacte(elements: readonly ElementPaie[]): {
  montant: DecimalExact;
  horsRemuneration: readonly ElementHorsRemuneration[];
} {
  const horsRemuneration: ElementHorsRemuneration[] = [];
  let montant = ZERO;

  for (const element of elements) {
    if (estHorsRemuneration(element.nature)) {
      horsRemuneration.push({
        libelle: element.libelle,
        montantFc: element.montantFc,
        motif:
          "Article 7, point 8 du Code du travail · ne sont pas éléments de la rémunération " +
          `${MOTIF_HORS_REMUNERATION[element.nature]}. L'exclusion ne porte aucune condition.`,
      });
      continue;
    }
    montant = plus(montant, depuisNombre(element.montantFc));
  }

  return { montant, horsRemuneration };
}

/**
 * LES DEUX ASSIETTES, RENDUES ENSEMBLE POUR QU'ON VOIE QU'ELLES DIFFÈRENT.
 *
 * L'ordre de calcul est celui que le livre de cours de P0 donnait et que les
 * textes confirment · brut, puis assiette sociale, puis cotisations, puis
 * assiette fiscale NETTE de ces cotisations (art. 70 et 71), puis barème.
 * Le calculer dans l'autre sens surestime l'impôt de tout ce que l'article 71
 * laisse déduire.
 */
export function assiettes(
  elements: readonly ElementPaie[],
  parametres: ParametresAssiettes = {},
): VerdictAssiettes {
  const { retenuesArticle71Fc, ...reste } = parametres;
  return assiettesExactes(elements, {
    ...reste,
    retenuesArticle71: depuisNombre(retenuesArticle71Fc ?? 0),
  }).verdict;
}

/** Les mêmes paramètres, les retenues de l'article 71 en valeur exacte. */
export type ParametresAssiettesExactes = Omit<ParametresAssiettes, 'retenuesArticle71Fc'> & {
  readonly retenuesArticle71?: DecimalExact;
};

/**
 * Le verdict, et les deux assiettes en VALEUR EXACTE, qui n'entrent jamais dans
 * le verdict (une `bigint` ne se fige pas en JSON, `common/decimal-exact.ts`).
 * La simulation s'en sert pour la quote-part ouvrière et pour l'arrondi au
 * millier de l'art. 118, qui ne se prennent pas sur un flottant.
 */
export type AssiettesExactes = {
  readonly verdict: VerdictAssiettes;
  readonly socialeExacte: DecimalExact;
  /** La base nette de l'art. 70 · `null` quand le verdict la dit non chiffrée. */
  readonly netteExacte: DecimalExact | null;
};

export function assiettesExactes(
  elements: readonly ElementPaie[],
  parametres: ParametresAssiettesExactes = {},
): AssiettesExactes {
  const sociale = assietteSocialeExacte(elements);
  const socialeFc = versNombre(sociale.montant);
  const sortsFiscaux: SortFiscal[] = [];
  const abstentions: Abstention[] = [];
  const reserves: string[] = [];

  // LE BRUT FISCAL S'ADDITIONNE EN VALEUR EXACTE (second tour de relecture du
  // paquet 1, BLOQUANT du millier) · chaque part imposable est un montant au
  // centime (la ligne saisie, ou l'excédent ramené par `auCentime`), et leur
  // somme flottante glissait sous un millier exact.
  let brutFiscal = ZERO;
  const ajouterImposable = (fc: number) => {
    brutFiscal = plus(brutFiscal, depuisNombre(fc));
  };
  let indetermine = false;

  // LES PLAFONDS DE L'ARTICLE 69 PORTENT SUR LA GRANDEUR DU SALARIÉ, pas sur
  // une ligne (passe F5). « L'indemnité de logement » (8, a) est une seule
  // grandeur · deux lignes de 20 % ne font pas deux indemnités sous le seuil,
  // elles en font une de 40 %. Et le « taux légal » des allocations (1) est
  // celui de TOUS les enfants bénéficiaires · il se consomme une fois, dans
  // l'ordre des lignes, jamais recommencé à chaque ligne. Même règle que les
  // plafonds du catalogue fiscal (`AssiettePlafond`).
  const estLigneLogement = (e: ElementPaie) =>
    e.remboursementDeDepenseProfessionnelleEffective !== true && e.nature === 'LOGEMENT_OU_SON_INDEMNITE';
  const totalLogementFc = elements.filter(estLigneLogement).reduce((t, e) => t + e.montantFc, 0);
  let tauxLegalRestantFc = parametres.tauxLegalAllocationsFamilialesFc ?? null;

  for (const element of elements) {
    // Article 68, 1 · un remboursement de dépenses professionnelles EFFECTIVES
    // n'entre pas dans les traitements imposables. Il ne s'agit pas d'une
    // immunité de l'article 69 : la somme n'est pas un revenu.
    if (element.remboursementDeDepenseProfessionnelleEffective === true) {
      sortsFiscaux.push({
        libelle: element.libelle,
        montantFc: element.montantFc,
        imposableFc: 0,
        motif:
          "Article 68, 1 · sont imposables les traitements et indemnités « qui ne représentent pas le remboursement de dépenses professionnelles effectives ». Le caractère effectif est qualifié par le cabinet.",
      });
      continue;
    }

    const immunite = IMMUNITES_ARTICLE_69.find((i) => i.nature === element.nature);

    if (!immunite) {
      // Article 68 · tout le reste est imposable, avantages en nature compris,
      // « comptés pour leur valeur réelle » (dernier alinéa).
      ajouterImposable(element.montantFc);
      sortsFiscaux.push({
        libelle: element.libelle,
        montantFc: element.montantFc,
        imposableFc: element.montantFc,
        motif:
          "Article 68 · imposable. L'article 69 ferme sa liste d'immunités, et cette nature n'y figure pas.",
      });
      continue;
    }

    if (immunite.forme === 'PLAFOND') {
      // Article 69, 1 · « dans la mesure où elles ne dépassent pas les taux
      // légaux ». Seul l'excédent est repris.
      const tauxLegal = parametres.tauxLegalAllocationsFamilialesFc;
      if (tauxLegal === undefined || tauxLegal === null) {
        indetermine = true;
        abstentions.push({
          motif: 'TAUX_LEGAL_ALLOCATIONS_FAMILIALES_NON_FOURNI',
          libelle: element.libelle,
          montantFc: element.montantFc,
          explication: explicationTauxLegalNonChiffre(immunite, parametres.tauxLegalAllocationsNonCalcule ?? null),
        });
        sortsFiscaux.push({
          libelle: element.libelle,
          montantFc: element.montantFc,
          imposableFc: null,
          motif: `${immunite.point} · plafond non chiffrable, voir l'abstention.`,
        });
        continue;
      }
      // AU CENTIME (paquet 1, C1, passe V1 n° 2) · le taux légal est un
      // produit de flottants (796,30 × 26 × 3 = 62 111,399999999994), et la
      // consommation ligne à ligne en ajoute d'autres (62 111,40 − 20 000,10).
      // Une allocation EXACTEMENT égale au taux légal laissait un excédent de
      // 7,3e-12 FC, imposable, et le motif « Seul l'excédent de 0.00 FC est
      // imposable ». Les montants de la paie vivent au centime (Decimal 18,2) ·
      // plafond, part immunisée, reste et excédent y sont ramenés. La règle du
      // plafond n'est pas touchée (seul l'excédent est repris).
      const plafondRestantFc = auCentime(Math.max(0, tauxLegalRestantFc ?? tauxLegal));
      // L'arrondi ne porte jamais l'immunité AU-DELÀ du montant (constat 3) ·
      // 50 000,005 FC s'arrondissait à 50 000,01, et la part imposable
      // devenait négative. La porte refuse le millième (ElementPaieDto) ; la
      // règle tient aussi pour un appelant interne.
      const immunise = Math.min(element.montantFc, auCentime(Math.min(element.montantFc, plafondRestantFc)));
      tauxLegalRestantFc = auCentime(plafondRestantFc - immunise);
      const excedent = auCentime(element.montantFc - immunise);
      ajouterImposable(excedent);
      sortsFiscaux.push({
        libelle: element.libelle,
        montantFc: element.montantFc,
        imposableFc: excedent,
        motif:
          `${immunite.point} · ${immunite.texte}. Taux légal retenu : ${tauxLegal.toFixed(2)} FC. ` +
          (excedent > 0
            ? `Seul l'excédent de ${excedent.toFixed(2)} FC est imposable.`
            : "L'allocation est entièrement immunisée."),
      });
      continue;
    }

    // Forme CONDITION · tout ou rien.
    if (immunite.conditionNonVerifiableParLeLogiciel) {
      const atteste = element.conditionArticle69Attestee;
      if (atteste === undefined || atteste === null) {
        indetermine = true;
        abstentions.push({
          motif: 'CONDITION_ARTICLE_69_NON_ATTESTEE',
          libelle: element.libelle,
          montantFc: element.montantFc,
          explication:
            `${immunite.point} n'immunise que ${immunite.texte}. Cette condition n'est dans aucun livre comptable : ` +
            "elle se constate sur pièces, et le cabinet l'atteste. Sans attestation, OmegaX ne l'immunise pas de lui-même et ne l'impose pas non plus.",
        });
        sortsFiscaux.push({
          libelle: element.libelle,
          montantFc: element.montantFc,
          imposableFc: null,
          motif: `${immunite.point} · condition non attestée, voir l'abstention.`,
        });
        continue;
      }
      const imposableFc = atteste ? 0 : element.montantFc;
      ajouterImposable(imposableFc);
      sortsFiscaux.push({
        libelle: element.libelle,
        montantFc: element.montantFc,
        imposableFc,
        motif: atteste
          ? `${immunite.point} · condition attestée par le cabinet, l'immunité joue.`
          : `${immunite.point} · condition NON remplie, l'immunité ne joue pas. Le montant entier est imposable (${immunite.forme.toLowerCase()}, non plafond).`,
      });
      continue;
    }

    // Article 69, 8, a) · la seule condition que le logiciel sait vérifier.
    // « Ne dépasse 30 % » · à 30 % EXACTEMENT la condition est remplie. Elle
    // se juge en CENTIMES ENTIERS (premier tour de relecture du paquet 1,
    // constat 1) · le flottant rendait 131 072,30 × 30 / 100 =
    // 39 321,689999999995, et un logement de 39 321,69 FC, 30 % pile, était
    // imposé EN ENTIER. Total × 100 ≤ rémunération × 30, sur des entiers.
    // Le plafond se dit au millième quand il en porte un (30 % d'un nombre
    // de centimes) · arrondi au centime, 39 321,699 s'affichait 39 321,70
    // à côté d'un total de 39 321,70 dit au-dessus.
    const remunerationCentimes = enCentimes(socialeFc);
    const conditionRemplie = enCentimes(totalLogementFc) * 100 <= remunerationCentimes * PLAFOND_LOGEMENT_POUR_CENT;
    const plafondMillimes = remunerationCentimes * PLAFOND_LOGEMENT_POUR_CENT / 10;
    const plafondFc = plafondMillimes / 1000;
    const plafondAffiche = Number.isInteger(plafondMillimes / 10) ? plafondFc.toFixed(2) : plafondFc.toFixed(3);
    const imposableFc = conditionRemplie ? 0 : element.montantFc;
    ajouterImposable(imposableFc);
    sortsFiscaux.push({
      libelle: element.libelle,
      montantFc: element.montantFc,
      imposableFc,
      motif:
        `${immunite.point} · ${immunite.texte}. Indemnité de logement du mois, toutes lignes : ${totalLogementFc.toFixed(2)} FC, ` +
        `plafond de comparaison : ${plafondAffiche} FC. ` +
        (conditionRemplie
          ? "La condition est remplie, l'immunité joue tout entière."
          : "La condition n'est PAS remplie, et le point est écrit « pour autant que », non « dans la limite de » : l'immunité ne joue pas du tout, le montant entier est imposable."),
    });
    // DÉCISION T3 DU 2026-10-07 · c'est une CONDITION, tranchée par le texte
    // (« pour autant que » gouverne a, b et c, dont b et c sont des conditions
    // pures ; la loi n° 23/053 a repris cette formule après la circulaire de
    // 1988, qui lisait une rédaction antérieure). L'autre lecture, chiffrée
    // jusque-là en réserve, n'a plus d'objet et ne s'affiche plus (§ 9 ter,
    // aucun historique à l'écran).
    reserves.push(
      "BASE DES 30 % · l'article 69, 8, a) dit « de la rémunération » sans la définir. OmegaX la prend au sens de " +
        "l'article 7, point 8 du Code du travail, qui en exclut justement le logement, soit " +
        `${socialeFc.toFixed(2)} FC. Une lecture qui y inclurait le logement élargirait le plafond.`,
    );
  }

  const retenues71 = maximum(ZERO, parametres.retenuesArticle71 ?? ZERO);
  const retenuesArticle71Fc = versNombre(retenues71);
  const assietteFiscaleBruteFc = indetermine ? null : versNombre(brutFiscal);
  const quotePartNonChiffree = parametres.quotePartOuvriereNonChiffree ?? null;
  const motifAssietteNetteNonChiffree =
    assietteFiscaleBruteFc !== null && quotePartNonChiffree
      ? "Base fiscale nette NON CHIFFRÉE · elle est nette des versements « réellement effectués à titre définitif » " +
        "à une caisse de pension officielle (loi n° 23/053, art. 70 et 71), et la quote-part ouvrière de la CNSS " +
        `ne l'est pas · ${quotePartNonChiffree} L'impôt et le net ne se chiffrent donc pas non plus.`
      : null;
  const netteExacte =
    assietteFiscaleBruteFc === null || motifAssietteNetteNonChiffree !== null
      ? null
      : maximum(ZERO, moins(brutFiscal, retenues71));
  const assietteFiscaleNetteFc = netteExacte === null ? null : versNombre(netteExacte);

  if (retenuesArticle71Fc > 0) {
    reserves.push(
      "ARTICLE 71 · les retenues déduites sont « les versements réellement effectués à titre définitif, soit à des " +
        "caisses de pension officielles, soit obligatoirement sous le patronage de l'employeur ». La quote-part " +
        "ouvrière de la CNSS y entre, le régime général de la loi n° 16/009 étant une caisse de pension officielle. " +
        "Les cotisations patronales n'y entrent pas : elles ne sont pas retenues sur le revenu du travailleur.",
    );
  }

  return {
    verdict: {
      assietteSocialeFc: socialeFc,
      horsRemuneration: sociale.horsRemuneration,
      assietteFiscaleBruteFc,
      sortsFiscaux,
      retenuesArticle71Fc,
      assietteFiscaleNetteFc,
      motifAssietteNetteNonChiffree,
      abstentions,
      reserves: [...new Set(reserves)],
    },
    socialeExacte: sociale.montant,
    netteExacte,
  };
}
