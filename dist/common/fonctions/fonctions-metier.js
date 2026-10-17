"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTROLEURS_HORS_PROFIL = exports.FONCTION_PAR_METHODE_DU_GESTIONNAIRE_PAIE = exports.FONCTION_PAR_METHODE = exports.FONCTION_PAR_CONTROLEUR = exports.LIBELLES_FONCTION = void 0;
exports.fonctionDeRoute = fonctionDeRoute;
exports.motifRefusFonction = motifRefusFonction;
const client_1 = require("@prisma/client");
exports.LIBELLES_FONCTION = {
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
exports.FONCTION_PAR_CONTROLEUR = {
    CompteController: client_1.FonctionMetier.STRUCTURE,
    NaturesCompteController: client_1.FonctionMetier.STRUCTURE,
    JournalController: client_1.FonctionMetier.STRUCTURE,
    TauxTvaController: client_1.FonctionMetier.STRUCTURE,
    DevisesController: client_1.FonctionMetier.STRUCTURE,
    ModeleSaisieController: client_1.FonctionMetier.STRUCTURE,
    SequencesSaisieController: client_1.FonctionMetier.STRUCTURE,
    ModesReglementController: client_1.FonctionMetier.STRUCTURE,
    ModelesImpressionController: client_1.FonctionMetier.STRUCTURE,
    BanquesController: client_1.FonctionMetier.STRUCTURE,
    EtatsPersonnalisesController: client_1.FonctionMetier.REVISION,
    SimulationsController: client_1.FonctionMetier.REVISION,
    TenantController: client_1.FonctionMetier.STRUCTURE,
    AccordCadreController: client_1.FonctionMetier.STRUCTURE,
    TiersController: client_1.FonctionMetier.TIERS,
    ModeleReglementController: client_1.FonctionMetier.TIERS,
    DocumentsTiersController: client_1.FonctionMetier.TIERS,
    PiecesJointesEcritureController: client_1.FonctionMetier.SAISIE,
    PiecesJointesSectionController: client_1.FonctionMetier.ANALYTIQUE,
    PiecesJointesImmobilisationController: client_1.FonctionMetier.IMMOBILISATIONS,
    PiecesJointesSalarieController: client_1.FonctionMetier.PAIE,
    RibsTiersController: client_1.FonctionMetier.TIERS,
    LieuxLivraisonController: client_1.FonctionMetier.TIERS,
    EcritureController: client_1.FonctionMetier.SAISIE,
    RegularisationController: client_1.FonctionMetier.SAISIE,
    OperationSpecifiqueController: client_1.FonctionMetier.SAISIE,
    ImportController: client_1.FonctionMetier.SAISIE,
    ExportModificationsController: client_1.FonctionMetier.SAISIE,
    LettrageController: client_1.FonctionMetier.LETTRAGE,
    RapprochementController: client_1.FonctionMetier.TRESORERIE,
    ReglementsController: client_1.FonctionMetier.TRESORERIE,
    VirementsFondsController: client_1.FonctionMetier.TRESORERIE,
    OrdresVirementController: client_1.FonctionMetier.TRESORERIE,
    LotsVirementController: client_1.FonctionMetier.TRESORERIE,
    ImputationsPaiementsController: client_1.FonctionMetier.TRESORERIE,
    RelancesController: client_1.FonctionMetier.RELANCES,
    CourrierController: client_1.FonctionMetier.RELANCES,
    ImmobilisationController: client_1.FonctionMetier.IMMOBILISATIONS,
    DegressifController: client_1.FonctionMetier.IMMOBILISATIONS,
    LocationAcquisitionController: client_1.FonctionMetier.IMMOBILISATIONS,
    RepriseSubventionController: client_1.FonctionMetier.IMMOBILISATIONS,
    SubventionRattacheeController: client_1.FonctionMetier.IMMOBILISATIONS,
    ReevaluationBilanController: client_1.FonctionMetier.IMMOBILISATIONS,
    DemantelementController: client_1.FonctionMetier.IMMOBILISATIONS,
    AnnulationTraitementController: client_1.FonctionMetier.IMMOBILISATIONS,
    FicheImmobilisationController: client_1.FonctionMetier.IMMOBILISATIONS,
    CreationDepuisEcrituresController: client_1.FonctionMetier.IMMOBILISATIONS,
    MaintenanceImmobilisationsController: client_1.FonctionMetier.IMMOBILISATIONS,
    CreancesDouteusesController: client_1.FonctionMetier.SAISIE,
    StockController: client_1.FonctionMetier.STOCKS,
    MagasinController: client_1.FonctionMetier.STOCKS,
    EmballagesController: client_1.FonctionMetier.STOCKS,
    AnalytiqueController: client_1.FonctionMetier.ANALYTIQUE,
    ComptabiliteGestionController: client_1.FonctionMetier.ANALYTIQUE,
    BailleurController: client_1.FonctionMetier.ANALYTIQUE,
    ConventionFinancementController: client_1.FonctionMetier.ANALYTIQUE,
    DonationController: client_1.FonctionMetier.ANALYTIQUE,
    FiscaliteController: client_1.FonctionMetier.FISCALITE,
    ExonerationsController: client_1.FonctionMetier.FISCALITE,
    FacturationController: client_1.FonctionMetier.GESTION_COMMERCIALE,
    CommercialController: client_1.FonctionMetier.GESTION_COMMERCIALE,
    PersonnelController: client_1.FonctionMetier.PAIE,
    AvancesRubriquesController: client_1.FonctionMetier.PAIE,
    BaremesPaieController: client_1.FonctionMetier.PAIE,
    CongesController: client_1.FonctionMetier.PAIE,
    AbsencesController: client_1.FonctionMetier.PAIE,
    MajorationsHeuresController: client_1.FonctionMetier.PAIE,
    PaiementSalairesController: client_1.FonctionMetier.PAIE,
    RepartitionsAnalytiquesPaieController: client_1.FonctionMetier.PAIE,
    ExerciceController: client_1.FonctionMetier.CLOTURE,
    AffectationController: client_1.FonctionMetier.CLOTURE,
    NoteAnnexeController: client_1.FonctionMetier.CLOTURE,
    DocumentsObligatoiresController: client_1.FonctionMetier.CLOTURE,
    InventaireController: client_1.FonctionMetier.REVISION,
    CircularisationController: client_1.FonctionMetier.REVISION,
    ProvisionsController: client_1.FonctionMetier.REVISION,
    FaiblessesController: client_1.FonctionMetier.REVISION,
    QuestionnaireController: client_1.FonctionMetier.REVISION,
    MandatAuditeurController: client_1.FonctionMetier.REVISION,
    GroupeController: client_1.FonctionMetier.GROUPE_ET_IFRS,
    ConsolidationController: client_1.FonctionMetier.GROUPE_ET_IFRS,
    IfrsController: client_1.FonctionMetier.GROUPE_ET_IFRS,
};
exports.FONCTION_PAR_METHODE = {
    'EcritureController.valider': client_1.FonctionMetier.VALIDATION,
    'EcritureController.validerJusqua': client_1.FonctionMetier.VALIDATION,
    'EcritureController.imputerOuverture': client_1.FonctionMetier.CLOTURE,
    'EcritureController.fusionnerComptes': client_1.FonctionMetier.STRUCTURE,
};
exports.FONCTION_PAR_METHODE_DU_GESTIONNAIRE_PAIE = {
    'DevisesController.poserCours': client_1.FonctionMetier.PAIE,
};
exports.CONTROLEURS_HORS_PROFIL = {
    AuthController: "Connexion et mot de passe · l'utilisateur lui-même, quel que soit son profil.",
    PlateformeController: "Console de l'opérateur, hors de tout dossier.",
    UtilisateurController: "Gestion des accès · réservée à l'administrateur, que le profil ne restreint jamais.",
    SurSiteController: "Licence et sauvegardes du poste d'une installation sur site · l'installation, pas un dossier.",
    ConditionsLicenceController: "Acceptation des conditions de licence au nom du client · réservée à l'administrateur, que le profil ne restreint jamais.",
    ImpressionsJournalController: "Trace de l'impression du journal (ligne sage-l1, fonction 60) · imprimer est une lecture, ouverte à qui lit le journal, que le profil ne ferme pas.",
    ModelesEditionController: "Modèles des éditions de travail (ligne sage-l7, fonction 59) · la présentation d'une liste imprimée, sans effet sur les livres, que le profil ne ferme pas.",
    SelectionsEditionController: "Sélections enregistrées des éditions (ligne sage-l7, fonction 59) · des critères de lecture rappelés, sans effet sur les livres, que le profil ne ferme pas.",
    ImpressionsDiffereesController: "Impression différée (ligne sage-l7, fonction 59) · demander et faire produire une édition est une lecture des livres, ouverte à qui peut les exporter, que le profil ne ferme pas.",
};
const METHODES_QUI_ECRIVENT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
function fonctionDeRoute(classe, methode, role) {
    const cle = `${classe}.${methode}`;
    const propreAuGestionnaire = role === client_1.RoleUtilisateur.GESTIONNAIRE_PAIE ? exports.FONCTION_PAR_METHODE_DU_GESTIONNAIRE_PAIE[cle] : undefined;
    return propreAuGestionnaire ?? exports.FONCTION_PAR_METHODE[cle] ?? exports.FONCTION_PAR_CONTROLEUR[classe] ?? null;
}
function motifRefusFonction(utilisateur, verbeHttp, fonction) {
    if (!utilisateur.restreindreFonctions)
        return null;
    if (utilisateur.role === client_1.RoleUtilisateur.ADMIN_CABINET)
        return null;
    if (!METHODES_QUI_ECRIVENT.has(verbeHttp.toUpperCase()))
        return null;
    if (!fonction)
        return null;
    if ((utilisateur.fonctionsAutorisees ?? []).includes(fonction))
        return null;
    return `La fonction « ${exports.LIBELLES_FONCTION[fonction]} » ne vous est pas ouverte · voyez l'administrateur du dossier.`;
}
//# sourceMappingURL=fonctions-metier.js.map