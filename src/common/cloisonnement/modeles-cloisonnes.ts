/**
 * LES MODÈLES QUI PORTENT UN `tenantId`.
 *
 * Liste tirée du schéma, pas écrite de mémoire · un modèle ajouté au schéma et
 * oublié ici échapperait au cloisonnement sans que rien ne le dise. Le spec
 * `cloisonnement.spec.ts` relit `prisma/schema.prisma` et fait tomber le test
 * si les deux divergent.
 */
export const MODELES_CLOISONNES = new Set<string>([
  // Ligne microfina-m2 · bons de commande (idée 2), arrêtés de caisse et
  // plafonds (idée 5), chéquiers et chèques émis (idée 9).
  'BonCommandeFournisseur',
  'LigneBonCommande',
  'ExecutionBonCommande',
  'ArreteCaisse',
  'CoupureArreteCaisse',
  'PlafondEncaisse',
  'Chequier',
  'ChequeEmis',
  'AffectationResultat',
  'ArticleStock',
  'Bailleur',
  'BulletinPaie',
  'Cloture',
  'Consignation',
  'ContratTravail',
  'ConventionFinancement',
  'Compte',
  'Devis',
  'Devise',
  'Donation',
  'DossierFiscalExercice',
  'Ecriture',
  'EnfantACharge',
  'EngagementDepense',
  // OD analytiques (2026-09-25) · la ligne porte son tenantId, comme l'en-tête.
  'OdAnalytique',
  // Natures de compte (2026-09-25) · paramétrage du dossier.
  'NatureCompte',
  'LigneOdAnalytique',
  'EvenementAudit',
  'Exercice',
  'Exoneration',
  'Facture',
  'CampagneInventaire',
  'SousCommissionInventaire',
  'MembreSousCommission',
  'FicheInventaire',
  'EcartInventaire',
  'CampagneCircularisation',
  'ProvisionRisqueCharge',
  'DemandeConfirmation',
  'RegistreFaiblesses',
  'FaiblesseControleInterne',
  'QuestionnaireRevision',
  'ReponseQuestionnaire',
  'ConsommationUniteOeuvre',
  'ContratLocationAcquisition',
  'ClotureLocationAcquisition',
  'RepriseSubventionImmobilisation',
  'SubventionImmobilisation',
  'ReductionSubventionImmobilisation',
  'RevisionPlanAmortissement',
  'CoutEmpruntIncorpore',
  'ReevaluationBilan',
  'LigneReevaluationBilan',
  'RepriseProvisionReevaluation',
  'MouvementDemantelement',
  'AnnulationTraitementImmobilisation',
  'CreanceDouteuse',
  'AjustementCreanceDouteuse',
  'MouvementCreanceDouteuse',
  'FactureCreanceDouteuse',
  'RecuperationTvaCreance',
  'DeclarationDeviseANouveau',
  // L'imputation déclarée d'un paiement (décision par la loi du 2026-10-07, point 4).
  'ImputationPaiement',
  'ConstatImpotResultat',
  // Comptabilité de gestion (ligne A20) · clés, leurs lignes et données du
  // coût de production, chacune portant son tenantId.
  'CleRepartition',
  'LigneCleRepartition',
  'CoutProductionDeclare',
  'ComportementsGestionFiges',
  'ProcesVerbalComptageCaisse',
  'CoupureComptee',
  'FamilleImmobilisation',
  'Immobilisation',
  'Journal',
  'Lettrage',
  'AccordCadrePlan',
  'EntitePerimetreConsolidation',
  'LienParticipationConsolidation',
  'FaitsConsolidationExercice',
  'LigneBalanceConsolidation',
  'OperationReciproqueConsolidation',
  'ResultatInterneConsolidation',
  'EcartEvaluationConsolidation',
  'ProvisionChangeConsolidation',
  // États IFRS (item 15) · chaque table, lignes comprises, porte son tenantId.
  'ParametresIfrs',
  'RegleCorrespondanceIfrs',
  'RetraitementIfrs',
  'LigneReleveBancaire',
  // En-cours d'ouverture du premier rapprochement (2026-09-28) · la ligne
  // porte son tenantId, comme le rapprochement qui la déclare.
  'EncoursOuvertureRapprochement',
  'LigneRetraitementIfrs',
  'MouvementCapitauxPropresIfrs',
  'EffetChangeTresorerieIfrs',
  'NotesIfrs',
  'RegleConsolidationIfrs',
  'MandatAuditeur',
  'Licence',
  'LiquidationTva',
  'ManuelProcedures',
  'Message',
  'ModeleAbonnement',
  'ModeleReglement',
  'ModeleSaisie',
  'Banque',
  'RibBanque',
  'LibelleEcriture',
  'LieuBien',
  'ModeleBulletin',
  'EtatPersonnalise',
  'DocumentTiers',
  'CompteVirementFonds',
  'VirementFonds',
  'PieceVirementFonds',
  // Ligne sage-l3, fonction 40 · types de remise, valeurs reçues et
  // bordereaux de remise en banque, chacun borné par son tenantId.
  'TypeRemise',
  'ValeurRecue',
  'RemiseEnBanque',
  'AnnulationActeRemise',
  // Ligne sage-l3, fonction 39 · les effets de commerce et leurs actes,
  // chacun borné par son tenantId.
  'EffetCommerce',
  'ActeEffet',
  // Ligne sage-l3, fonction 46 · conditions bancaires, autorisations de
  // financement, unions de comptes et leurs éléments, chacun borné par son tenantId.
  'ConditionBancaire',
  'AutorisationFinancement',
  'UnionComptesBancaires',
  'ElementUnionComptesBancaires',
  'TauxReference',
  'CoursTauxReference',
  'OperationTresorerie',
  'ActeOperationTresorerie',
  'TitrePlacement',
  'MouvementTitre',
  'EvaluationTitre',
  // Ligne sage-l6, fonction 22 · les pièces jointes aux écritures, aux
  // sections, aux biens et aux salariés, chacune bornée par son tenantId.
  'PieceJointeEcriture',
  'PieceJointeSection',
  'PieceJointeImmobilisation',
  'PieceJointeSalarie',
  // Ligne sage-l1, fonction 60 · les impressions du journal.
  'ImpressionJournal',
  // Ligne sage-l7, fonction 99 · l'export des écritures et son registre.
  'ExportEcritures',
  'EcritureExportee',
  // Ligne sage-l7, fonction 59 · l'impression différée et les sélections enregistrées.
  'ImpressionDifferee',
  // Ligne dossier-l9, fonction 102 · les envois reçus d'un autre dossier et leur registre.
  'ReceptionEchange',
  'EcritureRecue',
  // Ligne dossier-l9, fonction 95 · les sessions vues et la messagerie interne.
  'PresenceSession',
  'MessageInterne',
  'DestinataireMessage',
  // Ligne dossier-l9, fonctions 96 et 100 · préférences et notifications.
  'PreferenceUtilisateur',
  'NotificationUtilisateur',
  'SelectionEdition',
  'ModeleEdition',
  // Ligne export-periode · les extraits de période numérotés et datés.
  'ExtraitPeriode',
  // Ligne sage-l1, fonction 19 · les séquences de saisie.
  'SequenceSaisie',
  // Ligne gl-saisie, fonction 64 · les revues d'écritures.
  'RevueEcriture',
  // Ligne gl-saisie, fonction 33 · les décisions de relance sur une ligne.
  'DecisionRelanceLigne',
  // Ligne sage-l2, fonction 1 · les modes de règlement.
  'ModeReglement',
  // Ligne sage-l2, fonction 31 · les lieux de livraison des clients.
  'LieuLivraison',
  // Ligne sage-l2, fonction 27 · les modèles d'impression des tiers.
  'ModeleImpressionTiers',
  'RibTiers',
  'RubriquePaie',
  'VersionBaremePaie',
  'SimulationBudgetaire',
  'AmortissementDerogatoire',
  'AvanceSalaire',
  'RetenueAvanceBulletin',
  // Ligne sage-l5 · congés acquis chaque mois (fonction 79).
  'RepriseCongesSalarie',
  'CongeSalarie',
  'AbsenceSalarie',
  'MajorationHeures',
  'IndemniteCaisseAbsence',
  // Ligne sage-l5, fonction 78, reste · feuilles de temps et compteurs libres.
  'FeuilleTemps',
  'JourFeuilleTemps',
  'CompteurHeures',
  'TransfertImmobilisationGroupe',
  'DetentionBien',
  'RecuDetentionBien',
  'HeuresCompteurJour',
  // Ligne paie-suite · l'organigramme et les rattachements datés.
  'UniteOrganisation',
  'RattachementUnite',
  // Ligne paie-suite, fonction 87 · les rappels de salaire.
  'RappelSalaire',
  // Ligne microfina-m3, idée 3 · ordres et frais de mission.
  'MissionSalarie',
  'FraisMission',
  // Ligne microfina-m3, lot 2 · demandes de congé et formations.
  'DemandeCongeSalarie',
  'FormationPersonnel',
  'ParticipantFormation',
  // Le bilan social de l'ONEM.
  'BilanSocial',
  // Ligne sage-l5 · banques du salarié et paiement des salaires (fonction 75).
  'RibSalarie',
  'PaiementSalaires',
  'LignePaiementSalaire',
  // Ligne sage-l5 · fonction 88, la répartition analytique de la paie.
  'RepartitionAnalytiquePaie',
  'LigneRepartitionAnalytiquePaie',
  // Ligne analytique, fonction n° 48 · la grille d'un compte et ses lignes.
  'GrilleAnalytique',
  'LigneGrilleAnalytique',
  // Ligne analytique, fonction n° 51 · le budget d'un compte général.
  'BudgetCompte',
  'OrdreVirement',
  'LigneOrdreVirement',
  'LotVirement',
  'LigneLotVirement',
  'MouvementStock',
  'NiveauRelance',
  'PlanAnalytique',
  'RapportActivite',
  'Salarie',
  'RapprochementBancaire',
  'RattachementNote',
  'SaisieNote',
  'Reevaluation',
  'ProvisionChangeOuverture',
  'VerrouProvisionChange',
  'VerrouCreancesDouteuses',
  'Regularisation',
  'Relance',
  'RetraitementFiscal',
  'SectionAnalytique',
  'TauxTva',
  'Tiers',
  'TranscriptionInventaire',
  'User',
]);

/**
 * Les modèles SANS `tenantId` ne sont pas pour autant hors de danger · ils ne
 * sont atteignables que par leur parent (une ligne d'écriture par son
 * écriture, une ventilation par sa section). Leur cloisonnement repose donc
 * entièrement sur celui du parent, et c'est une dépendance à connaître :
 * `ligneEcriture.findMany({ where: { lettrageId } })` ne porte aucune borne de
 * dossier par lui-même.
 *
 * Le choix de ne PAS leur ajouter de `tenantId` est celui du schéma d'origine
 * et n'est pas défait ici · le dupliquer sur des tables aussi volumineuses
 * ouvrirait la porte à l'incohérence entre la ligne et sa tête, qui serait
 * pire que le mal.
 */
export const MODELES_PORTES_PAR_LEUR_PARENT = new Set<string>([
  'BudgetSection',
  'CoursDevise',
  // Portée par son immobilisation, comme la dotation aux amortissements · le
  // service ne l'atteint jamais autrement que par un bien déjà borné au
  // dossier (`trouver`), et lui donner un tenantId à elle ouvrirait la porte à
  // deux réponses possibles à la même question.
  'DepreciationImmobilisation',
  'DotationAmortissement',
  'EcheanceAbonnement',
  'EcheanceReglement',
  // Portée par son engagement · le service ne l'atteint jamais autrement
  // qu'après avoir borné l'engagement au dossier, et lui donner un tenantId
  // ouvrirait la porte à un rattachement dont la tête et la ligne
  // désigneraient deux dossiers différents.
  'ExecutionEngagement',
  // Portée par sa facture · l'état détaillé ne l'atteint jamais qu'après avoir
  // borné la facture au dossier, et le rattachement est en cascade (supprimer
  // la facture supprime ses lignes).
  'LigneDevis',
  'LigneFacture',
  'LigneAffectation',
  'LigneEcriture',
  // Portés par leur convention de financement · le service ne les atteint
  // jamais qu'après avoir borné la convention au dossier.
  'RapportBailleur',
  'TrancheFinancement',
  'LigneModeleSaisie',
  // Portée par son immobilisation, comme la dotation et la dépréciation · le
  // service ne l'atteint jamais que par un bien déjà borné au dossier.
  'ReclassementImmobilisation',
  'TiersCompte',
  'VentilationAnalytique',
]);

/**
 * LES MODÈLES QUI N'APPARTIENNENT À AUCUN DOSSIER · le registre de l'éditeur,
 * lu par la console de l'opérateur, et par un dossier pour SON seul abonnement,
 * ou celui de son siège pour une cellule (conditions de licence, ligne
 * pages-legales). Ils ne portent pas de `tenantId`,
 * n'entrent dans aucune archive de restitution (ce n'est pas une donnée du
 * client) et la liste est FERMÉE · un modèle ajouté ici sans motif ferait
 * sortir une table de tout contrôle.
 */
export const MODELES_HORS_DOSSIER: Record<string, string> = {
  LicenceSurSiteEmise: 'registre des licences sur site émises par l’éditeur, lu par la console de l’opérateur',
  FormuleAbonnement: 'grille des formules et prix de l’abonnement OmegaX, tenue par l’éditeur',
  AbonnementCabinet:
    'abonnement d’un dossier client, donnée de l’éditeur sur son client · le dossier lit le sien, sur sa clé, ou une cellule celui de son siège, avant d’accepter les conditions de licence (formule, options et dates, jamais le tiers facturé)',
  OptionAbonnement: 'options souscrites par un abonnement, portées par lui',
  FactureAbonnement: 'lien entre une période facturée et la facture née dans le dossier de l’éditeur',
  RappelSuppressionEssai:
    'suivi de l’éditeur sur un dossier d’essai échu (rappel de suppression), cabinetId et non tenantId comme l’abonnement · il part avec le dossier (cascade), ce n’est pas une donnée du client',
  DossierEssaiSupprime:
    'trace durable d’un dossier d’essai supprimé, sans clé étrangère · dates et nombres seulement, aucune donnée du client',
};
