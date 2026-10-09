import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClasseCompte } from '@prisma/client';
import { EcritureService } from '../comptabilite/ecriture.service';
import { AUCUN_VIREMENT, VirementsParCompte } from '../immobilisations/virements-mise-en-service';
import { ExerciceService } from '../exercice/exercice.service';
import {
  CompteDuPoste,
  LigneBalancePourEtat,
  MOTIF_EXERCICE_INTROUVABLE,
  MOTIF_RESULTAT_N1_NON_TENU,
  ProvenanceComparatif,
  chargerLignes,
  chargerOuverture,
  comparatifDuBilan,
  correspond,
  exerciceCloture,
  exercicePrecedentCloture,
  exercicePrecedentTenu,
  lireOuverturePasseeEnOd,
  mentionComparatifSurOuverture,
  mentionExercicePrecedentVide,
  mentionOuverturePresumeeNulle,
  motifOuverturePasseeEnOd,
  ouvertureTenue,
  trouverExerciceN1,
} from '../etats-financiers/etats-financiers.communs';
import {
  BornesExercice,
  finDeJournee,
  memePeriodeExercicePrecedent,
  motifRefusDateArrete,
} from '../etats-financiers/situation-intermediaire';
import {
  COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE,
  COMPTES_RESULTAT_SYSCOHADA,
  COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA,
  LIBELLE_RESULTAT_SYSCOHADA,
  ORDRE_AFFICHAGE_ACTIF_SYSCOHADA,
  ORDRE_AFFICHAGE_PASSIF_SYSCOHADA,
  POSTES_ACTIF_SYSCOHADA,
  POSTES_PASSIF_SYSCOHADA,
  PosteBilanDeBase,
  REF_RESULTAT_SYSCOHADA,
  REF_TRESORERIE_PASSIF_SYSCOHADA,
  TOTAUX_ACTIF_SYSCOHADA,
  TOTAUX_PASSIF_SYSCOHADA,
  TotalBilan,
} from './correspondance-bilan-syscohada';
import {
  ORDRE_AFFICHAGE_COMPTE_RESULTAT,
  POSTES_COMPTE_RESULTAT_SYSCOHADA,
  REFS_POSTES_SUPPLEMENTAIRES,
  SOLDES_INTERMEDIAIRES,
  calculerSoldesIntermediaires,
  montantSigne,
  posteDuCompteSyscohada,
  trouvePosteCompteResultat,
  trouveSoldeIntermediaire,
} from './correspondance-compte-resultat-syscohada';
import {
  COMPTES_EXCLUS_SANS_REPRISE,
  COMPTES_SANS_TRESORERIE_SYSCOHADA,
  CONTROLE_ZH_PAR_LE_BILAN,
  ColonneBilan,
  ORDRE_AFFICHAGE_FLUX_SYSCOHADA,
  PosteFluxTresorerieSyscohada,
  SensSolde,
  TOTAUX_FLUX_SYSCOHADA,
  TOUS_LES_POSTES_FLUX_SYSCOHADA,
  TermeComptes,
  TermeFluxTresorerie,
  besoinsDuPoste,
} from './correspondance-tft-syscohada';
import {
  partsDuResultatAuBilan,
  resultatAnterieurNonVire,
  resultatAnterieurNonVireDuComparatif,
  resultatAuBilan,
  type ResultatAnterieurNonVire,
} from '../etats-financiers/resultat-de-l-exercice';

/**
 * ÉTATS FINANCIERS DU SYSCOHADA RÉVISÉ · Système normal (AUDCIF art. 11) :
 * bilan, compte de résultat, tableau des flux de trésorerie.
 *
 * Ce service ne porte AUCUNE règle comptable : chaque poste, chaque compte,
 * chaque formule et chaque anomalie du texte officiel vit dans les trois
 * tables voisines, qui citent leur source ligne à ligne
 * (`correspondance-bilan-syscohada.ts`, `correspondance-compte-resultat-
 * syscohada.ts`, `correspondance-tft-syscohada.ts`). Le service les APPLIQUE.
 * Corollaire pratique : une divergence avec l'AUDCIF se corrige dans la
 * table, jamais ici, sinon la source citée cesse de décrire le calcul réel.
 *
 * Il reprend la MÉCANIQUE de `etats-financiers/etats-financiers.service.ts`
 * (SYCEBNL) et rien d'autre : les deux référentiels ne partagent que les
 * aides techniques de `etats-financiers.communs.ts` (CLAUDE.md §6). Aucun
 * poste, aucun numéro de compte, aucun libellé SYCEBNL n'apparaît ici.
 *
 * ## Trois différences de fond avec le moteur SYCEBNL, toutes voulues
 *
 * 1. **Convention de signe du compte de résultat.** Le ch. 4 du Titre IX
 *    écrit « les postes de charges (préfixe R) sont saisis EN NÉGATIF ; les
 *    formules de totalisation sont des SOMMES, jamais des différences ». Tout
 *    poste vaut donc crédit − débit, charge comprise (`montantSigne`), et les
 *    neuf lignes X* s'obtiennent par simple addition
 *    (`calculerSoldesIntermediaires`). Le SYCEBNL porte ses charges en
 *    positif parce que SON texte écrit des différences : on ne transpose pas.
 * 2. **Méthode du tableau de flux.** Le ch. 5 impose la méthode INDIRECTE
 *    (« le point d'entrée est l'EBE, jamais le résultat net »), là où le
 *    SYCEBNL est en méthode directe. Le tableau se calcule donc à partir des
 *    postes DÉJÀ RÉSOLUS du bilan et du compte de résultat, pas des comptes
 *    en vrac · c'est ce que `TermeFluxTresorerie` décrit.
 * 3. **Le résultat au bilan (CJ) prend les soldes intermédiaires 132 à 138**
 *    mais PAS le 130 (résultat N-1 en instance d'affectation) · anomalie n° 7
 *    de la table du bilan. Le 130 ressort donc en `comptesNonRattaches`, ce
 *    qui est le comportement attendu, pas un oubli.
 *
 * ## Garanties communes aux trois états, chacune héritée d'un incident
 *
 * - Un compte qu'aucun poste ne réclame est LISTÉ, jamais absorbé par un
 *   poste voisin ni masqué (`comptesNonRattaches`, `comptesNonVentiles`) :
 *   un plan personnalisé qui s'écarte des préfixes officiels doit se voir.
 * - Le comparatif N-1 vient de `trouverExerciceN1` ; sans exercice antérieur
 *   il reste `undefined`, jamais un zéro qui laisserait croire à un exercice
 *   réel et vide.
 * - Le résultat au bilan additionne les classes 6/7/8 et le compte 13
 *   (`resultatAuBilan`) · avant la clôture le 13 ne porte que le résultat
 *   PRÉCÉDENT non affecté, après elle les classes 6 à 8 sont soldées.
 * - Le tableau de flux boucle deux fois (ZH par les flux, ZH par le bilan) et
 *   l'écart est présenté, jamais corrigé : il chiffre exactement ce que la
 *   ventilation FA à FQ ne couvre pas.
 */

// ---------------------------------------------------------------------------
// Structures rendues au client
// ---------------------------------------------------------------------------

/**
 * Ligne du bilan · même forme que `LigneBilan` côté client (`client/src/lib/
 * types.ts`), enrichie du renvoi de note et du renvoi de bas de poste que le
 * modèle du ch. 3 imprime (« 3e » sur CE, « dont Placement en Net » sur AJ et
 * AK). Les deux sont des chaînes d'affichage, jamais des valeurs calculées ·
 * le ch. 7 ne donne aucune correspondance pour le renvoi (anomalie n° 8 de la
 * table du bilan).
 *
 * `brut`/`amortissement` : ACTIF seulement, le modèle exigeant trois colonnes
 * (Brut, Amort. et déprec., Net). `amortissement` est une magnitude POSITIVE,
 * `montant` (net) = `brut` − `amortissement`.
 *
 * LA COLONNE N-1 EST NETTE, ET SEULEMENT NETTE (audit final F217) · le modèle
 * du ch. 3 imprime l'exercice N en Brut, Amort. et déprec., Net, et
 * l'exercice N-1 en Net seul. Deux champs `brutN1` et `amortissementN1`
 * étaient servis sans que personne ne les lise, écran, liasse ni export, et
 * valaient 0 sur un dossier sans exercice antérieur · un faux zéro sur une
 * colonne que le modèle n'a pas. Ils sont retirés ; `montantN1` porte le net.
 */
export interface LigneBilanSyscohada {
  ref: string;
  libelle: string;
  montant: number;
  montantN1?: number;
  brut?: number;
  amortissement?: number;
  estTotal: boolean;
  comptes: CompteDuPoste[];
  note?: string;
  renvoi?: string;
}

/**
 * LES COMPTES À SOLDER À LA CLÔTURE (audit final F92) · la table du Titre VII
 * était écrite et lue par personne. Le 104 « systématiquement soldé à la
 * clôture de l'exercice » par le 103 a un poste (CA), si bien qu'un 104 oublié
 * passait dans les capitaux propres sans que rien ne le dise. Les comptes déjà
 * nommés parmi les non rattachés (130, 585, 588) n'y sont pas répétés.
 */
function comptesASolderALaCloture(
  lignes: LigneBalancePourEtat[],
  nonRattaches: CompteDuPoste[],
  nonVire: ResultatAnterieurNonVire | null,
): Array<CompteDuPoste & { source: string }> {
  const dejaNommes = new Set(nonRattaches.map((c) => c.numero));
  return lignes.flatMap((l) => {
    if (Math.abs(l.solde) < EPSILON || dejaNommes.has(l.numero)) return [];
    const regle = COMPTES_BILAN_A_SOLDER_A_LA_CLOTURE.find((c) => l.numero.startsWith(c.prefixe));
    if (regle) return [{ numero: l.numero, intitule: l.intitule, montant: l.solde, source: regle.source }];
    // LE 131 À 139 D'UN EXERCICE CLÔTURÉ SANS LE VIREMENT DU RÉSULTAT
    // PRÉCÉDENT NON AFFECTÉ (relecture de la passe V1, BLOQUANT) · avant
    // l'écriture qui solde la gestion, il ne porte que ce résultat
    // antérieur, que la fiche du compte 13 fait virer en fin d'exercice.
    if (nonVire && correspond(l.numero, COMPTES_RESULTAT_SYSCOHADA)) {
      return [{ numero: l.numero, intitule: l.intitule, montant: l.solde, source: SOURCE_RESULTAT_ANTERIEUR_NON_VIRE }];
    }
    return [];
  });
}

/** La source citée pour un 131 à 139 resté non viré sur un exercice clôturé. */
const SOURCE_RESULTAT_ANTERIEUR_NON_VIRE =
  "Titre VII COMPTE 13 : « En fin d'exercice, le résultat de l'exercice précédent non affecté […] est viré au compte de report à nouveau » · exercice clôturé sans ce virement, CJ l'additionne au résultat de l'exercice";

export interface BilanSyscohada {
  actif: LigneBilanSyscohada[];
  passif: LigneBilanSyscohada[];
  totalActif: number;
  totalPassif: number;
  totalActifN1?: number;
  totalPassifN1?: number;
  exerciceN1Disponible: boolean;
  /**
   * D'où vient la colonne N-1 (cas chiffrés de la clôture, Q3) · l'exercice
   * précédent, ou le bilan d'ouverture du dossier quand l'exercice précédent
   * n'est pas tenu dans OmegaX (AUDCIF art. 34). `null` · aucune colonne.
   */
  comparatif: ProvenanceComparatif | null;
  /** La mention à imprimer au-dessus de la colonne N-1 lue sur l'ouverture. */
  mentionComparatif: string | null;
  equilibre: boolean;
  comptesNonRattaches: CompteDuPoste[];
  /**
   * Comptes que le Titre VII impose de solder à la clôture et qui portent un
   * solde, hors ceux déjà nommés parmi les non rattachés · vide sur une
   * situation intermédiaire, où ils sont légitimes (audit final F92).
   */
  comptesASolderALaCloture: Array<CompteDuPoste & { source: string }>;
  controle: {
    resultatClasses678: number;
    resultatCompte13: number;
    /** La part de CJ qui est le résultat de l'exercice PRÉCÉDENT non affecté (`partsDuResultatAuBilan`). */
    resultatAnterieurNonAffecte: number;
  };
  /** Exercice clôturé qui porte encore ce résultat antérieur · nommé, `null` sinon (et sur une situation intermédiaire). */
  resultatAnterieurNonVire: ResultatAnterieurNonVire | null;
  /** La colonne N-1 qui reprend le même défaut de l'exercice précédent (paquet 1, A1). */
  resultatAnterieurNonVireN1: ResultatAnterieurNonVire | null;
}

/**
 * Ligne du compte de résultat · postes de base (TA à RS) et lignes de solde
 * (XA à XI) dans la même liste, comme le modèle du ch. 4 les entrelace.
 * `estSolde` distingue les secondes ; `formuleOfficielle` porte alors la
 * formule telle qu'imprimée (« Somme TA à RB »).
 *
 * `montant` est SIGNÉ selon la convention du modèle : une charge ressort
 * négative. Le client l'imprime tel quel, sans le re-négativer ni le passer
 * en valeur absolue.
 */
export interface LigneCompteResultatSyscohada {
  ref: string;
  libelle: string;
  montant: number;
  montantN1?: number;
  /** Même période de l’exercice précédent · ch. 39 § 2.1.2, deuxième tiret. */
  montantMemePeriodeN1?: number;
  comptes: CompteDuPoste[];
  estSolde?: boolean;
  /**
   * Poste ajouté au modèle par le ch. 33 (RQP, TQP) · sans code REF déposé,
   * sa clé ne s'imprime pas (audit final F89).
   */
  supplementaire?: true;
  formuleOfficielle?: string;
  /** Renvois de la colonne NOTE du ch. 4, non développés (« 27 » reste « 27 »). */
  notes: string[];
}

/**
 * Les NEUF lignes X* du modèle, nommées. Huit sont des soldes de gestion,
 * chacun reçu par un sous-compte du 13 à la clôture (Titre VII COMPTE 13 :
 * 132 à 138, puis 131 ou 139) ; `chiffreAffaires` (XB) est le neuvième et
 * n'est PAS un solde de gestion, c'est un agrégat de ventes (A + B + C + D)
 * qu'aucun sous-compte du 13 ne reçoit.
 */
export interface SoldesCompteResultatSyscohada {
  margeCommerciale: number; // XA
  chiffreAffaires: number; // XB
  valeurAjoutee: number; // XC
  excedentBrutExploitation: number; // XD
  resultatExploitation: number; // XE
  resultatFinancier: number; // XF
  resultatActivitesOrdinaires: number; // XG
  resultatHorsActivitesOrdinaires: number; // XH
  resultatNet: number; // XI
}

export interface CompteResultatSyscohada {
  lignes: LigneCompteResultatSyscohada[];
  soldes: SoldesCompteResultatSyscohada;
  soldesN1?: SoldesCompteResultatSyscohada;
  /**
   * La MÊME PÉRIODE de l'exercice précédent · ch. 39 § 2.1.2, deuxième tiret.
   * Absente hors situation intermédiaire, et absente aussi quand la période
   * équivalente tombe hors de l'exercice précédent.
   */
  soldesMemePeriodeN1?: SoldesCompteResultatSyscohada;
  /** La date jusqu'à laquelle cette colonne comparative court. */
  memePeriodeN1JusquAu?: string;
  exerciceN1Disponible: boolean;
  /**
   * Colonne N-1 vide d'un dossier qui a un bilan d'ouverture sans exercice
   * précédent tenu · le motif et l'issue (cas chiffrés de la clôture, Q3).
   */
  motifComparatifAbsent: string | null;
  comptesNonRattaches: CompteDuPoste[];
  controle: {
    resultatToutesClassesDeGestion: number;
    ecart: number;
    coherent: boolean;
  };
}

/** Ligne chiffrée du tableau de flux · même forme que `LigneFluxTresorerie` côté client. */
export interface LigneFluxSyscohada {
  ref: string;
  libelle: string;
  montant: number;
  montantN1?: number;
  comptes: CompteDuPoste[];
  estTotal?: boolean;
  /** Clé A à H de la colonne de droite du modèle · seulement sur ZA et ZB à ZH. */
  repere?: string;
}

/** Intitulé de rubrique intercalé par le modèle entre deux blocs de postes. */
export interface SectionFluxSyscohada {
  section: string;
}

/**
 * Un poste que la balance ne permet pas de chiffrer, ou pas entièrement.
 * Deux origines, jamais confondues, et le `raison` le dit toujours :
 *  - la donnée MANQUE (aucun exercice antérieur alors que le poste est une
 *    variation de bilan) · le poste vaut 0 et ne doit pas être imprimé ;
 *  - une part est INDÉTERMINABLE par numéro de compte (`nonDeterminables` de
 *    la table) · le poste est chiffré, mais avec la réserve nommée ici.
 * Dans les deux cas rien n'est approximé par une clé inventée.
 */
export interface PosteNonCalculable {
  ref: string;
  raison: string;
}

export interface CompteTropAgrege extends CompteDuPoste {
  /** Les subdivisions que le tableau des flux lit, et entre lesquelles ce compte n'a pas choisi. */
  subdivisions: string[];
}

/** Tous les préfixes que les formules du tableau des flux lisent. */
const PREFIXES_LUS_PAR_LE_TFT = [
  ...new Set(TOUS_LES_POSTES_FLUX_SYSCOHADA.flatMap((p) => p.termes.flatMap((t) => t.comptes?.prefixes ?? []))),
].sort();

/**
 * Un compte est trop agrégé quand le tableau des flux lit des subdivisions de
 * son numéro sans lire ce numéro lui-même. Les zéros de fin sont retirés, un
 * dossier pouvant tenir 48100000 pour 481. Mesuré le 2026-09-25 · aucun des
 * 1 132 comptes de détail du plan semé n'est pris, et la balance d'un corrigé
 * d'expert-comptable (481, 81 et 82 tenus sans subdivision) l'est entière.
 */
export function subdivisionsLuesParLeTft(numero: string): string[] {
  const racine = numero.replace(/0+$/, '');
  if (!racine) return [];
  return PREFIXES_LUS_PAR_LE_TFT.filter((p) => p.startsWith(racine) && p.length > racine.length);
}

export interface TableauFluxTresorerieSyscohada {
  lignes: Array<LigneFluxSyscohada | SectionFluxSyscohada>;
  exerciceN1Disponible: boolean;
  comptesNonVentiles: CompteDuPoste[];
  /**
   * Comptes tenus PLUS HAUT que ce que le tableau distingue · un 481 quand le
   * tableau sépare 4811 (incorporelles) et 4812 (corporelles), un 81 ou un 82
   * quand il sépare 812, 822 et 826. Leur montant ne va ni dans l'une ni dans
   * l'autre subdivision, et l'écart de bouclage en vient sans que
   * `comptesNonVentiles` le voie (le 481 est lu par un poste plus large).
   */
  comptesTropAgreges: CompteTropAgrege[];
  postesNonCalculables: PosteNonCalculable[];
  /**
   * Les postes de la colonne N laissés VIDES (et les totaux qui en
   * dépendent), à distinguer des réserves de `postesNonCalculables`, qui
   * portent aussi les postes chiffrés sous réserve · depuis les cas chiffrés
   * de la clôture (B1, N1, Q3), seul un terme qui lirait le compte de
   * résultat N-1 sans exercice N-1 tenu en laisse un.
   */
  postesVides: string[];
  /** La provenance des positions d'ouverture quand l'exercice précédent n'est pas tenu (bloquant 2). */
  mentionOuverture: string | null;
  /** Ceux de la colonne N-1, laissés vides pour la même raison (audit final F14). */
  postesNonCalculablesN1: PosteNonCalculable[];
  controle: {
    tresorerieOuverture: number;
    variation: number;
    tresorerieClotureParFlux: number;
    tresorerieClotureParBilan: number;
    ecart: number;
    coherent: boolean;
  };
}

// ---------------------------------------------------------------------------
// Structures internes
// ---------------------------------------------------------------------------

/**
 * Poste de bilan résolu. `comptesBrut` est la colonne « Brut » seule (sans les
 * comptes d'amortissement et de dépréciation) : le tableau de flux la lit sur
 * AD et AI pour reconstituer les acquisitions (anomalie n° 3 de la table du
 * TFT), et elle serait fausse si on la déduisait de `comptes`.
 */
export interface PosteBilanCalcule {
  ref: string;
  libelle: string;
  montant: number;
  brut?: number;
  amortissement?: number;
  comptes: CompteDuPoste[];
  comptesBrut: CompteDuPoste[];
}

export interface ResolutionBilan {
  parRef: Map<string, PosteBilanCalcule>;
  resultatClasses678: number;
  resultatCompte13: number;
}

export interface ResolutionCompteResultat {
  /** Montants signés de TOUS les refs · postes de base ET lignes X*. */
  montantsParRef: Record<string, number>;
  comptesParRef: Map<string, CompteDuPoste[]>;
  comptesNonRattaches: CompteDuPoste[];
  resultatToutesClassesDeGestion: number;
}

/** Tout ce dont un terme de flux a besoin pour être évalué. */
interface ContexteFlux {
  bilanCourant: ResolutionBilan;
  bilanAnterieur: ResolutionBilan;
  crCourant: ResolutionCompteResultat;
  crAnterieur: ResolutionCompteResultat;
  lignesCourant: LigneBalancePourEtat[];
  /**
   * Solde de CLÔTURE N-1 par numéro de compte, avec sa provenance : la balance
   * de l'exercice antérieur quand il existe, sinon le report à-nouveau de
   * l'exercice courant, qui EST cette clôture pour un compte de bilan (modes
   * SOLDE et DETAIL du semis) · même nombre, pas une approximation.
   */
  soldesAnterieurs: Map<string, number>;
  exerciceAnterieurDisponible: boolean;
  /**
   * Lot 14 · les mouvements de l'écriture de réévaluation du module, par
   * identifiant de compte (`EcritureService.mouvementsDeReevaluation`), lus
   * par les termes `liaison: 'REEVALUATION'` · vide quand l'appelant n'en
   * dispose pas (consolidation), et alors ces termes valent zéro.
   */
  reevaluations: VirementsParCompte;
}

/** Classes qui composent le bilan · la 6, la 7 et la 8 sont le résultat, la 9 est hors états. */
const CLASSES_DE_BILAN = new Set<ClasseCompte>([
  ClasseCompte.CLASSE_1,
  ClasseCompte.CLASSE_2,
  ClasseCompte.CLASSE_3,
  ClasseCompte.CLASSE_4,
  ClasseCompte.CLASSE_5,
]);

const CLASSES_DE_GESTION = new Set<ClasseCompte>([ClasseCompte.CLASSE_6, ClasseCompte.CLASSE_7, ClasseCompte.CLASSE_8]);

/** Tolérance d'arrondi commune · en deçà, un montant est nul et un contrôle boucle. */
const EPSILON = 0.005;

/** Le format du champ de date de l'écran, le seul qu'une date d'arrêté accepte. */
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * LA DATE D'ARRÊTÉ LUE, OU REFUSÉE (audit final F220). `new Date('xyz')` rend
 * une date invalide que `motifRefusDateArrete` laissait passer, toute
 * comparaison avec NaN étant fausse, et la lecture de la balance tombait
 * ensuite en erreur 500 sur une demande qui n'était qu'illisible. Deux autres
 * formes se lisaient SANS erreur et sont refusées du même geste :
 * « 2026-02-30 », que le moteur JavaScript reporte en silence au 2 mars, et
 * « 06/30/2026 », lu à l'américaine et à l'heure locale du serveur, donc la
 * veille sur un poste réglé à Kinshasa. Seul le format AAAA-MM-JJ est admis,
 * et il doit désigner un jour qui existe.
 */
export function lireDateArrete(arreteAu: string): Date {
  const jour = FORMAT_JOUR.test(arreteAu) ? new Date(`${arreteAu}T00:00:00.000Z`) : new Date(Number.NaN);
  if (Number.isNaN(jour.getTime()) || jour.toISOString().slice(0, 10) !== arreteAu) {
    throw new BadRequestException(
      `La date d'arrêté « ${arreteAu} » n'est pas lisible · elle s'écrit AAAA-MM-JJ et désigne un jour qui existe.`,
    );
  }
  return finDeJournee(jour);
}

@Injectable()
export class EtatsFinanciersSyscohadaService {
  constructor(
    private readonly ecritureService: EcritureService,
    private readonly exerciceService: ExerciceService,
  ) {}

  // Appelée en tête des trois états · elle REFUSE un exercice inconnu du
  // dossier (NotFoundException, `etats-financiers.communs.ts`). Sans ce
  // refus, chaque état se lisait sur une balance vide et sortait tout à zéro,
  // « équilibré » (audit final F222).
  private async trouverExerciceN1(tenantId: string, exerciceId: string): Promise<string | null> {
    return trouverExerciceN1(this.exerciceService, tenantId, exerciceId);
  }

  private async chargerLignes(
    tenantId: string,
    exerciceId: string | null,
    arreteAu?: Date,
  ): Promise<LigneBalancePourEtat[]> {
    return chargerLignes(this.ecritureService, tenantId, exerciceId, arreteAu);
  }

  /**
   * LA DATE D'ARRÊTÉ D'UNE SITUATION INTERMÉDIAIRE · ch. 39.
   *
   * Rend la borne à appliquer et celle de la même période de l'exercice
   * précédent (§ 2.1.2). Refuse une date hors de l'exercice, pour la raison
   * écrite dans `situation-intermediaire.ts` : en deçà de l'ouverture, le
   * report à-nouveau sortirait de la lecture.
   */
  private async bornesSituation(
    tenantId: string,
    exerciceId: string,
    exerciceN1Id: string | null,
    arreteAu?: string,
  ): Promise<{ borneN?: Date; borneMemePeriodeN1: Date | null }> {
    if (!arreteAu) return { borneN: undefined, borneMemePeriodeN1: null };
    // Lue avant la balance et avant les dates de l'exercice · une date
    // illisible est un refus de la demande (400), pas une panne du serveur
    // (audit final F220).
    const borneN = lireDateArrete(arreteAu);
    // Les dates viennent d'ExerciceService · le service des états n'atteint
    // jamais Prisma directement, et lui ouvrir cette porte pour deux dates
    // serait un chemin de plus à borner au dossier.
    const exercices = await this.exerciceService.lister(tenantId);
    const exercice = exercices.find((e) => e.id === exerciceId);
    // Un exercice inconnu du dossier est introuvable, pas une demande mal
    // formée (audit final F222) · `trouverExerciceN1`, appelé avant, le
    // refuse déjà ; ce refus-ci tient la même réponse si l'ordre change.
    if (!exercice) {
      throw new NotFoundException(MOTIF_EXERCICE_INTROUVABLE);
    }
    const motif = motifRefusDateArrete(borneN, exercice as BornesExercice);
    if (motif) throw new BadRequestException(motif);
    const exerciceN1 = exerciceN1Id ? (exercices.find((e) => e.id === exerciceN1Id) ?? null) : null;
    return { borneN, borneMemePeriodeN1: memePeriodeExercicePrecedent(borneN, exerciceN1 as BornesExercice | null) };
  }

  // =========================================================================
  // BILAN · AUDCIF Titre IX ch. 3 section 2 (modèle, codes AD à DZ) et ch. 7
  // (correspondance postes/comptes). Voir `correspondance-bilan-syscohada.ts`.
  // =========================================================================

  /**
   * Poste d'ACTIF · brut, amortissements et dépréciations (magnitude
   * positive), net. Deux filtres, chacun tiré des clés de lecture du ch. 7 :
   * `sens_qualificatif` restreint un poste de tiers polyvalent au sens de
   * solde que le texte lui donne (BJ « soldes débiteurs ») ;
   * `comptesTransferesSiCrediteur` FAIT SORTIR du poste les comptes qu'un
   * poste de passif réclame alors (52/53 créditeurs, BS vers DR). Sans ce
   * second filtre un découvert bancaire serait compté DEUX FOIS, en négatif à
   * l'actif et en positif au passif, et le bilan serait déséquilibré du double
   * du découvert (anomalie n° 3 de la table).
   */
  private calculerPosteActif(poste: PosteBilanDeBase, lignes: LigneBalancePourEtat[]): PosteBilanCalcule {
    let lignesBrut = lignes.filter((l) => correspond(l.numero, poste.comptes, poste.exclusions));
    if (poste.sens_qualificatif === 'DEBITEUR') {
      lignesBrut = lignesBrut.filter((l) => l.solde > 0);
    }
    if (poste.comptesTransferesSiCrediteur) {
      lignesBrut = lignesBrut.filter((l) => !(correspond(l.numero, poste.comptesTransferesSiCrediteur!) && l.solde < 0));
    }
    const comptesBrut: CompteDuPoste[] = lignesBrut.map((l) => ({
      numero: l.numero,
      intitule: l.intitule,
      montant: l.solde,
    }));
    const brut = comptesBrut.reduce((s, c) => s + c.montant, 0);

    const lignesAmort = poste.comptesAmortissement
      ? lignes.filter((l) => correspond(l.numero, poste.comptesAmortissement!, poste.exclusionsAmortissement))
      : [];
    // PAS de négation sur `montant` ici : un compte d'amortissement bien formé
    // porte déjà un solde (débit − crédit) négatif, ce qui le soustrait
    // naturellement du brut par simple addition. Le signer en positif dans
    // CETTE somme l'ADDITIONNERAIT au brut au lieu de l'en déduire. La colonne
    // officielle « Amort. et déprec. », elle, veut la magnitude POSITIVE :
    // c'est `amortissement`, calculé juste en dessous, et lui seul.
    const comptesAmort: CompteDuPoste[] = lignesAmort.map((l) => ({
      numero: l.numero,
      intitule: l.intitule,
      montant: l.solde,
    }));
    // `|| 0` normalise le -0 que produit la négation d'une somme vide.
    const amortissement = -comptesAmort.reduce((s, c) => s + c.montant, 0) || 0;

    return {
      ref: poste.ref,
      libelle: poste.libelle,
      montant: brut - amortissement,
      brut,
      amortissement,
      comptes: [...comptesBrut, ...comptesAmort],
      comptesBrut,
    };
  }

  /**
   * Poste de PASSIF · solde créditeur net, dans son sens naturel de lecture
   * (pas de colonne Brut/Amort. au passif). Un compte de passif
   * structurellement DÉBITEUR ressort en négatif sans traitement spécial :
   * c'est exactement ce que le modèle attend de CB « Apporteurs capital non
   * appelé (-) », de CH « Report à nouveau (+ ou -) » et de DC, qui présente
   * la provision de retraite nette de l'actif du régime 1962 (anomalie n° 14).
   */
  private calculerPostePassif(poste: PosteBilanDeBase, lignes: LigneBalancePourEtat[]): PosteBilanCalcule {
    let matches = lignes.filter((l) => correspond(l.numero, poste.comptes, poste.exclusions));
    if (poste.sens_qualificatif === 'CREDITEUR') {
      matches = matches.filter((l) => l.solde < 0);
    }
    const comptes: CompteDuPoste[] = matches.map((l) => ({
      numero: l.numero,
      intitule: l.intitule,
      montant: -l.solde,
    }));
    const montant = comptes.reduce((s, c) => s + c.montant, 0);
    return { ref: poste.ref, libelle: poste.libelle, montant, comptes, comptesBrut: comptes };
  }

  /**
   * DR « Banques, établissements financiers et crédits de trésorerie » ·
   * traité à part parce qu'il PARTAGE ses numéros 52 et 53 avec BS, à l'actif,
   * et que seul le sens du solde les départage (ch. 7, clés de lecture : « 52,
   * 53 vont en BS si débiteurs, DR si créditeurs »). Ses comptes propres 561 et
   * 566 ne portent AUCUN qualificatif de sens : sans poste d'accueil débiteur,
   * un 561 débiteur doit rester visible en négatif ici plutôt que de
   * disparaître du bilan (anomalie n° 3, second alinéa).
   */
  private calculerDR(lignes: LigneBalancePourEtat[]): PosteBilanCalcule {
    const posteDR = POSTES_PASSIF_SYSCOHADA.find((p) => p.ref === REF_TRESORERIE_PASSIF_SYSCOHADA)!;
    const base = this.calculerPostePassif(posteDR, lignes);
    const decouverts = lignes.filter(
      (l) => correspond(l.numero, COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA) && l.solde < 0,
    );
    const comptes = [
      ...base.comptes,
      ...decouverts.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde })),
    ];
    const montant = comptes.reduce((s, c) => s + c.montant, 0);
    return { ref: base.ref, libelle: base.libelle, montant, comptes, comptesBrut: comptes };
  }

  /**
   * CJ « Résultat net de l'exercice » · n'est PAS dans `POSTES_PASSIF_SYSCOHADA`
   * parce qu'il a deux sources, qui S'ADDITIONNENT (`resultatAuBilan`, passe
   * V1, B1) · le compte 13, que le ch. 7 porte sur CJ (« 13 (131 ou 139) »)
   * et qui garde, de la réouverture à l'affectation, le résultat de
   * l'exercice PRÉCÉDENT (Titre VII COMPTE 13 · « L'affectation du résultat
   * d'un exercice est décidée par les organes compétents au cours de
   * l'exercice suivant ; le compte 13 est donc soldé lors de la
   * comptabilisation de cette affectation »), et les classes 6/7/8, que la
   * clôture y portera (« crédité, à la clôture de l'exercice, par le débit
   * des comptes de la classe 7 [...] »). Avant l'écriture qui solde les
   * comptes de gestion le 13 ne porte jamais le résultat de l'exercice en
   * cours, après elle les classes 6 à 8 sont soldées · aucun double compte.
   * Lire l'une OU l'autre perdait le résultat de N au bilan de N+1 avant
   * l'assemblée (15 288 000 au banc de la passe V1). Les deux montants sont
   * rendus au contrôle, que la clôture relit (`ecartInexpliqueDuBilan`).
   *
   * Les comptes lus après clôture sont `COMPTES_RESULTAT_SYSCOHADA` (131 à
   * 139) et non « 13 » : le 130, résultat de l'exercice PRÉCÉDENT en instance
   * d'affectation, présenterait sinon le résultat N-1 comme résultat N sur
   * toute balance arrêtée avant l'assemblée (anomalie n° 7).
   */
  private calculerCJ(lignes: LigneBalancePourEtat[]): {
    poste: PosteBilanCalcule;
    resultatClasses678: number;
    resultatCompte13: number;
  } {
    const lignes678 = lignes.filter((l) => CLASSES_DE_GESTION.has(l.classe));
    const resultatClasses678 = lignes678.reduce((s, l) => s + montantSigne(l.totalDebit, l.totalCredit), 0);

    const lignes13 = lignes.filter((l) => correspond(l.numero, COMPTES_RESULTAT_SYSCOHADA));
    const resultatCompte13 = lignes13.reduce((s, l) => s + montantSigne(l.totalDebit, l.totalCredit), 0);

    const montant = resultatAuBilan(resultatClasses678, resultatCompte13);
    const comptes = [...lignes13, ...lignes678]
      .filter((l) => Math.abs(l.solde) > EPSILON)
      .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: montantSigne(l.totalDebit, l.totalCredit) }));

    return {
      poste: {
        ref: REF_RESULTAT_SYSCOHADA,
        libelle: LIBELLE_RESULTAT_SYSCOHADA,
        montant,
        comptes,
        comptesBrut: comptes,
      },
      resultatClasses678,
      resultatCompte13,
    };
  }

  /**
   * Résout tous les postes du bilan (détail, CJ, puis totaux) pour UN jeu de
   * lignes · appelée une fois par exercice utile (N, N-1, et N-2 pour la
   * colonne N-1 du tableau de flux). `lignes: []` résout tout à zéro sans cas
   * particulier : un poste sans compte mouvementé vaut légitimement 0.
   *
   * Les totaux agrègent aussi les `comptes` de leurs composantes, ce que le
   * bilan n'imprime pas (une rubrique de totalisation n'a pas de drill-down)
   * mais dont le tableau de flux a besoin : FD lit BG, FE lit DP, ZA lit
   * BT et DT, et il faut pouvoir dire QUELS comptes portent ces variations.
   */
  private resoudreTousLesPostesBilan(lignes: LigneBalancePourEtat[]): ResolutionBilan {
    const parRef = new Map<string, PosteBilanCalcule>();
    for (const poste of POSTES_ACTIF_SYSCOHADA) {
      parRef.set(poste.ref, this.calculerPosteActif(poste, lignes));
    }
    for (const poste of POSTES_PASSIF_SYSCOHADA) {
      if (poste.ref === REF_TRESORERIE_PASSIF_SYSCOHADA) continue; // traité par calculerDR
      parRef.set(poste.ref, this.calculerPostePassif(poste, lignes));
    }
    parRef.set(REF_TRESORERIE_PASSIF_SYSCOHADA, this.calculerDR(lignes));

    const { poste: posteCJ, resultatClasses678, resultatCompte13 } = this.calculerCJ(lignes);
    parRef.set(REF_RESULTAT_SYSCOHADA, posteCJ);

    // L'ORDRE des deux tableaux de totaux garantit qu'une ref n'est jamais
    // utilisée avant d'avoir été calculée (propriété figée par le spec de la
    // table). Les colonnes Brut et Amort. ne sont additionnées que côté ACTIF :
    // le modèle du ch. 3 ne les imprime pas au passif.
    for (const total of TOTAUX_ACTIF_SYSCOHADA) {
      parRef.set(total.ref, this.calculerTotalActif(total, parRef));
    }
    for (const total of TOTAUX_PASSIF_SYSCOHADA) {
      parRef.set(total.ref, this.calculerTotalPassif(total, parRef));
    }

    return { parRef, resultatClasses678, resultatCompte13 };
  }

  /**
   * Les postes INDIVIDUELS lus sur des lignes fournies par l'appelant · la
   * consolidation (D4C ch. XII-8) les lit sur la balance CONSOLIDÉE pour ne
   * pas réécrire la correspondance postes/comptes du ch. 7. Deux tables pour
   * une même règle divergeraient au premier correctif.
   */
  resoudreBilanSurLignes(lignes: LigneBalancePourEtat[]): { resolution: ResolutionBilan; nonRattaches: CompteDuPoste[] } {
    return { resolution: this.resoudreTousLesPostesBilan(lignes), nonRattaches: this.comptesNonRattachesDuBilan(lignes) };
  }

  resoudreCompteResultatSurLignes(lignes: LigneBalancePourEtat[]): ResolutionCompteResultat {
    return this.resoudreTousLesPostesCR(lignes);
  }

  /**
   * Les postes INDIVIDUELS du tableau des flux (FA à FQ, ZA à ZH) sur des
   * lignes fournies · N avec ses mouvements, N-1 pour les variations. Même
   * raison que le bilan · le tableau consolidé réutilise la table du ch. 5
   * plutôt que d'en écrire une seconde.
   */
  resoudreFluxSurLignes(lignesN: LigneBalancePourEtat[], lignesN1: LigneBalancePourEtat[]): Map<string, number> {
    const { parRef } = this.resoudreFluxPourExercice(lignesN, lignesN1, true);
    return new Map([...parRef.entries()].map(([ref, p]) => [ref, p.montant]));
  }

  /**
   * Les mêmes flux, avec les RÉSERVES de la table (postes non déterminables)
   * · les états IFRS (tranche 3) partent de ce tableau et doivent reprendre
   * ce qu'il dit ne pas savoir, pas seulement ses montants.
   */
  resoudreFluxDetailleSurLignes(
    lignesN: LigneBalancePourEtat[],
    lignesN1: LigneBalancePourEtat[],
    // Lot 14 · l'écriture de réévaluation de l'exercice, neutralisée par sa
    // liaison comme au tableau légal (`MOTIF_REEVALUATION_LIEE`).
    reevaluations: VirementsParCompte = AUCUN_VIREMENT,
  ): { montants: Map<string, number>; reserves: string[] } {
    const { parRef, postesNonCalculables } = this.resoudreFluxPourExercice(lignesN, lignesN1, true, reevaluations);
    return {
      montants: new Map([...parRef.entries()].map(([ref, p]) => [ref, p.montant])),
      reserves: postesNonCalculables.map((x) => `${x.ref} · ${x.raison}`),
    };
  }

  private calculerTotalActif(total: TotalBilan, parRef: Map<string, PosteBilanCalcule>): PosteBilanCalcule {
    const composantes = total.deRefs.map((ref) => parRef.get(ref));
    return {
      ref: total.ref,
      libelle: total.libelle,
      montant: composantes.reduce((s, p) => s + (p?.montant ?? 0), 0),
      // `p.brut ?? p.montant` : BU (Écart de conversion-Actif) n'a pas de
      // comptes d'amortissement et n'expose donc pas de colonne Brut distincte,
      // alors qu'il entre dans BZ · son net EST son brut.
      brut: composantes.reduce((s, p) => s + (p?.brut ?? p?.montant ?? 0), 0),
      amortissement: composantes.reduce((s, p) => s + (p?.amortissement ?? 0), 0),
      comptes: composantes.flatMap((p) => p?.comptes ?? []),
      comptesBrut: composantes.flatMap((p) => p?.comptesBrut ?? []),
    };
  }

  private calculerTotalPassif(total: TotalBilan, parRef: Map<string, PosteBilanCalcule>): PosteBilanCalcule {
    const composantes = total.deRefs.map((ref) => parRef.get(ref));
    const comptes = composantes.flatMap((p) => p?.comptes ?? []);
    return {
      ref: total.ref,
      libelle: total.libelle,
      montant: composantes.reduce((s, p) => s + (p?.montant ?? 0), 0),
      comptes,
      comptesBrut: comptes,
    };
  }

  /**
   * Comptes de bilan (classes 1 à 5) qu'AUCUN poste ne capte. Ils sont
   * SIGNALÉS, jamais rattachés d'office à un poste voisin : une non-conformité
   * se déclare, elle ne se devine pas. Ce sont eux qui expliquent un bilan
   * déséquilibré, et la liste `COMPTES_BILAN_SANS_POSTE_JUSTIFIES` de la table
   * dit lesquels sont là par construction du texte (130, 186 à 188, 585, 588 ·
   * anomalies n° 4, 5 et 7).
   *
   * Calculé sur N seulement : N-1 n'est qu'un comparatif d'affichage, pas un
   * état audité par cet appel.
   */
  private comptesNonRattachesDuBilan(lignes: LigneBalancePourEtat[]): CompteDuPoste[] {
    const rattaches = new Set<string>();
    for (const poste of [...POSTES_ACTIF_SYSCOHADA, ...POSTES_PASSIF_SYSCOHADA]) {
      for (const l of lignes) {
        if (
          correspond(l.numero, poste.comptes, poste.exclusions) ||
          (poste.comptesAmortissement &&
            correspond(l.numero, poste.comptesAmortissement, poste.exclusionsAmortissement))
        ) {
          rattaches.add(l.compteId);
        }
      }
    }
    for (const l of lignes) {
      // Les découverts (52/53 créditeurs) sont déjà couverts par BS, et le
      // résultat par CJ · ni l'un ni l'autre n'est un compte orphelin.
      if (
        correspond(l.numero, COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR_SYSCOHADA) ||
        correspond(l.numero, COMPTES_RESULTAT_SYSCOHADA)
      ) {
        rattaches.add(l.compteId);
      }
    }
    return lignes
      .filter((l) => CLASSES_DE_BILAN.has(l.classe) && !rattaches.has(l.compteId))
      .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
  }

  async bilan(tenantId: string, exerciceId: string, arreteAu?: string): Promise<BilanSyscohada> {
    const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
    // Ch. 39 § 2.1.2, premier tiret · « le bilan à la fin de la période
    // intermédiaire concernée ET le bilan à la DATE DE CLÔTURE de l'exercice
    // précédent ». La colonne N-1 n'est donc PAS bornée : c'est bien la
    // clôture qu'elle doit porter, et le comparatif du modèle la sert déjà.
    const { borneN } = await this.bornesSituation(tenantId, exerciceId, exerciceN1Id, arreteAu);
    const [lignesN, lignesN1, clos, closN1, ouvertureN] = await Promise.all([
      this.chargerLignes(tenantId, exerciceId, borneN),
      this.chargerLignes(tenantId, exerciceN1Id),
      exerciceCloture(this.exerciceService, tenantId, exerciceId),
      exercicePrecedentCloture(this.exerciceService, tenantId, exerciceN1Id),
      // Paquet 1, A4 · l'ouverture lue AVANT ce que la clôture de N y porte
      // (`chargerOuverture`), seulement quand elle sert le comparatif.
      exerciceN1Id ? Promise.resolve([]) : chargerOuverture(this.ecritureService, tenantId, exerciceId, borneN),
    ]);

    // Q3 des cas chiffrés de la clôture · sans exercice N-1, le comparatif
    // est le bilan d'ouverture du dossier (AUDCIF art. 34), jamais une
    // colonne vide pour un dossier repris (`comparatifDuBilan`).
    // Bloquant 2 de la relecture du 2026-10-07 · sans exercice N-1 ni
    // report, une ouverture saisie en OD au premier jour n'est lue ni comme
    // flux ni comme ouverture, et l'ouverture présumée nulle est DITE.
    const ouverturePassee = await lireOuverturePasseeEnOd(this.ecritureService, tenantId, exerciceId, exerciceN1Id, ouvertureN);
    const comparatif = comparatifDuBilan(exerciceN1Id, lignesN1, ouvertureN, ouverturePassee, 'SYSCOHADA');
    const resolutionN = this.resoudreTousLesPostesBilan(lignesN);
    const resolutionN1 = this.resoudreTousLesPostesBilan(comparatif.lignes);

    const refsTotaux = new Set([...TOTAUX_ACTIF_SYSCOHADA, ...TOTAUX_PASSIF_SYSCOHADA].map((t) => t.ref));
    const metadonnees = new Map<string, { note?: string; renvoi?: string }>();
    for (const p of [...POSTES_ACTIF_SYSCOHADA, ...POSTES_PASSIF_SYSCOHADA]) {
      metadonnees.set(p.ref, { note: p.note, renvoi: p.renvoi });
    }
    for (const t of [...TOTAUX_ACTIF_SYSCOHADA, ...TOTAUX_PASSIF_SYSCOHADA]) {
      metadonnees.set(t.ref, { note: t.note });
    }

    const enLigne = (ref: string): LigneBilanSyscohada => {
      const n = resolutionN.parRef.get(ref)!;
      const n1 = comparatif.provenance ? resolutionN1.parRef.get(ref) : undefined;
      const estTotal = refsTotaux.has(ref);
      const meta = metadonnees.get(ref) ?? {};
      return {
        ref,
        libelle: n.libelle,
        montant: n.montant,
        montantN1: n1?.montant,
        brut: n.brut,
        amortissement: n.amortissement,
        estTotal,
        // Une rubrique de totalisation n'a pas de drill-down : ses comptes sont
        // déjà présentés sous les postes qu'elle additionne, les répéter ici
        // ferait croire à un double compte.
        comptes: estTotal ? [] : n.comptes,
        note: meta.note,
        renvoi: meta.renvoi,
      };
    };

    const actif = ORDRE_AFFICHAGE_ACTIF_SYSCOHADA.map(enLigne);
    const passif = ORDRE_AFFICHAGE_PASSIF_SYSCOHADA.map(enLigne);

    const totalActif = resolutionN.parRef.get('BZ')!.montant;
    const totalPassif = resolutionN.parRef.get('DZ')!.montant;
    const comptesNonRattaches = this.comptesNonRattachesDuBilan(lignesN);
    // CJ partagé entre l'exercice et le résultat antérieur non affecté
    // (`partsDuResultatAuBilan`) · sur un exercice CLÔTURÉ lu en entier, le
    // second est nommé (`resultatAnterieurNonVire`, relecture de la passe V1).
    const parts = partsDuResultatAuBilan(
      resolutionN.resultatClasses678,
      resolutionN.resultatCompte13,
      lignesN.filter((l) => CLASSES_DE_GESTION.has(l.classe)),
      lignesN.filter((l) => correspond(l.numero, COMPTES_RESULTAT_SYSCOHADA)),
    );
    const nonVire = borneN ? null : resultatAnterieurNonVire(clos, parts.resultatAnterieurNonAffecte, REF_RESULTAT_SYSCOHADA, 'SYSCOHADA');
    // La colonne N-1 qui reprend le même défaut de l'exercice précédent ·
    // dite, jamais recalculée (paquet 1, A1). Lue en situation aussi · la
    // colonne N-1 y porte toujours la clôture précédente (ch. 39 § 2.1.2).
    const partsN1 = partsDuResultatAuBilan(
      resolutionN1.resultatClasses678,
      resolutionN1.resultatCompte13,
      comparatif.lignes.filter((l) => CLASSES_DE_GESTION.has(l.classe)),
      comparatif.lignes.filter((l) => correspond(l.numero, COMPTES_RESULTAT_SYSCOHADA)),
    );
    const nonVireN1 = resultatAnterieurNonVireDuComparatif(
      comparatif.provenance,
      closN1,
      partsN1.resultatAnterieurNonAffecte,
      REF_RESULTAT_SYSCOHADA,
      'SYSCOHADA',
    );

    return {
      actif,
      passif,
      totalActif,
      totalPassif,
      totalActifN1: comparatif.provenance ? resolutionN1.parRef.get('BZ')!.montant : undefined,
      totalPassifN1: comparatif.provenance ? resolutionN1.parRef.get('DZ')!.montant : undefined,
      exerciceN1Disponible: exerciceN1Id !== null,
      comparatif: comparatif.provenance,
      mentionComparatif: comparatif.mention,
      // Tolérance d'arrondi ; un écart réel signale un compte non rattaché ou
      // un défaut du moteur d'écritures, pas un défaut de cette répartition.
      equilibre: Math.abs(totalActif - totalPassif) < 0.01,
      comptesNonRattaches,
      comptesASolderALaCloture: borneN ? [] : comptesASolderALaCloture(lignesN, comptesNonRattaches, nonVire),
      // Les deux sources de CJ, séparées · toutes deux non nulles, c'est la
      // situation avant l'affectation, pas un double compte (`resultatAuBilan`).
      controle: {
        resultatClasses678: resolutionN.resultatClasses678,
        resultatCompte13: resolutionN.resultatCompte13,
        resultatAnterieurNonAffecte: parts.resultatAnterieurNonAffecte,
      },
      resultatAnterieurNonVire: nonVire,
      resultatAnterieurNonVireN1: nonVireN1,
    };
  }

  // =========================================================================
  // COMPTE DE RÉSULTAT · AUDCIF Titre IX ch. 4 section 2 (modèle TA à XI,
  // colonne SIGNE, formules) et ch. 7 (correspondance postes/comptes).
  // Voir `correspondance-compte-resultat-syscohada.ts`.
  // =========================================================================

  /**
   * Résout les 33 postes de base PUIS les neuf lignes X* pour UN jeu de
   * lignes. Tous les montants suivent la convention du modèle
   * (`montantSigne` = crédit − débit, charge comprise), sans quoi les formules
   * de soldes, qui sont des SOMMES pures, seraient fausses de deux fois le
   * montant des charges.
   *
   * Les comptes d'une ligne de solde sont ceux de ses composantes, concaténés :
   * les `deRefs` du modèle sont disjoints à chaque niveau (XC lit XB, pas
   * TA à TD directement), donc aucun compte n'est compté deux fois.
   */
  private resoudreTousLesPostesCR(lignes: LigneBalancePourEtat[]): ResolutionCompteResultat {
    const comptesParRef = new Map<string, CompteDuPoste[]>();
    const comptesNonRattaches: CompteDuPoste[] = [];
    // Résultat « brut » de tous les comptes de gestion, indépendamment des
    // postes : c'est exactement la base sur laquelle le bilan calcule CJ, donc
    // le contrôle croisé entre les deux états.
    let resultatToutesClassesDeGestion = 0;

    for (const l of lignes) {
      const montant = montantSigne(l.totalDebit, l.totalCredit);
      const estCompteDeGestion = CLASSES_DE_GESTION.has(l.classe);
      if (estCompteDeGestion) resultatToutesClassesDeGestion += montant;

      const poste = posteDuCompteSyscohada(l.numero);
      if (!poste) {
        // Classes 1 à 5 (bilan) et classe 9 (« hors états de synthèse » selon
        // le ch. 7) : exclusion normale, aucun signalement. Un compte de
        // gestion sans poste, en revanche, est une non-conformité : listé.
        if (estCompteDeGestion) {
          comptesNonRattaches.push({ numero: l.numero, intitule: l.intitule, montant });
        }
        continue;
      }
      const existants = comptesParRef.get(poste.ref) ?? [];
      existants.push({ numero: l.numero, intitule: l.intitule, montant });
      comptesParRef.set(poste.ref, existants);
    }

    const montantsParRef: Record<string, number> = {};
    for (const poste of POSTES_COMPTE_RESULTAT_SYSCOHADA) {
      montantsParRef[poste.ref] = (comptesParRef.get(poste.ref) ?? []).reduce((s, c) => s + c.montant, 0);
    }
    // `calculerSoldesIntermediaires` résout XA à XI dans l'ordre du modèle,
    // chaque solde ne lisant que ce qui le précède.
    const montantsAvecSoldes = calculerSoldesIntermediaires(montantsParRef);
    for (const solde of SOLDES_INTERMEDIAIRES) {
      comptesParRef.set(
        solde.ref,
        solde.deRefs.flatMap((ref) => comptesParRef.get(ref) ?? []),
      );
    }

    return {
      montantsParRef: montantsAvecSoldes,
      comptesParRef,
      comptesNonRattaches,
      resultatToutesClassesDeGestion,
    };
  }

  private soldesNommes(montantsParRef: Record<string, number>): SoldesCompteResultatSyscohada {
    return {
      margeCommerciale: montantsParRef.XA ?? 0,
      chiffreAffaires: montantsParRef.XB ?? 0,
      valeurAjoutee: montantsParRef.XC ?? 0,
      excedentBrutExploitation: montantsParRef.XD ?? 0,
      resultatExploitation: montantsParRef.XE ?? 0,
      resultatFinancier: montantsParRef.XF ?? 0,
      resultatActivitesOrdinaires: montantsParRef.XG ?? 0,
      resultatHorsActivitesOrdinaires: montantsParRef.XH ?? 0,
      resultatNet: montantsParRef.XI ?? 0,
    };
  }

  async compteDeResultat(
    tenantId: string,
    exerciceId: string,
    arreteAu?: string,
  ): Promise<CompteResultatSyscohada> {
    const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
    // Ch. 39 § 2.1.2, deuxième tiret · le compte de résultat d'une situation
    // intermédiaire porte TROIS colonnes : « le compte de résultat cumulé du
    // début de l'exercice à la fin de la période intermédiaire, le compte de
    // résultat pour la MÊME PÉRIODE DE L'EXERCICE PRÉCÉDENT, ainsi que le
    // compte de résultat de l'exercice précédent ».
    //
    // La deuxième est celle qui donne du sens à la première : comparer un
    // semestre à une année entière ferait conclure à un effondrement là où il
    // n'y a qu'une demi-période, et c'est le genre de lecture qu'un banquier
    // fait en trente secondes.
    const { borneN, borneMemePeriodeN1 } = await this.bornesSituation(
      tenantId,
      exerciceId,
      exerciceN1Id,
      arreteAu,
    );
    const [lignesN, lignesN1, lignesMemePeriodeN1, ouvertureN] = await Promise.all([
      this.chargerLignes(tenantId, exerciceId, borneN),
      this.chargerLignes(tenantId, exerciceN1Id),
      borneMemePeriodeN1 ? this.chargerLignes(tenantId, exerciceN1Id, borneMemePeriodeN1) : Promise.resolve(null),
      // Le motif de la colonne N-1 lit l'ouverture comme le bilan (paquet 1, A4).
      exerciceN1Id ? Promise.resolve([]) : chargerOuverture(this.ecritureService, tenantId, exerciceId, borneN),
    ]);

    const resN = this.resoudreTousLesPostesCR(lignesN);
    const resN1 = this.resoudreTousLesPostesCR(lignesN1);
    const resMemePeriodeN1 = lignesMemePeriodeN1 ? this.resoudreTousLesPostesCR(lignesMemePeriodeN1) : null;

    const lignesDuModele: LigneCompteResultatSyscohada[] = ORDRE_AFFICHAGE_COMPTE_RESULTAT.map((ref) => {
      const solde = trouveSoldeIntermediaire(ref);
      const poste = solde ? undefined : trouvePosteCompteResultat(ref);
      return {
        ref,
        libelle: solde?.libelle ?? poste!.libelle,
        montant: resN.montantsParRef[ref] ?? 0,
        // Jamais un faux zéro : sans exercice antérieur la colonne N-1 du
        // modèle reste vide, elle ne vaut pas 0.
        montantN1: exerciceN1Id ? (resN1.montantsParRef[ref] ?? 0) : undefined,
        // Même règle que la colonne N-1 : jamais un faux zéro. La colonne
        // reste absente quand la période équivalente tombe hors de l'exercice
        // précédent (premier exercice court, exercice de liquidation).
        montantMemePeriodeN1: resMemePeriodeN1 ? (resMemePeriodeN1.montantsParRef[ref] ?? 0) : undefined,
        comptes: resN.comptesParRef.get(ref) ?? [],
        estSolde: solde ? true : undefined,
        supplementaire: poste?.supplementaire ? true : undefined,
        formuleOfficielle: solde?.formuleOfficielle,
        notes: solde?.notes ?? poste!.notes,
      };
    });

    // LES DEUX POSTES DU CH. 33 NE S'IMPRIMENT QUE « DÈS LORS QUE L'ENTITÉ
    // RÉALISE DE TELLES OPÉRATIONS » (section 7.2, audit final F89) · nuls en
    // N, en N-1 et sur la même période, ils sortent de l'état, à l'écran
    // comme dans la liasse, où leur clé interne partait en colonne REF. Ils
    // restent dans les soldes · masquer une ligne ne retranche aucun montant.
    const nul = (m: number | undefined) => m === undefined || Math.abs(m) < 0.005;
    const lignes = lignesDuModele.filter(
      (l) =>
        !(
          REFS_POSTES_SUPPLEMENTAIRES.includes(l.ref) &&
          nul(l.montant) &&
          nul(l.montantN1) &&
          nul(l.montantMemePeriodeN1)
        ),
    );

    // Contrôle croisé : le résultat net obtenu en additionnant les postes du
    // modèle (XI) doit être identique au résultat obtenu en soldant TOUS les
    // comptes de gestion, celui que le bilan loge en CJ. L'écart vaut
    // exactement la somme des comptes non rattachés : un compte de gestion
    // hors poste disparaît des totaux de l'état, et le compte de résultat
    // cesse alors de boucler avec le bilan. Exposé plutôt que masqué.
    const resultatNet = resN.montantsParRef.XI ?? 0;
    const ecart = resN.resultatToutesClassesDeGestion - resultatNet;

    return {
      lignes,
      soldes: this.soldesNommes(resN.montantsParRef),
      soldesN1: exerciceN1Id ? this.soldesNommes(resN1.montantsParRef) : undefined,
      soldesMemePeriodeN1: resMemePeriodeN1 ? this.soldesNommes(resMemePeriodeN1.montantsParRef) : undefined,
      exerciceN1Disponible: exerciceN1Id !== null,
      // La date jusqu'à laquelle la colonne comparative court · sans elle,
      // l'écran ne pourrait pas titrer la colonne, et une colonne dont on ne
      // sait pas ce qu'elle couvre ne se compare à rien.
      memePeriodeN1JusquAu: borneMemePeriodeN1 ? borneMemePeriodeN1.toISOString().slice(0, 10) : undefined,
      // Q3 · le compte de résultat N-1 ne se tire pas d'un bilan d'ouverture ·
      // vide, et l'issue dite.
      motifComparatifAbsent: !exerciceN1Id && ouvertureTenue(ouvertureN) ? MOTIF_RESULTAT_N1_NON_TENU : null,
      comptesNonRattaches: resN.comptesNonRattaches,
      controle: {
        resultatToutesClassesDeGestion: resN.resultatToutesClassesDeGestion,
        ecart,
        coherent: Math.abs(ecart) < 0.01,
      },
    };
  }

  // =========================================================================
  // TABLEAU DES FLUX DE TRÉSORERIE · AUDCIF Titre IX ch. 5, MÉTHODE INDIRECTE
  // (§ 1.2.1 « le point d'entrée est l'EBE, jamais le résultat net »).
  // Voir `correspondance-tft-syscohada.ts` pour le rattachement terme à terme
  // et les 24 anomalies relevées.
  //
  // Le tableau ne relit pas la balance en vrac : chaque terme désigne soit un
  // POSTE déjà résolu du bilan ou du compte de résultat (par REF, lu sur N,
  // sur N-1 ou en variation), soit un ENSEMBLE DE COMPTES que le ch. 5
  // retraite nommément. C'est ce qui garantit que le tableau et les deux
  // autres états ne peuvent pas diverger : la trésorerie de ZA et du contrôle
  // de ZH est celle du bilan, découverts bancaires déjà transférés en DR.
  // =========================================================================

  /** Solde d'une ligne pris dans un sens donné · l'autre sens compte 0, aucune compensation. */
  private soldeDansLeSens(solde: number, sens: SensSolde): number {
    return sens === 'DEBITEUR' ? Math.max(solde, 0) : Math.max(-solde, 0);
  }

  /**
   * Un poste de bilan lu par un terme, avec ses comptes. `colonne: 'BRUT'`
   * rend la colonne Brut seule (FF et FG reconstituent les acquisitions sur le
   * brut, anomalie n° 3) ; un poste de passif n'ayant pas de colonne Brut, la
   * demande y retombe sur le net, ce qui est sa seule valeur.
   */
  private lirePosteBilan(
    resolution: ResolutionBilan,
    ref: string,
    colonne?: ColonneBilan,
  ): { montant: number; comptes: CompteDuPoste[] } {
    const p = resolution.parRef.get(ref);
    if (!p) return { montant: 0, comptes: [] };
    if (colonne === 'BRUT' && p.brut !== undefined) return { montant: p.brut, comptes: p.comptesBrut };
    return { montant: p.montant, comptes: p.comptes };
  }

  /** Différence compte à compte entre deux listes · sert aux lectures en VARIATION. */
  private differenceComptes(courant: CompteDuPoste[], anterieur: CompteDuPoste[]): CompteDuPoste[] {
    const parNumero = new Map<string, CompteDuPoste>();
    for (const c of courant) {
      const existant = parNumero.get(c.numero);
      parNumero.set(c.numero, {
        numero: c.numero,
        intitule: c.intitule,
        montant: (existant?.montant ?? 0) + c.montant,
      });
    }
    for (const c of anterieur) {
      const existant = parNumero.get(c.numero);
      parNumero.set(c.numero, {
        numero: c.numero,
        intitule: existant?.intitule ?? c.intitule,
        montant: (existant?.montant ?? 0) - c.montant,
      });
    }
    return [...parNumero.values()];
  }

  /** Lecture d'un ensemble de comptes · les quatre natures de `LectureCompte`. */
  private lireComptes(terme: TermeComptes, ctx: ContexteFlux): CompteDuPoste[] {
    const retenues = ctx.lignesCourant.filter((l) => correspond(l.numero, terme.prefixes, terme.exclusions));
    if (terme.liaison === 'REEVALUATION') {
      // Lot 14 · la seule part des mouvements que porte l'écriture de
      // réévaluation du module, reconnue par sa liaison · jamais par le
      // compte, un crédit du 106 pouvant être une réévaluation passée à la
      // main (anomalies n° 11 et 21).
      return retenues
        .map((l) => {
          const m = ctx.reevaluations.get(l.compteId);
          const montant = terme.lecture === 'MOUVEMENT_DEBIT' ? (m?.debit ?? 0) : terme.lecture === 'MOUVEMENT_CREDIT' ? (m?.credit ?? 0) : 0;
          return { numero: l.numero, intitule: l.intitule, montant };
        })
        .filter((c) => Math.abs(c.montant) > EPSILON);
    }
    if (terme.lecture !== 'VARIATION_SOLDE') {
      return retenues.map((l) => {
        let montant: number;
        switch (terme.lecture) {
          case 'SOLDE_GESTION':
            montant = montantSigne(l.totalDebit, l.totalCredit);
            break;
          case 'MOUVEMENT_DEBIT':
            // Mouvements PROPRES de l'exercice, report à-nouveau exclu : sans
            // cette exclusion le report d'un compte d'immobilisation serait lu
            // comme une acquisition de l'exercice, et tout le tableau serait
            // faux dès le deuxième exercice (voir EcritureService.balance).
            montant = l.mouvementDebit;
            break;
          default:
            montant = l.mouvementCredit;
            break;
        }
        return { numero: l.numero, intitule: l.intitule, montant };
      });
    }

    // VARIATION_SOLDE · solde N moins solde N-1, chacun pris dans le sens
    // demandé. Le solde N-1 vient de la balance de l'exercice antérieur quand
    // il existe, sinon du report à-nouveau de N, qui EST cette clôture pour un
    // compte de bilan · voir `ContexteFlux.soldesAnterieurs`.
    const sens = terme.sensSolde ?? 'DEBITEUR';
    return retenues.map((l) => {
      const soldeN = this.soldeDansLeSens(l.solde, sens);
      const soldeN1 = this.soldeDansLeSens(ctx.soldesAnterieurs.get(l.numero) ?? 0, sens);
      return { numero: l.numero, intitule: l.intitule, montant: soldeN - soldeN1 };
    });
  }

  private evaluerTerme(terme: TermeFluxTresorerie, ctx: ContexteFlux): CompteDuPoste[] {
    if (terme.comptes) {
      return this.lireComptes(terme.comptes, ctx).map((c) => ({ ...c, montant: terme.signe * c.montant }));
    }
    const ref = terme.poste!;
    const lire = (bilan: ResolutionBilan, cr: ResolutionCompteResultat) =>
      ref.etat === 'BILAN'
        ? this.lirePosteBilan(bilan, ref.ref, ref.colonne)
        : { montant: cr.montantsParRef[ref.ref] ?? 0, comptes: cr.comptesParRef.get(ref.ref) ?? [] };

    const courant = lire(ctx.bilanCourant, ctx.crCourant);
    if (ref.lecture === 'N') {
      return courant.comptes.map((c) => ({ ...c, montant: terme.signe * c.montant }));
    }
    const anterieur = lire(ctx.bilanAnterieur, ctx.crAnterieur);
    const comptes =
      ref.lecture === 'N1' ? anterieur.comptes : this.differenceComptes(courant.comptes, anterieur.comptes);
    return comptes.map((c) => ({ ...c, montant: terme.signe * c.montant }));
  }

  /**
   * Un poste exige-t-il le COMPTE DE RÉSULTAT d'un exercice antérieur tenu ?
   *
   * Les postes de BILAN lus sur N-1 ou en variation (`besoinsDuPoste`) ne
   * l'exigent plus (cas chiffrés de la clôture, B1, N1 et Q3, 2026-10-07) ·
   * sans exercice N-1 tenu, leurs positions N-1 se lisent sur l'OUVERTURE de
   * N, qui est le bilan de clôture N-1 par l'AUDCIF art. 34, et qui est nulle
   * pour une société qui naît (ZA « Trésorerie actif N-1 – Trésorerie passif
   * N-1 » vaut zéro). Les laisser vides rendait le tableau du premier
   * exercice incohérent (ZH par les flux contre ZH par le bilan) et celui
   * d'un dossier repris faux de toute sa trésorerie d'ouverture.
   *
   * Un compte de résultat, lui, ne se tire pas d'un bilan. Aucun terme du
   * modèle ne le lit autrement que sur N ; la garde reste pour qu'un terme
   * ajouté demain produise un signalement plutôt qu'un faux zéro silencieux.
   */
  /**
   * Un poste lit-il l'ouverture (bilan N-1, soldes antérieurs) ou les
   * mouvements de l'exercice ? Une ouverture saisie en OD au premier jour se
   * trouve dans les MOUVEMENTS (bloquant 2 de la relecture du 2026-10-07) ·
   * un tel poste ne se chiffre pas tant que sa nature n'est pas dite.
   */
  private litLOuvertureOuLesMouvements(poste: PosteFluxTresorerieSyscohada): boolean {
    const b = besoinsDuPoste(poste);
    return b.exerciceN1 || b.soldesAnterieurs || b.mouvements || this.exigeCompteDeResultatAnterieur(poste);
  }

  private exigeCompteDeResultatAnterieur(poste: PosteFluxTresorerieSyscohada): boolean {
    return poste.termes.some((t) => t.poste?.etat === 'COMPTE_RESULTAT' && t.poste.lecture !== 'N');
  }

  /**
   * Un poste de flux, tous ses termes appliqués. Les comptes sont agrégés par
   * numéro : un même compte peut entrer plusieurs fois dans un poste avec des
   * signes opposés (FA lit XD, qui contient le 654 par RJ, puis retire ce même
   * 654 comme le § 1.2.1.1 l'ordonne), et le drill-down doit montrer la
   * contribution NETTE, pas deux lignes qui s'annulent.
   */
  private calculerPosteFlux(
    poste: PosteFluxTresorerieSyscohada,
    ctx: ContexteFlux,
  ): { montant: number; comptes: CompteDuPoste[] } {
    const parNumero = new Map<string, CompteDuPoste>();
    for (const terme of poste.termes) {
      for (const c of this.evaluerTerme(terme, ctx)) {
        const existant = parNumero.get(c.numero);
        parNumero.set(c.numero, {
          numero: c.numero,
          intitule: existant?.intitule ?? c.intitule,
          montant: (existant?.montant ?? 0) + c.montant,
        });
      }
    }
    const comptes = [...parNumero.values()]
      .filter((c) => Math.abs(c.montant) > EPSILON)
      .sort((a, b) => a.numero.localeCompare(b.numero));
    // `|| 0` normalise le -0 d'une somme de termes qui s'annulent.
    const montant = [...parNumero.values()].reduce((s, c) => s + c.montant, 0) || 0;
    return { montant, comptes };
  }

  /**
   * Refs de POSTES DE BASE du bilan couvertes par une ref, en développant les
   * rubriques de totalisation (BG donne BH, BI, BJ ; BT donne BQ, BR, BS).
   * Sert à savoir quels comptes un terme lisant un poste par REF a déjà
   * ventilés, donc lesquels restent orphelins.
   */
  private refsDeBaseDuBilan(ref: string): string[] {
    const total = [...TOTAUX_ACTIF_SYSCOHADA, ...TOTAUX_PASSIF_SYSCOHADA].find((t) => t.ref === ref);
    if (!total) return [ref];
    return total.deRefs.flatMap((r) => this.refsDeBaseDuBilan(r));
  }

  /**
   * Comptes de bilan MOUVEMENTÉS que le tableau ne ventile nulle part · même
   * discipline qu'au bilan et au compte de résultat. Ce sont eux qui
   * expliquent un écart de bouclage : les lister à côté de l'écart donne la
   * cause avec le montant, plutôt qu'un chiffre orphelin.
   *
   * Restreint aux classes 1 à 5. Un compte de gestion ne déplace jamais la
   * trésorerie par lui-même, c'est sa contrepartie de bilan qui le fait ; et
   * les deux listes de la table qui nomment les causes connues d'écart
   * (`COMPTES_TFT_NON_VENTILES_JUSTIFIES`, `COMPTES_EXCLUS_SANS_REPRISE`) sont
   * intégralement des comptes de bilan.
   *
   * Deux retraits, chacun pour ne pas apprendre au lecteur à ignorer le bloc :
   * les comptes SANS TRÉSORERIE par construction (dépréciations, provisions
   * réglementées, soldes intermédiaires 132 à 138), couverts autrement, et
   * les comptes non mouvementés de l'exercice. Un ajout, en revanche :
   * `COMPTES_EXCLUS_SANS_REPRISE` (4726, 4751, 4752) est bien CITÉ par un
   * terme, donc « ventilé » au sens mécanique, mais retiré de FD ou FE sans
   * être repris ailleurs · la table demande explicitement de le nommer à côté
   * de l'écart, et le 4726 EST cet écart (anomalie n° 7).
   */
  private comptesNonVentiles(lignes: LigneBalancePourEtat[]): CompteDuPoste[] {
    const ventiles = new Set<string>();
    const refsBilanLues = new Set<string>();

    for (const poste of TOUS_LES_POSTES_FLUX_SYSCOHADA) {
      for (const terme of poste.termes) {
        if (terme.comptes) {
          for (const l of lignes) {
            if (correspond(l.numero, terme.comptes.prefixes, terme.comptes.exclusions)) ventiles.add(l.compteId);
          }
        } else if (terme.poste?.etat === 'BILAN') {
          refsBilanLues.add(terme.poste.ref);
        }
      }
    }
    // Le contrôle de ZH lit BT et DT : ce qu'il couvre est ventilé lui aussi.
    for (const terme of CONTROLE_ZH_PAR_LE_BILAN) {
      if (terme.poste?.etat === 'BILAN') refsBilanLues.add(terme.poste.ref);
    }

    const refsDeBase = new Set([...refsBilanLues].flatMap((ref) => this.refsDeBaseDuBilan(ref)));
    for (const poste of [...POSTES_ACTIF_SYSCOHADA, ...POSTES_PASSIF_SYSCOHADA]) {
      if (!refsDeBase.has(poste.ref)) continue;
      for (const l of lignes) {
        if (
          correspond(l.numero, poste.comptes, poste.exclusions) ||
          (poste.comptesAmortissement &&
            correspond(l.numero, poste.comptesAmortissement, poste.exclusionsAmortissement))
        ) {
          ventiles.add(l.compteId);
        }
      }
    }
    // DR reçoit les 52/53 créditeurs, qui portent les mêmes numéros que BS :
    // déjà couverts par BS, rien à ajouter, mais la symétrie est notée pour
    // qu'un lecteur ne les croie pas oubliés.

    const mouvemente = (l: LigneBalancePourEtat) =>
      Math.abs(l.mouvementDebit) > EPSILON || Math.abs(l.mouvementCredit) > EPSILON;

    const nonVentiles = lignes
      .filter((l) => CLASSES_DE_BILAN.has(l.classe))
      .filter((l) => !ventiles.has(l.compteId))
      .filter((l) => !COMPTES_SANS_TRESORERIE_SYSCOHADA.some((c) => l.numero.startsWith(c.prefixe)))
      .filter(mouvemente);

    const dejaListes = new Set(nonVentiles.map((l) => l.compteId));
    const exclusSansReprise = lignes
      .filter((l) => !dejaListes.has(l.compteId))
      .filter((l) => COMPTES_EXCLUS_SANS_REPRISE.some((c) => l.numero.startsWith(c.prefixe)))
      .filter(mouvemente);

    return [...nonVentiles, ...exclusSansReprise]
      .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }))
      .sort((a, b) => a.numero.localeCompare(b.numero));
  }

  /**
   * Résout tout le tableau pour UN exercice, à partir de ses propres lignes et
   * de celles de l'exercice qui le précède. Isolé pour être appelé DEUX FOIS :
   * une fois pour l'exercice demandé (colonne N), une fois pour son propre
   * exercice antérieur (colonne N-1 du modèle) · chaque ligne du tableau étant
   * elle-même une comparaison entre deux exercices, la colonne N-1 exige un
   * TROISIÈME exercice en arrière-plan, exactement comme la colonne N exige
   * N-1.
   */
  private resoudreFluxPourExercice(
    lignesCourant: LigneBalancePourEtat[],
    lignesAnterieur: LigneBalancePourEtat[],
    exerciceAnterieurDisponible: boolean,
    reevaluations: VirementsParCompte = AUCUN_VIREMENT,
    // Bloquant 2 de la relecture du 2026-10-07 · une ouverture saisie en OD
    // au premier jour, sans exercice précédent ni report · ni flux ni
    // ouverture, les postes qui lisent l'une ou l'autre restent vides.
    motifOuvertureIncertaine: string | null = null,
  ): {
    parRef: Map<string, { libelle: string; montant: number; comptes: CompteDuPoste[] }>;
    postesNonCalculables: PosteNonCalculable[];
    /** Postes laissés vides, et les totaux qui en dépendent (audit final F14). */
    nonCalcules: Set<string>;
    ctx: ContexteFlux;
  } {
    // Le solde N-1 d'un compte · la balance de l'exercice antérieur, sinon
    // l'OUVERTURE que l'appelant passe (`chargerOuverture`, solde = report),
    // jamais le report de `lignesCourant` · sur un exercice clôturé, celui-ci
    // porte aussi le virement du résultat antérieur non affecté (paquet 1, A4).
    const soldesAnterieurs = new Map<string, number>();
    for (const l of lignesAnterieur) soldesAnterieurs.set(l.numero, l.solde);

    const ctx: ContexteFlux = {
      bilanCourant: this.resoudreTousLesPostesBilan(lignesCourant),
      bilanAnterieur: this.resoudreTousLesPostesBilan(lignesAnterieur),
      crCourant: this.resoudreTousLesPostesCR(lignesCourant),
      crAnterieur: this.resoudreTousLesPostesCR(lignesAnterieur),
      lignesCourant,
      soldesAnterieurs,
      exerciceAnterieurDisponible,
      reevaluations,
    };

    const parRef = new Map<string, { libelle: string; montant: number; comptes: CompteDuPoste[] }>();
    const postesNonCalculables: PosteNonCalculable[] = [];
    const nonCalcules = new Set<string>();

    for (const poste of TOUS_LES_POSTES_FLUX_SYSCOHADA) {
      if (motifOuvertureIncertaine && this.litLOuvertureOuLesMouvements(poste)) {
        parRef.set(poste.ref, { libelle: poste.libelle, montant: 0, comptes: [] });
        nonCalcules.add(poste.ref);
        postesNonCalculables.push({ ref: poste.ref, raison: motifOuvertureIncertaine });
        continue;
      }
      if (!exerciceAnterieurDisponible && this.exigeCompteDeResultatAnterieur(poste)) {
        // Poste laissé VIDE, et dit vide · un compte de résultat N-1 ne se
        // tire pas du bilan d'ouverture (voir `exigeCompteDeResultatAnterieur`).
        // Les positions de BILAN N-1, elles, sont celles de l'ouverture
        // (`lignesAnterieur`, cas chiffrés de la clôture, B1 et N1).
        parRef.set(poste.ref, { libelle: poste.libelle, montant: 0, comptes: [] });
        nonCalcules.add(poste.ref);
        postesNonCalculables.push({
          ref: poste.ref,
          raison:
            "Aucun exercice antérieur tenu dans le dossier : ce poste lit le compte de résultat de l'exercice " +
            "N-1, qui ne se tire pas du bilan d'ouverture. Poste laissé vide, non chiffré à zéro.",
        });
        continue;
      }
      const { montant, comptes } = this.calculerPosteFlux(poste, ctx);
      parRef.set(poste.ref, { libelle: poste.libelle, montant, comptes });

      // Réserves permanentes de la table (`nonDeterminables`) : signalées
      // SEULEMENT quand les comptes visés sont effectivement mouvementés, sinon
      // le bloc se remplirait de réserves sans objet à chaque exercice et
      // cesserait d'être lu.
      // Lot 14 · le mouvement que porte l'écriture de réévaluation du module,
      // reconnue par sa liaison, est neutralisé par les termes liés · il ne
      // fait plus naître les réserves qui ne valent que pour une réévaluation
      // passée à la main (anomalies n° 11 et 21). Le reste du mouvement
      // (une dotation au 28, un 106 passé à la main) les fait toujours naître.
      for (const nd of poste.nonDeterminables ?? []) {
        const mouvementHorsModule = (comptes: string[], sens?: 'DEBIT' | 'CREDIT') =>
          lignesCourant.some((l) => {
            if (!correspond(l.numero, comptes)) return false;
            const lie = ctx.reevaluations.get(l.compteId);
            const debit = Math.abs(l.mouvementDebit - (lie?.debit ?? 0)) > EPSILON;
            const credit = Math.abs(l.mouvementCredit - (lie?.credit ?? 0)) > EPSILON;
            return sens === 'DEBIT' ? debit : sens === 'CREDIT' ? credit : debit || credit;
          });
        // Constat N2 des cas chiffrés de la clôture · un déclencheur déclaré
        // s'ajoute au mouvement des comptes, il ne le remplace pas.
        const concerne =
          mouvementHorsModule(nd.comptes) && (!nd.declencheur || mouvementHorsModule(nd.declencheur.comptes, nd.declencheur.sens));
        if (concerne) postesNonCalculables.push({ ref: poste.ref, raison: nd.motif });
      }
    }

    // Totaux : toutes des SOMMES de refs déjà résolues (« somme FA à FE »,
    // « D + E », « G + A »), dans un ordre que le spec de la table verrouille.
    for (const total of TOTAUX_FLUX_SYSCOHADA) {
      parRef.set(total.ref, {
        libelle: total.libelle,
        montant: total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0),
        comptes: [],
      });
      // Un total d'un poste laissé vide est vide lui aussi · l'additionner
      // comme zéro rendrait un total plausible et faux.
      if (total.deRefs.some((ref) => nonCalcules.has(ref))) nonCalcules.add(total.ref);
    }

    return { parRef, postesNonCalculables, nonCalcules, ctx };
  }

  async tableauFluxTresorerie(
    tenantId: string,
    exerciceId: string,
    arreteAu?: string,
  ): Promise<TableauFluxTresorerieSyscohada> {
    const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
    const exerciceN2Id = exerciceN1Id ? await this.trouverExerciceN1(tenantId, exerciceN1Id) : null;
    // Ch. 39 § 2.1.2, quatrième tiret · « un tableau des flux de trésorerie
    // CUMULÉS du début de l'exercice à la fin de la période intermédiaire,
    // ainsi que le tableau des flux de l'exercice précédent ».
    //
    // Seule la colonne N est bornée, et le cumul se fait tout seul : le
    // tableau se calcule par différence entre la situation à la borne et la
    // CLÔTURE de l'exercice précédent, qui est l'ouverture du courant. La
    // colonne N-1, elle, reste l'exercice précédent ENTIER, comme le tiret le
    // demande.
    const { borneN } = await this.bornesSituation(tenantId, exerciceId, exerciceN1Id, arreteAu);
    const [lignesN, lignesN1, lignesN2, reevaluationsN, reevaluationsN1] = await Promise.all([
      this.chargerLignes(tenantId, exerciceId, borneN),
      this.chargerLignes(tenantId, exerciceN1Id),
      this.chargerLignes(tenantId, exerciceN2Id),
      // Lot 14 · l'écriture de réévaluation de CHAQUE colonne, bornée comme
      // ses lignes (une situation arrêtée avant la clôture ne la contient pas).
      this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceId, borneN),
      this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceN1Id),
    ]);

    // POSITIONS N-1 · la clôture de l'exercice précédent quand il est tenu,
    // sinon l'OUVERTURE de l'exercice, qui est cette clôture (AUDCIF art. 34 ;
    // cas chiffrés de la clôture, B1, N1 et Q3) · bilan d'ouverture importé
    // d'un dossier repris, ou rien du tout pour une société qui naît, dont
    // la trésorerie d'ouverture (ZA) est nulle.
    // Bloquant 2 de la relecture du 2026-10-07 · une ouverture saisie en OD
    // au premier jour, sans exercice précédent ni report, n'est lue ni comme
    // flux ni comme ouverture ; sans elle, l'ouverture présumée nulle est
    // DITE. Même règle pour la colonne N-1 quand N-2 manque.
    // Un exercice précédent ouvert SANS ÉCRITURE ne tient aucune clôture ·
    // ses positions, nulles, ne remplacent pas l'ouverture de l'exercice
    // (`exercicePrecedentTenu`, relecture de la passe V1).
    const n1Tenu = exercicePrecedentTenu(exerciceN1Id, lignesN1);
    const n2Tenu = exercicePrecedentTenu(exerciceN2Id, lignesN2);
    // L'OUVERTURE se lit AVANT ce que la clôture de l'exercice y porte
    // (`chargerOuverture`, paquet 1, A4) · la colonne report d'un exercice
    // clôturé porte aussi le virement du résultat antérieur non affecté.
    const [ouvertureN, ouvertureN1] = await Promise.all([
      n1Tenu ? Promise.resolve([]) : chargerOuverture(this.ecritureService, tenantId, exerciceId, borneN),
      exerciceN1Id && !n2Tenu ? chargerOuverture(this.ecritureService, tenantId, exerciceN1Id) : Promise.resolve([]),
    ]);
    const [ouverturePasseeN, ouverturePasseeN1] = await Promise.all([
      lireOuverturePasseeEnOd(this.ecritureService, tenantId, exerciceId, n1Tenu ? exerciceN1Id : null, ouvertureN),
      exerciceN1Id
        ? lireOuverturePasseeEnOd(this.ecritureService, tenantId, exerciceN1Id, n2Tenu ? exerciceN2Id : null, ouvertureN1)
        : Promise.resolve(null),
    ]);
    const resN = this.resoudreFluxPourExercice(
      lignesN,
      n1Tenu ? lignesN1 : ouvertureN,
      n1Tenu,
      reevaluationsN,
      ouverturePasseeN ? motifOuverturePasseeEnOd(ouverturePasseeN, 'SYSCOHADA') : null,
    );
    // Colonne N-1 seulement si l'exercice existe · jamais un faux zéro pour un
    // dossier à son premier exercice (même discipline que partout ailleurs).
    // Ses propres positions N-1 suivent la même règle (N-2, sinon l'ouverture
    // de N-1).
    const resN1 = exerciceN1Id
      ? this.resoudreFluxPourExercice(
          lignesN1,
          n2Tenu ? lignesN2 : ouvertureN1,
          n2Tenu,
          reevaluationsN1,
          ouverturePasseeN1 ? motifOuverturePasseeEnOd(ouverturePasseeN1, 'SYSCOHADA') : null,
        )
      : null;

    const refsTotaux = new Map(TOTAUX_FLUX_SYSCOHADA.map((t) => [t.ref, t]));
    const lignes: Array<LigneFluxSyscohada | SectionFluxSyscohada> = ORDRE_AFFICHAGE_FLUX_SYSCOHADA.map((entree) => {
      if ('section' in entree) return { section: entree.section };
      const ligne = resN.parRef.get(entree.ref)!;
      const total = refsTotaux.get(entree.ref);
      return {
        ref: entree.ref,
        libelle: ligne.libelle,
        montant: ligne.montant,
        // JAMAIS UN FAUX ZÉRO EN N-1 (audit final F14) · sans N-2, les postes
        // qui exigent l'exercice antérieur et leurs totaux restent vides, et
        // leurs motifs sont rendus (`postesNonCalculablesN1`).
        montantN1: resN1 && !resN1.nonCalcules.has(entree.ref) ? resN1.parRef.get(entree.ref)?.montant : undefined,
        comptes: ligne.comptes,
        estTotal: total !== undefined,
        // ZA porte la clé A sans être un total : elle est portée par le poste
        // d'ouverture lui-même dans le modèle. Elle est rendue ici pour que la
        // colonne de droite du modèle soit complète.
        repere: entree.ref === 'ZA' ? 'A' : total?.cle,
      };
    });

    // ZH calculé DEUX FOIS, comme le modèle l'exige (« ZH Trésorerie nette au
    // 31 Décembre (G + A) · Contrôle : Trésorerie actif N – Trésorerie passif
    // N »). Le montant présenté est celui du CUMUL DES FLUX, qui est ce que le
    // tableau démontre ; la lecture directe du bilan (BT − DT) est un contrôle
    // indépendant. Un écart n'est PAS corrigé : il chiffre exactement ce que la
    // ventilation FA à FQ ne couvre pas, et `comptesNonVentiles` en nomme la
    // cause avec son montant.
    const tresorerieClotureParFlux = resN.parRef.get('ZH')!.montant;
    const tresorerieClotureParBilan = CONTROLE_ZH_PAR_LE_BILAN.reduce(
      (s, terme) => s + this.evaluerTerme(terme, resN.ctx).reduce((t, c) => t + c.montant, 0),
      0,
    );
    const ecart = tresorerieClotureParFlux - tresorerieClotureParBilan;

    return {
      lignes,
      exerciceN1Disponible: exerciceN1Id !== null,
      // Calculés sur N seulement : N-1 n'est qu'un comparatif d'affichage, pas
      // un état audité par cet appel (même convention que `bilan()`).
      comptesNonVentiles: this.comptesNonVentiles(lignesN),
      comptesTropAgreges: lignesN
        .filter((l) => /^[1-8]/.test(l.numero))
        .filter((l) => Math.abs(l.solde) > EPSILON || Math.abs(l.mouvementDebit) > EPSILON || Math.abs(l.mouvementCredit) > EPSILON)
        .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde, subdivisions: subdivisionsLuesParLeTft(l.numero) }))
        .filter((c) => c.subdivisions.length > 0),
      postesNonCalculables: resN.postesNonCalculables,
      postesVides: [...resN.nonCalcules],
      // D'où viennent les positions d'ouverture quand l'exercice précédent
      // n'est pas tenu · le report (dossier repris), rien (présumée nulle,
      // dit), ou une OD du premier jour (motif, postes vides).
      mentionOuverture: n1Tenu
        ? null
        : exerciceN1Id && !ouverturePasseeN
          ? mentionExercicePrecedentVide('SYSCOHADA', ouvertureTenue(ouvertureN))
          : ouverturePasseeN
          ? motifOuverturePasseeEnOd(ouverturePasseeN, 'SYSCOHADA')
          : ouvertureTenue(ouvertureN)
            ? mentionComparatifSurOuverture('SYSCOHADA')
            : mentionOuverturePresumeeNulle('SYSCOHADA'),
      postesNonCalculablesN1: resN1?.postesNonCalculables ?? [],
      controle: {
        tresorerieOuverture: resN.parRef.get('ZA')!.montant,
        variation: resN.parRef.get('ZG')!.montant,
        tresorerieClotureParFlux,
        tresorerieClotureParBilan,
        ecart,
        coherent: Math.abs(ecart) < 0.01,
      },
    };
  }
}
