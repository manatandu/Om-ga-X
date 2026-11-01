import { LIBELLES_LOGICIEL, LOGICIELS, Logiciel, ROLES_SANS_LOGICIELS } from '../../modules/utilisateurs/logiciels';

/**
 * LE REFUS PAR LE SERVEUR, LOGICIEL PAR LOGICIEL (ligne commercial-site,
 * gel levé par Manasse le 2026-11-01, « Fais tout le point 1 »).
 *
 * Jusque-là les logiciels attribués à un utilisateur (`User.restreindreLogiciels`,
 * `logicielsAutorises`) ne faisaient que MASQUER des tuiles · une adresse tapée
 * ouvrait encore la fenêtre, et le serveur servait tout (« masquer n'est pas
 * refuser »). Cette table rattache chaque contrôleur au logiciel qui le sert,
 * et `JwtAuthGuard` refuse, lectures comprises, ce que l'utilisateur n'a pas.
 *
 * QUATRE RÈGLES, ET CHACUNE EMPÊCHE UN DÉFAUT PRÉCIS.
 *  1. LA TABLE EST FERMÉE · `logiciels-des-routes.spec.ts` relit les sources et
 *     fait tomber le test pour un contrôleur ni rangé ni déclaré commun avec
 *     son motif, ou pour une entrée qui ne vise plus rien. Un contrôleur
 *     inconnu à l'exécution est REFUSÉ à l'utilisateur restreint (on ne sert
 *     pas ce qu'on n'a pas classé).
 *  2. CE QU'UN LOGICIEL LIT D'UN AUTRE EST ÉCRIT ICI (`lecture`), jamais
 *     deviné · la paie lit les journaux, le règlement des tiers lit les
 *     comptes, les notes annexes lisent les immobilisations. Ces lectures ont
 *     été relevées dans les écrans du client (appels `api.get` de chaque
 *     fenêtre que la tuile garde), et le même spec rejoue ce relevé à chaque
 *     passage · un écran attribué qui appellerait une route refusée fait tomber
 *     le test, avant qu'un utilisateur ne voie un 403.
 *  3. UNE LECTURE N'EST QU'UN GET (ou HEAD) · un POST qui ne fait que lire
 *     (palmarès) suit les écritures.
 *  4. L'ADMINISTRATEUR ET LE GESTIONNAIRE DE PAIE NE SONT JAMAIS RESTREINTS
 *     (`ROLES_SANS_LOGICIELS`) · le premier attribue les logiciels des autres,
 *     le second a son rôle cantonné, que `roles-cantonnes.ts` tient seul.
 *
 * Le refus s'ajoute aux autres, il n'en remplace aucun · rôle, référentiel,
 * profil de fonctions et journaux autorisés restent jugés à part.
 */

/** Une lecture ouverte à tout logiciel · la donnée sert de structure à tous les écrans. */
export const TOUS = 'TOUS' as const;

export interface PorteeLogiciel {
  /** Les logiciels qui lisent ET écrivent par ces routes. */
  logiciels: readonly Logiciel[];
  /** Les logiciels qui, en plus, LISENT (GET, HEAD) · `TOUS` pour une structure lue partout. */
  lecture?: readonly Logiciel[] | typeof TOUS;
}

const C = 'COMPTABILITE' as const;
const T = 'TIERS_TRESORERIE' as const;
const I = 'IMMOBILISATIONS' as const;
const P = 'PAIE' as const;
const R = 'REVISION_AUDIT' as const;
const G = 'GESTION_COMMERCIALE' as const;
const GC = 'GROUPE_CONSOLIDATION' as const;
const F = 'IFRS' as const;
const A = 'ADMINISTRATION' as const;

/**
 * Contrôleurs ouverts à tout utilisateur authentifié, quel que soit son
 * logiciel, avec leur motif. Ce sont les fenêtres que le client garde au menu
 * quel que soit la tuile (`CHEMINS_COMMUNS` de `client/src/lib/logiciels.ts`)
 * et ce que le chrome lit pour s'afficher.
 */
export const CONTROLEURS_COMMUNS: Record<string, string> = {
  AuthController: "Connexion, mot de passe, double authentification et sessions · l'utilisateur lui-même, quel que soit son logiciel.",
  SanteController: "Contrôle de santé du service, sans session.",
  DemandeInformationController: "Formulaire de demande de la page publique, sans session · aucune donnée de dossier lue ni rendue.",
  PlateformeController: "Console de l'opérateur de la plateforme, gardée par sa propre garde, hors de tout logiciel du dossier.",
  SurSiteController: "Licence et sauvegardes du poste d'une installation sur site · le chrome lit son état, l'installation n'est pas un logiciel.",
  ConditionsLicenceController: "Conditions de licence · lues par le chrome, acceptées par l'administrateur, qui n'est jamais restreint.",
  MessagerieController: "Messagerie interne · fenêtre commune à toutes les tuiles, chacun ses propres messages.",
  NotificationsController: "Notifications · le chrome compte les non lues, fenêtre commune à toutes les tuiles.",
  PreferencesController: "Préférences d'affichage · lues au démarrage de l'interface, chacun règle les siennes.",
  CourrierController:
    "Courrier sortant · fenêtre commune à toutes les tuiles, mais la liste, la cloche, la fiche d'un message et la reprise sont FILTRÉES par l'origine du message (courrier/origines-par-logiciel.ts · ce qu'une tuile émet, elle le lit).",
  ModelesEditionController: "Modèles des éditions de travail · une présentation de liste imprimée, sans donnée propre à un logiciel.",
  SelectionsEditionController: "Sélections enregistrées des éditions · des critères de lecture rappelés, lus par la fenêtre commune des impressions différées.",
};

/** Le logiciel de chaque contrôleur rangé. */
export const LOGICIEL_PAR_CONTROLEUR: Record<string, PorteeLogiciel> = {
  // ---- Comptabilité ------------------------------------------------------
  // Structures lues par tous les écrans · natures, taxes et paramètres du
  // dossier alimentent les listes de choix de chaque logiciel. Pour les
  // comptes, journaux, devises et exercices, seule la LISTE est lue par tous
  // (méthodes ci-dessous) · l'analyse d'un journal ou l'aperçu de l'ouverture
  // suivante portent des soldes, ils restent à la comptabilité.
  CompteController: { logiciels: [C] },
  NaturesCompteController: { logiciels: [C, A], lecture: TOUS },
  JournalController: { logiciels: [C] },
  TauxTvaController: { logiciels: [C], lecture: TOUS },
  DevisesController: { logiciels: [C] },
  ExerciceController: { logiciels: [C] },
  TenantController: { logiciels: [C, A], lecture: TOUS },
  // Les livres · lus par les balances et l'échéancier des tiers, et par la révision.
  EcritureController: { logiciels: [C], lecture: [T, R] },
  // La pièce jointe d'une écriture se voit depuis le volet commun des pièces (biens, salariés).
  PiecesJointesEcritureController: { logiciels: [C], lecture: [I, P] },
  PiecesJointesSectionController: { logiciels: [C] },
  CircuitVisaController: { logiciels: [C] },
  RevueEcrituresController: { logiciels: [C] },
  InterrogationCompteController: { logiciels: [C], lecture: [T, R] },
  EcheancesTiersController: { logiciels: [C], lecture: [T] },
  ImpressionsJournalController: { logiciels: [C] },
  ModeleSaisieController: { logiciels: [C] },
  SequencesSaisieController: { logiciels: [C] },
  RegularisationController: { logiciels: [C] },
  OperationSpecifiqueController: { logiciels: [C] },
  CreancesDouteusesController: { logiciels: [C] },
  AffectationController: { logiciels: [C] },
  AnalytiqueController: { logiciels: [C] },
  BonsCommandeController: { logiciels: [C] },
  ComptabiliteGestionController: { logiciels: [C] },
  BailleurController: { logiciels: [C] },
  ConventionFinancementController: { logiciels: [C] },
  DonationController: { logiciels: [C] },
  EtatsPersonnalisesController: { logiciels: [C] },
  SimulationsController: { logiciels: [C] },
  MonnaieFonctionnelleController: { logiciels: [C] },
  EtatsFinanciersController: { logiciels: [C], lecture: [R] },
  EtatsFinanciersSyscohadaController: { logiciels: [C], lecture: [R] },
  NoteAnnexeController: { logiciels: [C], lecture: [R] },
  DocumentsObligatoiresController: { logiciels: [C] },
  RetenuesController: { logiciels: [C] },
  // L'exemption d'IS est lue par les paramètres du dossier (administration).
  FiscaliteController: { logiciels: [C], lecture: [A] },
  ExonerationsController: { logiciels: [C] },
  // L'export et l'échange des écritures sont rangés dans les deux tuiles par le client.
  ExportModificationsController: { logiciels: [C, A] },
  EchangeEcrituresController: { logiciels: [C, A] },
  // Les éditions des livres et des états · voir aussi les méthodes ci-dessous.
  ExportController: { logiciels: [C, R] },

  // ---- Tiers et trésorerie -----------------------------------------------
  // Le plan des tiers, ses modes et modèles de règlement · lus par la saisie,
  // la facturation, les biens (fournisseur) et les écrans de révision. Du
  // tiers, la liste et la fiche seules (méthodes ci-dessous).
  TiersController: { logiciels: [T] },
  ModesReglementController: { logiciels: [T], lecture: TOUS },
  ModeleReglementController: { logiciels: [T], lecture: TOUS },
  // Banques · la liste lue par la paie (paiement des salaires), les libellés par la saisie.
  BanquesController: { logiciels: [T] },
  RibsTiersController: { logiciels: [T] },
  DocumentsTiersController: { logiciels: [T] },
  LieuxLivraisonController: { logiciels: [T], lecture: [G] },
  ModelesImpressionController: { logiciels: [T] },
  ConditionsBancairesController: { logiciels: [T] },
  TauxReferenceController: { logiciels: [T] },
  LettrageController: { logiciels: [T], lecture: [C] },
  LettrageDossierController: { logiciels: [T], lecture: [C] },
  ReglementsController: { logiciels: [T] },
  ImputationsPaiementsController: { logiciels: [T] },
  VirementsFondsController: { logiciels: [T] },
  ArretesCaisseController: { logiciels: [T] },
  RemisesController: { logiciels: [T] },
  EffetsController: { logiciels: [T] },
  OperationsTresorerieController: { logiciels: [T] },
  TitresPlacementController: { logiciels: [T] },
  ChequesController: { logiciels: [T] },
  RapprochementController: { logiciels: [T] },
  OrdresVirementController: { logiciels: [T] },
  EnvoiAvisReglementController: { logiciels: [T] },
  LotsVirementController: { logiciels: [T] },
  RelancesController: { logiciels: [T] },

  // ---- Immobilisations ---------------------------------------------------
  // Les notes annexes lisent le registre (coûts d'emprunt, réévaluation).
  ImmobilisationController: { logiciels: [I], lecture: [C, R] },
  ReevaluationBilanController: { logiciels: [I], lecture: [C] },
  FicheImmobilisationController: { logiciels: [I] },
  AnnulationTraitementController: { logiciels: [I] },
  AnnulationSortieController: { logiciels: [I] },
  CreationDepuisEcrituresController: { logiciels: [I] },
  MaintenanceImmobilisationsController: { logiciels: [I] },
  DegressifController: { logiciels: [I] },
  LocationAcquisitionController: { logiciels: [I] },
  RepriseSubventionController: { logiciels: [I] },
  SubventionRattacheeController: { logiciels: [I] },
  DemantelementController: { logiciels: [I] },
  DetentionBienController: { logiciels: [I] },
  PiecesJointesImmobilisationController: { logiciels: [I] },
  // Le transfert d'un bien d'un dossier du groupe à l'autre · deux tuiles.
  TransfertGroupeController: { logiciels: [I, GC] },

  // ---- Paie --------------------------------------------------------------
  PersonnelController: { logiciels: [P] },
  PersonnelSuiteController: { logiciels: [P] },
  AvancesRubriquesController: { logiciels: [P] },
  BaremesPaieController: { logiciels: [P] },
  BilanSocialController: { logiciels: [P] },
  CongesController: { logiciels: [P] },
  AbsencesController: { logiciels: [P] },
  MajorationsHeuresController: { logiciels: [P] },
  FeuillesTempsController: { logiciels: [P] },
  MissionsController: { logiciels: [P] },
  SuiviPersonnelController: { logiciels: [P] },
  OrganigrammeController: { logiciels: [P] },
  PaiementSalairesController: { logiciels: [P] },
  RepartitionsAnalytiquesPaieController: { logiciels: [P] },
  QuestionnairePaieController: { logiciels: [P] },
  PiecesJointesSalarieController: { logiciels: [P] },

  // ---- Révision et audit -------------------------------------------------
  ControlesController: { logiciels: [C, R] },
  ConcordanceController: { logiciels: [R] },
  InventaireController: { logiciels: [R] },
  CircularisationController: { logiciels: [R] },
  ProvisionsController: { logiciels: [R] },
  QuestionnaireController: { logiciels: [R] },
  FaiblessesController: { logiciels: [R] },

  // ---- Gestion commerciale -----------------------------------------------
  FacturationController: { logiciels: [G] },
  CommercialController: { logiciels: [G] },
  ArticlesCommerciauxController: { logiciels: [G] },
  // Les collaborateurs sont lus par la fiche du tiers (représentant).
  StructuresCommercialesController: { logiciels: [G], lecture: [T] },
  StockController: { logiciels: [G] },
  MagasinController: { logiciels: [G] },
  EmballagesController: { logiciels: [G] },

  // ---- Groupe, consolidation, IFRS ---------------------------------------
  GroupeController: { logiciels: [GC] },
  ConsolidationController: { logiciels: [GC] },
  IfrsController: { logiciels: [F] },

  // ---- Administration ----------------------------------------------------
  UtilisateurController: { logiciels: [A] },
  UtilisateursConnectesController: { logiciels: [A] },
  JournalAuditController: { logiciels: [A] },
  ImportController: { logiciels: [A] },
  RestitutionController: { logiciels: [A] },
  AccordCadreController: { logiciels: [A] },
  ConstitutionController: { logiciels: [A], lecture: [C] },
  // Le mandat est rangé sous Administration par le client, il relève aussi de la révision.
  MandatAuditeurController: { logiciels: [A, R] },
  // Elles produisent le journal, le grand livre et la balance · rangées par le
  // client sous les trois tuiles qui lisent les livres, plus au menu commun.
  ImpressionsDiffereesController: { logiciels: [C, T, R] },
};

/**
 * Méthodes rangées autrement que leur contrôleur · `COMMUN` ouvre la route à
 * tout logiciel, lectures et écritures.
 */
export const LOGICIEL_PAR_METHODE: Record<string, PorteeLogiciel | 'COMMUN'> = {
  // Les listes de structure, lues par tous les écrans (listes de choix,
  // chrome, cours du jour de la paie en dollars).
  'CompteController.lister': { logiciels: [C], lecture: TOUS },
  'JournalController.lister': { logiciels: [C], lecture: TOUS },
  'DevisesController.lister': { logiciels: [C], lecture: TOUS },
  'ExerciceController.lister': { logiciels: [C], lecture: TOUS },
  'ExerciceController.planningCloture': { logiciels: [C], lecture: TOUS },
  'TiersController.lister': { logiciels: [T], lecture: TOUS },
  'TiersController.obtenir': { logiciels: [T], lecture: TOUS },
  // La saisie lit la devise des comptes de tiers et l'échéancier d'une ligne.
  'TiersController.devisesDesComptes': { logiciels: [T], lecture: [C] },
  'TiersController.echeancierDeLigne': { logiciels: [T], lecture: [C] },
  'BanquesController.lister': { logiciels: [T], lecture: TOUS },
  // L'accueil, monté pour toute tuile, lit la SYNTHÈSE des contrôles ·
  // compteurs et intitulé seuls (synthese-controles.ts). Le rapport complet
  // (`analyser`) porte comptes, tiers et montants · il reste à la
  // Comptabilité et à la Révision, comme le reste du contrôleur.
  'ControlesController.synthese': 'COMMUN',
  // Viser une facture est un geste de la facturation.
  'CircuitVisaController.viserFacture': { logiciels: [C, G] },
  // Personnaliser le compte d'un bien depuis sa fiche (compte retenu).
  'CompteController.modifier': { logiciels: [C, I] },
  // Le salaire stipulé en dollars ne se calcule pas sans le cours du jour.
  'DevisesController.poserCours': { logiciels: [C, P] },
  // Les libellés d'écriture servent la saisie, pas la banque.
  'BanquesController.listerLibelles': { logiciels: [C, T], lecture: TOUS },
  'BanquesController.creerLibelle': { logiciels: [C] },
  'BanquesController.modifierLibelle': { logiciels: [C] },
  'BanquesController.supprimerLibelle': { logiciels: [C] },
  // Éditions propres à une tuile.
  'ExportController.grandLivreTiers': { logiciels: [C, T, R] },
  'ExportController.balanceAuxiliaire': { logiciels: [C, T, R] },
  'ExportController.balanceAgee': { logiciels: [C, T, R] },
  'ExportController.justificatifSolde': { logiciels: [C, T, R] },
  'ExportController.tableauImmobilisations': { logiciels: [C, I, R] },
  'ExportController.tableauAmortissements': { logiciels: [C, I, R] },
  'ExportController.tableauxImmobilisations': { logiciels: [C, I, R] },
};

const LECTURES = new Set(['GET', 'HEAD']);

/** La portée d'une route, ou null si ni le contrôleur ni la méthode ne sont rangés. */
export function porteeDeRoute(classe: string, methode: string): PorteeLogiciel | 'COMMUN' | null {
  const parMethode = LOGICIEL_PAR_METHODE[`${classe}.${methode}`];
  if (parMethode) return parMethode;
  if (classe in CONTROLEURS_COMMUNS) return 'COMMUN';
  return LOGICIEL_PAR_CONTROLEUR[classe] ?? null;
}

/**
 * Les logiciels qui s'opposent à cet utilisateur, ou null s'il n'est pas
 * restreint. Une clé que la liste ne connaît plus n'ouvre rien.
 */
export function logicielsOpposables(u: {
  role: string;
  restreindreLogiciels?: boolean | null;
  logicielsAutorises?: string[] | null;
}): Logiciel[] | null {
  if (ROLES_SANS_LOGICIELS.includes(u.role)) return null;
  if (!u.restreindreLogiciels) return null;
  const connus: readonly string[] = LOGICIELS;
  return (u.logicielsAutorises ?? []).filter((l): l is Logiciel => connus.includes(l));
}

function nommer(logiciels: readonly Logiciel[]): string {
  const noms = logiciels.map((l) => `« ${LIBELLES_LOGICIEL[l]} »`);
  if (noms.length <= 1) return `du logiciel ${noms[0] ?? ''}, qui ne vous est pas attribué`;
  return `des logiciels ${noms.slice(0, -1).join(', ')} ou ${noms[noms.length - 1]}, qui ne vous sont pas attribués`;
}

/** Pourquoi la route est refusée à cet utilisateur, ou null. */
export function motifRefusLogiciel(
  utilisateur: { role: string; restreindreLogiciels?: boolean | null; logicielsAutorises?: string[] | null },
  verbeHttp: string,
  portee: PorteeLogiciel | 'COMMUN' | null,
): string | null {
  const attribues = logicielsOpposables(utilisateur);
  if (!attribues) return null;
  if (portee === 'COMMUN') return null;
  if (!portee) {
    return "Cette fonction n'est rattachée à aucun logiciel, et vos accès sont restreints à certains logiciels · l'administrateur du dossier peut corriger vos logiciels attribués (Utilisateurs).";
  }
  if (portee.logiciels.some((l) => attribues.includes(l))) return null;
  if (LECTURES.has(verbeHttp.toUpperCase()) && portee.lecture) {
    if (portee.lecture === TOUS) return null;
    if (portee.lecture.some((l) => attribues.includes(l))) return null;
  }
  return `Cette fonction relève ${nommer(portee.logiciels)} · l'administrateur du dossier peut corriger vos logiciels attribués (Utilisateurs).`;
}
