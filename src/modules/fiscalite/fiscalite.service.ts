import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { estCompteDuResultatDeLExercice, resultatDeLExerciceAuxClassesDeGestion } from '../etats-financiers/resultat-de-l-exercice';
import {
  FormeJuridiqueSyscohada,
  NatureActiviteFiscale,
  Prisma,
  Referentiel,
  RegimeLiquidation,
  StatutExercice,
  SensRetraitementFiscal,
  StatutEcriture,
  TypeCompteDetailTotal,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { avantSoldeDesComptesDeGestion } from '../comptabilite/balance-trois-colonnes';
import { CATALOGUE_RETRAITEMENTS, CODE_LIBRE, RETRAITEMENT_PAR_CODE } from './catalogue-retraitements';
import {
  DERNIERE_VERIFICATION_FISCALE,
  EXERCICES_OBSERVES_REGIME,
  IMPOT_REVENU_PERSONNES_PHYSIQUES,
  IMPOT_SOCIETES,
  QUOTITES_PETITE_ENTREPRISE,
} from './parametres-fiscaux';
import { CreerRetraitementDto, ModifierDossierFiscalDto, ModifierRetraitementDto } from './dto/fiscalite.dto';
import { qualifierExemptionIs } from './exemption-is-ebnl';
import { arrondirImpotArt150 } from './arrondi-article-150';
import { montantFiscal } from './ecriture-impot-resultat';
import { ENTREE_EN_VIGUEUR_LOI_23_053 } from '../../common/entree-en-vigueur-loi-23-053';
import {
  avertissementDeficitsSimules,
  avertissementExercicesNonJointifs,
  avertissementsReportDeclare,
  originesHorsFenetre,
  partImputableDeLaSaisie,
  rejouerReport,
  type ExerciceRejoue,
} from './report-deficitaire';
import {
  OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE,
  sourceChiffreAffairesPeriode,
  OBSERVATION_PERTE_PERIODE_CREATION,
  chiffreAffairesMinimumPremierExercice,
  deductionPeriodeCreation,
  periodeDeCreation,
  type PeriodeCreation,
} from './periode-creation';
// Le chiffre d'affaires n'est plus écrit ici : il se DÉRIVE du poste XB du
// modèle du ch. 4 (voir correspondance-compte-resultat-syscohada.ts). Une
// liste officielle recopiée dans deux modules est une divergence en attente.
import { PREFIXES_CHIFFRE_AFFAIRES_SYSCOHADA as PREFIXES_CHIFFRE_AFFAIRES } from '../etats-financiers-syscohada/correspondance-compte-resultat-syscohada';
import { FORMES_PERSONNES_PHYSIQUES } from '../retenues/correspondance-retenues';
import { cotisationsDues, echeancierDissolution, estExerciceDeLiquidation, sansLiquidation } from '../exercice/liquidation-societe';

/**
 * DÉTERMINATION DU RÉSULTAT FISCAL ET DE L'IMPÔT SUR LES BÉNÉFICES ·
 * dossiers SYSCOHADA uniquement.
 *
 * Loi n° 23/053 du 30 novembre 2023, art. 9 : « le bénéfice imposable est
 * […] l'excédent des produits sur les charges en application de la
 * législation comptable, sous réserve des dispositions fiscales
 * contraires ». Le premier terme vient de la balance, le second des
 * retraitements saisis depuis le catalogue (catalogue-retraitements.ts).
 *
 * Ce que ce service NE FAIT PAS, et pourquoi · il ne qualifie aucune charge
 * de non déductible à partir de son compte. Le 6582 « Dons » reçoit des
 * versements déductibles dans la limite de l'article 44 et des libéralités
 * qui ne le sont pas ; un tri automatique se
 * tromperait en silence sur tous les dossiers. Il ne produit pas non plus le
 * formulaire de déclaration de la DGI, dont le modèle n'est pas en main.
 *
 * CE QUE CE SERVICE NE DIT PLUS · il refusait tout dossier SYCEBNL avec la
 * phrase « Une entité à but non lucratif est exemptée d'impôt sur les
 * sociétés (loi n° 23/053, art. 5) », qui affirmait un droit à partir du seul
 * RÉFÉRENTIEL COMPTABLE. L'art. 5 porte trois exemptions distinctes (points
 * 3, 4 et 5) et le point 5, celui des établissements d'utilité publique et
 * des ONG, renvoie « aux conditions définies par voie réglementaire » que
 * l'arrêté n° 007/2025 a fixées. Le refus du module demeure, sa raison ne
 * change pas (ce module lit une balance SYSCOHADA), mais la qualification est
 * désormais posée par exemption-is-ebnl.ts à partir de la FORME JURIDIQUE et
 * de l'attestation du dossier, et non plus supposée.
 *
 * Le contrôleur refuse les dossiers SYCEBNL, et le service le revérifie, la
 * double barrière étant la règle du dépôt.
 */


const arrondir = (n: number) => Math.round(n * 100) / 100;

/**
 * ENTRÉE EN VIGUEUR DE LA LOI N° 23/053 DU 30 NOVEMBRE 2023 · le 1er janvier
 * 2026, tel que les bases juridiques du Titre Ier le portent (fichier
 * `code-general-2026/references/03-loi23-053-titre1-dispositions-generales.md`).
 * Tout ce que ce service calcule vient de cette loi ; un exercice ouvert avant
 * cette date relève d'un texte qui n'est pas dans OmegaX.
 */
// La date elle-même vit dans `common/entree-en-vigueur-loi-23-053.ts`, seul porteur.

// L'arrondi de l'art. 150 vit dans `arrondi-article-150.ts`, SEUL porteur ·
// la paie l'appelle aussi (audit final F111).
export { arrondirImpotArt150 };

type RegimeImposition =
  | 'IMPOT_SOCIETES'
  | 'IRPP_MICRO_ENTREPRISE'
  | 'IRPP_PETITE_ENTREPRISE'
  | 'IRPP_REGIME_REEL';

/**
 * Ce que la condition de l'art. 44 a besoin de lire · le résultat fiscal
 * BRUT et les retraitements déjà saisis, rien de plus.
 */
type LectureFiscaleBrute = {
  resultatFiscalBrut: number;
  retraitements: { code: string; sens: SensRetraitementFiscal; montant: unknown }[];
};

/** Les trois régimes d'une personne physique, du plus bas au plus haut. */
type RegimePhysique = 'IRPP_MICRO_ENTREPRISE' | 'IRPP_PETITE_ENTREPRISE' | 'IRPP_REGIME_REEL';

/**
 * L'ÉCHELLE DES RÉGIMES, dans l'ordre où la loi les gravit et les redescend ·
 * art. 106 à 112 de la loi n° 23/053. Son ordre est ce qui donne un sens au
 * « régime d'imposition immédiatement inférieur » de l'art. 113 : on ne
 * descend que d'un cran à la fois.
 */
const ECHELLE_REGIMES_PHYSIQUES: RegimePhysique[] = [
  'IRPP_MICRO_ENTREPRISE',
  'IRPP_PETITE_ENTREPRISE',
  'IRPP_REGIME_REEL',
];

/**
 * PASSE F5 · ce que le Titre 3 (IRPP) pose et qu'aucune balance ne tranche.
 * Dit, jamais calculé · chaque condition est un fait du dossier.
 */
export const OBSERVATIONS_PHYSIQUE_PASSE_F5 = {
  commun: [
    "Art. 103 : sont exonérés les revenus des terres EXCLUSIVEMENT affectées à des cultures vivrières et d'une superficie INFÉRIEURE à dix hectares · deux conditions cumulatives qu'aucune écriture ne porte. Si elles sont remplies, ni le régime ni l'impôt annoncés ici ne sont dus sur ces revenus.",
  ],
  regimeReel: [
    "Art. 89, al. 2 et 3 : les revenus de capitaux mobiliers et les loyers d'immeubles NON inscrits à l'actif du bilan ne sont pas des produits taxables de l'entreprise ; inscrits à l'actif, ils le sont pour leur montant net. Art. 90 : sont en outre déductibles les versements définitifs pour rente viagère, pension, assurance maladie ou chômage, dans la limite de 20 % des revenus professionnels imposés l'année antérieure, et les frais médicaux du redevable résident, de son épouse et de ses enfants célibataires à charge, effectivement payés et justifiés. Ces montants se portent en déduction manuelle.",
    "Art. 92 à 99 : les bénéfices d'une profession libérale ou non commerciale sont l'excédent des RECETTES sur les dépenses. Les provisions et avances sur honoraires EFFECTIVEMENT ENCAISSÉES sont des recettes, sauf celles qui couvrent des débours (art. 95, 1°) · en comptabilité d'engagement, elles restent au 419 et hors du résultat, et se réintègrent ici. Les fonds des clients ne restent non imposables qu'enregistrés à un compte distinct (art. 97), et aucun loyer ne se déduit pour des locaux dont le professionnel est propriétaire (art. 99, al. 3).",
  ],
} as const;

/**
 * PASSE F5 · ANOMALIE DU TEXTE, signalée et non tranchée. Le Titre 2, art. 3
 * soumet à l'IS les SA, SARL et SAS « même unipersonnelles » ; le Titre 3,
 * art. 63, al. 2, 1° soumet personnellement à l'IRPP l'associé ou
 * l'actionnaire unique personne physique de ces mêmes sociétés, par renvoi
 * au régime des SNC « lorsque ces sociétés n'ont pas opté pour l'Impôt sur les
 * Sociétés ». Aucune source lue n'articule les deux · le calcul reste à l'IS.
 */
export const OBSERVATION_UNIPERSONNELLE_PASSE_F5 =
  "Société unipersonnelle à associé ou actionnaire unique personne physique : le Titre 2, art. 3 la soumet à l'impôt sur les sociétés « même unipersonnelle », quand l'art. 63, al. 2, 1° soumet cet associé personnellement à l'IRPP, par renvoi au régime des sociétés de personnes qui n'ont pas opté pour l'IS. Aucune source lue n'articule les deux textes · le calcul reste à l'IS, et le point est à faire trancher.";

/** Complément servi quand la SASU est déclarée mais pas la nature de son associé (C4). */
export const COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE =
  "La nature de l'associé unique n'est pas déclarée (identité du dossier, « associé unique personne morale ») · l'observation ne vaut que s'il est une personne physique.";

/**
 * QUAND L'OBSERVATION DE L'ART. 63, AL. 2, 1° SE SERT (paquet 1, ligne C,
 * point C4, passe V1 n° 2). Elle était servie à TOUTE SA, SARL ou SAS, sur la
 * seule forme · une société à plusieurs associés lisait qu'elle était
 * « unipersonnelle à associé unique personne physique ».
 *
 * Le texte vise « l'associé unique d'une société à responsabilité limitée ou
 * […] l'actionnaire unique d'une société anonyme ou d'une société par action
 * simplifiée, lorsque cet associé ou cet actionnaire est une personne
 * physique » (loi n° 23/053, art. 63, al. 2, 1°) · DEUX faits, l'unicité et
 * la personne physique. Le dossier n'en porte que deux, et pour la SAS
 * seulement :
 *  · `associeUniqueSas` · la SAS qui « ne comprend qu'un associé », la SASU
 *    (AUSCGIE art. 853-2, al. 2), propre à la SAS ;
 *  · `associeUniquePersonneMorale` · tous les titres détenus par un associé
 *    unique PERSONNE MORALE (art. 201, al. 4), pour toute société
 *    commerciale. Sur une SASU déclarée, « non » dit donc que l'associé
 *    unique est une personne physique.
 * Rien ne dit qu'une SARL ou une SA est unipersonnelle À ASSOCIÉ PERSONNE
 * PHYSIQUE (l'art. 309 et l'art. 385 de l'AUSCGIE le permettent, aucun champ
 * ne le déclare) · l'observation ne leur est pas servie. « Pas encore dit »
 * n'est pas « oui » · une SAS dont l'unicité n'est pas déclarée ne la reçoit
 * pas ; une SASU dont la nature de l'associé n'est pas déclarée la reçoit,
 * avec la condition dite ; une SASU à associé personne morale ne la reçoit
 * pas (l'art. 63 vise la personne physique).
 */
export function unipersonnaliteDeLArticle63(t: {
  formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null;
  associeUniqueSas?: boolean | null;
  associeUniquePersonneMorale?: boolean | null;
}): 'ASSOCIE_PERSONNE_PHYSIQUE' | 'NATURE_NON_DECLAREE' | null {
  if (t.formeJuridiqueSyscohada !== FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE) return null;
  if (t.associeUniqueSas !== true) return null;
  if (t.associeUniquePersonneMorale === true) return null;
  return t.associeUniquePersonneMorale === false ? 'ASSOCIE_PERSONNE_PHYSIQUE' : 'NATURE_NON_DECLAREE';
}

/**
 * C02 · LE CHIFFRE D'AFFAIRES QUE LE MODULE LIT, DIT À CHAQUE ENDROIT OÙ IL
 * SERT. L'art. 57 assied le minimum sur le chiffre d'affaires « déclaré »,
 * l'art. 44 le plafond des dons sur le « chiffre d'affaires de l'exercice »,
 * les art. 43 et 49, 1° leurs plafonds sur le chiffre d'affaires « hors
 * taxes » · aucun article du Titre Ier ne le définit. OmegaX lit le poste XB
 * du compte de résultat (comptes 701 à 707), et ne le disait que dans la
 * branche « déficit et chiffre d'affaires nul » (cas chiffré C02,
 * `docs/cas-chiffres/is.md`). Le montant ne change pas · l'hypothèse se dit.
 */
export const LECTURE_CHIFFRE_AFFAIRES =
  "Chiffre d'affaires lu sur les comptes 701 à 707 (poste XB du compte de résultat), mouvements du livre-journal, rabais compris · la loi n° 23/053 vise le chiffre d'affaires « déclaré » (art. 57) ou « hors taxes » (art. 43 et 49) sans le définir ; si celui que le dossier déclare diffère de ces comptes, l'impôt minimum et les plafonds affichés diffèrent d'autant.";

/**
 * LOI N° 23/053, ART. 12 AL. 4 · « Lorsqu'il est dressé des bilans successifs
 * au cours d'une même année, les résultats en sont totalisés pour l'assiette
 * de l'impôt dû au titre de ladite année. » DITE, jamais calculée (décision
 * par la loi du 2026-10-07, point 2) · ni le minimum de l'art. 57 ni le
 * report déficitaire ne sont rejoués sur l'année totalisée.
 */
export function observationBilansSuccessifs(dateFin: Date): string {
  const annee = dateFin.getUTCFullYear();
  return (
    `BILANS SUCCESSIFS EN ${annee} · « lorsqu'il est dressé des bilans successifs au cours d'une même année, les ` +
    "résultats en sont totalisés pour l'assiette de l'impôt dû au titre de ladite année » (loi n° 23/053, art. 12 " +
    "al. 4). Le calcul ci-dessous porte sur cet exercice seul, impôt minimum et report déficitaire compris · la " +
    `totalisation des résultats de ${annee}, et l'impôt qui en résulte, restent à établir par le cabinet. En cas de ` +
    "dissolution, la cotisation spéciale est rattachée à l'exercice désigné par le millésime de l'année de la " +
    'dissolution (art. 13 al. 3).'
  );
}

/** Les bilans successifs de l'année de la dissolution, servis au résultat fiscal. */
export interface BilansSuccessifs {
  role: 'PREMIERE_COTISATION' | 'COTISATION_UNIQUE' | 'SECONDE_COTISATION' | 'NON_CALCULEE';
  anneeDissolution: number;
  calculable: boolean;
  motif: string | null;
  premiereCotisation: number | null;
  /**
   * D'où vient la première cotisation (second tour, BLOQUANT 2) · le constat
   * de l'écriture de l'impôt, le débit du 891 et du 895 de l'exercice arrêté
   * (impôt passé à la main), ou le recalcul (exercice clôturé sans l'un ni
   * l'autre), dit avec sa réserve. Absente hors de la seconde cotisation.
   */
  sourcePremiereCotisation?: 'CONSTAT' | 'COMPTE_89' | 'RECALCUL';
  totalisation: {
    periodeActivite: { exerciceId: string; dateDebut: Date; dateFin: Date; resultatFiscalAvantReport: number; chiffreAffaires: number };
    liquidation: { resultatFiscalAvantReport: number; chiffreAffaires: number };
    total: number;
    deficitDisponible: number;
    deficitImpute: number;
    resultatFiscal: number;
    chiffreAffaires: number;
    impotTheorique: number | null;
    impotMinimum: number | null;
    impotTotal: number | null;
    minimumApplique: boolean;
    acomptesImputes: number;
    dejaRegle: number | null;
    secondeCotisation: number | null;
    excedent: number;
    /**
     * L'impôt que porte le 891 de l'exercice de liquidation · l'impôt
     * totalisé moins la première cotisation, AVANT acomptes (fiche du compte
     * 89, « quelles que soient les modalités de règlement »). Nul quand la
     * première cotisation le dépasse ; `null` si l'un des deux n'est pas chiffré.
     */
    cotisationDeLExercice: number | null;
    /**
     * La part de la première cotisation qui dépasse l'impôt totalisé · dette
     * de l'État, D 441 / C 8994 (décision de Manasse du 2026-10-08).
     */
    tropPayePremiereCotisation: number;
    /** La part des acomptes non absorbée · reste au 4492 (art. 57 ter LPF). */
    excedentAcomptes: number;
  } | null;
  observation: string;
}

@Injectable()
export class FiscaliteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecritureService: EcritureService,
  ) {}

  /** Le catalogue seul · pour l'écran de saisie, avant même tout calcul. */
  catalogue() {
    return { retraitements: CATALOGUE_RETRAITEMENTS, derniereVerification: DERNIERE_VERIFICATION_FISCALE };
  }

  /**
   * LE REFUS DU MODULE, ET LA PHRASE QUI L'ACCOMPAGNE.
   *
   * Le refus reste entier : ce service lit une balance SYSCOHADA (préfixes de
   * chiffre d'affaires 701 à 707 du modèle du ch. 4, catalogue de
   * retraitements de la loi n° 23/053) et un dossier SYCEBNL n'en a pas.
   *
   * Ce qui change est la phrase servie avec lui. Elle affirmait l'exemption
   * de l'art. 5 pour TOUT dossier SYCEBNL. Or l'exemption d'un établissement
   * d'utilité publique ou d'une ONG relève du point 5, « dans les conditions
   * définies par voie réglementaire », et l'arrêté n° 007/2025 subordonne son
   * bénéfice à une attestation (art. 2) et à quatre conditions de fond
   * (art. 3), l'impôt étant dû « au titre de l'exercice concerné » en cas de
   * manquement (art. 5). Affirmer l'exemption à un tel dossier, c'est lui
   * dire qu'il est en règle sans en rien savoir.
   */
  /**
   * Le dossier, refusé s'il n'est pas tenu en SYSCOHADA · seconde barrière
   * après `ReferentielGuard`. Publique pour que les gestes voisins qui ne
   * calculent rien (annuler l'impôt constaté) la passent aussi.
   */
  async tenantSyscohada(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Dossier introuvable');
    if (tenant.referentiel !== Referentiel.SYSCOHADA) {
      const qualification = qualifierExemptionIs(tenant);
      throw new BadRequestException(
        `La détermination du résultat fiscal ne concerne que les dossiers tenus en SYSCOHADA. ${qualification.enonce}`,
      );
    }
    return tenant;
  }

  /**
   * LE STATUT D'EXEMPTION D'IS D'UN DOSSIER NON LUCRATIF · la seule route de
   * ce module ouverte au SYCEBNL, et elle ne calcule rien.
   *
   * Elle existe parce que fermer une fenêtre n'avertit personne. Le dossier
   * porte déjà la forme juridique (loi n° 004/2001), l'acte de personnalité
   * juridique et l'attestation d'exemption de l'art. 2 de l'arrêté
   * n° 007/2025 ; jusqu'ici le module fiscal ne les lisait pas. Ils sont lus
   * ici pour poser la qualification et les avertissements dus, sans jamais en
   * tirer un impôt : les quatre conditions de l'art. 3 sont des faits de
   * gestion et de marché, hors de portée d'une comptabilité.
   */
  async exemptionIs(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Dossier introuvable');
    if (tenant.referentiel !== Referentiel.SYCEBNL) {
      throw new BadRequestException(
        "Le statut d'exemption d'impôt sur les sociétés de l'article 5 de la loi n° 23/053 ne concerne que les dossiers tenus en SYCEBNL.",
      );
    }
    return {
      formeJuridique: tenant.formeJuridique ?? null,
      droitEtranger: tenant.droitEtranger ?? false,
      ...qualifierExemptionIs(tenant),
    };
  }

  private async exerciceDuDossier(tenantId: string, exerciceId: string) {
    const exercice = await this.prisma.exercice.findFirst({ where: { id: exerciceId, tenantId } });
    if (!exercice) throw new NotFoundException('Exercice introuvable');
    return exercice;
  }

  /**
   * Résultat comptable et chiffre d'affaires lus dans la balance.
   *
   * Le résultat de l'EXERCICE seul · avant clôture il vit dans les classes
   * 6, 7 et 8 ; après, dans le compte 13 qui les a soldées. L'une OU
   * l'autre source, jamais les deux · à la différence du poste du bilan
   * (`resultatAuBilan`), qui y ajoute le résultat PRÉCÉDENT resté au 13
   * jusqu'à son affectation, et qui n'est pas imposable ici. Comptes Détail
   * seulement · un compte Total n'est qu'un agrégat d'affichage de ses
   * enfants, l'additionner compterait deux fois les mêmes mouvements.
   */
  /**
   * SUIVI DES ACOMPTES PROVISIONNELS · le rapprochement que rien ne faisait,
   * et les deux lectures fausses qu'il empêche.
   *
   * LE MONTANT DÉCLARÉ N'EST PAS LE MONTANT VERSÉ. `acomptesVerses` est une
   * SAISIE : le comptable tape ce qu'il croit avoir versé, et le solde à
   * payer s'en déduit. Le compte 4492 « État, avances et acomptes versés sur
   * impôts », lui, ne contient que ce qui est sorti de la trésorerie (AUDCIF
   * Titre VII, compte 44 : DÉBITÉ des sommes versées lors du règlement par
   * l'entité à l'État, par le crédit des comptes de trésorerie). Les deux
   * peuvent différer de plusieurs millions sans qu'aucune balance ne cesse de
   * boucler : le solde à payer est faux de l'écart, la déclaration part avec,
   * et l'insuffisance se découvre au contrôle. L'art. 98 bis LPF la sanctionne
   * d'« une amende égale à 50 % du montant de l'acompte non versé ».
   *
   * UN EXCÉDENT D'ACOMPTES N'EST PAS UN REMBOURSEMENT. Quand les acomptes
   * dépassent l'impôt, l'arithmétique rend un solde négatif, et un solde
   * négatif se lit comme de l'argent qui revient. L'art. 57 ter dit autre
   * chose : « Si les acomptes provisionnels versés par le contribuable sont
   * supérieurs à l'impôt dû pour la même année, les crédits constatés à son
   * compte courant fiscal PEUVENT, À SA DEMANDE, servir au paiement d'autres
   * impôts et droits dus. » Un crédit, pas une créance à encaisser ; et il
   * faut le demander. Porter un encaissement attendu au budget de trésorerie
   * sur la foi d'un solde négatif est une erreur que ce champ empêche.
   *
   * LE MODULE NE CALCULE AUCUNE AMENDE et ne dit jamais qu'un acompte est
   * « non versé » : établir l'insuffisance est un acte de l'Administration,
   * qui suppose de connaître la base légale (l'impôt déclaré de l'exercice
   * précédent, ou l'impôt reconstitué d'office). Il rapproche deux chiffres
   * du dossier et nomme l'exposition.
   */
  static suiviAcomptes(entree: {
    acomptesDus: boolean;
    declares: number;
    comptabilises: number;
    impotDu: number | null;
  }): {
    declares: number;
    comptabilises: number;
    ecart: number;
    excedent: number | null;
    observations: string[];
  } | null {
    // Une petite entreprise (deux quotités) et une micro-entreprise (forfait)
    // ne versent pas d'acompte · leur servir un rapprochement de 4492
    // signalerait un écart sur une obligation qu'elles n'ont pas.
    if (!entree.acomptesDus) return null;

    const ecart = arrondir(entree.declares - entree.comptabilises);
    const observations: string[] = [];

    if (Math.abs(ecart) >= 0.01) {
      /*
        L'ÉCART A DEUX SENS, ET UN SEUL APPELLE L'AMENDE DE L'ART. 98 BIS.

        Passe F10. Le message était INCONDITIONNEL et renvoyait dans tous les
        cas à « l'insuffisance de paiement de l'acompte provisionnel ». Quand
        le 4492 porte PLUS que les acomptes déclarés, ce reproche est à
        l'envers : rien ne manque, quelque chose est en trop, et le cabinet
        était envoyé chercher un défaut de versement qui n'existe pas.

        ET LA CAUSE LA PLUS PROBABLE DE CE SENS-LÀ EST UNE CONSIGNATION, pas un
        acompte. Loi n° 004/2003 portant réforme des procédures fiscales,
        art. 110, alinéa 2, VERBATIM : « Toutefois, lorsque la réclamation
        porte sur un supplément d'impôt, le contribuable peut, à sa demande,
        bénéficier d'un sursis de recouvrement de l'impôt litigieux et des
        pénalités y afférentes. Dans ce cas, IL EST TENU DE VERSER un montant
        égal au DIXIÈME du supplément d'impôt contesté. » C'est une compétence
        liée, le versement est dû dès que le sursis est demandé, et le seul
        compte semé dont l'intitulé le reçoive est justement le 4492 « État,
        avances et acomptes versés sur impôts ». Le filtre de ce module étant
        un `startsWith('4492')`, la consignation y entre quelle que soit la
        subdivision ouverte.

        CE N'EST PAS UN ACOMPTE PROVISIONNEL. L'acompte de l'art. 57 bis est
        une avance sur l'impôt de l'exercice, imputable sur lui ; la
        consignation de l'art. 110 est le prix d'entrée d'un sursis sur un
        supplément CONTESTÉ, et son sort dépend de l'issue de la réclamation.
        Les additionner fausse le solde à payer dans l'autre sens.

        LE MODULE NE TRANCHE PAS, ET NE PEUT PAS · OmegaX ne détient aucune
        réclamation, aucun avis de mise en recouvrement, aucune demande de
        sursis. Il NOMME la cause possible et laisse le cabinet la
        reconnaître, comme partout ailleurs dans ce service.
      */
      const enTrop = ecart < 0;
      observations.push(
        `Les acomptes DÉCLARÉS dans cette fenêtre (${entree.declares}) et le solde débiteur du compte 4492 ` +
          `« État, avances et acomptes versés sur impôts » (${entree.comptabilises}) diffèrent de ${ecart}. ` +
          "Le 4492 est débité des sommes effectivement versées à l'État par le crédit de la trésorerie (AUDCIF " +
          'Titre VII, compte 44) : il porte le décaissement, la saisie porte une déclaration. Le solde à payer ' +
          'calculé ici est faux de cet écart. ' +
          (enTrop
            ? "LE COMPTE PORTE PLUS QUE CE QUI EST DÉCLARÉ : ce sens-là n'est PAS une insuffisance de versement, " +
              "et l'amende de l'art. 98 bis ne s'y applique pas. TROIS CAUSES À EXAMINER. Un acompte versé et non " +
              'saisi dans cette fenêtre, qui se corrige à la saisie. Ou une somme qui N’EST PAS un acompte : ' +
              "l'art. 110, alinéa 2 de la loi de procédures fiscales oblige le contribuable qui demande un sursis " +
              'de recouvrement sur un supplément contesté à « verser un montant égal au DIXIÈME du supplément ' +
              "d'impôt contesté ». Cette consignation n'est pas une avance sur l'impôt de l'exercice et ne " +
              "s'impute pas comme un acompte · son sort suit l'issue de la réclamation. Le sursis ne joue pas en " +
              "cas de taxation d'office (même article, alinéa 3). Ou, si le dossier donne des immeubles en location, " +
              "les retenues sur loyers opérées par ses locataires en son acquit : la loi n° 83/004, art. 11, appelle " +
              "chacune « acompte », et son art. 13 l'impute sur l'impôt sur les revenus locatifs du propriétaire, non " +
              "sur l'impôt sur les sociétés. OmegaX ne détient aucune réclamation ni aucun bail et ne peut donc pas " +
              'distinguer ces trois sommes : la ventilation appartient au cabinet.'
            : "LE COMPTE PORTE MOINS QUE CE QUI EST DÉCLARÉ. Si ce sont les acomptes qui manquent, l'art. 98 bis " +
              "LPF punit « le défaut ou l'insuffisance de paiement de l'acompte provisionnel » d'« une amende " +
              "égale à 50 % du montant de l'acompte non versé »."),
      );
    }

    let excedent: number | null = null;
    if (entree.impotDu !== null && entree.declares > entree.impotDu) {
      excedent = arrondir(entree.declares - entree.impotDu);
      observations.push(
        `Les acomptes versés dépassent l'impôt dû de ${excedent}. CE N'EST PAS UN REMBOURSEMENT À ENCAISSER : ` +
          "art. 57 ter LPF, « les crédits constatés à son compte courant fiscal PEUVENT, À SA DEMANDE, servir au " +
          "paiement d'autres impôts et droits dus ». Le crédit existe au compte courant fiscal du contribuable, " +
          "son emploi suppose une demande, et il s'impute sur d'autres impôts plutôt que de revenir en trésorerie.",
      );
    }

    // LE 4492 SOLDÉ · l'imputation de l'art. 57 bis al. 3 (« ces trois
    // versements sont à déduire de l'impôt dû par le contribuable pour
    // l'exercice fiscal considéré »). Tant qu'elle n'est pas passée, le 4492
    // reste débiteur au bilan : une créance sur l'État qui a déjà servi à
    // éteindre la dette d'impôt, donc comptée deux fois à l'actif et au
    // passif. L'écriture s'équilibre des deux côtés, le bilan boucle.
    if (entree.impotDu !== null && entree.comptabilises > 0.005 && entree.declares > 0.005) {
      observations.push(
        "À la liquidation, le 4492 se solde par imputation sur la dette d'impôt · art. 57 bis, al. 3 : « Ces trois " +
          "versements sont à déduire de l'impôt dû par le contribuable pour l'exercice fiscal considéré, le solde " +
          "éventuel de cet impôt devant être versé au moment du dépôt de la déclaration y afférente. » Un 4492 " +
          "laissé débiteur après liquidation porte à l'actif une avance qui a déjà éteint la dette : elle est " +
          "comptée deux fois, et le bilan boucle quand même.",
      );
    }

    return { declares: arrondir(entree.declares), comptabilises: arrondir(entree.comptabilises), ecart, excedent, observations };
  }

  /** Total des réintégrations « Impôt sur les sociétés et impôt minimum comptabilisés en charges ». */
  static reintegrationsImpot(retraitements: { code: string; sens: SensRetraitementFiscal; montant: unknown }[]): number {
    return arrondir(
      retraitements
        .filter((r) => r.code === 'IMPOT_SUR_LE_RESULTAT' && r.sens === SensRetraitementFiscal.REINTEGRATION)
        .reduce((s, r) => s + Number(r.montant), 0),
    );
  }

  /**
   * L'IMPÔT DÉDUIT DE SON PROPRE CALCUL · ligne A11. Le résultat fiscal part
   * du résultat comptable, que l'écriture du 89 diminue dès qu'elle est
   * validée. Sans réintégration du même montant, l'impôt se recalcule sur une
   * base amputée de lui-même · loi n° 23/053, art. 45 (« à l'exception de
   * l'Impôt sur les Sociétés et du minimum forfaitaire de perception ») et
   * art. 50, 2°. La balance boucle, l'impôt affiché baisse, rien ne le dit ·
   * d'où l'observation, dans les deux sens. Rien n'est inscrit d'office (le
   * logiciel se souvient, il ne qualifie pas).
   */
  static observationImpotNonReintegre(impotConstateAu89: number, reintegrations: number): string | null {
    const ecart = arrondir(impotConstateAu89 - reintegrations);
    if (Math.abs(ecart) < 0.005) return null;
    // Mêmes montants, même formateur que le motif jumeau du constat
    // (`motifsRefusConstat`) · un écran ne doit pas lire 180 ici et 180,00 là.
    return (
      `IMPÔT NON RÉINTÉGRÉ À SA MESURE · les comptes 891, 892 et 895 portent ${montantFiscal(impotConstateAu89)} au débit ` +
      `du livre-journal, la réintégration « Impôt sur les sociétés et impôt minimum comptabilisés en charges » vaut ` +
      `${montantFiscal(reintegrations)} (écart ${montantFiscal(ecart)}). L'impôt sur les sociétés et le minimum forfaitaire de ` +
      "perception ne sont pas déductibles (loi n° 23/053, art. 45 et art. 50, 2°) · tant que la réintégration n'égale pas " +
      "l'impôt constaté, le résultat fiscal et l'impôt calculés ici sont faux de cet écart. Ajustez la réintégration ; un " +
      "impôt comptabilisé hors du 89 et réintégré à raison se range sous une ligne libre, ou sa charge se reclasse au 89."
    );
  }

  /**
   * LE DÉGRÈVEMENT AU 899, NOMMÉ ET JAMAIS DÉDUIT · ligne A11. L'art. 45 de la
   * loi n° 23/053 ne fait entrer dans les recettes que les dégrèvements
   * accordés « sur les impôts déductibles » · lu a contrario, celui de l'IS
   * resterait hors de l'assiette, mais aucun texte ne le dit expressément. Le
   * cabinet en décide (une déduction en ligne libre, motivée) ; OmegaX le
   * montre seulement.
   */
  static observationDegrevement(degrevementsAu899: number): string | null {
    if (Math.abs(degrevementsAu899) < 0.005) return null;
    return (
      `DÉGRÈVEMENT AU 899 · ${montantFiscal(degrevementsAu899)} crédités en « Dégrèvements et annulations d'impôts sur ` +
      "résultats antérieurs ». Son traitement fiscal relève du cabinet · l'art. 45 de la loi n° 23/053 ne fait entrer en " +
      "recette que les dégrèvements « sur les impôts déductibles », et aucun texte ne dit expressément le sort de celui de " +
      "l'impôt sur les sociétés. Rien n'est déduit d'office ; une déduction se saisit en ligne libre, avec son fondement."
    );
  }

  /**
   * `arreteAu` · lecture à une date à l'intérieur de l'exercice, pour les
   * comptes intermédiaires de l'art. 12, al. 3 (période de création arrêtée
   * au 31 décembre). `inclureBrouillard` ne sert qu'à MESURER ce que le
   * brouillard changerait (cas chiffré C01-bis) · jamais au calcul de
   * l'impôt.
   */
  private async lireBalance(tenantId: string, exerciceId: string, arreteAu?: Date, inclureBrouillard = false) {
    // LE LIVRE-JOURNAL SEUL (audit du serveur du 2026-09-27, F6). Un résultat
    // fiscal, un impôt et un minimum de perception engagent le dossier devant
    // l'Administration · ils ne se calculent pas sur une écriture restée au
    // brouillard, qui n'est pas entrée en comptabilité (AUDCIF art. 22, 2°).
    // `propositionsRetraitements` lit déjà ainsi, et les deux lectures d'un
    // même exercice ne doivent pas rendre deux chiffres d'affaires.
    const balance = await this.ecritureService.balance(tenantId, exerciceId, inclureBrouillard, arreteAu);
    // GARDE-FOU CONSERVÉ, ET REDONDANT PAR CONSTRUCTION · la balance ne rend
    // plus que des comptes de détail depuis qu'elle a cessé de sous-totaliser
    // par compte principal. Le filtre reste parce qu'un agrégat compté en plus
    // de ses enfants double des montants EN SILENCE · une assurance d'une ligne
    // contre la catégorie de bug que ce projet ne peut pas se permettre.
    const details = balance.lignes.filter((l) => l.typeCompte !== TypeCompteDetailTotal.TOTAL);
    // LES CLASSES 6 À 8 AVANT LEUR SOLDE DE CLÔTURE (régression de l'audit
    // final F4). L'écriture qui les solde sur le 13 entre VALIDÉE, donc au
    // livre-journal · lues au solde, elles valaient zéro sur tout exercice
    // clos, et le résultat retombait sur le 13, qui porte AUSSI le résultat de
    // l'exercice précédent tant que l'affectation n'est pas passée · l'impôt
    // se calculait alors sur deux bénéfices.
    const gestion = avantSoldeDesComptesDeGestion(details).filter((l) => /^[678]/.test(l.numero));
    const resultatClasses678 = gestion.reduce((s, l) => s - l.solde, 0);
    // 131 À 139, JAMAIS LE 130 · la règle de tout le logiciel
    // (`resultat-de-l-exercice.ts`), pour que l'impôt parte du résultat que le
    // bilan publie. Le 130 « Résultat en instance d'affectation » tient le
    // résultat de l'exercice PRÉCÉDENT · l'additionner ferait payer l'impôt
    // deux fois sur le même bénéfice. Les 132 à 138, eux, ENTRENT : ce sont
    // les soldes intermédiaires, virés l'un dans l'autre par des écritures
    // équilibrées à l'intérieur du 13 (Titre VIII ch. 19 § 2.4), si bien que
    // leur somme avec le 131 et le 139 vaut le résultat même quand la cascade
    // s'arrête en chemin. Ce calcul lisait jusqu'au 2026-09-27 le 131 et le
    // 139 seuls, et rendait ZÉRO sur une cascade arrêtée au 137.
    const lignes13 = details.filter((l) => estCompteDuResultatDeLExercice(l.numero));
    const resultatCompte13 = lignes13.reduce((s, l) => s - l.solde, 0);
    /*
      LE 13 N'EST LU QUE SI LA GESTION A ÉTÉ SOLDÉE DANS L'EXERCICE (cas
      chiffré V3, troisième tour). La clôture d'OmegaX reporte à l'ouverture
      suivante le résultat non affecté sur son compte (131 ou 139, colonne
      report de la balance). Un exercice dont la gestion se solde à ZÉRO
      (ventes 1 000 000, achats 1 000 000) basculait sur le 13 au seul motif
      que le net des classes 6 à 8 était nul, et y lisait les pertes de 2026
      et 2027 non affectées · 2028 et 2029 sortaient à -300 000, perte
      fantôme reportée, et 2030 rendait 60 000 d'impôt au lieu de 240 000,
      sans un mot. Deux règles, chacune sur ce que la balance montre.
      (1) Une gestion qui porte un solde sur un seul de ses comptes N'EST PAS
      soldée · son net, même nul, est le résultat (Titre VII, compte 13, le
      13 n'est mouvementé « qu'à la clôture […] pour solde »).
      (2) Un 13 qui ne porte que l'à-nouveau (aucun mouvement propre ni
      clôture de l'exercice) tient le résultat d'exercices ANTÉRIEURS · le
      résultat de l'exercice est nul (exercice sans gestion, société en
      sommeil). Le 13 reste lu, comme avant, quand la gestion a été soldée
      dans l'exercice (comptes de gestion tous à zéro) ou quand il porte des
      mouvements propres sans gestion ; l'à-nouveau qu'il porte alors est
      DIT (`reportAuCompte13`), l'affectation passée ou non ne se lisant pas
      dans la balance.
    */
    const gestionNonSoldee = gestion.some((l) => Math.abs(l.solde) > 0.005);
    const mouvementPropre13 = lignes13.some(
      (l) =>
        Math.abs(l.mouvementDebit) > 0.005 ||
        Math.abs(l.mouvementCredit) > 0.005 ||
        Math.abs(l.clotureDebit ?? 0) > 0.005 ||
        Math.abs(l.clotureCredit ?? 0) > 0.005,
    );
    const reportAuCompte13 = lignes13.reduce((s, l) => s + (l.reportCredit ?? 0) - (l.reportDebit ?? 0), 0);
    // Une règle pour tout le logiciel · les états la lisent aussi pour séparer,
    // dans le poste du résultat, l'exercice du résultat antérieur non affecté.
    const avantCloture = resultatDeLExerciceAuxClassesDeGestion(gestionNonSoldee, mouvementPropre13);
    // Un produit est un solde créditeur, donc négatif dans la convention
    // `solde = débit - crédit` de la balance · d'où le signe.
    //
    // LU SUR LES MOUVEMENTS, JAMAIS SUR LE SOLDE. L'écriture de clôture solde
    // les classes 6 et 7 de l'exercice clos (`estSoldeDesComptesDeGestion`,
    // rangée par la balance dans ses colonnes de clôture). Lu au solde, le chiffre d'affaires
    // d'un exercice clos vaudrait zéro dès que cette écriture compte, et
    // `chiffresAffairesAnterieurs`, qui ne lit QUE des exercices clos, rendrait
    // à l'art. 113 un historique de zéros · le régime d'une personne physique
    // serait déduit d'une activité fictive. Les mouvements excluent les
    // écritures de clôture, comme `balanceCumulee` ; une classe 7 n'a pas de
    // report à-nouveau, rien d'autre n'en sort.
    const chiffreAffaires = details
      .filter((l) => PREFIXES_CHIFFRE_AFFAIRES.some((p) => l.numero.startsWith(p)))
      .reduce((s, l) => s + l.mouvementCredit - l.mouvementDebit, 0);
    // LE 4492, PRIS DANS LA MÊME BALANCE · « État, avances et acomptes versés
    // sur impôts » (AUDCIF Titre VII, compte 449 : 4491 obligations
    // cautionnées, 4492 avances et acomptes versés sur impôts, 4493 fonds de
    // dotation à recevoir…). Il est DÉBITÉ des sommes versées à l'État par le
    // crédit de la trésorerie · son solde débiteur est donc ce que le dossier
    // a réellement décaissé au titre des acomptes, par opposition à ce que le
    // comptable a DÉCLARÉ dans la fenêtre fiscale.
    //
    // Le préfixe est '4492' et non '449' : le 4493 et le 4495 sont des
    // subventions à recevoir, le 4491 des obligations cautionnées. Les
    // additionner ferait passer une subvention attendue pour un acompte
    // d'impôt versé, et le solde à payer serait faux d'autant sans qu'aucun
    // total ne bouge.
    const acomptesAu4492 = details
      .filter((l) => l.numero.startsWith('4492'))
      .reduce((s, l) => s + l.solde, 0);
    // LE COMPTE 89, LU AVANT LE SOLDE DE CLÔTURE comme le reste de la gestion
    // (ligne A11). L'impôt sur le résultat n'est pas déductible de son propre
    // calcul (loi n° 23/053, art. 45 et art. 50, 2°) · une fois l'écriture du
    // 89 validée, le résultat comptable baisse d'autant, et seule la
    // réintégration IMPOT_SUR_LE_RESULTAT le rétablit. Lire le 89 ici permet
    // de dire l'écart au lieu de laisser l'impôt se recalculer, en silence,
    // sur une base amputée de lui-même.
    //
    // L'IMPÔT CONSTATÉ, ET LUI SEUL · les DÉBITS des 891 (impôt de
    // l'exercice), 892 (rappels sur exercices antérieurs) et 895 (impôt
    // minimum), plan du compte 89, AUDCIF Titre VII. Le 899 « Dégrèvements et
    // annulations d'impôts sur résultats antérieurs » est un CRÉDIT · l'additionner
    // au solde faisait qu'une réintégration (toujours positive, code en
    // REINTEGRATION) ne l'égalait jamais, et le constat restait refusé pour
    // toujours. Il est lu À PART (`degrevementsAu899`) et seulement nommé ·
    // l'art. 45 ne fait entrer en recette que les dégrèvements « sur les
    // impôts déductibles », ce qui, lu a contrario, laisse hors de l'assiette
    // celui de l'IS ; aucun texte ne le dit expressément, et rien n'est déduit
    // d'office. Débits relus APRÈS le retrait de la colonne de clôture ; une
    // annulation par inscription en négatif y vient en débit négatif.
    const impotConstateAu89 = gestion
      .filter((l) => ['891', '892', '895'].some((p) => l.numero.startsWith(p)))
      .reduce((s, l) => s + l.totalDebit, 0);
    const degrevementsAu899 = gestion
      .filter((l) => l.numero.startsWith('899'))
      .reduce((s, l) => s - l.solde, 0);
    // 891 et 895 à part · l'impôt et l'impôt minimum DE L'EXERCICE ; un 892
    // porte un exercice antérieur.
    const impotExerciceAu89 = gestion
      .filter((l) => l.numero.startsWith('891') || l.numero.startsWith('895'))
      .reduce((s, l) => s + l.solde, 0);
    return {
      resultatComptable: arrondir(avantCloture ? resultatClasses678 : resultatCompte13),
      sourceResultat: avantCloture ? ('CLASSES_6_7_8' as const) : ('COMPTE_13' as const),
      // L'à-nouveau que porte le 13 quand il est lu et rend un résultat · nul
      // hors de ce cas. Un 13 lu à zéro sous un à-nouveau non nul est celui
      // d'une affectation passée en entier · rien à dire.
      reportAuCompte13: avantCloture || Math.abs(resultatCompte13) <= 0.005 ? 0 : arrondir(reportAuCompte13),
      chiffreAffaires: arrondir(chiffreAffaires),
      acomptesAu4492: arrondir(acomptesAu4492),
      impotConstateAu89: arrondir(impotConstateAu89),
      degrevementsAu899: arrondir(degrevementsAu899),
      impotExerciceAu89: arrondir(impotExerciceAu89),
    };
  }

  /**
   * Résultat fiscal AVANT imputation des déficits antérieurs · c'est cette
   * valeur qui dit si un exercice est bénéficiaire ou déficitaire, « abstraction
   * faite des déficits reportables antérieurs » (art. 52 in fine).
   */
  /**
   * PROPOSITIONS DE RETRAITEMENT, tirées des comptes que le cabinet a
   * qualifiés lui-même (`Compte.codeRetraitementFiscal`).
   *
   * Le catalogue explique pourquoi le logiciel ne DÉDUIT pas la qualification
   * fiscale d'un numéro de compte : le 6582 « Dons » reçoit des versements
   * déductibles dans la limite de l'article 44 et d'autres qui ne le sont
   * pas. Cette règle reste vraie du plan NORMALISÉ, et rien ici ne la défait.
   *
   * Ce que fait cette méthode est autre chose : un cabinet qui a ouvert son
   * propre sous-compte « Amendes fiscales » a déjà tranché, une fois. Le
   * logiciel lui REPROPOSE chaque exercice le montant et l'article, au lieu
   * de le lui faire ressaisir. Il ne qualifie pas · il se souvient.
   *
   * ET IL NE CRÉE RIEN. La méthode rend des PROPOSITIONS : le comptable les
   * reprend, les corrige ou les ignore. Une réintégration inscrite d'office
   * serait exactement le « logiciel qui tranche seul » que le catalogue
   * refuse.
   */
  async propositionsRetraitements(tenantId: string, exerciceId: string) {
    await this.tenantSyscohada(tenantId);
    await this.exerciceDuDossier(tenantId, exerciceId);

    const comptes = await this.prisma.compte.findMany({
      where: { tenantId, codeRetraitementFiscal: { not: null } },
      select: { id: true, numero: true, intitule: true, codeRetraitementFiscal: true },
      orderBy: { numero: 'asc' },
    });
    if (!comptes.length) return { propositions: [], avertissements: [], chiffreAffaires: 0 };

    const [mouvements, brut] = await Promise.all([
      this.prisma.ligneEcriture.groupBy({
        by: ['compteId'],
        where: {
          compteId: { in: comptes.map((c) => c.id) },
          // LE LIVRE-JOURNAL SEUL · une écriture restée en brouillard n'est
          // pas entrée en comptabilité, et un impôt ne se calcule pas sur du
          // provisoire.
          // ET SANS LE SOLDE DE CLÔTURE · l'écriture qui solde les comptes de
          // gestion est validée (audit final F4), et le mouvement d'une charge
          // d'un exercice clos serait nul · aucune réintégration proposée.
          ecriture: { tenantId, exerciceId, statut: StatutEcriture.VALIDEE, estSoldeDesComptesDeGestion: false },
        },
        _sum: { debit: true, credit: true },
      }),
      // PAS `lireBalance` MAIS `resultatFiscalBrut` · la condition d'ouverture
      // de l'art. 44 se juge sur le RÉSULTAT NET IMPOSABLE, donc après les
      // réintégrations et déductions déjà saisies, et non sur le seul
      // chiffre d'affaires. C'est le seul plafond du Titre II dont l'assiette
      // dépend de l'ordre des opérations.
      this.resultatFiscalBrut(tenantId, exerciceId),
    ]);
    const parCompte = new Map(mouvements.map((m) => [m.compteId, m]));

    // PREMIER PASSAGE · le mouvement net de chaque compte qualifié, sans
    // encore aucun plafond. Le mouvement est pris dans son sens naturel, une
    // charge étant débitrice ; un compte qui finit créditeur (avoir supérieur
    // à la charge) ne porte plus rien à réintégrer.
    const lignes = comptes.flatMap((c) => {
      const definition = CATALOGUE_RETRAITEMENTS.find((d) => d.code === c.codeRetraitementFiscal);
      // Un code devenu inconnu (catalogue remanié) est IGNORÉ, pas rendu ·
      // proposer un retraitement sans article ni libellé ne veut rien dire.
      if (!definition) return [];
      const m = parCompte.get(c.id);
      const mouvement = arrondir(Number(m?._sum.debit ?? 0) - Number(m?._sum.credit ?? 0));
      if (mouvement <= 0) return [];
      return [{ compte: c, definition, mouvement }];
    });

    // CE QUI NE SE PROPOSE PAS, ET POURQUOI ON LE DIT QUAND MÊME.
    //
    // Pour un code sans plafond, le service posait `montant = mouvement` :
    // tout le mouvement se réintègre. C'est juste pour une amende (art. 50,
    // 3°), dont la charge entière est non déductible. Ce l'est exactement
    // A REBOURS pour l'amortissement : l'art. 28 admet en déduction toute
    // dotation conforme au barème de l'arrêté n° 013/CAB/MIN/FINANCES/2025,
    // et seul l'EXCÉDENT se réintègre. Un cabinet qui taguait son 6813 ·
    // geste naturel, c'est le compte où vit l'écart, et rien ne l'en
    // empêchait · se voyait proposer la dotation ENTIÈRE.
    //
    // L'annuité fiscale ne se lit pas dans une balance. Plutôt que de
    // proposer un montant faux, le module N'EN PROPOSE AUCUN et rend la
    // ligne comme un avertissement, avec son article et ce que le comptable
    // doit établir lui-même. S'abstenir en disant pourquoi vaut mieux que
    // deviner : un montant repris sans réflexion se retrouve dans une
    // déclaration.
    const horsPortee = lignes.filter((l) => l.definition.assietteHorsPortee);
    const proposables = lignes.filter((l) => !l.definition.assietteHorsPortee);
    const avertissements = horsPortee.map((l) => ({
      compteId: l.compte.id,
      numero: l.compte.numero,
      intitule: l.compte.intitule,
      code: l.definition.code,
      libelle: l.definition.libelle,
      source: l.definition.source,
      mouvement: l.mouvement,
      motif: l.definition.assietteHorsPortee!,
    }));

    // CUMUL PAR NATURE DE CHARGE · c'est lui, et non le mouvement d'un
    // compte, que les plafonds assis sur le chiffre d'affaires viennent
    // limiter (voir `repartirExcedentPlafonne` et le commentaire de
    // `AssiettePlafond`).
    const cumulParCode = new Map<string, number>();
    for (const l of proposables) {
      if (l.definition.plafond?.assiette !== 'CHIFFRE_AFFAIRES') continue;
      cumulParCode.set(l.definition.code, arrondir((cumulParCode.get(l.definition.code) ?? 0) + l.mouvement));
    }
    // ART. 44, AL. 2, 2° · le plafond ne joue que si le droit à déduction est
    // OUVERT. Ici, et ici seulement, les deux termes de la condition sont
    // connus : les versements sont le cumul de la nature, et ce qui en a déjà
    // été réintégré se lit dans les retraitements saisis.
    const plafondsFermes = new Set<string>();
    for (const [code, cumul] of cumulParCode) {
      const definition = RETRAITEMENT_PAR_CODE.get(code);
      if (!definition?.conditionResultatNetPositif) continue;
      if (!this.droitADeductionOuvert(brut, code, cumul).ouvert) plafondsFermes.add(code);
    }
    const excedentsRepartis = this.repartirExcedentPlafonne(
      proposables,
      cumulParCode,
      brut.chiffreAffaires,
      plafondsFermes,
    );

    const propositions = proposables.flatMap((l) => {
      const plafond = l.definition.plafond;
      const cumulNature = cumulParCode.get(l.definition.code) ?? null;
      const conditionFermee = plafondsFermes.has(l.definition.code);
      // Sans plafond, tout le mouvement se retraite. Avec plafond, SEUL
      // L'EXCÉDENT · réintégrer la charge entière ferait payer l'impôt sur
      // une somme que la loi admet en déduction. Condition d'ouverture non
      // remplie, en revanche, il n'y a PAS d'excédent : il n'y a aucune
      // déduction, et le versement entier se réintègre.
      const montant = !plafond
        ? l.mouvement
        : plafond.assiette === 'CHIFFRE_AFFAIRES'
          ? (excedentsRepartis.get(l.compte.id) ?? 0)
          : arrondir(Math.max(l.mouvement - arrondir(plafond.part * l.mouvement), 0));
      if (montant <= 0) return [];
      const partagee = plafond?.assiette === 'CHIFFRE_AFFAIRES' && cumulNature !== null && cumulNature > l.mouvement;
      return [
        {
          compteId: l.compte.id,
          numero: l.compte.numero,
          intitule: l.compte.intitule,
          code: l.definition.code,
          sens: l.definition.sens,
          libelle: l.definition.libelle,
          source: l.definition.source,
          mouvement: l.mouvement,
          // L'ÉNONCÉ EST LE SEUL CANAL QUI ATTEIGNE L'ÉCRAN AUJOURD'HUI · la
          // condition d'ouverture y est donc jointe, plutôt que servie dans
          // un champ que la page de saisie ne lit pas encore.
          plafondEnonce: !plafond
            ? null
            : [
                conditionFermee
                  ? `${plafond.enonce} · SANS EFFET ICI`
                  : partagee
                    ? `${plafond.enonce} · plafond commun à ${cumulNature!.toLocaleString('fr-FR')} de charges de cette nature, réparti au prorata`
                    : plafond.enonce,
                conditionFermee ? this.enonceConditionFermee(l.definition.code, brut, cumulNature ?? 0) : null,
                // C02 · le plafond est assis sur un chiffre d'affaires que le
                // module LIT · dit sur la ligne même où il sert.
                plafond.assiette === 'CHIFFRE_AFFAIRES' ? LECTURE_CHIFFRE_AFFAIRES : null,
              ]
                .filter(Boolean)
                .join(' · '),
          // Ce que la ligne conserve en déduction. Pour un plafond global
          // réparti, c'est sa quote-part du plafond, pas le plafond entier ·
          // afficher le plafond entier sur chaque ligne serait exactement
          // l'erreur que cette répartition corrige.
          montantAdmis: !plafond ? null : arrondir(l.mouvement - montant),
          /** Cumul de la nature, quand le plafond est global. Null sinon. */
          mouvementNature: plafond?.assiette === 'CHIFFRE_AFFAIRES' ? cumulNature : null,
          /** Plafond légal de la NATURE, avant répartition entre ses comptes. */
          montantAdmisNature:
            plafond?.assiette === 'CHIFFRE_AFFAIRES'
              ? conditionFermee
                ? 0
                : arrondir(plafond.part * brut.chiffreAffaires)
              : null,
          montant,
        },
      ];
    });

    return { propositions, avertissements, chiffreAffaires: brut.chiffreAffaires };
  }

  /**
   * CONDITION D'OUVERTURE DU DROIT À DÉDUCTION · art. 44, al. 2, 2° de la loi
   * n° 23/053 : « le résultat net imposable avant déduction de ces versements
   * soit positif ».
   *
   * L'article pose DEUX choses et le module n'en connaissait qu'une. Le
   * plafond de 0,5 % du chiffre d'affaires dit COMBIEN est admis ; cette
   * condition dit SI quelque chose l'est. Sur un dossier déficitaire, la loi
   * n'admet AUCUN versement en déduction : le module offrait 0,5 % du chiffre
   * d'affaires, et le contribuable déclarait un déficit reportable trop élevé
   * d'autant · un report fictif qui ne se découvre qu'à l'exercice où il
   * s'impute, deux ou trois ans plus tard.
   *
   * LE CALCUL, ET POURQUOI IL EST CE QU'IL EST. Les versements sont en charge
   * dans le résultat comptable, donc déjà déduits ; ce que la loi veut, c'est
   * le résultat AVANT cette déduction. On les rajoute donc · moins ce qui en
   * a déjà été réintégré par une ligne saisie sous le même code, faute de
   * quoi cette réintégration compterait deux fois.
   *
   * Le résultat pris est le résultat fiscal BRUT, réintégrations et
   * déductions saisies comprises, et non le résultat comptable : c'est le
   * « résultat net IMPOSABLE » que l'article nomme. Il est pris avant
   * imputation des déficits antérieurs, comme l'art. 52, 2° le commande pour
   * apprécier le caractère bénéficiaire d'un exercice.
   */
  private droitADeductionOuvert(
    brut: LectureFiscaleBrute,
    code: string,
    versements: number,
  ): { ouvert: boolean; resultatAvantVersements: number; dejaReintegre: number } {
    const dejaReintegre = arrondir(
      brut.retraitements
        .filter((r) => r.code === code && r.sens === SensRetraitementFiscal.REINTEGRATION)
        .reduce((somme, r) => somme + Number(r.montant), 0),
    );
    const resultatAvantVersements = arrondir(brut.resultatFiscalBrut + versements - dejaReintegre);
    return { ouvert: resultatAvantVersements > 0.005, resultatAvantVersements, dejaReintegre };
  }

  /**
   * LA CONDITION DE L'ART. 44 VUE DEPUIS L'ÉCRAN DE SAISIE, où le montant des
   * versements N'EST PAS ENCORE CONNU · le comptable est en train de le
   * taper. Le serveur ne peut donc pas trancher comme il le fait pour une
   * proposition, où le cumul des comptes qualifiés lui donne le montant.
   *
   * CE QU'IL PEUT DIRE, EN REVANCHE, EST EXACT. La condition s'écrit
   * `résultat fiscal brut + versements − déjà réintégré > 0`, soit
   * `versements > déjà réintégré − résultat fiscal brut`. Le membre de droite
   * ne dépend pas des versements : c'est un SEUIL, et il se calcule.
   *
   *  · seuil négatif ou nul · la condition est remplie quel que soit le
   *    montant saisi, le plafond joue normalement ;
   *  · seuil positif · elle ne l'est qu'au-dessus de ce seuil. Le plafond est
   *    alors servi à ZÉRO, et le seuil est dit. Ce sens-là est celui de la
   *    loi : la déduction est SUBORDONNÉE à la condition, elle n'est pas
   *    acquise tant que la condition n'est pas établie. L'écran affiche donc
   *    la réintégration totale, et la phrase dit exactement à partir de quel
   *    montant de versements il faut la corriger à la main.
   *
   * La première branche de la double condition · le relevé joint à la
   * déclaration · n'est jamais calculée : une pièce jointe à un imprimé ne se
   * lit dans aucune comptabilité. Elle est RAPPELÉE, ce qui est tout ce qu'un
   * logiciel peut honnêtement en faire.
   */
  private conditionPlafondPourEcran(
    definition: { code: string; conditionResultatNetPositif?: { enonce: string; source: string } },
    brut: LectureFiscaleBrute,
  ): { ouverte: boolean; enonce: string | null } {
    const condition = definition.conditionResultatNetPositif;
    if (!condition) return { ouverte: true, enonce: null };
    const { dejaReintegre } = this.droitADeductionOuvert(brut, definition.code, 0);
    const seuilVersements = arrondir(dejaReintegre - brut.resultatFiscalBrut);
    if (seuilVersements < 0.005) {
      return {
        ouverte: true,
        enonce: `${condition.source} : « ${condition.enonce} » La condition de résultat (2°) est remplie sur cet exercice. Celle du relevé (1°) ne se lit dans aucune comptabilité · OmegaX ne peut pas la vérifier, elle reste à joindre à la déclaration.`,
      };
    }
    return {
      ouverte: false,
      enonce: `${condition.source} : « ${condition.enonce} » Le résultat fiscal de cet exercice, retraitements saisis compris, est de ${brut.resultatFiscalBrut.toLocaleString('fr-FR')} : la déduction n'est ouverte que si ces versements dépassent ${seuilVersements.toLocaleString('fr-FR')}. Au-dessous, AUCUN n'est déductible et la totalité se réintègre · le plafond est servi à zéro pour cette raison.`,
    };
  }

  /** La phrase servie au comptable quand la condition de l'art. 44 est fermée. */
  private enonceConditionFermee(
    code: string,
    brut: LectureFiscaleBrute,
    versements: number,
  ): string {
    const definition = RETRAITEMENT_PAR_CODE.get(code);
    const condition = definition?.conditionResultatNetPositif;
    const { resultatAvantVersements } = this.droitADeductionOuvert(brut, code, versements);
    return `${condition?.source ?? 'Loi n° 23/053, art. 44, al. 2'} : « ${condition?.enonce ?? ''} » Le résultat net imposable avant déduction de ces versements est de ${resultatAvantVersements.toLocaleString('fr-FR')} : la condition n'est PAS remplie, aucun versement n'est déductible et la totalité se réintègre. Le plafond ne joue pas.`;
  }

  /**
   * RÉPARTITION DE L'EXCÉDENT D'UN PLAFOND GLOBAL entre les comptes qui
   * portent la même nature de charge.
   *
   * Les plafonds assis sur le chiffre d'affaires sont des plafonds de NATURE,
   * pas de compte · l'art. 44 admet les versements « dans la limite de 0,5 %
   * du chiffre d'affaires de l'exercice », l'art. 49, 1° les cadeaux « dans
   * les limites de deux pour mille (2 ‰) du chiffre d'affaires hors taxes »,
   * l'art. 43 les redevances à des entités liées « dans la limite de 3,5 % du
   * chiffre d'affaires hors taxes ». Aucun de ces textes ne parle de compte.
   *
   * CE QUE L'APPLICATION COMPTE PAR COMPTE FAISAIT · un cabinet qui tient
   * deux sous-comptes de dons obtenait deux fois 0,5 % du chiffre d'affaires,
   * trois sous-comptes trois fois, et ainsi de suite. La charge déduite
   * dépassait le plafond d'autant, sans qu'aucun total ne le montre : le
   * calcul avait l'air normal, seul l'impôt était faux.
   *
   * L'excédent est calculé UNE FOIS sur le cumul de la nature, puis réparti
   * entre les comptes au prorata de leur mouvement · le dernier compte de la
   * nature absorbe le centime d'arrondi, pour que la somme des lignes soit
   * exactement l'excédent dû.
   *
   * Les plafonds assis sur la CHARGE (frais de représentation, 60 % de leur
   * montant, art. 49, 2° ; frais de communication, 50 %, art. 49, 7°) ne
   * passent pas ici : une fraction est linéaire, la calculer compte par
   * compte donne le même total qu'en une fois.
   */
  private repartirExcedentPlafonne(
    lignes: { compte: { id: string }; definition: { code: string; plafond?: { part: number; assiette: string } }; mouvement: number }[],
    cumulParCode: Map<string, number>,
    chiffreAffaires: number,
    /**
     * Codes dont la CONDITION D'OUVERTURE n'est pas remplie · art. 44, al. 2,
     * 2°. Leur plafond en francs vaut zéro : la loi n'admet aucun versement
     * en déduction, l'excédent est donc le versement entier.
     */
    plafondsFermes: Set<string> = new Set(),
  ): Map<string, number> {
    const excedents = new Map<string, number>();
    for (const [code, cumul] of cumulParCode) {
      const definition = RETRAITEMENT_PAR_CODE.get(code);
      if (!definition?.plafond) continue;
      const admisNature = plafondsFermes.has(code) ? 0 : arrondir(definition.plafond.part * chiffreAffaires);
      const excedentNature = arrondir(Math.max(cumul - admisNature, 0));
      const comptes = lignes.filter((l) => l.definition.code === code);
      let reparti = 0;
      comptes.forEach((l, index) => {
        const dernier = index === comptes.length - 1;
        // Le dernier prend le reste · sans quoi la somme des quotes-parts
        // arrondies s'écarterait de l'excédent réellement dû.
        const part = dernier || cumul <= 0 ? arrondir(excedentNature - reparti) : arrondir((excedentNature * l.mouvement) / cumul);
        reparti = arrondir(reparti + part);
        excedents.set(l.compte.id, Math.max(part, 0));
      });
    }
    return excedents;
  }

  /**
   * DEUX BORNES QUE CE MODULE FRANCHIT SANS LES NOMMER · la date, et le
   * territoire.
   *
   * 1 · L'ENTRÉE EN VIGUEUR. La loi n° 23/053 du 30 novembre 2023 est « entrée
   * en vigueur le 1er janvier 2026 » (`code-general-2026/references/
   * 03-loi23-053-titre1-dispositions-generales.md`, bases juridiques du
   * Titre Ier). Tout ce que ce service applique en vient : l'assiette des
   * art. 14 à 19, le catalogue des retraitements, le taux, le minimum de
   * perception, le report déficitaire. Or `deficitsAnterieursCalcules` et
   * `chiffresAffairesAnterieurs` REMONTENT jusqu'à trois exercices et y
   * recalculent un résultat fiscal avec ces mêmes règles · un dossier ouvert
   * en 2026 se voit donc calculer un résultat 2024 et 2025 sous une loi qui ne
   * régissait pas ces exercices, et ce résultat sert ensuite d'assiette au
   * report imputé en 2026. C'est le deuxième piège du dépôt, dont la doctrine
   * est pourtant écrite au CLAUDE.md et appliquée ailleurs.
   *
   * ON AVERTIT, ON NE BLOQUE PAS, et c'est délibéré. Le texte antérieur n'est
   * pas dans le corpus lu : refuser le calcul priverait le cabinet d'un chiffre
   * qu'il peut vouloir, sans rien lui offrir en échange. Ce que le logiciel
   * doit, c'est cesser de présenter comme un résultat fiscal de 2024 ce qui est
   * une simulation de 2024 sous la loi de 2026.
   *
   * 2 · LA TERRITORIALITÉ, ET SON SENS DE CORRECTION · DEUX ARTICLES, DEUX
   * DIRECTIONS OPPOSÉES. La passe F4a n'avait lu que l'art. 7 et écrivait donc,
   * sans condition, « la base affichée est TROP LARGE · à retrancher par une
   * déduction ». C'est vrai d'une exploitation étrangère BÉNÉFICIAIRE et FAUX
   * d'une exploitation étrangère DÉFICITAIRE : l'art. 51, alinéa 3 dispose que
   * « les pertes subies dans les entreprises exploitées hors de la République
   * Démocratique du Congo ne sont pas déductibles du bénéfice imposable des
   * entreprises exploitées en République Démocratique du Congo ». La perte
   * étrangère est déjà entrée dans le résultat comptable de la balance : la
   * base est alors TROP ÉTROITE, et il faut la RÉINTÉGRER. Un comptable qui
   * suivait à la lettre le seul avertissement disponible CREUSAIT l'écart au
   * lieu de le combler · une correction de la veille avait donné une direction
   * unique à une règle qui en a deux.
   *
   * L'art. 7, alinéa 1er : les bénéfices passibles de
   * l'impôt « sont déterminés en tenant compte UNIQUEMENT des bénéfices
   * réalisés dans les entreprises exploitées ou sur les opérations réalisées en
   * République Démocratique du Congo, ainsi que ceux dont l'imposition est
   * attribuée à la République Démocratique du Congo par une convention
   * internationale relative aux doubles impositions ». Le résultat fiscal part
   * ici du résultat COMPTABLE entier, lu au compte 13 ou sur les classes 6, 7
   * et 8 : une succursale, un chantier ou un immeuble à l'étranger entrent dans
   * la même balance et ressortent dans la même base, sans découpage et sans un
   * mot. Aucune donnée du modèle ne porte la source d'un produit ni le lieu
   * d'une exploitation.
   */
  /**
   * C10 · LE PREMIER EXERCICE LONG À CHEVAL SUR LE 1er JANVIER 2026, tranché
   * par la loi (lue le 2026-10-04). Art. 12, al. 3 · la période de création
   * est imposée À PART, sur les comptes intermédiaires du 31 décembre de
   * l'année de création, et ses bénéfices « viennent ensuite en déduction des
   * résultats du premier exercice comptable clos ». L'impôt du premier
   * exercice clos porte donc sur ce qui suit le 31 décembre de l'année de
   * création · créée en 2025, la société est imposée pour 2026 sous la loi
   * n° 23/053, en vigueur depuis le 1er janvier 2026 (art. 153), et pour sa
   * période de 2025 sous le texte qui régissait 2025 (art. 152, 2° · titres
   * III et IV de l'O.-L. n° 69/009 abrogés, hors du corpus de calcul). Dire
   * de tout l'exercice que « la loi ne le régissait pas » était faux pour sa
   * part de 2026 · l'avertissement de SIMULATION ne vise plus que la période
   * de création, et l'impôt du premier exercice clos est un impôt réel.
   *
   * `debutPeriodeImposable` · l'ouverture de l'exercice, ou le lendemain de la
   * période de création quand l'art. 12, al. 3 la commande.
   */
  static debutPeriodeImposable(exercice: { dateDebut: Date }, periode: PeriodeCreation | null): Date {
    return periode ? new Date(Date.UTC(periode.annee + 1, 0, 1)) : exercice.dateDebut;
  }

  private avertissementsPerimetreLoi(dateDebutExercice: Date, periode: PeriodeCreation | null = null): string[] {
    const avertissements = [
      "PÉRIMÈTRE TERRITORIAL NON DÉCOUPÉ (art. 7 et art. 51, alinéa 3). Le résultat fiscal calculé ici part du résultat COMPTABLE de la balance, dans son entier. OmegaX ne porte ni la source d'un produit ni le lieu d'une exploitation, et LE SENS DE LA CORRECTION DÉPEND DU RÉSULTAT DE L'EXPLOITATION ÉTRANGÈRE · les deux articles jouent en sens inverse. Si elle est BÉNÉFICIAIRE, l'article 7 ne retient « uniquement » que les bénéfices réalisés dans les entreprises exploitées ou sur les opérations réalisées en République Démocratique du Congo, plus ceux qu'une convention de double imposition attribue à la RDC : la base affichée est TROP LARGE, à retrancher par une déduction. Si elle est DÉFICITAIRE, l'article 51, alinéa 3 dispose que « les pertes subies dans les entreprises exploitées hors de la République Démocratique du Congo ne sont pas déductibles du bénéfice imposable des entreprises exploitées en République Démocratique du Congo » : la perte étrangère est déjà entrée dans le résultat comptable, la base est alors TROP ÉTROITE, et il faut la RÉINTÉGRER. Dans les deux cas, pièce à l'appui.",
    ];
    if (periode && !periode.sousLaLoi) {
      avertissements.push(
        `PREMIER EXERCICE LONG OUVERT AVANT LA LOI (art. 12, al. 3 et art. 153). La période de création, du ${periode.dateDebut.toISOString().slice(0, 10)} au ${periode.dateFin.toISOString().slice(0, 10)}, est imposée à part et relève du texte qui régissait ${periode.annee}, que le dossier ne contient pas · son impôt n'est PAS calculé ici, et ses bénéfices, lus au livre-journal ou déclarés, viennent seulement en déduction du premier exercice clos. L'impôt affiché est celui du premier exercice clos, période imposable ${periode.annee + 1}, sous la loi n° 23/053 en vigueur depuis le 1er janvier 2026.`,
      );
    } else if (!periode && dateDebutExercice.getTime() < ENTREE_EN_VIGUEUR_LOI_23_053.getTime()) {
      avertissements.push(
        `EXERCICE ANTÉRIEUR À L'ENTRÉE EN VIGUEUR DE LA LOI. Cet exercice ouvre le ${dateDebutExercice.toISOString().slice(0, 10)}, avant le 1er janvier 2026, date à laquelle la loi n° 23/053 du 30 novembre 2023 est entrée en vigueur. Tout ce qui est calculé ci-dessous en vient : l'assiette, le catalogue des retraitements, le taux, le minimum de perception et le report déficitaire. Le texte applicable à cet exercice n'est PAS celui-ci et n'est pas dans OmegaX · ce chiffre est une SIMULATION sous la loi de 2026, pas le résultat fiscal de l'exercice. Il ne doit servir ni de déclaration, ni de base à un report déficitaire imputé sur un exercice postérieur, ni de BASE AUX ACOMPTES PROVISIONNELS de l'exercice suivant · l'art. 57 bis LPF les assied sur « l'impôt déclaré au titre de l'exercice précédent », c'est-à-dire sur l'impôt effectivement déclaré pour cet exercice-ci, sous le texte qui le régissait.`,
      );
    }
    return avertissements;
  }

  private async resultatFiscalBrut(tenantId: string, exerciceId: string) {
    const [lecture, retraitements] = await Promise.all([
      this.lireBalance(tenantId, exerciceId),
      this.prisma.retraitementFiscal.findMany({ where: { tenantId, exerciceId }, orderBy: { createdAt: 'asc' } }),
    ]);
    const somme = (sens: SensRetraitementFiscal) =>
      retraitements.filter((r) => r.sens === sens).reduce((s, r) => s + Number(r.montant), 0);
    const totalReintegrations = arrondir(somme(SensRetraitementFiscal.REINTEGRATION));
    const totalDeductions = arrondir(somme(SensRetraitementFiscal.DEDUCTION));
    return {
      ...lecture,
      retraitements,
      totalReintegrations,
      totalDeductions,
      resultatFiscalBrut: arrondir(lecture.resultatComptable + totalReintegrations - totalDeductions),
    };
  }

  /**
   * Déficits reportables des exercices précédents, art. 51 · rejoués du
   * PREMIER exercice du dossier à celui qui précède la cible, dans l'ordre,
   * chaque perte sur les premiers bénéfices qui la suivent et dans sa propre
   * fenêtre de trois exercices (`report-deficitaire.ts`, cas chiffré C05).
   *
   * POURQUOI TOUT L'HISTORIQUE ET NON PLUS TROIS EXERCICES. La fenêtre bornée
   * à l'exercice lu (`take: 3` et borne de date, passe F4b) rendait un report
   * qui dépendait de l'année d'où l'on regardait · ce qui reste d'un déficit
   * dépend des bénéfices qui l'ont suivi, que des déficits plus anciens, sortis
   * de la fenêtre, avaient pu consommer d'abord. Le rejeu part donc toujours du
   * même point, et la borne de DATE de la passe F4b vit désormais perte par
   * perte (`finDeFenetre`) · un dossier qui tient 2020, 2021 puis 2026 ne
   * réimpute toujours pas en 2026 la perte de 2020.
   *
   * Le coût est d'une balance par exercice antérieur · les exercices d'un
   * dossier se comptent par dizaines au plus (conservation de dix ans, AUDCIF
   * art. 24), et la lecture est bornée au dossier.
   */
  private async deficitsAnterieursCalcules(
    tenantId: string,
    exercice: { id: string; dateDebut: Date },
    physique: boolean,
  ) {
    const precedents = await this.prisma.exercice.findMany({
      where: { tenantId, dateFin: { lt: exercice.dateDebut } },
      orderBy: { dateDebut: 'desc' },
      select: { id: true, dateDebut: true, dateFin: true, statut: true },
    });
    const premierId = precedents.length
      ? [...precedents].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime())[0].id
      : null;
    // B2, P1 · LES REPORTS DÉCLARÉS À L'OUVERTURE DES EXERCICES ANTÉRIEURS.
    // Une saisie de `deficitAnterieurSaisi` dit le report disponible À
    // L'OUVERTURE de son exercice · elle FAIT FOI dans le rejeu des suivants.
    // Ignorée, une perte de 2025 recalculée à 1 000 000 et déclarée à 400 000
    // ressortait à 700 000 en 2027, et un report de 800 000 repris d'un
    // confrère disparaissait sans un mot l'année d'après.
    const dossiers = precedents.length
      ? await this.prisma.dossierFiscalExercice.findMany({
          where: { tenantId, exerciceId: { in: precedents.map((e) => e.id) } },
        })
      : [];
    const dossierDe = new Map(dossiers.map((d) => [d.exerciceId, d]));
    const rejoues: ExerciceRejoue[] = [];
    for (const ex of precedents) {
      const d = dossierDe.get(ex.id);
      const { base, debutImposable } = await this.baseAvantReport(tenantId, ex, ex.id === premierId && !physique, d ?? null);
      rejoues.push({
        exerciceId: ex.id,
        dateDebut: ex.dateDebut,
        dateFin: ex.dateFin,
        base,
        debutImposable,
        ouvertureDeclaree:
          d?.deficitAnterieurSaisi === null || d?.deficitAnterieurSaisi === undefined
            ? null
            : {
                montant: Number(d.deficitAnterieurSaisi),
                origines: FiscaliteService.originesDeclarees(d.deficitAnterieurOrigines, Number(d.deficitAnterieurSaisi)),
              },
      });
    }
    const { detail, perdusParPrudence } = rejouerReport(rejoues, exercice, IMPOT_SOCIETES.exercicesReportDeficit);
    return {
      total: arrondir(detail.reduce((s, d) => s + d.montant, 0)),
      detail,
      avertissements: [
        ...avertissementsReportDeclare(
          detail,
          perdusParPrudence,
          new Set(precedents.filter((e) => e.statut === StatutExercice.CLOTURE).map((e) => e.id)),
        ),
        ...[avertissementExercicesNonJointifs(precedents, exercice, IMPOT_SOCIETES.exercicesReportDeficit)].filter(
          (a): a is string => a !== null,
        ),
      ],
    };
  }

  /**
   * L'origine déclarée d'un report saisi, relue de sa colonne JSON · null si
   * absente, illisible, ou si elle ne ventile plus le montant saisi.
   *
   * UNE ORIGINE QUI NE TOTALISE PAS LA SAISIE NE FAIT PAS FOI (troisième tour,
   * relecture adverse). Le rejeu des exercices suivants prend les parts de
   * l'origine, pas le montant saisi · une saisie ramenée de 800 000 à
   * 600 000 sous une origine restée à 800 000 imputait 200 000 de trop en
   * N+1, sans un mot. Relue sans elle, la saisie retombe sur la borne
   * prudente, qui se dit.
   */
  static originesDeclarees(brut: unknown, montantSaisi: number): { dateFin: Date; montant: number }[] | null {
    if (!Array.isArray(brut) || brut.length === 0) return null;
    const lues = brut.map((o) => {
      const x = o as { dateFin?: unknown; montant?: unknown };
      const date = typeof x.dateFin === 'string' ? new Date(`${x.dateFin.slice(0, 10)}T00:00:00Z`) : null;
      return { dateFin: date, montant: Number(x.montant) };
    });
    // Une origine illisible ne s'invente pas · toute la déclaration retombe
    // alors sur la borne prudente, qui se dit.
    if (lues.some((o) => !o.dateFin || Number.isNaN(o.dateFin.getTime()) || !Number.isFinite(o.montant))) return null;
    if (Math.abs(arrondir(lues.reduce((t, o) => t + o.montant, 0)) - arrondir(montantSaisi)) >= 0.005) return null;
    return lues as { dateFin: Date; montant: number }[];
  }

  /**
   * La base d'un exercice au sens de l'art. 52, 2° · résultat fiscal brut,
   * moins, pour le premier exercice long de l'art. 12, al. 3, les bénéfices de
   * la période de création déjà imposés à part. Sans cette déduction, le
   * rejeu du report verrait un bénéfice qui a déjà payé son impôt.
   *
   * B1 · `appliquerArticle12` est FAUX pour une personne physique · l'art. 12,
   * al. 3 relève du Titre II (impôt sur les sociétés), et l'IRPP a son propre
   * report (art. 101). Sans ce filtre, que le calcul principal posait déjà,
   * le rejeu déduisait d'une entreprise individuelle un « bénéfice de période
   * de création » et inventait le déficit correspondant l'année suivante.
   */
  private async baseAvantReport(
    tenantId: string,
    exercice: { id: string; dateDebut: Date; dateFin: Date },
    appliquerArticle12: boolean,
    dossier: { resultatPeriodeCreationSaisi?: unknown; chiffreAffairesPeriodeCreationSaisi?: unknown } | null,
  ): Promise<{ base: number; debutImposable: Date }> {
    const brut = (await this.resultatFiscalBrut(tenantId, exercice.id)).resultatFiscalBrut;
    const periode = appliquerArticle12 ? periodeDeCreation(exercice, true) : null;
    // Le début de la période imposable suit la MÊME règle que l'impôt (fil
    // C10) · c'est sur lui, pas sur l'ouverture de l'exercice, que le rejeu
    // lit le drapeau `simulation` d'une perte.
    const debutImposable = FiscaliteService.debutPeriodeImposable(exercice, periode);
    if (!periode) return { base: brut, debutImposable };
    const lecture = await this.lirePeriodeCreation(tenantId, exercice.id, periode, dossier);
    return { base: arrondir(brut - deductionPeriodeCreation(lecture.resultatFiscal)), debutImposable };
  }

  /**
   * LES COMPTES INTERMÉDIAIRES DE LA PÉRIODE DE CRÉATION · art. 12, al. 3,
   * « ces bénéfices sont déterminés d'après les comptes intermédiaires arrêtés
   * à la date du 31 décembre de l'année de création ».
   *
   * LUS SUR LE LIVRE-JOURNAL À CETTE DATE, ou DÉCLARÉS. Le livre-journal dit
   * le résultat COMPTABLE de la période, régularisations datées au plus tard
   * du 31 décembre comprises ; il ne sait pas à quelle période rattacher un
   * retraitement fiscal, saisi pour l'exercice entier. Le cabinet qui a arrêté
   * ses comptes intermédiaires DÉCLARE donc le bénéfice fiscal de la période
   * (`resultatPeriodeCreationSaisi`), qui prime ; à défaut, le résultat
   * comptable lu fait foi, et l'observation dit que les retraitements sont
   * tous rattachés au premier exercice clos. Le chiffre d'affaires, lui, est
   * un fait comptable · il se lit toujours.
   *
   * L'IMPÔT NE MINORE JAMAIS SA PROPRE BASE (relevé 2) · loi n° 23/053,
   * art. 45, l'IS et le minimum ne sont pas déductibles. L'impôt de la période
   * passé au 891 ou au 895 à une date de la période (au 31 décembre, comme le
   * motif de l'A11 le propose) diminuerait le résultat lu, puis l'impôt
   * recalculé sur lui · les DÉBITS des 891, 892 et 895 de la période sont
   * rajoutés, comme la réintégration le fait pour l'exercice entier.
   *
   * LA DÉCLARATION SE CONFRONTE À LA LECTURE (relevé 1) · l'écart entre le
   * bénéfice déclaré et le résultat lu (impôt neutralisé) ne peut venir que
   * des retraitements fiscaux de la période ; il est servi, et dit.
   */
  private async lirePeriodeCreation(
    tenantId: string,
    exerciceId: string,
    periode: PeriodeCreation,
    dossier: { resultatPeriodeCreationSaisi?: unknown; chiffreAffairesPeriodeCreationSaisi?: unknown } | null,
  ) {
    const lecture = await this.lireBalance(tenantId, exerciceId, periode.dateFin);
    const resultatComptable = arrondir(lecture.resultatComptable + lecture.impotConstateAu89);
    const saisi = dossier?.resultatPeriodeCreationSaisi;
    const declare = saisi === null || saisi === undefined ? null : arrondir(Number(saisi));
    // Le chiffre d'affaires DÉCLARÉ avec le bénéfice (mineur C09) prime sur la
    // lecture ; seul, sans bénéfice déclaré, il ne compte pas (refusé à la porte).
    const caSaisi = dossier?.chiffreAffairesPeriodeCreationSaisi;
    const caDeclare = declare === null || caSaisi === null || caSaisi === undefined ? null : arrondir(Number(caSaisi));
    return {
      resultatComptable,
      impotNeutralise: lecture.impotConstateAu89,
      chiffreAffaires: caDeclare ?? lecture.chiffreAffaires,
      chiffreAffairesLu: lecture.chiffreAffaires,
      sourceChiffreAffaires: caDeclare === null ? ('LIVRE_JOURNAL' as const) : ('DECLARE' as const),
      resultatFiscal: declare ?? resultatComptable,
      source: declare === null ? ('LIVRE_JOURNAL' as const) : ('DECLARE' as const),
      ecartDeclaration: declare === null ? null : arrondir(declare - resultatComptable),
    };
  }

  /**
   * TRANCHE commandée par le seul chiffre d'affaires d'un exercice · art. 107
   * (micro-entreprise, au plus 25 000 000 FC), art. 109 (petite entreprise,
   * de 25 000 001 à 300 000 000 FC) et art. 112 (régime réel, au-delà).
   *
   * Ce n'est PAS le régime applicable · c'est seulement la tranche où tombe
   * l'exercice. Le régime, lui, se lit dans l'art. 113, qui regarde deux
   * exercices et non un seul.
   */
  private trancheSelonChiffreAffaires(chiffreAffaires: number): RegimePhysique {
    const p = IMPOT_REVENU_PERSONNES_PHYSIQUES;
    if (chiffreAffaires <= p.seuilMicroEntreprise) return 'IRPP_MICRO_ENTREPRISE';
    if (chiffreAffaires <= p.seuilPetiteEntreprise) return 'IRPP_PETITE_ENTREPRISE';
    return 'IRPP_REGIME_REEL';
  }

  /**
   * RÉGIME EFFECTIF D'UNE PERSONNE PHYSIQUE · art. 113 de la loi n° 23/053 :
   *
   *   « Les entreprises dont le chiffre d'affaires hors taxes devient
   *   inférieur à la limite de leur régime d'imposition ne sont soumises au
   *   régime d'imposition immédiatement inférieur que lorsque leur chiffre
   *   d'affaires est resté en dessous de cette limite pendant deux exercices
   *   consécutifs.
   *   Toutefois, les entreprises dont le chiffre d'affaires hors taxes devient
   *   supérieur à la limite de leur régime d'imposition sont soumises
   *   immédiatement au régime supérieur conformément aux articles 109 et 112
   *   ci-dessus. »
   *
   * L'ARTICLE N'EST PAS SYMÉTRIQUE, et c'est tout son intérêt · la montée est
   * immédiate, la descente attend DEUX exercices consécutifs sous le seuil,
   * et elle ne va que d'UN CRAN, vers le régime « immédiatement inférieur ».
   * Une entreprise au régime réel dont le chiffre d'affaires s'effondre à
   * 20 000 000 FC deux années de suite passe aux petites entreprises, pas aux
   * micro-entreprises : il lui faudra deux exercices de plus sous le seuil de
   * 25 000 000 FC pour descendre encore.
   *
   * Trancher sur le seul chiffre d'affaires de l'exercice en cours, comme le
   * faisait ce service, déclassait dès la première mauvaise année · avec, à
   * la clé, un impôt assis sur le chiffre d'affaires là où le régime réel
   * s'appliquait encore, et un calendrier de paiement qui n'était pas le bon.
   *
   * `chiffresAffaires` est chronologique, du plus ancien au plus récent, le
   * dernier étant l'exercice calculé. Le régime de départ est celui que
   * commande le chiffre d'affaires du plus ancien exercice connu · au-delà de
   * la fenêtre observée, le dépôt n'a pas d'historique, et l'observation le
   * dit plutôt que de le taire.
   */
  private regimePhysiqueSelonHistorique(chiffresAffaires: number[]): {
    regime: RegimePhysique;
    trancheExercice: RegimePhysique;
    maintenu: boolean;
    exercicesSousLeSeuil: number;
  } {
    const trancheExercice = this.trancheSelonChiffreAffaires(chiffresAffaires[chiffresAffaires.length - 1]);
    let regime = this.trancheSelonChiffreAffaires(chiffresAffaires[0]);
    let exercicesSousLeSeuil = 0;
    for (const ca of chiffresAffaires.slice(1)) {
      const tranche = this.trancheSelonChiffreAffaires(ca);
      const rang = ECHELLE_REGIMES_PHYSIQUES.indexOf(regime);
      const rangTranche = ECHELLE_REGIMES_PHYSIQUES.indexOf(tranche);
      if (rangTranche > rang) {
        // Art. 113, al. 2 · la montée est immédiate, sans condition de durée.
        regime = tranche;
        exercicesSousLeSeuil = 0;
      } else if (rangTranche < rang) {
        exercicesSousLeSeuil += 1;
        if (exercicesSousLeSeuil >= 2) {
          // Art. 113, al. 1 · deux exercices consécutifs sous la limite DU
          // RÉGIME EN COURS, et un seul cran de descente. Le compteur repart
          // à zéro : la limite à surveiller est désormais celle du nouveau
          // régime, et elle exige à son tour deux exercices.
          regime = ECHELLE_REGIMES_PHYSIQUES[rang - 1];
          exercicesSousLeSeuil = 0;
        }
      } else {
        exercicesSousLeSeuil = 0;
      }
    }
    return { regime, trancheExercice, maintenu: regime !== trancheExercice, exercicesSousLeSeuil };
  }

  /**
   * Ce que le logiciel doit DIRE au comptable sur le régime retenu, et qu'il
   * ne peut pas calculer.
   *
   * L'OPTION DE L'ART. 110 N'EST PAS OBSERVABLE. « Les Petites Entreprises
   * peuvent opter pour l'imposition selon le régime réel d'imposition […] à
   * condition d'informer par écrit le service gestionnaire compétent de
   * l'Administration des Impôts de cette option avant le 1er février de
   * l'année d'imposition. L'option est valable pour ladite année et pour les
   * deux années suivantes. Pendant cette période, elle demeure irrévocable. »
   * Cette lettre au service gestionnaire ne laisse aucune trace comptable :
   * aucun compte ne la porte, aucune écriture ne la révèle. Le logiciel ne
   * peut donc pas la deviner, et un régime deviné serait pire qu'un régime
   * signalé · d'où un AVERTISSEMENT, jamais un calcul.
   */
  private observationsRegimePhysique(
    regime: RegimePhysique,
    suivi: { trancheExercice: RegimePhysique; maintenu: boolean; exercicesSousLeSeuil: number },
    nombreExercicesAnterieurs: number,
  ): string[] {
    const observations: string[] = [];
    const nom: Record<RegimePhysique, string> = {
      IRPP_MICRO_ENTREPRISE: 'des micro-entreprises',
      IRPP_PETITE_ENTREPRISE: 'des petites entreprises',
      IRPP_REGIME_REEL: 'réel',
    };
    if (suivi.maintenu) {
      observations.push(
        `Art. 113 : le chiffre d'affaires de cet exercice relève de la tranche ${nom[suivi.trancheExercice]}, mais le régime ${nom[regime]} est MAINTENU. Le déclassement « n'intervient que lorsque leur chiffre d'affaires est resté en dessous de cette limite pendant deux exercices consécutifs », et d'un seul cran vers le régime immédiatement inférieur. ${suivi.exercicesSousLeSeuil === 1 ? "Premier exercice sous le seuil : un second, consécutif, ouvrira le déclassement." : ''}`.trim(),
      );
    }
    if (nombreExercicesAnterieurs >= EXERCICES_OBSERVES_REGIME) {
      observations.push(
        `Art. 113 : le régime est reconstitué sur les ${EXERCICES_OBSERVES_REGIME} exercices antérieurs tenus dans ce dossier, le plus ancien d'entre eux étant supposé relever de la tranche que commande son chiffre d'affaires. Si l'entreprise est plus ancienne que cette fenêtre, contrôler cette hypothèse de départ avant de conclure.`,
      );
    }
    if (nombreExercicesAnterieurs === 0) {
      observations.push(
        "Aucun exercice antérieur n'est tenu dans ce dossier : le régime est déterminé sur le seul chiffre d'affaires de l'exercice. Si l'entreprise était suivie ailleurs, vérifier l'art. 113 avant de conclure · un déclassement suppose deux exercices consécutifs sous le seuil, une montée de régime est en revanche immédiate.",
      );
    }
    if (regime === 'IRPP_MICRO_ENTREPRISE') {
      // ART. 64, 3° ET ART. 108 · ce n'est pas une nuance de régime, c'est une
      // EXEMPTION. Le module classait tout dossier de personne physique à
      // faible chiffre d'affaires en micro-entreprise et lui annonçait le
      // forfait de l'art. 128 ; pour les cinq figures que l'art. 108 énumère,
      // la loi ne pose aucun impôt du tout.
      //
      // La dispense de patente est un FAIT ADMINISTRATIF · elle se lit dans la
      // législation sur le petit commerce et dans la situation du redevable,
      // jamais dans une balance. Le logiciel ne la devine donc pas : il la
      // rappelle, avec la liste limitative du texte, qui est elle-même la
      // meilleure réponse (aucune de ces cinq figures ne tient une
      // comptabilité en partie double).
      observations.push(
        "Art. 64, 3° et art. 108 : sont EXEMPTÉS de l'Impôt sur le Revenu des Personnes Physiques, et exclus du régime des micro-entreprises, « les contribuables dispensés de l'obligation d'obtenir la patente conformément à la législation sur le petit commerce ». L'art. 108 les énumère : petits cultivateurs et petits éleveurs qui viennent occasionnellement vendre sur les marchés publics, petits marchands ambulants de produits de consommation courante, cireurs de chaussures, vendeurs de journaux à la criée, petits vendeurs à domicile. Cette dispense est un fait administratif qu'aucune écriture ne porte · OmegaX ne peut pas la connaître. Si le dossier relève de l'une de ces figures, il n'y a ni régime ni impôt, et le forfait annoncé ici ne lui est pas dû.",
      );
    }
    if (regime === 'IRPP_PETITE_ENTREPRISE') {
      observations.push(
        "Art. 110 et 111 : si l'entreprise a opté par écrit pour le régime réel auprès de son service gestionnaire avant le 1er février, cette option prime · elle vaut pour l'année et les deux suivantes et demeure irrévocable pendant cette période. OmegaX ne peut pas la connaître, aucune écriture ne la porte : dans ce cas, ni l'impôt ci-dessous ni le calendrier de paiement ne sont ceux du dossier. En cas de non-respect des obligations du régime réel, l'art. 111 ramène d'office au régime des petites entreprises.",
      );
    }
    return observations;
  }

  /**
   * Chiffres d'affaires des exercices précédents, du plus ancien au plus
   * récent · matière première de l'art. 113. Lecture bornée à
   * EXERCICES_OBSERVES_REGIME exercices : au-delà, le dossier n'a plus
   * d'historique en base, et l'observation servie au comptable le dit.
   */
  private async chiffresAffairesAnterieurs(tenantId: string, exercice: { dateDebut: Date }) {
    const precedents = await this.prisma.exercice.findMany({
      where: { tenantId, dateFin: { lt: exercice.dateDebut } },
      orderBy: { dateDebut: 'desc' },
      take: EXERCICES_OBSERVES_REGIME,
    });
    const chronologiques = [...precedents].reverse();
    const lectures = await Promise.all(chronologiques.map((e) => this.lireBalance(tenantId, e.id)));
    return lectures.map((l) => l.chiffreAffaires);
  }

  /**
   * Régime d'imposition commandé par la forme juridique OHADA du dossier ·
   * loi 23/053 art. 3 à 6 pour les personnes morales, art. 107 à 113 pour
   * les personnes physiques. La forme se lit dans les Paramètres du dossier.
   */
  private regimeSelonForme(
    forme: FormeJuridiqueSyscohada | null,
    chiffreAffaires: number,
    chiffresAffairesAnterieurs: number[],
    faits: { associeUniqueSas?: boolean | null; associeUniquePersonneMorale?: boolean | null } = {},
  ): { regime: RegimeImposition; observations: string[] } {
    const observations: string[] = [];
    const physique = forme !== null && FORMES_PERSONNES_PHYSIQUES.includes(forme);
    if (physique) {
      const p = IMPOT_REVENU_PERSONNES_PHYSIQUES;
      const suivi = this.regimePhysiqueSelonHistorique([...chiffresAffairesAnterieurs, chiffreAffaires]);
      const regime = suivi.regime;
      if (regime === 'IRPP_MICRO_ENTREPRISE') {
        observations.push(
          `Régime des micro-entreprises (art. 107) : chiffre d'affaires hors taxes au plus égal à ${p.seuilMicroEntreprise.toLocaleString('fr-FR')} FC. Impôt forfaitaire annuel fixé par arrêté (art. 128), non redevable du minimum de perception (art. 122).`,
        );
      } else if (regime === 'IRPP_PETITE_ENTREPRISE') {
        observations.push(
          `Régime des petites entreprises (art. 109) : chiffre d'affaires hors taxes de ${(p.seuilMicroEntreprise + 1).toLocaleString('fr-FR')} à ${p.seuilPetiteEntreprise.toLocaleString('fr-FR')} FC. Impôt assis sur le chiffre d'affaires, 1 % pour la vente et 2 % pour les prestations (art. 127).`,
        );
      } else {
        observations.push(
          `Régime réel (art. 112) : chiffre d'affaires hors taxes supérieur à ${p.seuilPetiteEntreprise.toLocaleString('fr-FR')} FC. Le résultat fiscal déterminé ici est le bénéfice professionnel catégoriel ; le barème progressif de l'art. 118 s'applique au REVENU NET GLOBAL du contribuable, que ce dossier ne détient pas. Le minimum de perception de 1 % du chiffre d'affaires reste dû (art. 122).`,
        );
      }
      observations.push(...this.observationsRegimePhysique(regime, suivi, chiffresAffairesAnterieurs.length));
      observations.push(...OBSERVATIONS_PHYSIQUE_PASSE_F5.commun);
      if (regime !== 'IRPP_MICRO_ENTREPRISE' && regime !== 'IRPP_PETITE_ENTREPRISE') {
        observations.push(...OBSERVATIONS_PHYSIQUE_PASSE_F5.regimeReel);
      }
      return { regime, observations };
    }

    switch (forme) {
      case FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF:
      case FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE:
        observations.push(
          "Société de personnes : l'impôt sur les sociétés ne s'applique que SUR OPTION, irrévocable, levée en assemblée générale et notifiée dans les trois mois du début de l'exercice (art. 4). Sans option, les bénéfices sont imposés dans le chef des associés. Le calcul ci-dessous suppose l'option levée.",
        );
        break;
      case FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE:
        observations.push(
          "Groupement d'intérêt économique : exonéré pour la quote-part de bénéfice distribuée à ses membres personnes physiques (art. 6). Le calcul ci-dessous porte sur la totalité du résultat · retrancher cette quote-part par une déduction, avec le relevé des membres en commentaire.",
        );
        break;
      case FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE:
        observations.push(
          "Société coopérative : soumise à l'impôt sur les sociétés à raison de son activité (art. 3), SAUF les coopératives de production, de transformation, de conservation et de vente de produits agricoles, de l'élevage et de la pêche et leurs unions « fonctionnant conformément aux dispositions légales qui les régissent, lorsqu'elles revêtent la FORME CIVILE » (art. 5, 2°) · deux conditions cumulatives qu'aucun champ du dossier ne porte, le champ « forme juridique » désignant la coopérative au sens de l'Acte uniforme et non la forme civile au sens fiscal. RISTOURNES : l'art. 11, 3° n'en réintègre que DEUX catégories, celles versées « aux associés, en tant que ristournes et avantages provenant d'achats ou de ventes effectués par les NON-ASSOCIÉS » et celles versées « aux non-associés ». La ristourne servie à un associé sur ses propres opérations avec la coopérative, qui est la ristourne ordinaire, n'y figure pas · ne pas réintégrer le compte en bloc.",
        );
        break;
      case FormeJuridiqueSyscohada.ENTITE_PUBLIQUE:
        observations.push(
          "Entité publique : imposable si elle se livre à une exploitation lucrative (art. 3) ; exemptés, l'État, les Provinces, les ETD, les établissements publics en vertu de leurs statuts et les organismes dont les ressources proviennent uniquement de subventions budgétaires (art. 5).",
        );
        break;
      case FormeJuridiqueSyscohada.SOCIETE_ANONYME:
      case FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
      case FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE: {
        // Servie sur les FAITS déclarés, jamais sur la seule forme (C4).
        const unipersonnalite = unipersonnaliteDeLArticle63({ formeJuridiqueSyscohada: forme, ...faits });
        if (unipersonnalite === 'ASSOCIE_PERSONNE_PHYSIQUE') observations.push(OBSERVATION_UNIPERSONNELLE_PASSE_F5);
        if (unipersonnalite === 'NATURE_NON_DECLAREE') {
          observations.push(`${OBSERVATION_UNIPERSONNELLE_PASSE_F5} ${COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE}`);
        }
        break;
      }
      // LA FORME NE DIT NI LA NATURE NI LA RÉSIDENCE DU PROPRIÉTAIRE (passe
      // O1a). L'AUSCGIE, art. 116, fait de la succursale l'établissement
      // « d'une société ou d'une personne physique », et l'art. 118 dit
      // seulement qu'elle « PEUT être l'établissement d'une société ou d'une
      // personne physique étrangère ». Le module groupe tient d'ailleurs le cas
      // domestique (une société et ses succursales, liées par les 184 à 187).
      // L'établissement stable (art. 7 et 8) et la non-déductibilité des
      // frais du siège (art. 50, 7°) ne valent que pour une SOCIÉTÉ
      // NON-RÉSIDENTE · la phrase est donc conditionnelle, et rien n'est
      // présumé du propriétaire.
      case FormeJuridiqueSyscohada.SUCCURSALE:
        observations.push(
          "Succursale : la forme ne dit ni si son propriétaire est une société ou une personne physique (AUSCGIE, art. 116), ni s'il est étranger (art. 118) · ses droits et obligations sont compris dans le patrimoine du propriétaire (art. 117). SI ce propriétaire est une société non-résidente, la succursale est un établissement stable imposable en RDC (loi n° 23/053, art. 7 et 8), et les frais généraux du siège se trouvant à l'étranger ne sont pas déductibles (art. 50, 7°) · voir la réintégration correspondante.",
        );
        break;
      case null:
        observations.push(
          "La forme juridique OHADA du dossier n'est pas renseignée (Structure > Paramètres du dossier > Forme juridique). Le calcul suppose une personne morale à l'impôt sur les sociétés · une entreprise individuelle ou un entreprenant relève d'un autre régime.",
        );
        break;
      default:
        break;
    }
    return { regime: 'IMPOT_SOCIETES', observations };
  }

  /**
   * DÉCHÉANCES DU REPORT DÉFICITAIRE · art. 51, al. 2 et art. 52, 1° de la
   * loi n° 23/053. CE SONT DES AVERTISSEMENTS, PAS UN CALCUL, et la raison
   * tient en une phrase : aucune des deux déchéances ne se lit dans une
   * comptabilité.
   *
   * Art. 51, al. 2 : « L'absence de déclaration après une mise en demeure de
   * déclarer pour un exercice fiscal déterminé exclut toute possibilité de
   * faire admettre postérieurement la déduction de la perte éprouvée pendant
   * l'année se rapportant à cet exercice fiscal. » La mise en demeure est un
   * acte de l'Administration des Impôts : elle arrive par courrier, elle
   * n'entre dans aucun journal, et OmegaX n'en saura jamais rien. Un logiciel
   * qui rayerait le déficit de lui-même se tromperait dans un sens (le
   * contribuable a déclaré, et perd un report auquel il a droit) ; un
   * logiciel qui se tait laisse imputer un déficit déjà déchu. La seule
   * réponse honnête est de poser la question au comptable.
   *
   * Art. 52, 1° : « l'exercice du report déficitaire n'est pas applicable par
   * le nouvel exploitant lors de l'achat d'une entreprise déficitaire. Il en
   * est de même lorsque l'entreprise change complètement d'activité ou
   * lorsqu'elle a subi des transformations telles, dans sa composition et son
   * activité, que tout en ayant conservé sa personnalité juridique, elle
   * n'est plus en réalité la même. » Un changement d'exploitant, un
   * changement complet d'activité, une transformation de fond : rien de tout
   * cela n'est un solde de compte. Même avertissement, même raison.
   *
   * L'art. 52, 2°, lui, est bien appliqué et non signalé · le caractère
   * bénéficiaire ou déficitaire d'un exercice s'apprécie sur le résultat
   * fiscal « abstraction faite des déficits reportables des exercices
   * antérieurs », ce que fait `resultatFiscalBrut`.
   */
  private avertissementsReportDeficitaire(deficitAnterieur: number): string[] {
    if (deficitAnterieur <= 0.005) return [];
    return [
      "Art. 51, al. 2 : le report est PERDU pour un exercice dont la déclaration n'a pas été souscrite après une mise en demeure de déclarer. Une mise en demeure est un acte de l'Administration, qu'aucune écriture ne porte · OmegaX ne peut pas la connaître. Vérifier, exercice par exercice, qu'aucun des déficits imputés ci-dessus ne tombe sous cette déchéance.",
      "Art. 52, 1° : le report déficitaire n'est pas applicable au nouvel exploitant qui a acheté une entreprise déficitaire, ni lorsque l'entreprise a changé complètement d'activité ou subi des transformations telles qu'elle n'est plus en réalité la même. Ces faits ne se lisent pas davantage dans la comptabilité : si l'un d'eux s'est produit, ramener le déficit antérieur à zéro par la saisie manuelle.",
    ];
  }

  /**
   * DEUX ARTICLES 57, ET ILS NE SONT PAS DE LA MÊME LOI · relevé par l'audit
   * des citations du 6 septembre 2026. L'art. 57 de la loi n° 23/053 pose
   * l'IMPÔT MINIMUM de 1 % du chiffre d'affaires ; l'art. 57 de la loi de
   * PROCÉDURES FISCALES pose les MODALITÉS DE PAIEMENT. Ce module manie les
   * deux, à quelques lignes l'un de l'autre, et un « art. 57 » nu y est
   * indécidable · chaque message servi à l'écran nomme donc sa loi. Sixième
   * fois que ce dépôt rencontre « un numéro, deux sens », après le 192, le
   * 4181, le 1061/1062, le 38/37 et le 397, et la deuxième sur un numéro
   * d'ARTICLE après les deux articles 11 de la retenue locative.
   *
   * LE CALENDRIER DE PAIEMENT, DIT AVEC SON ARTICLE · art. 57 de la loi de
   * procédures fiscales, dont les alinéas 2 et 3 ne visent pas les mêmes
   * contribuables.
   *
   * Servir les trois acomptes de l'art. 57 bis à une petite entreprise, comme
   * le faisait ce service, donnait un total juste et trois dates fausses :
   * l'impôt était annoncé aux 25 juillet, 25 septembre et 25 novembre alors
   * que la loi veut 60 % au plus tard le 31 janvier et 40 % ensuite. La
   * première échéance de l'année, la plus précoce de tout le calendrier de ce
   * contribuable, était donc la première à être manquée.
   */
  private observationsCalendrierPaiement(
    regime: RegimeImposition,
    impotDu: number | null,
    contexte: {
      acomptesDus: boolean;
      sansExerciceAnterieur: boolean;
      simulationAvantLaLoi: boolean;
      /** Art. 12, al. 3 · la période de création et son impôt, null s'il n'est pas calculé. */
      periodeCreation?: { periode: PeriodeCreation; impotDu: number | null } | null;
    },
  ): string[] {
    // LES DEUX BRANCHES D'ASSIETTE QUE LE MODULE NE SERT PAS · art. 57 bis,
    // al. 1er, dans sa rédaction issue de la L.F. n° 25/060 du 29 décembre
    // 2025. L'article en pose trois : l'impôt déclaré de l'exercice
    // précédent, ce même impôt augmenté des suppléments de l'Administration,
    // « ou, en cas d'absence de déclaration, [l']impôt reconstitué d'office ».
    // Le module sert les deux premières · la troisième REMPLACE l'impôt
    // déclaré au lieu de s'y ajouter, et rien dans une comptabilité ne dit
    // qu'un exercice n'a pas été déclaré. Elle est donc DITE, pas calculée :
    // inventer la base d'un acompte, c'est inventer un versement.
    const acomptes: string[] = [];
    if (contexte.acomptesDus && impotDu !== null) {
      if (contexte.periodeCreation) {
        // ART. 12, AL. 3 ET ART. 57 BIS LPF · la période de création EST
        // l'exercice précédent de l'année qui suit · l'impôt établi sur elle,
        // déclaré au plus tard le 30 avril (LPF art. 12), fonde les trois
        // acomptes de cette année-là, « de l'année de réalisation des revenus
        // imposables », qui s'imputent sur l'impôt du premier exercice clos
        // (art. 57 bis, al. 3). Dire « AUCUN acompte n'est dû » exposait à
        // l'amende de 50 % de l'art. 98 bis (cas chiffré C09).
        const { periode, impotDu: impotPeriode } = contexte.periodeCreation;
        acomptes.push(
          impotPeriode === null
            ? `Art. 12, al. 3 et art. 57 bis LPF : les acomptes des 25 juillet, 25 septembre et 25 novembre ${periode.annee + 1} sont assis sur l'impôt déclaré pour la période de création (${periode.annee}), établi sous le texte de l'époque · OmegaX ne le connaît pas et ne les chiffre pas. Ils restent dus · calculez-les sur l'impôt réellement déclaré, et imputez-les sur l'impôt ci-dessous.`
            : `Art. 12, al. 3 et art. 57 bis LPF : l'impôt de la période de création (${impotPeriode.toLocaleString('fr-FR')}) est l'impôt déclaré de l'exercice précédent · augmenté des suppléments établis sur lui, il fonde les acomptes des 25 juillet, 25 septembre et 25 novembre ${periode.annee + 1}, servis dans « Acomptes de l'exercice », imputés sur l'impôt du premier exercice clos (al. 3). Les trois montants « du prochain exercice » sont ceux de ${periode.annee + 2}.`,
        );
      } else if (contexte.sansExerciceAnterieur) {
        acomptes.push(
          "Art. 57 bis, al. 1er : les acomptes sont « calculés sur base de l'impôt déclaré au titre de l'exercice précédent ». Aucun exercice antérieur n'est tenu dans ce dossier · à défaut d'exercice précédent, cette base n'existe pas et AUCUN acompte n'est dû au titre de la présente année. Les trois montants ci-dessous sont ceux du PROCHAIN exercice. Si l'entreprise était suivie ailleurs, l'exercice précédent existe hors du dossier et ses acomptes restent dus : le vérifier avant de conclure. La fenêtre Retenues et déclarations présente pour sa part les trois échéances d'acompte à tout dossier SYSCOHADA, sans montant · ce sont des dates de calendrier, pas une somme à verser.",
        );
      }
      acomptes.push(
        "Art. 57 bis, al. 1er : la base des acomptes est l'impôt déclaré au titre de l'exercice précédent, augmenté des suppléments établis par l'Administration, « ou, en cas d'absence de déclaration, [de] l'impôt reconstitué d'office, que ces sommes fassent ou non l'objet de contestation ». " + (contexte.simulationAvantLaLoi ? "La base servie ci-dessous N'EST PAS la base légale : cet exercice est antérieur au 1er janvier 2026, l'impôt liquidé ici est une SIMULATION sous la loi n° 23/053, et l'impôt DÉCLARÉ pour cet exercice, qui seul fonde les acomptes, n'est pas dans OmegaX. Les trois montants ne valent qu'ordre de grandeur · calculer les acomptes sur l'impôt réellement déclaré." : "La base servie ci-dessous est la première branche · l'impôt liquidé ici, plus les suppléments saisis.") + " SI L'EXERCICE PRÉCÉDENT N'A PAS ÉTÉ DÉCLARÉ, la base légale est l'impôt reconstitué d'office par l'Administration, qui REMPLACE l'impôt déclaré au lieu de s'y ajouter : OmegaX ne peut pas le connaître, aucune écriture ne le porte, et le champ « suppléments » est additif. Dans ce cas, calculer les acomptes sur l'impôt reconstitué hors du logiciel · l'art. 98 bis punit « le défaut ou l'insuffisance de paiement de l'acompte provisionnel » d'une amende de 50 % de l'acompte non versé.",
      );
    }
    if (regime === 'IRPP_PETITE_ENTREPRISE') {
      const [premiere, seconde] = QUOTITES_PETITE_ENTREPRISE;
      return [
        `Loi de procédures fiscales, art. 57, al. 3 et 57 quater : l'impôt d'une petite entreprise est payé en DEUX QUOTITÉS, ${premiere.quotite * 100} % et ${seconde.quotite * 100} % de l'impôt dû, et non par acomptes provisionnels. La première est payée à la souscription de la déclaration auto liquidative, au plus tard le ${premiere.echeance} de l'année qui suit celle de la réalisation des revenus. Les acomptes des 25 juillet, 25 septembre et 25 novembre (art. 57 bis) ne visent que l'alinéa 2 de l'art. 57, c'est-à-dire l'impôt sur les sociétés et l'IRPP au régime réel : ils ne sont pas dus ici.`,
        ...(seconde.reserve ? [seconde.reserve] : []),
        ...acomptes,
      ];
    }
    if (regime === 'IRPP_MICRO_ENTREPRISE') {
      return [
        "Loi de procédures fiscales, art. 57 : une micro-entreprise acquitte le forfait annuel de l'art. 128 de la loi " +
          "n° 23/053 et ne verse ni acompte provisionnel (art. 57, al. 2) ni quotité (art. 57, al. 3), ces deux modes " +
          "visant d'autres régimes.",
        ...acomptes,
      ];
    }
    if (regime === 'IRPP_REGIME_REEL' && impotDu === null) {
      return [
        ...acomptes,
        "Loi de procédures fiscales, art. 57, al. 2 et 57 bis : l'IRPP au régime réel se paie bien par acomptes provisionnels, mais leur base est l'impôt DÉCLARÉ de l'exercice précédent, augmenté des suppléments établis par l'Administration. Cet impôt dépend du barème progressif appliqué au revenu net global du contribuable, que ce dossier ne détient pas · les trois montants ne sont donc pas calculés ici, seule leur date est certaine (25 juillet, 25 septembre, 25 novembre).",
      ];
    }
    return acomptes;
  }

  /** L'état complet · lecture, retraitements, report, impôt, solde. */
  async resultatFiscal(tenantId: string, exerciceId: string) {
    const tenant = await this.tenantSyscohada(tenantId);
    const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
    const [brut, dossier] = await Promise.all([
      this.resultatFiscalBrut(tenantId, exerciceId),
      this.prisma.dossierFiscalExercice.findUnique({ where: { exerciceId } }),
    ]);
    const acomptesVerses = Number(dossier?.acomptesVerses ?? 0);
    const supplementsAdministration = Number(dossier?.supplementsAdministration ?? 0);
    const supplementsPeriodeCreation = Number(dossier?.supplementsPeriodeCreation ?? 0);
    const deficitSaisi = dossier?.deficitAnterieurSaisi === null || dossier?.deficitAnterieurSaisi === undefined
      ? null
      : Number(dossier.deficitAnterieurSaisi);

    // UN SEUL EXERCICE ANTÉRIEUR SUFFIT À RÉPONDRE · art. 57 bis, al. 1er, dont
    // la base est « l'impôt déclaré au titre de l'exercice PRÉCÉDENT ». Sans
    // exercice précédent dans le dossier, il n'y a pas de base, et le dire
    // vaut mieux que laisser un échéancier annoncer des versements.
    const anterieurs = await this.prisma.exercice.findMany({
      where: { tenantId, dateFin: { lt: exercice.dateDebut } },
      orderBy: { dateDebut: 'desc' },
      take: 1,
    });

    // ART. 113 · le régime d'une personne physique ne se lit pas dans le seul
    // chiffre d'affaires de l'exercice. La lecture des exercices antérieurs
    // coûte une balance chacun : elle n'est faite que pour les formes qui en
    // relèvent, une personne morale étant à l'impôt sur les sociétés quel que
    // soit son chiffre d'affaires.
    const physique =
      tenant.formeJuridiqueSyscohada !== null && FORMES_PERSONNES_PHYSIQUES.includes(tenant.formeJuridiqueSyscohada);

    // ART. 12, AL. 3 · LE PREMIER EXERCICE LONG (cas chiffrés C09 et C10). La
    // période de création est imposée à part sur ses comptes intermédiaires,
    // et ses bénéfices viennent en déduction du premier exercice clos. Article
    // du Titre II (impôt sur les sociétés) · une personne physique n'est pas
    // concernée.
    const periode = physique ? null : periodeDeCreation(exercice, anterieurs.length === 0);
    const lecturePeriode = periode
      ? await this.lirePeriodeCreation(tenantId, exerciceId, periode, dossier)
      : null;
    const deductionCreation = lecturePeriode ? deductionPeriodeCreation(lecturePeriode.resultatFiscal) : 0;
    const baseAvantReport = arrondir(brut.resultatFiscalBrut - deductionCreation);
    const debutImposable = FiscaliteService.debutPeriodeImposable(exercice, periode);
    const simulationAvantLaLoi = debutImposable.getTime() < ENTREE_EN_VIGUEUR_LOI_23_053.getTime();

    const calcules = deficitSaisi === null ? await this.deficitsAnterieursCalcules(tenantId, exercice, physique) : null;
    // LA SAISIE N'IMPUTE QUE CE QUE SA FENÊTRE COUVRE · même `imputable` que
    // le rejeu des exercices suivants (une seule lecture de l'art. 51).
    const saisieLue =
      deficitSaisi === null
        ? null
        : partImputableDeLaSaisie(
            deficitSaisi,
            FiscaliteService.originesDeclarees(dossier?.deficitAnterieurOrigines, deficitSaisi),
            exercice,
            IMPOT_SOCIETES.exercicesReportDeficit,
          );
    const deficitAnterieur = saisieLue ? saisieLue.imputable : calcules!.total;
    // Un déficit ne s'impute que sur un bénéfice, et jamais au-delà.
    const deficitImpute = arrondir(Math.min(deficitAnterieur, Math.max(baseAvantReport, 0)));
    const resultatFiscal = arrondir(baseAvantReport - deficitImpute);
    const chiffresAffairesAnterieurs = physique ? await this.chiffresAffairesAnterieurs(tenantId, exercice) : [];
    const { regime, observations } = this.regimeSelonForme(
      tenant.formeJuridiqueSyscohada,
      brut.chiffreAffaires,
      chiffresAffairesAnterieurs,
      { associeUniqueSas: tenant.associeUniqueSas, associeUniquePersonneMorale: tenant.associeUniquePersonneMorale },
    );
    observations.push(...this.avertissementsReportDeficitaire(deficitAnterieur));
    // C15 · le déficit d'avant la loi se dit dans la vue qui l'IMPUTE, pas
    // seulement dans celle de l'exercice ancien.
    const deficitsSimules = avertissementDeficitsSimules(calcules?.detail ?? [], deficitSaisi !== null);
    if (deficitsSimules && deficitImpute > 0.005) observations.push(deficitsSimules);
    // B2, P1 et (8) · report déclaré sans origine, et exercices non jointifs.
    if (calcules) observations.push(...calcules.avertissements);
    if (saisieLue && saisieLue.horsFenetre.length) {
      observations.push(
        `PERTE DÉCLARÉE HORS FENÊTRE · ${saisieLue.horsFenetre
          .map((o) => `${montantFiscal(o.montant)} de l'exercice clos le ${o.dateFin.toISOString().slice(0, 10)}, report éteint le ${o.finDeFenetre.toISOString().slice(0, 10)}`)
          .join(', ')}. L'art. 51 ne reporte une perte que « jusqu'au troisième exercice qui suit l'exercice déficitaire » · cette part n'est pas imputée. Corrigez la saisie ou son origine.`,
      );
    }
    observations.push(...this.avertissementsPerimetreLoi(exercice.dateDebut, periode));
    // LOI N° 23/053, ART. 12 AL. 4, DITE ET NON CALCULÉE (décision par la loi
    // du 2026-10-07, point 2) · un exercice arrêté hors du 31 décembre
    // (dissolution, liquidation), ou qui suit un exercice clos la même année,
    // fait des « bilans successifs au cours d'une même année », dont les
    // résultats « sont totalisés pour l'assiette de l'impôt dû au titre de
    // ladite année ». Le calcul ci-dessous reste celui de l'exercice seul ·
    // aucun impôt nouveau n'est calculé, la totalisation est dite.
    const finHorsDecembre = !(exercice.dateFin.getUTCMonth() === 11 && exercice.dateFin.getUTCDate() === 31);
    const precedentMemeAnnee =
      anterieurs.length > 0 && anterieurs[0].dateFin.getUTCFullYear() === exercice.dateFin.getUTCFullYear();
    // UNE SOCIÉTÉ DISSOUTE · la totalisation est CALCULÉE (décision par la loi
    // du 2026-10-07, quatrième lot, point 2 ; constat 12), plus seulement dite.
    const dissoute =
      !!tenant.dateDissolution &&
      cotisationsDues({ forme: tenant.formeJuridiqueSyscohada, dateDissolution: tenant.dateDissolution }) &&
      exercice.dateFin.getTime() >= tenant.dateDissolution.getTime();
    if (!dissoute && (finHorsDecembre || precedentMemeAnnee)) observations.push(observationBilansSuccessifs(exercice.dateFin));
    // LES ACOMPTES DE L'ANNÉE DE LA DISSOLUTION SONT BORNÉS COMME L'ÉCHÉANCIER
    // (relecture du 2026-10-07, mineur 7 · `echeancierDissolution().retenir`,
    // une seule règle) · l'exercice clos avant la dissolution sert ses
    // acomptes l'année qui suit (art. 57 bis LPF), et ceux qui échoient après
    // la dernière cotisation spéciale ne sont plus dus (loi n° 23/053, art. 13
    // al. 3) · servis ici, le dossier les aurait versés en trop.
    const bornage = echeancierDissolution(
      {
        forme: tenant.formeJuridiqueSyscohada,
        dateDissolution: tenant.dateDissolution,
        dateNominationLiquidateur: null,
        regimeLiquidation: tenant.regimeLiquidation,
        associeUniquePersonneMorale: tenant.associeUniquePersonneMorale,
        dateClotureLiquidation: tenant.dateClotureLiquidation,
      },
      new Date(),
    );
    const anneeDesAcomptes = exercice.dateFin.getUTCFullYear() + 1;
    const CLES_ACOMPTES = ['premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs'];
    const MOIS_ACOMPTES: Record<string, number> = { juillet: 6, septembre: 8, novembre: 10 };
    const acomptesRetenus = IMPOT_SOCIETES.acomptes.filter((a, i) => {
      const [jourDuMois, mois] = a.echeance.split(' ');
      // Une échéance illisible est un défaut du paramètre, jamais un acompte retenu ou écarté en silence.
      if (!(mois in MOIS_ACOMPTES)) throw new Error(`Échéance d'acompte illisible · ${a.echeance}`);
      return bornage.retenir(CLES_ACOMPTES[i], new Date(Date.UTC(anneeDesAcomptes, MOIS_ACOMPTES[mois], Number(jourDuMois))));
    });
    if (!dissoute && acomptesRetenus.length < IMPOT_SOCIETES.acomptes.length) {
      observations.push(
        `ACOMPTES APRÈS LA DISSOLUTION · ${IMPOT_SOCIETES.acomptes.length - acomptesRetenus.length} acompte(s) de ${anneeDesAcomptes} ` +
          'échoient après la dernière cotisation spéciale, ou après l’année de la dissolution · ils ne sont plus dus ' +
          '(LPF art. 57 bis ; loi n° 23/053, art. 13 al. 3) et ne sont pas servis.',
      );
    }
    // V3 · le 13 lu porte aussi l'à-nouveau d'un résultat antérieur · dit, la
    // balance ne disant pas si son affectation est passée.
    if (Math.abs(brut.reportAuCompte13) > 0.005) {
      observations.push(
        `RÉSULTAT LU SUR LE COMPTE 13 · aucun compte de gestion ne porte de solde dans l'exercice, et le 13 porte aussi ${montantFiscal(brut.reportAuCompte13)} reportés à l'ouverture, résultat d'un exercice antérieur. ` +
          "Si son affectation n'est pas passée dans cet exercice, le résultat lu ici le contient et l'impôt est faux d'autant · passez l'affectation, ou corrigez le résultat par un retraitement motivé.",
      );
    }
    const reintegrationsImpot = FiscaliteService.reintegrationsImpot(brut.retraitements);
    const ecartImpotNonReintegre = FiscaliteService.observationImpotNonReintegre(brut.impotConstateAu89, reintegrationsImpot);
    if (ecartImpotNonReintegre) observations.push(ecartImpotNonReintegre);
    const degrevement = FiscaliteService.observationDegrevement(brut.degrevementsAu899);
    if (degrevement) observations.push(degrevement);

    // Plafonds exprimés en francs pour cet exercice · l'écran s'en sert pour
    // calculer l'excédent à réintégrer à partir de la charge engagée.
    // LES PLAFONDS SERVIS À L'ÉCRAN DE SAISIE · c'est à partir d'eux que la
    // page calcule l'excédent à réintégrer depuis la charge que le comptable
    // vient de taper. Un plafond dont la CONDITION D'OUVERTURE n'est pas
    // remplie doit donc valoir zéro ici, sans quoi l'écran continuerait
    // d'offrir 0,5 % du chiffre d'affaires à un dossier déficitaire.
    const plafonds = CATALOGUE_RETRAITEMENTS.filter((r) => r.plafond).map((r) => {
      const condition = this.conditionPlafondPourEcran(r, brut);
      return {
        code: r.code,
        // La condition est jointe à l'énoncé · c'est le seul champ que la
        // page de saisie affiche aujourd'hui (« Plafond : … »).
        // C02 · un plafond assis sur le chiffre d'affaires dit lequel il lit.
        enonce: [
          r.plafond!.enonce,
          condition.enonce,
          r.plafond!.assiette === 'CHIFFRE_AFFAIRES' ? LECTURE_CHIFFRE_AFFAIRES : null,
        ]
          .filter(Boolean)
          .join(' · '),
        assiette: r.plafond!.assiette,
        part: r.plafond!.part,
        montantAdmis:
          r.plafond!.assiette !== 'CHIFFRE_AFFAIRES'
            ? null
            : condition.ouverte
              ? arrondir(r.plafond!.part * brut.chiffreAffaires)
              : 0,
        /** Null quand le code ne porte aucune condition d'ouverture. */
        conditionOuverte: r.conditionResultatNetPositif ? condition.ouverte : null,
      };
    });

    // C09 · LE MINIMUM DU PREMIER EXERCICE CLOS NE COMPTE PAS LE CHIFFRE
    // D'AFFAIRES DE LA PÉRIODE DE CRÉATION (décision par la loi du
    // 2026-10-07, point 2 · art. 12, al. 1, 3 et 4 ; art. 57 ; LPF, art. 12
    // et 13 ; art. 153) · il a porté son propre minimum dans la déclaration de
    // l'année de création. Même source que la période (`lirePeriodeCreation`),
    // si bien que chaque vente compte une fois. Les plafonds assis sur le
    // chiffre d'affaires gardent celui de l'exercice · la décision ne vise que
    // le minimum.
    const chiffreAffairesMinimum = lecturePeriode
      ? chiffreAffairesMinimumPremierExercice(brut.chiffreAffaires, lecturePeriode.chiffreAffaires)
      : brut.chiffreAffaires;
    const impot = this.calculerImpot(regime, resultatFiscal, chiffreAffairesMinimum, dossier?.natureActivite ?? null);
    // L'IMPÔT DE LA PÉRIODE DE CRÉATION · même liquidation (art. 56 et 57,
    // minimum compris, voir `periode-creation.ts`), sur le résultat et le
    // chiffre d'affaires de la période. Avant 2026, le texte de l'époque ·
    // non calculé, `null`, jamais zéro.
    const impotPeriode =
      periode && lecturePeriode && periode.sousLaLoi
        ? this.calculerImpot('IMPOT_SOCIETES', lecturePeriode.resultatFiscal, lecturePeriode.chiffreAffaires, null)
        : null;
    if (periode && lecturePeriode) {
      observations.push(
        `PREMIER EXERCICE LONG · art. 12, al. 3. Entreprise tenue pour créée le ${periode.dateDebut.toISOString().slice(0, 10)} (ouverture du premier exercice du dossier) · la période de création, jusqu'au ${periode.dateFin.toISOString().slice(0, 10)}, est imposée À PART sur ses comptes intermédiaires ` +
          `(${lecturePeriode.source === 'DECLARE' ? 'bénéfice fiscal DÉCLARÉ par le cabinet' : 'résultat COMPTABLE lu au livre-journal à cette date'} : ${lecturePeriode.resultatFiscal.toLocaleString('fr-FR')}), ` +
          `et ses bénéfices (${deductionCreation.toLocaleString('fr-FR')}) viennent en déduction du premier exercice clos. L'impôt dû ci-dessous est celui du premier exercice clos ; celui de la période de création est servi à part.` +
          (lecturePeriode.source === 'LIVRE_JOURNAL'
            ? " Les retraitements saisis valent pour l'exercice ENTIER et sont donc tous rattachés au premier exercice clos · si l'un d'eux concerne la période de création, déclarez le bénéfice fiscal de la période arrêté au 31 décembre, il prime sur la lecture."
            : '') +
          " Si l'entreprise a été créée avant l'ouverture de ce premier exercice (dossier repris), ce cas ne s'applique pas.",
      );
      observations.push(
        `${OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE} ${sourceChiffreAffairesPeriode({
          chiffreAffairesDeclare: lecturePeriode.sourceChiffreAffaires === 'DECLARE',
          beneficeDeclare: lecturePeriode.source === 'DECLARE',
        })} Ici · ${montantFiscal(brut.chiffreAffaires)} pour l'exercice, ` +
          `${montantFiscal(lecturePeriode.chiffreAffaires)} pour la période, ${montantFiscal(chiffreAffairesMinimum)} retenus pour le minimum du premier exercice clos.`,
      );
      // LA PERTE DE LA PÉRIODE · la règle citée (art. 12, al. 3 ; art. 51 ;
      // art. 52, 2°), dite seulement quand la période est déficitaire.
      if (lecturePeriode.resultatFiscal < 0) observations.push(OBSERVATION_PERTE_PERIODE_CREATION);
      if (lecturePeriode.ecartDeclaration !== null && Math.abs(lecturePeriode.ecartDeclaration) >= 0.005) {
        // RELEVÉ 1 · une déclaration se confronte à ce que le livre dit.
        observations.push(
          `BÉNÉFICE DÉCLARÉ DE LA PÉRIODE DE CRÉATION · ${montantFiscal(lecturePeriode.resultatFiscal)} déclarés contre ${montantFiscal(lecturePeriode.resultatComptable)} lus au livre-journal au ${periode.dateFin.toISOString().slice(0, 10)} (impôt sur le résultat neutralisé, art. 45), soit un écart de ${montantFiscal(lecturePeriode.ecartDeclaration)}. ` +
            `Il ne peut venir que des retraitements fiscaux de la période (réintégrations moins déductions) · ceux saisis sur l'exercice entier valent ${montantFiscal(arrondir(brut.totalReintegrations - brut.totalDeductions))}. ` +
            "Si l'écart ne s'explique pas par eux, une écriture de la période manque au livre-journal ou la déclaration est à revoir ; la déclaration prime, le calcul ci-dessus la retient.",
        );
      }
      if (lecturePeriode.impotNeutralise > 0.005) {
        observations.push(
          `Impôt sur le résultat passé dans la période de création (${montantFiscal(lecturePeriode.impotNeutralise)} au débit des 891, 892 ou 895) · rajouté au résultat lu de la période, l'impôt n'étant pas déductible de sa propre base (loi n° 23/053, art. 45).`,
        );
      }
    }

    // ALINÉA 2 CONTRE ALINÉA 3 DE L'ART. 57 LPF · l'alinéa 2 range dans les
    // acomptes provisionnels « l'Impôt sur les Sociétés et l'Impôt sur le
    // Revenu des Personnes Physiques […] suivant le régime réel d'imposition ».
    // L'alinéa 3 donne aux petites entreprises un mode de paiement à part, en
    // deux quotités, et les micro-entreprises acquittent un forfait annuel
    // (art. 128) : ni les unes ni les autres ne versent d'acompte.
    const acomptesDus = regime === 'IMPOT_SOCIETES' || regime === 'IRPP_REGIME_REEL';
    observations.push(
      ...this.observationsCalendrierPaiement(regime, impot.impotDu, {
        acomptesDus,
        sansExerciceAnterieur: anterieurs.length === 0,
        simulationAvantLaLoi,
        periodeCreation: periode ? { periode, impotDu: impotPeriode?.impotDu ?? null } : null,
      }),
    );

    // LES BILANS SUCCESSIFS DE L'ANNÉE DE LA DISSOLUTION (point 2) · une
    // assiette, deux cotisations. Aucun acompte pour les années qui suivent
    // (point 3) · la base des acomptes du « prochain exercice » n'est pas servie.
    const bilansSuccessifs: BilansSuccessifs | null = dissoute
      ? await this.bilansSuccessifsDe(tenantId, tenant, exercice, {
          base: baseAvantReport,
          chiffreAffaires: chiffreAffairesMinimum,
          impotDu: impot.impotDu,
          acomptesVerses,
          regime,
          natureActivite: dossier?.natureActivite ?? null,
        })
      : null;
    if (bilansSuccessifs) observations.push(bilansSuccessifs.observation);

    // C01-bis · LE BROUILLARD SE DIT SUR L'ÉCRAN DU CALCUL, et le chiffre ne se
    // présente jamais comme définitif tant qu'il en reste. Le calcul ne lit que
    // le livre-journal (AUDCIF art. 22, 2°) · c'est juste, mais une charge
    // saisie et non validée disparaissait de l'impôt sans un mot (seule
    // l'écriture A11 le disait, en refusant). Même compte que le refus de
    // l'A11 (`constat-impot.service.ts`) · écritures au brouillard dont une
    // ligne touche les classes 6 à 8.
    const ecrituresAuBrouillard = await this.prisma.ecriture.count({
      where: {
        tenantId,
        exerciceId,
        statut: StatutEcriture.BROUILLARD,
        lignes: {
          some: {
            OR: [
              { compte: { numero: { startsWith: '6' } } },
              { compte: { numero: { startsWith: '7' } } },
              { compte: { numero: { startsWith: '8' } } },
            ],
          },
        },
      },
    });
    let brouillard = { ecritures: ecrituresAuBrouillard, effetSurResultat: 0, effetSurChiffreAffaires: 0 };
    if (ecrituresAuBrouillard > 0) {
      // Ce que le brouillard CHANGERAIT, validé tel quel · une seconde lecture,
      // brouillard compris, qui ne sert qu'à le chiffrer.
      const avec = await this.lireBalance(tenantId, exerciceId, undefined, true);
      brouillard = {
        ecritures: ecrituresAuBrouillard,
        effetSurResultat: arrondir(avec.resultatComptable - brut.resultatComptable),
        effetSurChiffreAffaires: arrondir(avec.chiffreAffaires - brut.chiffreAffaires),
      };
      observations.unshift(
        `CHIFFRE PROVISOIRE · ${ecrituresAuBrouillard} écriture(s) au brouillard touchent les classes 6 à 8 de l'exercice. ` +
          "Le résultat fiscal et l'impôt ne lisent que le livre-journal (AUDCIF art. 22, 2°) · validées telles quelles, " +
          `elles changeraient le résultat comptable de ${montantFiscal(brouillard.effetSurResultat)}` +
          (Math.abs(brouillard.effetSurChiffreAffaires) >= 0.005
            ? ` et le chiffre d'affaires de ${montantFiscal(brouillard.effetSurChiffreAffaires)}`
            : '') +
          ". L'impôt affiché n'est pas définitif tant qu'elles ne sont ni validées ni retirées.",
      );
    }

    return {
      exerciceId,
      dateDebut: exercice.dateDebut,
      dateFin: exercice.dateFin,
      derniereVerification: DERNIERE_VERIFICATION_FISCALE,
      formeJuridiqueSyscohada: tenant.formeJuridiqueSyscohada,
      devise: tenant.devise ?? 'CDF',
      regime,
      observations,
      // C01-bis · faux tant qu'une écriture au brouillard touche la gestion.
      definitif: ecrituresAuBrouillard === 0,
      brouillard,
      simulationAvantLaLoi,
      natureActivite: dossier?.natureActivite ?? null,
      resultatComptable: brut.resultatComptable,
      sourceResultat: brut.sourceResultat,
      chiffreAffaires: brut.chiffreAffaires,
      // C09 · le chiffre d'affaires qui assied le minimum (art. 57) · celui de
      // l'exercice, sauf au premier exercice long, période de création retranchée.
      chiffreAffairesMinimum,
      retraitements: brut.retraitements.map((r) => ({
        id: r.id,
        code: r.code,
        sens: r.sens,
        libelle: r.libelle,
        montant: Number(r.montant),
        commentaire: r.commentaire,
        source: RETRAITEMENT_PAR_CODE.get(r.code)?.source ?? null,
      })),
      totalReintegrations: brut.totalReintegrations,
      totalDeductions: brut.totalDeductions,
      // Le 89 au livre-journal et sa réintégration · servis pour l'écriture
      // de l'impôt (ligne A11), jamais recalculés à l'écran.
      impotConstateAu89: brut.impotConstateAu89,
      degrevementsAu899: brut.degrevementsAu899,
      impotExerciceAu89: brut.impotExerciceAu89,
      reintegrationsImpot,
      acomptesAu4492: brut.acomptesAu4492,
      resultatFiscalBrut: brut.resultatFiscalBrut,
      deficitAnterieur: {
        montant: deficitAnterieur,
        saisi: deficitSaisi !== null,
        // Le montant SAISI, tel que le cabinet l'a tapé · `montant` n'en garde
        // que la part que la fenêtre de l'art. 51 couvre.
        montantSaisi: deficitSaisi,
        detail: calcules?.detail ?? [],
        // L'origine déclarée du report saisi · null tant qu'elle n'est pas
        // dite (le rejeu des exercices suivants la borne alors par prudence).
        origines:
          deficitSaisi === null
            ? null
            : (FiscaliteService.originesDeclarees(dossier?.deficitAnterieurOrigines, deficitSaisi)?.map((o) => ({
                dateFin: o.dateFin.toISOString().slice(0, 10),
                montant: o.montant,
              })) ?? null),
      },
      // ART. 12, AL. 3 · la période de création, son impôt et les acomptes
      // qu'il fonde pour l'année qui suit (art. 57 bis LPF). Null hors de ce cas.
      periodeCreation:
        periode && lecturePeriode
          ? {
              dateDebut: periode.dateDebut,
              dateFin: periode.dateFin,
              sousLaLoi: periode.sousLaLoi,
              source: lecturePeriode.source,
              resultatComptable: lecturePeriode.resultatComptable,
              chiffreAffaires: lecturePeriode.chiffreAffaires,
              chiffreAffairesLu: lecturePeriode.chiffreAffairesLu,
              sourceChiffreAffaires: lecturePeriode.sourceChiffreAffaires,
              resultatFiscal: lecturePeriode.resultatFiscal,
              deduction: deductionCreation,
              impotTheorique: impotPeriode?.impotTheorique ?? null,
              impotMinimum: impotPeriode?.impotMinimum ?? null,
              impotDu: impotPeriode?.impotDu ?? null,
              minimumApplique: impotPeriode?.minimumApplique ?? false,
              explication: impotPeriode
                ? impotPeriode.explication
                : `Période de création antérieure au 1er janvier 2026 · son impôt relève du texte qui régissait ${periode.annee} (loi n° 23/053, art. 153), que le dossier ne contient pas.`,
              ecartDeclaration: lecturePeriode.ecartDeclaration,
              impotNeutralise: lecturePeriode.impotNeutralise,
              // RELEVÉ 5 · LPF art. 57 bis, al. 1er · la base est l'impôt
              // déclaré « augmenté des suppléments éventuels établis par
              // l'Administration », contestés ou non · ceux de l'impôt de la
              // PÉRIODE DE CRÉATION, saisis à part des suppléments qui fondent
              // les acomptes du prochain exercice.
              supplements: supplementsPeriodeCreation,
              baseAcomptesExercice:
                impotPeriode?.impotDu === null || impotPeriode?.impotDu === undefined
                  ? null
                  : arrondir(impotPeriode.impotDu + supplementsPeriodeCreation),
              acomptesExercice:
                impotPeriode?.impotDu === null || impotPeriode?.impotDu === undefined
                  ? []
                  : IMPOT_SOCIETES.acomptes.map((a) => ({
                      ...a,
                      annee: periode.annee + 1,
                      montant: arrondir(a.quotite * (impotPeriode.impotDu! + supplementsPeriodeCreation)),
                    })),
            }
          : null,
      deductionPeriodeCreation: deductionCreation,
      deficitImpute,
      resultatFiscal,
      plafonds,
      ...impot,
      acomptesVerses,
      soldeAPayer: impot.impotDu === null ? null : arrondir(impot.impotDu - acomptesVerses),
      // Les deux impositions de l'exercice comptable, période de création
      // comprise · null si l'une n'est pas chiffrée (jamais un zéro).
      impotTotalExercice:
        impot.impotDu === null
          ? null
          : !periode
            ? impot.impotDu
            : impotPeriode?.impotDu === null || impotPeriode?.impotDu === undefined
              ? null
              : arrondir(impot.impotDu + impotPeriode.impotDu),
      // SUIVI DES ACOMPTES · le rapprochement que rien ne faisait.
      suiviAcomptes: FiscaliteService.suiviAcomptes({
        acomptesDus,
        declares: acomptesVerses,
        comptabilises: brut.acomptesAu4492,
        impotDu: impot.impotDu,
      }),
      // BASE DES ACOMPTES · art. 57 bis LPF, tel que modifié par la loi de
      // finances n° 25/060 : « l'impôt déclaré au titre de l'exercice
      // précédent, AUGMENTÉ des suppléments éventuels établis par
      // l'Administration des Impôts […] que ces sommes fassent ou non l'objet
      // de contestation ». L'impôt calculé ici est le premier terme ; le
      // second ne se lit dans aucun compte, il naît d'un avis de
      // redressement, d'où sa saisie. L'assoir sur le seul impôt déclaré
      // proposerait trois acomptes insuffisants à tout dossier redressé, et
      // l'insuffisance de versement se paie même quand le redressement est
      // contesté.
      supplementsAdministration,
      baseAcomptes:
        !dissoute && acomptesDus && impot.impotDu !== null && acomptesRetenus.length > 0
          ? arrondir(impot.impotDu + supplementsAdministration)
          : null,
      bilansSuccessifs,
      // LES ACOMPTES NE SONT PAS SERVIS À TOUT LE MONDE · art. 57 bis LPF,
      // « les acomptes provisionnels visés à l'article 57, ALINÉA 2 ». Cet
      // alinéa 2 vise l'impôt sur les sociétés et l'IRPP au RÉGIME RÉEL, et
      // eux seuls. Une petite entreprise relève de l'alinéa 3 : elle paie en
      // deux quotités, ci-dessous, et le tableau des acomptes reste vide.
      acomptesProchainExercice:
        dissoute || !acomptesDus || impot.impotDu === null
          ? []
          : acomptesRetenus.map((a) => ({
              ...a,
              montant: arrondir(a.quotite * (impot.impotDu! + supplementsAdministration)),
            })),
      // ART. 57, AL. 3 ET 57 QUATER · les deux quotités de 60 % et 40 % de
      // l'impôt DE CET EXERCICE, la première au plus tard le 31 janvier de
      // l'année qui suit celle de la réalisation des revenus. Ce n'est pas un
      // acompte sur l'exercice suivant : c'est le paiement de cet impôt-ci.
      quotitesPetiteEntreprise:
        regime !== 'IRPP_PETITE_ENTREPRISE' || impot.impotDu === null
          ? []
          : QUOTITES_PETITE_ENTREPRISE.map((q) => ({
              rang: q.rang,
              quotite: q.quotite,
              echeance: q.echeance,
              source: q.source,
              reserve: q.reserve,
              montant: arrondir(q.quotite * impot.impotDu!),
            })),
    };
  }

  /**
   * LES BILANS SUCCESSIFS DE L'ANNÉE DE LA DISSOLUTION (décision par la loi du
   * 2026-10-07, quatrième lot, point 2 ; constat 12 de la relecture) · UNE
   * assiette, celle de l'année de la dissolution, payée en DEUX cotisations.
   * Loi n° 23/053, art. 11, 1° (« sans distinguer » l'activité continuée des
   * opérations de liquidation), art. 12, al. 4 (« les résultats en sont
   * totalisés pour l'assiette de l'impôt dû au titre de ladite année ») et
   * art. 13, al. 3 (« cette cotisation est rattachée à l'exercice désigné par
   * le millésime de l'année de la dissolution »).
   *
   * · L'exercice ARRÊTÉ à la dissolution porte la première cotisation · son
   *   impôt seul, calculé ci-dessus (bilan avant liquidation).
   * · L'exercice de LIQUIDATION porte la seconde · l'impôt calculé une fois sur
   *   le TOTAL des deux résultats (report déficitaire disponible à l'ouverture
   *   de l'année, impôt minimum de l'art. 57 sur le chiffre d'affaires TOTAL),
   *   moins la première cotisation et les acomptes de l'année qui ne s'y sont
   *   pas imputés (ceux portés par l'exercice de liquidation, LPF art. 57 bis,
   *   al. 3 · déduits de la cotisation dont la déclaration les suit).
   * · Sans liquidation (AUSCGIE art. 201 al. 4), la cotisation de l'exercice
   *   arrêté est la seule.
   * UN RÉGLÉ SUPÉRIEUR À L'IMPÔT TOTALISÉ SE SÉPARE EN DEUX (décision de
   * Manasse du 2026-10-08, « crédit d'impôt dans un compte du bilan », compte
   * choisi par la loi). L'impôt de l'année s'éteint d'abord par la première
   * cotisation, puis par les acomptes. (1) L'excédent d'ACOMPTES reste au
   * 4492 · l'art. 57 ter LPF ne vise que « les acomptes provisionnels
   * versés ». (2) La part de la PREMIÈRE COTISATION (art. 13, al. 1) qui
   * dépasse l'impôt totalisé (art. 12, al. 4) n'est pas un acompte · c'est une
   * dette de l'État envers la société, constatée au DÉBIT du 441 « État,
   * impôt sur les bénéfices » (fiche du compte 44, « Débité lors de la
   * constatation de la dette de l'État envers l'entité [...] par le crédit
   * des comptes concernés [...] des classes 7 et 8 ») par le CRÉDIT du 8994
   * « Annulations pour pertes rétroactives » (fiche du compte 89 · le 891
   * « diminué des dégrèvements et des annulations sur des exercices
   * antérieurs »), dans l'exercice de liquidation · proposée par l'écriture
   * de l'impôt (`ConstatImpotService`). Le 441 débiteur reste au bilan en
   * créance (« Autres créances »), jamais présenté comme un remboursement à
   * encaisser.
   */
  private async bilansSuccessifsDe(
    tenantId: string,
    tenant: { dateDissolution: Date | null; formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null; regimeLiquidation: RegimeLiquidation | null; associeUniquePersonneMorale: boolean | null },
    exercice: { id: string; dateDebut: Date; dateFin: Date },
    courant: { base: number; chiffreAffaires: number; impotDu: number | null; acomptesVerses: number; regime: RegimeImposition; natureActivite: NatureActiviteFiscale | null },
  ): Promise<BilansSuccessifs> {
    const d = tenant.dateDissolution!;
    const annee = d.getUTCFullYear();
    const jour = (x: Date) => x.toISOString().slice(0, 10).split('-').reverse().join('/');
    const sans = sansLiquidation({ forme: tenant.formeJuridiqueSyscohada, regimeLiquidation: tenant.regimeLiquidation, associeUniquePersonneMorale: tenant.associeUniquePersonneMorale });
    if (exercice.dateFin.getTime() === d.getTime()) {
      return {
        role: sans ? ('COTISATION_UNIQUE' as const) : ('PREMIERE_COTISATION' as const),
        anneeDissolution: annee,
        calculable: true,
        motif: null as string | null,
        premiereCotisation: courant.impotDu,
        totalisation: null,
        observation:
          `DISSOLUTION DU ${jour(d)} · l'impôt ci-dessus est ${sans ? 'la cotisation spéciale UNIQUE' : 'la PREMIÈRE cotisation spéciale'} de l'année ${annee}, sur les résultats de la période d'activité (loi n° 23/053, art. 13, al. 1), ` +
          (sans
            ? "la société étant dissoute sans liquidation (AUSCGIE art. 201 al. 4)."
            : "à déduire de la seconde, qui se calcule sur le total des résultats de l'année de la dissolution (art. 12, al. 4 ; art. 13, al. 3) · servie sur l'exercice de liquidation.") +
          " Aucun acompte n'est dû pour les années qui suivent celle de la dissolution (LPF art. 57 bis ; décision par la loi du 2026-10-07, quatrième lot, point 3).",
      };
    }
    if (!estExerciceDeLiquidation(exercice, d) || sans) {
      return {
        role: 'NON_CALCULEE' as const,
        anneeDissolution: annee,
        calculable: false,
        motif:
          exercice.dateDebut.getTime() <= d.getTime()
            ? `L'exercice n'est pas arrêté à la dissolution du ${jour(d)} · la période d'activité et la liquidation y sont mêlées, et les deux cotisations ne se séparent pas. Arrêtez-le dans la fenêtre Exercices (loi n° 23/053, art. 12, al. 1).`
            : `Cet exercice suit la dissolution du ${jour(d)} sans être l'exercice de liquidation · tous les résultats de la liquidation sont rattachés à l'année ${annee} (art. 13, al. 3), et aucun impôt annuel propre n'est dû.`,
        premiereCotisation: null,
        totalisation: null,
        observation: `DISSOLUTION DU ${jour(d)} · totalisation non calculée sur cet exercice.`,
      };
    }
    const arrete = await this.prisma.exercice.findFirst({
      where: { tenantId, dateFin: d },
      select: { id: true, dateDebut: true, dateFin: true, statut: true },
    });
    if (!arrete) {
      return {
        role: 'SECONDE_COTISATION' as const,
        anneeDissolution: annee,
        calculable: false,
        motif:
          `Aucun exercice n'est arrêté à la dissolution du ${jour(d)} dans le dossier · la première cotisation ne s'y lit pas, et l'impôt totalisé de l'année ${annee} ne se calcule pas ici. ` +
          "Le calcul ci-dessus porte sur l'exercice de liquidation seul.",
        premiereCotisation: null,
        totalisation: null,
        observation: `DISSOLUTION DU ${jour(d)} · totalisation de l'année ${annee} non calculée, faute d'exercice arrêté à la dissolution.`,
      };
    }
    const premier: {
      resultatFiscal: number;
      deficitImpute: number;
      deficitAnterieur: { montant: number };
      chiffreAffairesMinimum: number;
      impotDu: number | null;
      impotConstateAu89: number;
      impotExerciceAu89: number;
      reintegrationsImpot: number;
    } = await this.resultatFiscal(tenantId, arrete.id);
    /*
      LA PREMIÈRE COTISATION SE LIT SUR CE QUI L'A CONSTATÉE, JAMAIS
      RECALCULÉE QUAND ELLE EST ÉCRITE (relecture « échecs silencieux », M3 ;
      second tour, BLOQUANT 2) · c'est l'impôt de la période d'activité que la
      société a déclaré et payé (loi n° 23/053, art. 13, al. 1). Dans l'ordre ·
      le constat non annulé de l'écriture de l'impôt (ligne A11) ; à défaut,
      le DÉBIT du 891 et du 895 de l'exercice arrêté (impôt passé à la main,
      que l'écriture de l'impôt refuse alors de doubler) ; à défaut, sur un
      exercice CLÔTURÉ (où l'écriture de l'impôt ne se passe plus), l'impôt
      recalculé, avec sa réserve. On ne refuse que là où le cabinet PEUT
      passer le constat (exercice ouvert, 891 et 895 vides) · sans quoi le
      dossier était enfermé, la seconde cotisation jamais calculée. Un impôt
      au 89 non réintégré à sa mesure fausse la base de la période d'activité
      (art. 45) · refus nommé, la réintégration se saisit même sur un exercice
      clôturé.
    */
    const constat = await this.prisma.constatImpotResultat.findFirst({
      where: { tenantId, exerciceId: arrete.id, annuleeLe: null },
      select: { montantImpot: true },
    });
    const impotAu89 = arrondir(premier.impotExerciceAu89 ?? 0);
    const ecartReintegration = arrondir((premier.impotConstateAu89 ?? 0) - (premier.reintegrationsImpot ?? 0));
    const sourcePremiereCotisation: 'CONSTAT' | 'COMPTE_89' | 'RECALCUL' | null = constat
      ? 'CONSTAT'
      : impotAu89 > 0.005
        ? 'COMPTE_89'
        : arrete.statut === StatutExercice.CLOTURE
          ? 'RECALCUL'
          : null;
    if (!sourcePremiereCotisation || Math.abs(ecartReintegration) >= 0.005) {
      return {
        role: 'SECONDE_COTISATION' as const,
        anneeDissolution: annee,
        calculable: false,
        motif: !sourcePremiereCotisation
          ? `La première cotisation de l'exercice arrêté à la dissolution du ${jour(d)} n'est pas constatée · passez l'écriture de l'impôt de cet exercice (Résultat fiscal, « Écriture de l'impôt »), puis revenez ici. ` +
            "Recalculée, elle pourrait différer de la cotisation déclarée et payée (loi n° 23/053, art. 13, al. 1), et la seconde serait fausse d'autant."
          : `L'impôt porté au 89 de l'exercice arrêté à la dissolution du ${jour(d)} (${montantFiscal(premier.impotConstateAu89)}) n'est pas réintégré à sa mesure (${montantFiscal(premier.reintegrationsImpot)}) · la base de la période d'activité est fausse de ${montantFiscal(Math.abs(ecartReintegration))} (loi n° 23/053, art. 45). ` +
            "Ajustez la réintégration « Impôt sur les sociétés et impôt minimum comptabilisés en charges » de cet exercice, puis revenez ici.",
        premiereCotisation: constat ? Number(constat.montantImpot) : impotAu89 > 0.005 ? impotAu89 : null,
        totalisation: null,
        observation: `DISSOLUTION DU ${jour(d)} · totalisation de l'année ${annee} non calculée, ${!sourcePremiereCotisation ? 'faute de première cotisation constatée' : "l'impôt de la période d'activité n'étant pas réintégré à sa mesure"}.`,
      };
    }
    const baseActivite = arrondir(premier.resultatFiscal + premier.deficitImpute);
    const deficitDisponible = premier.deficitAnterieur.montant;
    const total = arrondir(baseActivite + courant.base);
    const deficitImpute = arrondir(Math.min(deficitDisponible, Math.max(total, 0)));
    const resultatFiscal = arrondir(total - deficitImpute);
    const chiffreAffaires = arrondir(premier.chiffreAffairesMinimum + courant.chiffreAffaires);
    const impot = this.calculerImpot(courant.regime, resultatFiscal, chiffreAffaires, courant.natureActivite);
    const premiereCotisation: number | null =
      sourcePremiereCotisation === 'CONSTAT' ? Number(constat!.montantImpot) : sourcePremiereCotisation === 'COMPTE_89' ? impotAu89 : premier.impotDu;
    const reservePremiere =
      sourcePremiereCotisation === 'COMPTE_89'
        ? ` La première cotisation est lue sur le débit du 891 et du 895 de l'exercice arrêté (${montantFiscal(impotAu89)}), l'impôt y ayant été passé hors de l'écriture de l'impôt.`
        : sourcePremiereCotisation === 'RECALCUL'
          ? " La première cotisation est RECALCULÉE · l'exercice arrêté est clôturé sans écriture de l'impôt ni impôt au 89 · à vérifier contre la déclaration déposée, qui prime (loi n° 23/053, art. 13, al. 1)."
          : '';
    const dejaRegle =
      premiereCotisation === null ? null : arrondir(premiereCotisation + courant.acomptesVerses);
    const reste = impot.impotDu === null || dejaRegle === null ? null : arrondir(impot.impotDu - dejaRegle);
    const totalisation = {
      periodeActivite: {
        exerciceId: arrete.id,
        dateDebut: arrete.dateDebut,
        dateFin: arrete.dateFin,
        resultatFiscalAvantReport: baseActivite,
        chiffreAffaires: premier.chiffreAffairesMinimum,
      },
      liquidation: { resultatFiscalAvantReport: courant.base, chiffreAffaires: courant.chiffreAffaires },
      total,
      deficitDisponible,
      deficitImpute,
      resultatFiscal,
      chiffreAffaires,
      impotTheorique: impot.impotTheorique,
      impotMinimum: impot.impotMinimum,
      impotTotal: impot.impotDu,
      minimumApplique: impot.minimumApplique,
      acomptesImputes: courant.acomptesVerses,
      dejaRegle,
      secondeCotisation: reste === null ? null : Math.max(reste, 0),
      excedent: reste !== null && reste < 0 ? -reste : 0,
      cotisationDeLExercice:
        impot.impotDu === null || premiereCotisation === null ? null : Math.max(arrondir(impot.impotDu - premiereCotisation), 0),
      tropPayePremiereCotisation:
        impot.impotDu === null || premiereCotisation === null ? 0 : Math.max(arrondir(premiereCotisation - impot.impotDu), 0),
      excedentAcomptes: 0,
    };
    totalisation.excedentAcomptes = Math.max(arrondir(totalisation.excedent - totalisation.tropPayePremiereCotisation), 0);
    const montant = (n: number | null) => (n === null ? 'non calculé' : montantFiscal(n));
    return {
      role: 'SECONDE_COTISATION' as const,
      anneeDissolution: annee,
      calculable: true,
      motif: null as string | null,
      premiereCotisation,
      sourcePremiereCotisation,
      totalisation,
      observation:
        `BILANS SUCCESSIFS DE ${annee} · une assiette, deux cotisations (loi n° 23/053, art. 11, 1°, 12, al. 4, et 13, al. 3). ` +
        `Période d'activité ${montant(baseActivite)}, liquidation ${montant(courant.base)}, total ${montant(total)}` +
        (deficitImpute > 0.005 ? `, report déficitaire imputé ${montant(deficitImpute)}` : '') +
        `, chiffre d'affaires total ${montant(chiffreAffaires)} · impôt de l'année ${montant(impot.impotDu)}, ` +
        `première cotisation ${montant(premiereCotisation)}, acomptes imputés ${montant(courant.acomptesVerses)}, ` +
        (totalisation.excedent > 0.005
          ? `seconde cotisation 0 · ce qui est réglé dépasse l'impôt totalisé de ${montant(totalisation.excedent)}` +
            (totalisation.tropPayePremiereCotisation > 0.005
              ? `, dont ${montant(totalisation.tropPayePremiereCotisation)} de première cotisation · créance sur l'État, gardée au bilan au débit du 441 par le crédit du 8994 « Annulations pour pertes rétroactives » (AUDCIF, Titre VII, fiches des comptes 44 et 89), proposée par l'écriture de l'impôt de l'exercice, jamais un remboursement à encaisser`
              : '') +
            (totalisation.excedentAcomptes > 0.005
              ? `${totalisation.tropPayePremiereCotisation > 0.005 ? ', et' : ', dont'} ${montant(totalisation.excedentAcomptes)} d'acomptes, qui restent au 4492 (LPF art. 57 ter, « peuvent, à sa demande, servir au paiement d'autres impôts et droits dus »)`
              : '') +
            '.'
          : `seconde cotisation ${montant(totalisation.secondeCotisation)}.`) +
        reservePremiere,
    };
  }

  /**
   * Liquidation de l'impôt selon le régime. `impotDu` vaut null quand le
   * montant ne PEUT pas être calculé ici, et l'explication dit pourquoi :
   * un zéro affiché à la place d'un impôt inconnu serait une faute.
   */
  private calculerImpot(
    regime: RegimeImposition,
    resultatFiscal: number,
    chiffreAffaires: number,
    natureActivite: NatureActiviteFiscale | null,
  ): {
    impotTheorique: number | null;
    impotMinimum: number | null;
    impotDu: number | null;
    baseImpot: string;
    minimumApplique: boolean;
    explication: string;
  } {
    const is = IMPOT_SOCIETES;
    const pp = IMPOT_REVENU_PERSONNES_PHYSIQUES;
    switch (regime) {
      case 'IMPOT_SOCIETES': {
        // ART. 150 · l'arrondi légal s'applique aux montants d'impôt
        // eux-mêmes, DONC AVANT la comparaison de l'art. 57 : c'est le
        // montant arrondi qui est dû, et c'est lui qui doit être comparé.
        const theoriqueAvantArrondi = is.taux * Math.max(resultatFiscal, 0);
        const minimumAvantArrondi = is.tauxMinimum * chiffreAffaires;
        const theorique = arrondirImpotArt150(theoriqueAvantArrondi);
        const minimum = arrondirImpotArt150(minimumAvantArrondi);
        const minimumApplique = minimum > theorique;
        /*
          C12a · L'ARRONDI QUI REND ÉGAUX DEUX IMPÔTS QUI NE L'ÉTAIENT PAS.
          L'art. 150 arrondit « le montant de l'Impôt sur les Sociétés, de
          l'Impôt minimum » ; l'art. 57 compare une « imposition » au minimum.
          Aucun des deux ne dit si l'arrondi précède la comparaison (lus le
          2026-10-04) · l'ordre actuel est gardé (arrondi d'abord), le
          montant dû est le même dans les deux lectures, mais le COMPTE de la
          charge en dépend (891 au taux, 895 au minimum, fiche du compte 89),
          et dire « égaux » sans la réserve affirmait une égalité que les
          montants calculés n'avaient pas.
        */
        const egauxParArrondi =
          minimum === theorique && Math.abs(minimumAvantArrondi - theoriqueAvantArrondi) >= 0.005;
        /*
          TROIS CAS, ET NON DEUX · la comparaison est stricte, l'ÉGALITÉ
          tombait donc dans la branche qui affirme le contraire.

          Le texte servi disait « Impôt sur le bénéfice au taux de 30 %,
          SUPÉRIEUR à l'impôt minimum ». Quand les deux montants sont ÉGAUX,
          c'est faux, et le cas n'a rien d'exotique : il est atteint par toute
          société DÉFICITAIRE dont le chiffre d'affaires est nul, puisque le
          chiffre d'affaires ne lit que les comptes 701 à 707. Une holding dont
          les produits sont en 77, une société en démarrage, une société dont
          tout le produit est hors activités ordinaires en 84 · l'écran
          affichait alors « 30 % : 0 », « minimum : 0 », « IMPÔT DÛ : 0 » et
          l'affirmation que le premier est supérieur au second.

          Le déficit est nommé pour lui-même, parce que c'est le premier cas de
          déclenchement de l'article : « Les sociétés sont assujetties à un
          impôt minimum fixé à 1 % du chiffre d'affaires déclaré, LORSQUE LES
          RÉSULTATS SONT DÉFICITAIRES ou bénéficiaires mais susceptibles de
          donner lieu à une imposition inférieure à ce montant. »
        */
        const deficitaire = resultatFiscal < 0;
        const avantArrondi = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
        const explicationSeule = minimumApplique
          ? `L'impôt minimum de ${is.tauxMinimum * 100} % du chiffre d'affaires déclaré (loi n° 23/053, art. 57) est supérieur à l'impôt sur le bénéfice : c'est lui qui est dû.`
          : minimum === theorique
            ? deficitaire
              ? `RÉSULTAT DÉFICITAIRE ET CHIFFRE D'AFFAIRES NUL. L'article 57 assujettit les sociétés à l'impôt minimum de ${is.tauxMinimum * 100} % du chiffre d'affaires déclaré « lorsque les résultats sont déficitaires » : il s'applique bien ici, mais son assiette est nulle, d'où un impôt de zéro. Si le dossier a des produits ailleurs (77 financiers, 84 hors activités ordinaires), le chiffre d'affaires DÉCLARÉ à l'administration peut ne pas être celui-ci.`
              : egauxParArrondi
                ? `Les deux impôts sont égaux APRÈS l'arrondi de l'art. 150 de la loi n° 23/053, pas avant : ${is.taux * 100} % du bénéfice net imposable (art. 56) donne ${avantArrondi(theoriqueAvantArrondi)}, ${is.tauxMinimum * 100} % du chiffre d'affaires (art. 57) donne ${avantArrondi(minimumAvantArrondi)}, et tous deux s'arrondissent à ${theorique.toLocaleString('fr-FR')}. Ni l'art. 150 ni l'art. 57 ne disent si l'arrondi précède la comparaison · OmegaX arrondit d'abord, compare ensuite, et l'impôt est retenu AU TAUX (compte 891). Comparé avant l'arrondi, ${minimumAvantArrondi > theoriqueAvantArrondi ? "le minimum serait retenu (compte 895)" : "l'impôt au taux resterait retenu"} · le montant dû est le même dans les deux lectures.`
                : `Les deux impôts sont ÉGAUX : ${is.taux * 100} % du bénéfice net imposable (loi n° 23/053, art. 56) et ${is.tauxMinimum * 100} % du chiffre d'affaires (même loi, art. 57) donnent le même montant. L'article 57 ne joue que si l'imposition serait INFÉRIEURE au minimum · ce n'est pas le cas.`
            : `Impôt sur le bénéfice net imposable au taux de ${is.taux * 100} % (loi n° 23/053, art. 56), supérieur à l'impôt minimum de ${is.tauxMinimum * 100} % du chiffre d'affaires (même loi, art. 57).`;
        // C02 · le chiffre d'affaires du minimum est dit dans TOUTES les
        // branches, pas seulement quand il est nul.
        const explication = `${explicationSeule} ${LECTURE_CHIFFRE_AFFAIRES}`;
        return {
          impotTheorique: theorique,
          impotMinimum: minimum,
          impotDu: Math.max(theorique, minimum),
          baseImpot: `${is.taux * 100} % du bénéfice net imposable (loi n° 23/053, art. 56)`,
          minimumApplique,
          explication,
        };
      }
      case 'IRPP_MICRO_ENTREPRISE':
        return {
          impotTheorique: null,
          impotMinimum: null,
          impotDu: null,
          baseImpot: `Forfait annuel de ${pp.forfaitMicroEntrepriseUsd} dollars américains, converti en francs (arrêté n° 015/CAB/MIN/FINANCES/2025)`,
          minimumApplique: false,
          explication: `Le forfait est libellé en dollars et sa contre-valeur dépend du taux fixé par la circulaire de perception, que le logiciel ne détient pas · ${pp.forfaitMicroEntrepriseUsd} USD, payable au plus tard le 30 avril de l'année suivante. Aucun minimum de perception (art. 122).`,
        };
      case 'IRPP_PETITE_ENTREPRISE': {
        if (!natureActivite) {
          return {
            impotTheorique: null,
            impotMinimum: null,
            impotDu: null,
            baseImpot: "1 % du chiffre d'affaires pour la vente, 2 % pour les prestations (art. 127)",
            minimumApplique: false,
            explication:
              "La nature de l'activité principale n'est pas renseignée : le taux ne se devine pas. Indiquez vente ou prestations de services · en cas d'activité mixte, la loi cumule les chiffres d'affaires et impose suivant l'activité principale.",
          };
        }
        const taux = pp.tauxPetiteEntreprise[natureActivite];
        // Art. 150 · l'IRPP est nommément visé par l'arrondi légal.
        const du = arrondirImpotArt150(taux * chiffreAffaires);
        return {
          impotTheorique: du,
          impotMinimum: null,
          impotDu: du,
          baseImpot: `${taux * 100} % du chiffre d'affaires annuel réalisé, activité de ${natureActivite === 'VENTE' ? 'vente' : 'prestations de services'} (art. 127)`,
          minimumApplique: false,
          explication:
            "Impôt assis sur le chiffre d'affaires, indépendant du résultat : les retraitements ci-dessus ne le modifient pas. Ils restent utiles si l'entreprise opte pour le régime réel.",
        };
      }
      case 'IRPP_REGIME_REEL': {
        // Art. 150 · « l'Impôt minimum » est nommé par l'article.
        const minimum = arrondirImpotArt150(pp.tauxMinimumRegimeReel * chiffreAffaires);
        return {
          impotTheorique: null,
          impotMinimum: minimum,
          impotDu: null,
          baseImpot: 'Barème progressif de l’art. 118 sur le revenu net global du contribuable',
          minimumApplique: false,
          explication: `Le bénéfice professionnel déterminé ici (${resultatFiscal.toLocaleString('fr-FR')}) entre dans le revenu net global du contribuable avec ses autres revenus catégoriels ; le barème progressif s'applique à ce total, que ce dossier ne détient pas. Le minimum de perception de ${pp.tauxMinimumRegimeReel * 100} % du chiffre d'affaires (art. 122) est en revanche connu.`,
        };
      }
    }
  }

  // --- Retraitements --------------------------------------------------------

  async ajouterRetraitement(tenantId: string, exerciceId: string, dto: CreerRetraitementDto) {
    await this.tenantSyscohada(tenantId);
    await this.exerciceDuDossier(tenantId, exerciceId);
    const definition = RETRAITEMENT_PAR_CODE.get(dto.code);
    if (!definition) throw new BadRequestException(`Code de retraitement inconnu : ${dto.code}`);
    const libre = dto.code === CODE_LIBRE;
    if (libre && !dto.libelle?.trim()) {
      throw new BadRequestException('Une ligne libre doit porter un libellé');
    }
    if (libre && !dto.commentaire?.trim()) {
      // Sans fondement écrit, la ligne est indéfendable devant le vérificateur.
      throw new BadRequestException('Une ligne libre doit indiquer son fondement en commentaire');
    }
    await this.prisma.retraitementFiscal.create({
      data: {
        tenantId,
        exerciceId,
        code: dto.code,
        // Le sens d'un code du catalogue est celui du catalogue · seule la
        // ligne libre peut aller dans les deux directions.
        sens: libre ? (dto.sens ?? definition.sens) : definition.sens,
        libelle: libre ? dto.libelle!.trim() : definition.libelle,
        montant: arrondir(dto.montant),
        commentaire: dto.commentaire?.trim() || null,
      },
    });
    return this.resultatFiscal(tenantId, exerciceId);
  }

  async modifierRetraitement(tenantId: string, id: string, dto: ModifierRetraitementDto) {
    await this.tenantSyscohada(tenantId);
    const existant = await this.prisma.retraitementFiscal.findFirst({ where: { id, tenantId } });
    if (!existant) throw new NotFoundException('Retraitement introuvable');
    await this.prisma.retraitementFiscal.update({
      where: { id },
      data: {
        ...(dto.montant === undefined ? {} : { montant: arrondir(dto.montant) }),
        ...(dto.commentaire === undefined ? {} : { commentaire: dto.commentaire.trim() || null }),
      },
    });
    return this.resultatFiscal(tenantId, existant.exerciceId);
  }

  async supprimerRetraitement(tenantId: string, id: string) {
    await this.tenantSyscohada(tenantId);
    const existant = await this.prisma.retraitementFiscal.findFirst({ where: { id, tenantId } });
    if (!existant) throw new NotFoundException('Retraitement introuvable');
    await this.prisma.retraitementFiscal.delete({ where: { id } });
    return this.resultatFiscal(tenantId, existant.exerciceId);
  }

  // --- Dossier fiscal de l'exercice ----------------------------------------

  async modifierDossier(tenantId: string, exerciceId: string, dto: ModifierDossierFiscalDto) {
    await this.tenantSyscohada(tenantId);
    const exercice = await this.exerciceDuDossier(tenantId, exerciceId);
    /*
      RELEVÉ 7 · CE QUI FONDE LE REPORT ET LA PÉRIODE DE CRÉATION NE SE
      RETOUCHE PAS SUR UN EXERCICE CLOS. Le report déclaré fait foi dans le
      rejeu des exercices suivants (B2, P1), le bénéfice de la période de
      création fonde son impôt et la déduction du premier exercice clos ·
      changés sur un exercice clos, ils changeraient en silence l'impôt
      d'exercices déjà déclarés (AUDCIF art. 22, 2° pour l'exercice clos). Le
      refus n'enferme rien · le report disponible se déclare à l'ouverture de
      l'exercice OUVERT suivant, et cette déclaration fait foi à son tour. Les
      autres champs (acomptes, suppléments, nature d'activité) restent ouverts,
      comme avant, et chaque changement passe au journal d'audit (le modèle
      est audité).
    */
    const touchesReport =
      dto.deficitAnterieurSaisi !== undefined ||
      dto.deficitAnterieurOrigines !== undefined ||
      dto.resultatPeriodeCreationSaisi !== undefined ||
      dto.chiffreAffairesPeriodeCreationSaisi !== undefined;
    if (touchesReport && exercice.statut === StatutExercice.CLOTURE) {
      throw new BadRequestException(
        "L'exercice est clôturé · le déficit reportable déclaré et le bénéfice de la période de création n'y changent plus, ils fondent l'impôt d'exercices déjà déclarés. Déclarez le report disponible à l'ouverture de l'exercice ouvert suivant (« Déficits antérieurs ») · cette déclaration fait foi pour la suite.",
      );
    }
    // LE CHIFFRE D'AFFAIRES DE LA PÉRIODE SE DÉCLARE AVEC SON BÉNÉFICE (mineur
    // C09) · les deux viennent des mêmes comptes intermédiaires (art. 12,
    // al. 3) ; sans bénéfice déclaré, les deux se lisent au livre-journal.
    if (dto.chiffreAffairesPeriodeCreationSaisi !== undefined && dto.chiffreAffairesPeriodeCreationSaisi !== null) {
      const beneficeApres =
        dto.resultatPeriodeCreationSaisi !== undefined
          ? dto.resultatPeriodeCreationSaisi
          : ((await this.prisma.dossierFiscalExercice.findUnique({ where: { exerciceId }, select: { resultatPeriodeCreationSaisi: true } }))
              ?.resultatPeriodeCreationSaisi ?? null);
      if (beneficeApres === null) {
        throw new BadRequestException(
          "Le chiffre d'affaires de la période de création se déclare avec son bénéfice fiscal, d'après les mêmes comptes intermédiaires (loi n° 23/053, art. 12, al. 3) · déclarez d'abord le bénéfice ; sans lui, les deux se lisent au livre-journal.",
        );
      }
    }
    if (dto.deficitAnterieurOrigines) {
      const existant = await this.prisma.dossierFiscalExercice.findUnique({ where: { exerciceId } });
      const saisi =
        dto.deficitAnterieurSaisi !== undefined
          ? dto.deficitAnterieurSaisi
          : existant?.deficitAnterieurSaisi === null || existant?.deficitAnterieurSaisi === undefined
            ? null
            : Number(existant.deficitAnterieurSaisi);
      if (saisi === null) {
        throw new BadRequestException("L'origine d'un déficit ne se déclare qu'avec le déficit saisi qu'elle ventile.");
      }
      const somme = arrondir(dto.deficitAnterieurOrigines.reduce((t, o) => t + o.montant, 0));
      if (Math.abs(somme - arrondir(saisi)) >= 0.005) {
        throw new BadRequestException(
          `L'origine déclarée totalise ${montantFiscal(somme)} pour un déficit saisi de ${montantFiscal(saisi)} · chaque part se rattache à un exercice déficitaire, et leur somme est le déficit saisi.`,
        );
      }
      const horsFenetre = originesHorsFenetre(
        dto.deficitAnterieurOrigines.map((o) => ({ dateFin: new Date(`${o.dateFin.slice(0, 10)}T00:00:00Z`), montant: o.montant })),
        exercice,
        IMPOT_SOCIETES.exercicesReportDeficit,
      );
      if (horsFenetre.length) {
        throw new BadRequestException(
          `Loi n° 23/053, art. 51 · une perte ne se reporte que « jusqu'au troisième exercice qui suit l'exercice déficitaire ». ${horsFenetre
            .map((o) => `La perte de l'exercice clos le ${o.dateFin.toISOString().slice(0, 10)} ne s'imputait plus après le ${o.finDeFenetre.toISOString().slice(0, 10)}`)
            .join(' ; ')}, avant l'ouverture du ${exercice.dateDebut.toISOString().slice(0, 10)} · elle ne se reporte pas sur cet exercice.`,
        );
      }
      for (const o of dto.deficitAnterieurOrigines) {
        if (new Date(`${o.dateFin.slice(0, 10)}T00:00:00Z`).getTime() >= exercice.dateDebut.getTime()) {
          throw new BadRequestException(
            `Une perte reportée à l'ouverture vient d'un exercice clos AVANT elle · le ${o.dateFin.slice(0, 10)} ne précède pas l'ouverture du ${exercice.dateDebut.toISOString().slice(0, 10)}.`,
          );
        }
      }
    }
    // UNE SAISIE CHANGÉE SEULE EMPORTE L'ORIGINE QUI NE LA VENTILE PLUS
    // (troisième tour, relecture adverse). L'écran envoie le montant seul ·
    // l'origine gardée à l'ancien total aurait fait foi dans le rejeu des
    // exercices suivants pour un montant que le cabinet venait de corriger.
    // Retirée, la saisie retombe sur la borne prudente, dite à l'écran
    // (« Origine non déclarée ») et dans le rejeu ; le cabinet la redéclare.
    let origineCaduque = false;
    if (typeof dto.deficitAnterieurSaisi === 'number' && dto.deficitAnterieurOrigines === undefined) {
      const existant = await this.prisma.dossierFiscalExercice.findUnique({ where: { exerciceId } });
      const lues = Array.isArray(existant?.deficitAnterieurOrigines)
        ? (existant!.deficitAnterieurOrigines as { montant?: unknown }[])
        : [];
      origineCaduque =
        lues.length > 0 &&
        Math.abs(arrondir(lues.reduce((t, o) => t + Number(o.montant), 0)) - arrondir(dto.deficitAnterieurSaisi)) >= 0.005;
    }
    const data = {
      ...(dto.acomptesVerses === undefined ? {} : { acomptesVerses: arrondir(dto.acomptesVerses) }),
      ...(dto.supplementsAdministration === undefined
        ? {}
        : { supplementsAdministration: arrondir(dto.supplementsAdministration) }),
      ...(dto.deficitAnterieurSaisi === undefined
        ? {}
        : { deficitAnterieurSaisi: dto.deficitAnterieurSaisi === null ? null : arrondir(dto.deficitAnterieurSaisi) }),
      // Un déficit saisi effacé emporte son origine · elle ne ventile plus rien.
      ...(dto.deficitAnterieurSaisi === null || origineCaduque
        ? { deficitAnterieurOrigines: Prisma.DbNull }
        : dto.deficitAnterieurOrigines === undefined
          ? {}
          : {
              deficitAnterieurOrigines:
                dto.deficitAnterieurOrigines === null
                  ? Prisma.DbNull
                  : dto.deficitAnterieurOrigines.map((o) => ({ dateFin: o.dateFin.slice(0, 10), montant: arrondir(o.montant) })),
            }),
      ...(dto.supplementsPeriodeCreation === undefined
        ? {}
        : { supplementsPeriodeCreation: arrondir(dto.supplementsPeriodeCreation) }),
      ...(dto.natureActivite === undefined ? {} : { natureActivite: dto.natureActivite }),
      ...(dto.resultatPeriodeCreationSaisi === undefined
        ? {}
        : {
            resultatPeriodeCreationSaisi:
              dto.resultatPeriodeCreationSaisi === null ? null : arrondir(dto.resultatPeriodeCreationSaisi),
            // Le bénéfice retiré emporte le chiffre d'affaires déclaré avec lui ·
            // les deux se relisent au livre-journal (mineur C09).
            ...(dto.resultatPeriodeCreationSaisi === null ? { chiffreAffairesPeriodeCreationSaisi: null } : {}),
          }),
      ...(dto.chiffreAffairesPeriodeCreationSaisi === undefined || dto.resultatPeriodeCreationSaisi === null
        ? {}
        : {
            chiffreAffairesPeriodeCreationSaisi:
              dto.chiffreAffairesPeriodeCreationSaisi === null ? null : arrondir(dto.chiffreAffairesPeriodeCreationSaisi),
          }),
    };
    await this.prisma.dossierFiscalExercice.upsert({
      where: { exerciceId },
      create: { tenantId, exerciceId, ...data },
      update: data,
    });
    return this.resultatFiscal(tenantId, exerciceId);
  }
}
