import { FonctionMetier, RoleUtilisateur } from '@prisma/client';

/**
 * PROFIL DE FONCTIONS (point 15 de la comparaison Sage i7).
 *
 * Les manuels i7 du corpus ne décrivent que l'« autorisation d'accès » par
 * mot de passe de fichier. Le découpage fonction par fonction vient du
 * support Sage X3 (skill sage-i7, paie-et-x3.md · « Profils fonctions
 * (quelles fonctions/menus accessibles) »). OmegaX en retient la partie qui
 * s'accorde avec ses rôles, et rien de plus.
 *
 * TROIS RÈGLES, ET CHACUNE EMPÊCHE UN DÉFAUT PRÉCIS.
 *  1. LE PROFIL RESTREINT, IL N'ÉLARGIT JAMAIS · il se lit APRÈS le rôle
 *     (RolesGuard, rôles cantonnés). Un aide-comptable à qui l'on coche
 *     « Validation » ne valide pas pour autant.
 *  2. IL PORTE SUR CE QUI ÉCRIT · POST, PUT, PATCH et DELETE. Les écrans
 *     lisent les comptes, les journaux, les tiers pour s'afficher ; fermer
 *     leurs lectures casserait la saisie elle-même. La confidentialité d'une
 *     DONNÉE (le personnel) relève du rôle cantonné, pas du profil.
 *  3. L'ADMINISTRATEUR N'EST JAMAIS RESTREINT · c'est lui qui lève la
 *     restriction, et un administrateur restreint verrouillerait le dossier.
 *
 * LA TABLE EST PAR CONTRÔLEUR, pas par URL · un chemin se renomme sans que
 * personne pense à cette table, une classe non rangée fait tomber
 * `fonctions-metier.spec.ts`, qui relit les sources.
 */

export const LIBELLES_FONCTION: Record<FonctionMetier, string> = {
  STRUCTURE: 'Structure · plan comptable, journaux, taxes, devises, paramètres',
  TIERS: 'Tiers et modèles de règlement',
  SAISIE: 'Saisie et correction des écritures, régularisations, import',
  VALIDATION: 'Validation des écritures',
  LETTRAGE: 'Lettrage',
  TRESORERIE: 'Rapprochement bancaire et règlements',
  RELANCES: 'Rappels, relevés et courriers',
  IMMOBILISATIONS: 'Immobilisations',
  STOCKS: 'Stocks, magasin et emballages',
  ANALYTIQUE: 'Analytique, bailleurs et donateurs',
  FISCALITE: 'Fiscalité, TVA et exonérations',
  GESTION_COMMERCIALE: 'Facturation et devis',
  PAIE: 'Personnel et paie',
  CLOTURE: "Fin d'exercice, affectation, notes et documents obligatoires",
  REVISION: 'Révision · inventaire, circularisation, provisions, faiblesses',
  GROUPE_ET_IFRS: 'Groupe, consolidation et IFRS',
};

/** La fonction de chaque contrôleur qui écrit. */
export const FONCTION_PAR_CONTROLEUR: Record<string, FonctionMetier> = {
  CompteController: FonctionMetier.STRUCTURE,
  NaturesCompteController: FonctionMetier.STRUCTURE,
  JournalController: FonctionMetier.STRUCTURE,
  TauxTvaController: FonctionMetier.STRUCTURE,
  DevisesController: FonctionMetier.STRUCTURE,
  ModeleSaisieController: FonctionMetier.STRUCTURE,
  SequencesSaisieController: FonctionMetier.STRUCTURE,
  ModesReglementController: FonctionMetier.STRUCTURE,
  ModelesImpressionController: FonctionMetier.STRUCTURE,
  BanquesController: FonctionMetier.STRUCTURE,
  // Ligne sage-l3, fonction 46 · conditions, autorisations et unions des comptes bancaires.
  ConditionsBancairesController: FonctionMetier.STRUCTURE,
  TauxReferenceController: FonctionMetier.STRUCTURE,
  EtatsPersonnalisesController: FonctionMetier.REVISION,
  SimulationsController: FonctionMetier.REVISION,
  TenantController: FonctionMetier.STRUCTURE,
  AccordCadreController: FonctionMetier.STRUCTURE,
  TiersController: FonctionMetier.TIERS,
  ModeleReglementController: FonctionMetier.TIERS,
  DocumentsTiersController: FonctionMetier.TIERS,
  // Ligne sage-l6, fonction 22 · chaque pièce jointe suit la fonction de son objet.
  PiecesJointesEcritureController: FonctionMetier.SAISIE,
  PiecesJointesSectionController: FonctionMetier.ANALYTIQUE,
  PiecesJointesImmobilisationController: FonctionMetier.IMMOBILISATIONS,
  PiecesJointesSalarieController: FonctionMetier.PAIE,
  RibsTiersController: FonctionMetier.TIERS,
  LieuxLivraisonController: FonctionMetier.TIERS,
  EcritureController: FonctionMetier.SAISIE,
  // Ligne microfina-m1 · le visa précède la validation, il en suit la fonction ·
  // un profil sans « Validation » ne vise pas plus qu'il ne valide.
  CircuitVisaController: FonctionMetier.VALIDATION,
  // Ligne gl-saisie, fonction 64 · revoir une écriture est un geste de révision.
  RevueEcrituresController: FonctionMetier.REVISION,
  RegularisationController: FonctionMetier.SAISIE,
  OperationSpecifiqueController: FonctionMetier.SAISIE,
  ImportController: FonctionMetier.SAISIE,
  // Ligne sage-l7, fonction 99 · l'export des écritures, pendant de l'import.
  ExportModificationsController: FonctionMetier.SAISIE,
  LettrageController: FonctionMetier.LETTRAGE,
  RapprochementController: FonctionMetier.TRESORERIE,
  ReglementsController: FonctionMetier.TRESORERIE,
  VirementsFondsController: FonctionMetier.TRESORERIE,
  // Ligne sage-l3, fonction 40 · remises de chèques et de cartes.
  RemisesController: FonctionMetier.TRESORERIE,
  // Ligne sage-l3, fonction 39 · effets de commerce.
  EffetsController: FonctionMetier.TRESORERIE,
  OperationsTresorerieController: FonctionMetier.TRESORERIE,
  TitresPlacementController: FonctionMetier.TRESORERIE,
  OrdresVirementController: FonctionMetier.TRESORERIE,
  // Ligne gl-saisie, fonction 35 · l'avis de règlement suit l'ordre qu'il annonce.
  EnvoiAvisReglementController: FonctionMetier.TRESORERIE,
  LotsVirementController: FonctionMetier.TRESORERIE,
  // Ligne microfina-m2 · arrêté de caisse et registre des chèques émis.
  ArretesCaisseController: FonctionMetier.TRESORERIE,
  ChequesController: FonctionMetier.TRESORERIE,
  // L'imputation déclarée d'un paiement (Code civil, Livre III, art. 151 et
  // 153) · elle dit quelle facture le règlement paie.
  ImputationsPaiementsController: FonctionMetier.TRESORERIE,
  RelancesController: FonctionMetier.RELANCES,
  CourrierController: FonctionMetier.RELANCES,
  ImmobilisationController: FonctionMetier.IMMOBILISATIONS,
  DegressifController: FonctionMetier.IMMOBILISATIONS,
  LocationAcquisitionController: FonctionMetier.IMMOBILISATIONS,
  RepriseSubventionController: FonctionMetier.IMMOBILISATIONS,
  SubventionRattacheeController: FonctionMetier.IMMOBILISATIONS,
  ReevaluationBilanController: FonctionMetier.IMMOBILISATIONS,
  DemantelementController: FonctionMetier.IMMOBILISATIONS,
  AnnulationTraitementController: FonctionMetier.IMMOBILISATIONS,
  FicheImmobilisationController: FonctionMetier.IMMOBILISATIONS,
  CreationDepuisEcrituresController: FonctionMetier.IMMOBILISATIONS,
  MaintenanceImmobilisationsController: FonctionMetier.IMMOBILISATIONS,
  TransfertGroupeController: FonctionMetier.IMMOBILISATIONS,
  // Ligne Microfina M4 · le détenteur d'un bien.
  DetentionBienController: FonctionMetier.IMMOBILISATIONS,
  // Reclassement, dépréciation, perte · des régularisations du compte client.
  CreancesDouteusesController: FonctionMetier.SAISIE,
  StockController: FonctionMetier.STOCKS,
  MagasinController: FonctionMetier.STOCKS,
  EmballagesController: FonctionMetier.STOCKS,
  AnalytiqueController: FonctionMetier.ANALYTIQUE,
  // Ligne microfina-m2 · le bon de commande engage le budget (SYCEBNL, Application 22).
  BonsCommandeController: FonctionMetier.ANALYTIQUE,
  ComptabiliteGestionController: FonctionMetier.ANALYTIQUE,
  BailleurController: FonctionMetier.ANALYTIQUE,
  ConventionFinancementController: FonctionMetier.ANALYTIQUE,
  DonationController: FonctionMetier.ANALYTIQUE,
  FiscaliteController: FonctionMetier.FISCALITE,
  ExonerationsController: FonctionMetier.FISCALITE,
  FacturationController: FonctionMetier.GESTION_COMMERCIALE,
  CommercialController: FonctionMetier.GESTION_COMMERCIALE,
  // Ligne commercial-l8 · articles, tarifs et pièces de la gestion commerciale.
  ArticlesCommerciauxController: FonctionMetier.GESTION_COMMERCIALE,
  PersonnelController: FonctionMetier.PAIE,
  AvancesRubriquesController: FonctionMetier.PAIE,
  BaremesPaieController: FonctionMetier.PAIE,
  // Ligne sage-l5 · le compteur des congés, du registre du personnel.
  CongesController: FonctionMetier.PAIE,
  AbsencesController: FonctionMetier.PAIE,
  MajorationsHeuresController: FonctionMetier.PAIE,
  FeuillesTempsController: FonctionMetier.PAIE,
  // Ligne microfina-m3, idée 3 · ordres et frais de mission, du registre du personnel.
  MissionsController: FonctionMetier.PAIE,
  // Ligne microfina-m3, lot 2 · demandes de congé, échéancier, formation, main-d'œuvre.
  SuiviPersonnelController: FonctionMetier.PAIE,
  BilanSocialController: FonctionMetier.PAIE,
  // Ligne sage-l5 · le paiement du salarié et des salaires, de la fenêtre Personnel.
  PaiementSalairesController: FonctionMetier.PAIE,
  RepartitionsAnalytiquesPaieController: FonctionMetier.PAIE,
  ExerciceController: FonctionMetier.CLOTURE,
  AffectationController: FonctionMetier.CLOTURE,
  NoteAnnexeController: FonctionMetier.CLOTURE,
  DocumentsObligatoiresController: FonctionMetier.CLOTURE,
  InventaireController: FonctionMetier.REVISION,
  CircularisationController: FonctionMetier.REVISION,
  ProvisionsController: FonctionMetier.REVISION,
  FaiblessesController: FonctionMetier.REVISION,
  QuestionnaireController: FonctionMetier.REVISION,
  MandatAuditeurController: FonctionMetier.REVISION,
  GroupeController: FonctionMetier.GROUPE_ET_IFRS,
  ConsolidationController: FonctionMetier.GROUPE_ET_IFRS,
  IfrsController: FonctionMetier.GROUPE_ET_IFRS,
};

/**
 * Méthodes rangées ailleurs que leur contrôleur · valider n'est pas saisir
 * (AUDCIF art. 22, 2° · la validation fait entrer la pièce au livre-journal,
 * c'est l'acte que la séparation des tâches isole).
 */
export const FONCTION_PAR_METHODE: Record<string, FonctionMetier> = {
  'EcritureController.valider': FonctionMetier.VALIDATION,
  'EcritureController.validerJusqua': FonctionMetier.VALIDATION,
  'EcritureController.imputerOuverture': FonctionMetier.CLOTURE,
  'EcritureController.fusionnerComptes': FonctionMetier.STRUCTURE,
};

/**
 * Méthodes rangées autrement POUR LE GESTIONNAIRE DE PAIE (audit final F247,
 * 2026-09-28). Coter l'USD du jour est, pour lui, un geste de la PAIE · son
 * salaire stipulé en dollars ne se calcule pas sans ce cours, et c'est tout ce
 * que le serveur lui ouvre du module (`motifRefusCotationGestionnairePaie`).
 * Rangée à STRUCTURE comme pour le comptable, la cotation était refusée au
 * gestionnaire dont le profil ne coche que « Personnel et paie », c'est-à-dire
 * au profil naturel de son rôle, et le seul remède aurait été de lui cocher
 * « Structure », qui ne dit pas ce qu'on lui confie. Le comptable, lui, garde
 * STRUCTURE · pour lui, poser un cours de toute devise à toute date est bien
 * de la structure du dossier.
 */
export const FONCTION_PAR_METHODE_DU_GESTIONNAIRE_PAIE: Record<string, FonctionMetier> = {
  'DevisesController.poserCours': FonctionMetier.PAIE,
};

/** Contrôleurs qui écrivent sans relever d'un profil, avec leur motif. */
export const CONTROLEURS_HORS_PROFIL: Record<string, string> = {
  AuthController: "Connexion et mot de passe · l'utilisateur lui-même, quel que soit son profil.",
  PlateformeController: "Console de l'opérateur, hors de tout dossier.",
  UtilisateurController: "Gestion des accès · réservée à l'administrateur, que le profil ne restreint jamais.",
  SurSiteController: "Licence et sauvegardes du poste d'une installation sur site · l'installation, pas un dossier.",
  ConditionsLicenceController:
    "Acceptation des conditions de licence au nom du client · réservée à l'administrateur, que le profil ne restreint jamais.",
  ImpressionsJournalController:
    "Trace de l'impression du journal (ligne sage-l1, fonction 60) · imprimer est une lecture, ouverte à qui lit le journal, que le profil ne ferme pas.",
  ModelesEditionController:
    "Modèles des éditions de travail (ligne sage-l7, fonction 59) · la présentation d'une liste imprimée, sans effet sur les livres, que le profil ne ferme pas.",
  SelectionsEditionController:
    "Sélections enregistrées des éditions (ligne sage-l7, fonction 59) · des critères de lecture rappelés, sans effet sur les livres, que le profil ne ferme pas.",
  ImpressionsDiffereesController:
    "Impression différée (ligne sage-l7, fonction 59) · demander et faire produire une édition est une lecture des livres, ouverte à qui peut les exporter, que le profil ne ferme pas.",
};

const METHODES_QUI_ECRIVENT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * La fonction d'une route, lue pour le RÔLE qui l'appelle · la même route peut
 * relever de deux fonctions selon qui écrit (voir la table du gestionnaire de
 * paie). Sans rôle, la lecture commune.
 */
export function fonctionDeRoute(classe: string, methode: string, role?: string): FonctionMetier | null {
  const cle = `${classe}.${methode}`;
  const propreAuGestionnaire =
    role === RoleUtilisateur.GESTIONNAIRE_PAIE ? FONCTION_PAR_METHODE_DU_GESTIONNAIRE_PAIE[cle] : undefined;
  return propreAuGestionnaire ?? FONCTION_PAR_METHODE[cle] ?? FONCTION_PAR_CONTROLEUR[classe] ?? null;
}

/** Pourquoi la route est refusée à cet utilisateur, ou null. */
export function motifRefusFonction(
  utilisateur: { role: string; restreindreFonctions?: boolean; fonctionsAutorisees?: string[] },
  verbeHttp: string,
  fonction: FonctionMetier | null,
): string | null {
  if (!utilisateur.restreindreFonctions) return null;
  if (utilisateur.role === RoleUtilisateur.ADMIN_CABINET) return null;
  if (!METHODES_QUI_ECRIVENT.has(verbeHttp.toUpperCase())) return null;
  if (!fonction) return null;
  if ((utilisateur.fonctionsAutorisees ?? []).includes(fonction)) return null;
  return `La fonction « ${LIBELLES_FONCTION[fonction]} » ne vous est pas ouverte · voyez l'administrateur du dossier.`;
}
