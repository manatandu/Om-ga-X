"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ECRITURE_LAISSEE_PARTIR = exports.RELATIONS_VERS_UNE_LIGNE = exports.COLONNES_QUI_RETIENNENT = void 0;
exports.COLONNES_QUI_RETIENNENT = [
    'Immobilisation.ecritureAcquisitionId',
    'Immobilisation.ecritureSortieId',
    'Immobilisation.ecritureProduitCessionId',
    'Immobilisation.ecritureMiseEnServiceId',
    'Immobilisation.ecritureSoldeDetteAleatoireId',
    'Immobilisation.ecritureSortieEcartReevaluationId',
    'DotationAmortissement.ecritureId',
    'DepreciationImmobilisation.ecritureId',
    'ReclassementImmobilisation.ecritureId',
    'Reevaluation.ecritureEcartsId',
    'Reevaluation.ecritureProvisionId',
    'Reevaluation.ecritureExtourneId',
    'Reevaluation.contrePassationDeclareeId',
    'Regularisation.ecritureConstatationId',
    'Regularisation.ecritureRepriseId',
    'EcheanceAbonnement.ecritureId',
    'LiquidationTva.ecritureId',
    'Donation.ecritureId',
    'AffectationResultat.ecritureId',
    'ExecutionEngagement.ecritureId',
    'MouvementStock.ecritureId',
    'BulletinPaie.ecritureId',
    'BulletinPaie.ecritureNegatifId',
    'AmortissementDerogatoire.ecritureId',
    'LigneOrdreVirement.ecritureId',
    'Consignation.ecritureConsignationId',
    'Consignation.ecritureDenouementId',
    'EcartInventaire.ecritureId',
    'ClotureLocationAcquisition.ecritureId',
    'ClotureLocationAcquisition.ecritureExtourneId',
    'RepriseSubventionImmobilisation.ecritureId',
    'ReductionSubventionImmobilisation.ecritureId',
    'RevisionPlanAmortissement.ecritureId',
    'CoutEmpruntIncorpore.ecritureId',
    'ReevaluationBilan.ecritureId',
    'RepriseProvisionReevaluation.ecritureId',
    'MouvementDemantelement.ecritureId',
    'CreanceDouteuse.ecritureReclassementId',
    'VirementFonds.ecritureOrigineId',
    'VirementFonds.ecritureDestinationId',
    'VirementFonds.ecritureNegatifOrigineId',
    'VirementFonds.ecritureNegatifDestinationId',
    'AjustementCreanceDouteuse.ecritureId',
    'MouvementCreanceDouteuse.ecritureId',
    'MouvementCreanceDouteuse.ecriturePerteId',
    'RecuperationTvaCreance.ecritureId',
    'DeclarationDeviseANouveau.ecritureCorrectionId',
    'CreanceDouteuse.ecritureCorrectionResultatId',
    'ConstatImpotResultat.ecritureId',
    'PaiementSalaires.ecritureId',
    'PaiementSalaires.ecritureNegatifId',
    'AnnulationTraitementImmobilisation.ecritureOrigineId',
    'AnnulationTraitementImmobilisation.ecritureNegatifId',
];
exports.RELATIONS_VERS_UNE_LIGNE = {
    'VentilationAnalytique.ligneEcritureId': 'CASCADE · la ventilation analytique suit sa ligne · retirée ou remplacée au brouillard, la ligne emporte sa ventilation, ' +
        'que la saisie repose avec la ligne nouvelle',
    'FactureCreanceDouteuse.ligneEcritureId': 'RESTRICT · seule une facture VALIDÉE se désigne (`motifRefusDesignation`), donc une ligne indélébile · un chemin qui ' +
        'viendrait à la supprimer est refusé par la base au lieu de dénouer la désignation, et le recouvrement de perdre sa TVA',
    'ImputationPaiement.ligneReglementId': 'RESTRICT · seul un paiement VALIDÉ se déclare (`motifRefusDeclaration`), donc une ligne indélébile · un chemin qui ' +
        'viendrait à la supprimer est refusé par la base au lieu de faire disparaître l’imputation de la déclaration de TVA',
    'ImputationPaiement.ligneFactureId': 'RESTRICT · seule une facture VALIDÉE se désigne dans une imputation (`motifRefusDeclaration`) · même raison que le paiement',
    'Immobilisation.ligneAcquisitionId': 'RESTRICT · seule une ligne VALIDÉE fait naître un bien (`motifRefusLigneACreer`), donc une ligne indélébile ; son ' +
        'écriture est en outre retenue par la fiche (`ecritureAcquisitionId`) · un chemin qui viendrait à la supprimer est ' +
        'refusé par la base au lieu de laisser une fiche sans la ligne qui fonde sa valeur',
};
exports.ECRITURE_LAISSEE_PARTIR = {
    'PieceJointeEcriture.ecritureId': "SET NULL · la pièce justificative ne fait pas l'écriture, elle la justifie · seule une écriture au brouillard se " +
        "retire (AUDCIF art. 22, 2°), par la saisie ou par le module qui l'a passée, et la pièce reste alors DÉTACHÉE, jamais " +
        "perdue (art. 24), sa description figée au dépôt (`ecritureDecrite`) ; retenir l'écriture interdirait de la modifier " +
        "et ferait tomber en erreur brute chaque annulation de module au brouillard",
    'LigneEcriture.ecritureId': "ce sont les lignes de l'écriture elle-même · elles partent avec leur tête, et c'est ce que la suppression veut dire",
    'Ecriture.corrigeEcritureId': "l'écriture corrigée est VALIDÉE (on ne corrige que ce qui est entré au livre-journal) et ne se supprime donc jamais ; " +
        'le lien ne peut se dénouer que si la correction elle-même, encore au brouillard, est retirée, ce qui la fait disparaître avec lui',
    'Facture.ecritureId': "la facture est la pièce, l'écriture son enregistrement · retirer au brouillard une écriture passée depuis une facture " +
        "rend la facture « à comptabiliser », ce qui est exactement l'état qu'elle retrouve, et elle se repasse depuis la fenêtre Facturation",
};
//# sourceMappingURL=detenteurs-ecriture.js.map