"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const RACINE = path.resolve(__dirname, '../../..');
const FILTRES_NOMMES = {
    avecStatut: 'src/modules/comptabilite/ecritures-de-situation.ts',
    baseHorsSituation: 'src/modules/comptabilite/balance-trois-colonnes.ts',
    filtresDesTroisColonnes: 'src/modules/comptabilite/balance-trois-colonnes.ts',
    filtresDesTroisColonnesDeLaPeriode: 'src/modules/comptabilite/balance-trois-colonnes.ts',
    perimetreJournal: 'src/modules/comptabilite/ecriture.service.ts',
    filtreEcrituresDeTresorerie: 'src/modules/etats-financiers/etats-financiers-smt.service.ts',
    lignesReporteesAuDetail: 'src/modules/exercice/lignes-reportees-au-detail.ts',
    filtreOuverturePasseeAuPremierJour: 'src/modules/exercice/ouverture-passee.ts',
    luesParLePv: 'src/modules/inventaire/solde-caisse-au-comptage.ts',
    valideesDepuisLePv: 'src/modules/inventaire/solde-caisse-au-comptage.ts',
    filtreEcarteDuPointage: 'src/modules/rapprochement/rapprochement.service.ts',
    filtreLignesDeBienSansFiche: 'src/modules/immobilisations/creation-depuis-ecritures.service.ts',
};
const CATEGORIES = [
    {
        nom: 'LETTREES_OU_POINTEES',
        motif: "une ligne de situation n'est jamais lettrée ni pointée · le lettrage (manuel, automatique, du module) et le " +
            'pointage la refusent, et la reprise des journaux de situation a laissé au brouillard toute écriture déjà ' +
            'lettrée ou pointée (migration 20270171040000) · une lecture bornée aux lignes lettrées ou pointées ne la ' +
            'rencontre donc jamais',
        repond: (f) => /\blettrageId\s*:\s*\{\s*not\s*:\s*null\s*\}/.test(f) ||
            (/\b(?:lettrageId|lettre|rapprochementId)\b\s*(?::\s*(?!null\b)|[,}\n])/.test(f) &&
                !/\b(?:lettrageId|lettre|rapprochementId)\s*:\s*null\b/.test(f)),
    },
    {
        nom: 'ECRITURES_DE_CLOTURE',
        motif: "le report à-nouveau, l'à-nouveau provisoire et l'écriture qui solde les comptes de gestion naissent de la " +
            "clôture, jamais dans un journal de situation · l'extension `journal-de-situation` y refuse toute écriture " +
            "qui n'est pas une simulation saisie",
        repond: (f) => /\b(?:estGenereeParCloture|estANouveauProvisoire|estSoldeDesComptesDeGestion)\s*:\s*true\b|\bA_NOUVEAU\b|\bECRITURE_D_A_NOUVEAU\b|\bfiltreANouveauEcarte\b/.test(f),
    },
];
const categorieDuFiltre = (filtre) => (/\bNOT\b/.test(filtre) ? undefined : CATEGORIES.find((c) => c.repond(filtre)));
const MOTIFS = {
    PAR_IDENTIFIANT: "l'écriture ou la ligne est désignée par son identifiant · reçue du client et JUGÉE ensuite (refus nommé d'une " +
        "simulation), tirée d'une lecture déjà filtrée, désignée par la liaison d'un module (l'extension " +
        '`journal-de-situation` refuse à un module tout journal de situation), ou relue par la garde même qui juge',
    USAGE: "un usage est un usage · une simulation mouvemente le compte, le journal, le taux ou le dossier aussi " +
        "sûrement qu'une opération, et le garde qui refuse de supprimer ou de transformer doit la compter",
    NUMEROTATION: 'la numérotation des pièces de SON journal · un journal de situation se numérote sur lui seul',
    PERIMETRE_DES_JOURNAUX: "le périmètre des journaux d'un utilisateur juge le journal de la pièce visée, simulation comprise · " +
        "un journal de situation interdit garde ses simulations",
    SUIT_SA_DATE: "l'arrêt à la dissolution, son annulation et la fin de liquidation font suivre à toute écriture l'exercice qui " +
        'couvre sa date · une simulation laissée derrière resterait dans un exercice qui ne la couvre plus',
    SUIT_SA_LIGNE: "la ventilation analytique suit la ligne qu'elle ventile · celle d'une simulation se pose et s'efface avec elle, " +
        'et aucun cumul analytique ne la lit (`cumulsPlan` pose le statut)',
    ETAT_DES_JOURNAUX: "l'analyse et l'état des journaux montrent CHAQUE journal sur sa ligne · celle d'un journal de situation porte " +
        'ses simulations sous leur propre sigle (jamais en brouillard), et aucun total ne les ajoute aux autres journaux',
    FILTRE_DE_L_APPELANT: "le filtre est reçu de l'appelant, dans le même fichier, qui pose lui-même le statut (le grand livre, " +
        '`perimetreEcriture` et `HORS_SITUATION`) · la fonction ne fait que regrouper ce qu’on lui donne',
};
const EXCEPTIONS = [
    { fichier: 'src/common/journal-de-situation/extension-journal-de-situation.ts', fonction: 'garderJournalDeSituation', appel: 'ecriture.groupBy', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/common/journal-de-situation/extension-journal-de-situation.ts', fonction: 'garderJournalDeSituation', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/common/perimetre/extension-perimetre-journaux.ts', fonction: 'garderLignes', appel: 'ecriture.findMany', nombre: 1, motif: 'PERIMETRE_DES_JOURNAUX' },
    { fichier: 'src/common/perimetre/extension-perimetre-journaux.ts', fonction: 'garderLignes', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PERIMETRE_DES_JOURNAUX' },
    { fichier: 'src/common/perimetre/extension-perimetre-journaux.ts', fonction: 'garderPerimetreJournaux', appel: 'ecriture.findMany', nombre: 1, motif: 'PERIMETRE_DES_JOURNAUX' },
    { fichier: 'src/modules/analytique/analytique.service.ts', fonction: 'ventilerLigne', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'SUIT_SA_LIGNE' },
    { fichier: 'src/modules/analytique/analytique.service.ts', fonction: 'effacerVentilation', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'SUIT_SA_LIGNE' },
    { fichier: 'src/modules/analytique/engagement.service.ts', fonction: 'rattacherExecution', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/analytique/engagement.service.ts', fonction: 'rattacherExecution', appel: 'ligneEcriture.aggregate', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/pieces-jointes-ecriture.ts', fonction: 'lireEcritureDesPieces', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'verifierComptesCollectifs', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'trouverEnBrouillard', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'modifier', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'transfererDansUnJournalOrdinaire', appel: 'ecriture.findFirst', nombre: 2, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'supprimer', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'retirerCompensation', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'valider', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'reimputer', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'corrigerParInscriptionEnNegatif', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'inscrireEnNegatifPourAnnulation', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'chargerContreparties', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'FILTRE_DE_L_APPELANT' },
    { fichier: 'src/modules/comptes/compte.service.ts', fonction: 'modifier', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'USAGE' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'statutDansTx', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'facturesADesigner', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'lignesOuvertesDeLaCreance', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'lettrer416', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'ecrituresDeLaCreance', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'groupeDuModule', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'corrigerParResultatSousVerrou', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'retirerMouvement', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'retirerMouvement', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/devises/declaration-devise-a-nouveau.service.ts', fonction: 'prolongeUneLigneDeclaree', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/devises/declaration-devise-a-nouveau.service.ts', fonction: 'declarerSousVerrou', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/devises/declaration-devise-a-nouveau.service.ts', fonction: 'declarerParCorrection', appel: 'ligneEcriture.count', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/devises/devises.service.ts', fonction: 'declarerContrePassationSousVerrou', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/devises/devises.service.ts', fonction: 'candidatesContrePassationManuelle', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/emballages/emballages.service.ts', fonction: 'rattacherEcriture', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/emballages/emballages.service.ts', fonction: 'detacherEcriture', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/etats-financiers/dettes-rattachees.ts', fonction: 'dettesParPoste', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/etats-financiers/reglements-de-tresorerie.ts', fonction: 'naturesDesReglementsFournisseurs', appel: 'ligneEcriture.findMany', nombre: 2, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/exercice/exercice.service.ts', fonction: 'arreterALaDissolution', appel: 'ecriture.count', nombre: 1, motif: 'SUIT_SA_DATE' },
    { fichier: 'src/modules/exercice/exercice.service.ts', fonction: 'annulerArretDissolution', appel: 'ecriture.count', nombre: 1, motif: 'SUIT_SA_DATE' },
    { fichier: 'src/modules/exercice/exercice.service.ts', fonction: 'annulerArretDissolution', appel: 'ecriture.findMany', nombre: 1, motif: 'SUIT_SA_DATE' },
    { fichier: 'src/modules/exercice/exercice.service.ts', fonction: 'modifierFinDeLiquidation', appel: 'ecriture.count', nombre: 1, motif: 'SUIT_SA_DATE' },
    { fichier: 'src/modules/exercice/exercice.service.ts', fonction: 'retirerActesDeLaPeriode', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/exercice/exercice.service.ts', fonction: 'lireEtatAvantArret', appel: 'ecriture.findMany', nombre: 1, motif: 'SUIT_SA_DATE' },
    { fichier: 'src/modules/exercice/exercice.service.ts', fonction: 'lireActesDeLaPeriode', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/exercice/gel-cloture.ts', fonction: 'lignesFigees', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/facturation/facturation.service.ts', fonction: 'enregistrer', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/facturation/facturation.service.ts', fonction: 'emettreNoteDeCredit', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/groupe/groupe.service.ts', fonction: 'importerCanevasDuGroupe', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/immobilisations/immobilisation.service.ts', fonction: 'solderDetteAleatoire', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/immobilisations/immobilisation.service.ts', fonction: 'declarerReservePropriete', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/inventaire/inventaire.service.ts', fonction: 'rattacherEcritureRedressement', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/inventaire/inventaire.service.ts', fonction: 'detacherEcritureRedressement', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/journaux/analyse-journaux.service.ts', fonction: 'analyseJournaux', appel: 'ecriture.findMany', nombre: 2, motif: 'ETAT_DES_JOURNAUX' },
    { fichier: 'src/modules/journaux/analyse-journaux.service.ts', fonction: 'grilleSaisie', appel: 'ecriture.groupBy', nombre: 1, motif: 'ETAT_DES_JOURNAUX' },
    { fichier: 'src/modules/journaux/numerotation-piece.ts', fonction: 'prochainNumeroPiece', appel: 'ecriture.aggregate', nombre: 3, motif: 'NUMEROTATION' },
    { fichier: 'src/modules/lettrage/lettrage.service.ts', fonction: 'poserGroupeSoldeDuModule', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/lettrage.service.ts', fonction: 'creerGroupe', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/lettrage.service.ts', fonction: 'lettrerManuel', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/lettrage.service.ts', fonction: 'completer', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/lettrage.service.ts', fonction: 'preLettrage', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/lettrage.service.ts', fonction: 'confirmerPreLettrage', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/lettrage.service.ts', fonction: 'poserGroupeDuModule', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/ligne-de-reclassement.ts', fonction: 'lignesDuCompteClientReclasse', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/ligne-de-reclassement.ts', fonction: 'lignesReclasseesDuCompte', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/ligne-de-reclassement.ts', fonction: 'reportsDuReclassement', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/ligne-de-reclassement.ts', fonction: 'reportsDuReclassementParIdentifiants', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/ligne-de-reclassement.ts', fonction: 'lignesDeLaPerteAvecTva', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/lettrage/reconduction-lettrage.ts', fonction: 'poserGroupeReconduit', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/personnel/comptabilisation-paie.service.ts', fonction: 'annulerComptabilisation', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/plateforme/garnissage-demonstration.service.ts', fonction: 'garnirRapprochement', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/rapprochement/rapprochement.service.ts', fonction: 'pointer', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/rapprochement/rapprochement.service.ts', fonction: 'confirmer', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/registre-donateurs/donation.service.ts', fonction: 'inscrire', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/registre-donateurs/donation.service.ts', fonction: 'modifier', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/reglements/lignes-de-reevaluation.ts', fonction: 'lignesDeReevaluationSurLesTiers', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/reglements/reglements-sans-ecart.ts', fonction: 'reglementsSansEcart', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/reglements/reglements.service.ts', fonction: 'echeances', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/reglements/reglements.service.ts', fonction: 'enregistrer', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/regularisation/regularisation.service.ts', fonction: 'reprendre', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/stocks/magasin.service.ts', fonction: 'enregistrerMouvement', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/tenant/tenant.service.ts', fonction: 'demarrage', appel: 'ecriture.count', nombre: 1, motif: 'USAGE' },
    { fichier: 'src/modules/tenant/tenant.service.ts', fonction: 'parametres', appel: 'ecriture.count', nombre: 1, motif: 'USAGE' },
    { fichier: 'src/modules/tenant/tenant.service.ts', fonction: 'modifierJeuEtatsFinanciers', appel: 'ecriture.count', nombre: 1, motif: 'USAGE' },
    { fichier: 'src/modules/tenant/tenant.service.ts', fonction: 'modifierSystemeSyscohada', appel: 'ecriture.count', nombre: 1, motif: 'USAGE' },
    { fichier: 'src/modules/tiers/tiers.service.ts', fonction: 'supprimer', appel: 'ligneEcriture.count', nombre: 1, motif: 'USAGE' },
    { fichier: 'src/modules/tva/imputations-paiements.service.ts', fonction: 'lignesDeTiers', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/tva/imputations-paiements.service.ts', fonction: 'groupe', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/tva/taux-tva.service.ts', fonction: 'modifier', appel: 'ligneEcriture.count', nombre: 1, motif: 'USAGE' },
    { fichier: 'src/modules/tva/taux-tva.service.ts', fonction: 'calculerProrata', appel: 'ligneEcriture.aggregate', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/virements-fonds/virements-fonds.service.ts', fonction: 'creer', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/virements-fonds/virements-fonds.service.ts', fonction: 'annuler', appel: 'ecriture.findFirst', nombre: 2, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/virements-fonds/virements-fonds.service.ts', fonction: 'annuler', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/virements-fonds/virements-fonds.service.ts', fonction: 'annuler', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'fusionnerComptes', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'USAGE' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'annulerRevueSousVerrou', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'annulerReclassementSousVerrou', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/creances-douteuses/creances-douteuses.service.ts', fonction: 'annulerMouvementSousVerrou', appel: 'ligneEcriture.findMany', nombre: 3, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/devises/devises.service.ts', fonction: 'annulerContrePassationSousVerrou', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/devises/devises.service.ts', fonction: 'annulerContrePassationSousVerrou', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/devises/devises.service.ts', fonction: 'annulerSousVerrou', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/fiscalite/constat-impot.service.ts', fonction: 'annuler', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/fiscalite/constat-impot.service.ts', fonction: 'annuler', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/immobilisations/demantelement.service.ts', fonction: 'composant', appel: 'ligneEcriture.count', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/immobilisations/reprise-subvention.service.ts', fonction: 'proposer', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/personnel/comptabilisation-paie.service.ts', fonction: 'proposition', appel: 'ecriture.findMany', nombre: 2, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/personnel/personnel.service.ts', fonction: 'annulerBulletin', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/plateforme/garnissage-demonstration.service.ts', fonction: 'garnir', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/rapprochement/rapprochement.service.ts', fonction: 'obtenir', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'modifierPieceDuModule', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/immobilisations/annulation-traitement.service.ts', fonction: 'traitementsDuBien', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/immobilisations/annulation-traitement.service.ts', fonction: 'annuler', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/immobilisations/creation-depuis-ecritures.service.ts', fonction: 'creer', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/immobilisations/fiche-immobilisation.service.ts', fonction: 'lire', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/personnel/paiement-salaires.service.ts', fonction: 'confronterAu422', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/personnel/paiement-salaires.service.ts', fonction: 'payer', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
    { fichier: 'src/modules/personnel/paiement-salaires.service.ts', fonction: 'annuler', appel: 'ecriture.findFirst', nombre: 2, motif: 'PAR_IDENTIFIANT' },
];
function fichiersSources(dossier, acc = []) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
        const p = path.join(dossier, e.name);
        if (e.isDirectory())
            fichiersSources(p, acc);
        else if (p.endsWith('.ts') && !p.endsWith('.spec.ts'))
            acc.push(p);
    }
    return acc;
}
function sauter(src, j) {
    const c = src[j];
    if (c === '/' && src[j + 1] === '/')
        return src.indexOf('\n', j) === -1 ? src.length : src.indexOf('\n', j);
    if (c === '/' && src[j + 1] === '*')
        return src.indexOf('*/', j) + 1;
    if (c === "'" || c === '"' || c === '`') {
        let k = j + 1;
        while (k < src.length && src[k] !== c) {
            if (src[k] === '\\')
                k++;
            k++;
        }
        return k;
    }
    return -1;
}
function argumentDeLAppel(src, ouvrante) {
    let profondeur = 0;
    for (let j = ouvrante; j < src.length; j++) {
        const s = sauter(src, j);
        if (s >= 0) {
            j = s;
            continue;
        }
        if (src[j] === '(')
            profondeur++;
        if (src[j] === ')' && --profondeur === 0)
            return src.slice(ouvrante, j + 1);
    }
    return src.slice(ouvrante);
}
function expression(src, debut, finALaLigne = false) {
    let profondeur = 0;
    for (let j = debut; j < src.length; j++) {
        const s = sauter(src, j);
        if (s >= 0) {
            j = s;
            continue;
        }
        const c = src[j];
        if ('([{'.includes(c))
            profondeur++;
        else if (')]}'.includes(c)) {
            if (profondeur === 0)
                return src.slice(debut, j);
            profondeur--;
        }
        else if (profondeur === 0 && (c === ',' || c === ';'))
            return src.slice(debut, j);
        else if (finALaLigne && profondeur === 0 && c === '\n') {
            const avant = src.slice(debut, j).trimEnd();
            const apres = src.slice(j + 1).trimStart();
            if (!/[=(,[{?:|&+]$/.test(avant) && !/^[.?:|&]/.test(apres))
                return src.slice(debut, j);
        }
    }
    return src.slice(debut);
}
function filtreDeLAppel(arg) {
    let profondeur = 0;
    for (let j = 0; j < arg.length; j++) {
        const s = sauter(arg, j);
        if (s >= 0) {
            j = s;
            continue;
        }
        const c = arg[j];
        if ('([{'.includes(c))
            profondeur++;
        else if (')]}'.includes(c))
            profondeur--;
        else if (profondeur === 2 && /^where\b/.test(arg.slice(j, j + 6)) && !/[\w$.]/.test(arg[j - 1] ?? '')) {
            const apres = arg.slice(j + 5).match(/^\s*(:)?/);
            if (apres[1])
                return expression(arg, j + 5 + apres[0].length);
            return 'where';
        }
    }
    return '';
}
const ENTETES = [
    /^ {2}(?:(?:public|private|protected|static|async|readonly|override)\s+)*(?:get\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^>\n]*>)?\s*\(/,
    /^ {2}(?:(?:public|private|protected|static|readonly)\s+)*([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:async\s*)?\(/,
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
    /^(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:\(|function|[A-Za-z_$][\w$]*\s*=>)/,
];
const MOTS_CLES = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'constructor', 'await']);
function fonctionEnglobante(lignes, n) {
    for (let k = n; k >= 0; k--) {
        for (const r of ENTETES) {
            const m = r.exec(lignes[k]);
            if (m && !MOTS_CLES.has(m[1]))
                return { nom: m[1], debut: k };
        }
    }
    return { nom: '(module)', debut: 0 };
}
const JETON_STATUT = /\bstatut\b|\bHORS_SITUATION\b|\bfiltreDuStatut\b/;
function sansCommentaires(texte) {
    let sortie = '';
    for (let j = 0; j < texte.length; j++) {
        const s = sauter(texte, j);
        if (s >= 0) {
            if (texte[j] === '/')
                sortie += ' ';
            else
                sortie += texte.slice(j, s + 1);
            j = s;
            continue;
        }
        sortie += texte[j];
    }
    return sortie;
}
function elements(texte) {
    const interieur = sansCommentaires(texte.trim()).slice(1, -1);
    const resultat = [];
    let profondeur = 0;
    let debut = 0;
    for (let j = 0; j < interieur.length; j++) {
        const s = sauter(interieur, j);
        if (s >= 0) {
            j = s;
            continue;
        }
        const c = interieur[j];
        if ('([{'.includes(c))
            profondeur++;
        else if (')]}'.includes(c))
            profondeur--;
        else if (c === ',' && profondeur === 0) {
            resultat.push(interieur.slice(debut, j).trim());
            debut = j + 1;
        }
    }
    resultat.push(interieur.slice(debut).trim());
    return resultat.filter((x) => x !== '');
}
function nue(expr) {
    let e = sansCommentaires(expr).trim();
    for (let change = true; change;) {
        change = false;
        const cast = /\s+(?:as|satisfies)\s+[\w$.<>\[\], |]+$/.exec(e);
        if (cast) {
            e = e.slice(0, cast.index).trim();
            change = true;
        }
        if (e.startsWith('(') && argumentDeLAppel(e, 0).length === e.length) {
            e = e.slice(1, -1).trim();
            change = true;
        }
    }
    return e;
}
function ternaire(e) {
    let profondeur = 0;
    let question = -1;
    for (let j = 0; j < e.length; j++) {
        const s = sauter(e, j);
        if (s >= 0) {
            j = s;
            continue;
        }
        const c = e[j];
        if ('([{'.includes(c))
            profondeur++;
        else if (')]}'.includes(c))
            profondeur--;
        else if (profondeur === 0 && c === '?' && e[j + 1] !== '.' && e[j + 1] !== '?' && e[j - 1] !== '?') {
            if (question < 0)
                question = j;
        }
        else if (profondeur === 0 && c === ':' && question >= 0) {
            return [e.slice(0, question), e.slice(question + 1, j), e.slice(j + 1)];
        }
    }
    return null;
}
function poseLeStatut(expr, niveau, contexte, entete, profondeur = 0) {
    const e = nue(expr).replace(/^this\./, '').replace(/^([A-Za-z_$][\w$]*)\[[^\]]*\]$/, '$1.membre');
    if (!e || profondeur > 6)
        return false;
    if (categorieDuFiltre(e))
        return true;
    const t = ternaire(e);
    if (t)
        return poseLeStatut(t[1], niveau, contexte, entete, profondeur + 1) && poseLeStatut(t[2], niveau, contexte, entete, profondeur + 1);
    if (e.startsWith('{')) {
        for (const entree of elements(e)) {
            if (entree.startsWith('...')) {
                if (poseLeStatut(entree.slice(3), niveau, contexte, entete, profondeur + 1))
                    return true;
                continue;
            }
            const m = /^([A-Za-z_$][\w$]*)\s*(:)?/.exec(entree);
            if (!m)
                continue;
            const cle = m[1];
            const valeur = m[2] ? entree.slice(m[0].length) : cle;
            if (niveau === 'ecriture' && cle === 'statut')
                return true;
            if (cle === 'AND' || cle === 'NOT' || (cle === 'is' && niveau === 'ecriture')) {
                const v = nue(valeur);
                const branches = v.startsWith('[') ? elements(v) : [v];
                if (branches.some((b) => poseLeStatut(b, niveau, contexte, entete, profondeur + 1)))
                    return true;
            }
            if (cle === 'OR') {
                const v = nue(valeur);
                const branches = v.startsWith('[') ? elements(v) : [v];
                if (branches.length > 0 && branches.every((b) => poseLeStatut(b, niveau, contexte, entete, profondeur + 1)))
                    return true;
            }
            if (niveau === 'ligne' && cle === 'ecriture' && poseLeStatut(valeur, 'ecriture', contexte, entete, profondeur + 1))
                return true;
        }
        return false;
    }
    if (niveau === 'ecriture' && (/^HORS_SITUATION$/.test(e) || /^filtreDuStatut\s*\(/.test(e)))
        return true;
    const nom = /^([A-Za-z_$][\w$]*)/.exec(e)?.[1];
    if (nom && Object.keys(FILTRES_NOMMES).includes(nom))
        return true;
    const appel = /^([A-Za-z_$][\w$]*)\s*\(/.exec(e);
    if (appel) {
        const fleche = new RegExp(`(?:const|let)\\s+${appel[1]}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::[^=\\n]+)?=>\\s*`, 'g');
        for (const lieu of [contexte, entete]) {
            let m;
            fleche.lastIndex = 0;
            while ((m = fleche.exec(lieu))) {
                if (poseLeStatut(expression(lieu, m.index + m[0].length, true), niveau, contexte, entete, profondeur + 1))
                    return true;
            }
        }
        return false;
    }
    const membre = /^([A-Za-z_$][\w$]*)\.[A-Za-z_$][\w$]*$/.exec(e);
    const id = membre ? membre[1] : e;
    if (!/^[A-Za-z_$][\w$]*$/.test(id))
        return false;
    const lieux = [
        [contexte, new RegExp(`(?:const|let)\\s+(?:\\{[^}=]*\\b${id}\\b[^}=]*\\}|${id})\\s*(?::[^=\\n]+)?=`, 'g')],
        [entete, new RegExp(`^(?:export\\s+)?(?:const|let)\\s+${id}\\s*(?::[^=\\n]+)?=`, 'gm')],
    ];
    for (const [lieu, r] of lieux) {
        let m;
        while ((m = r.exec(lieu))) {
            if (poseLeStatut(expression(lieu, m.index + m[0].length, true), niveau, contexte, entete, profondeur + 1))
                return true;
        }
    }
    return false;
}
function filtreAdmisStrict(filtre, niveau, contexte, entete) {
    if (categorieDuFiltre(filtre))
        return true;
    return poseLeStatut(filtre, niveau, contexte, entete);
}
function bloc(src, debut) {
    let profondeur = 0;
    for (let j = debut; j < src.length; j++) {
        const s = sauter(src, j);
        if (s >= 0) {
            j = s;
            continue;
        }
        if (src[j] === '{')
            profondeur++;
        if (src[j] === '}' && --profondeur === 0)
            return src.slice(debut, j + 1);
    }
    return src.slice(debut);
}
function definition(src, nom) {
    const fonction = new RegExp(`^\\s*(?:export\\s+)?(?:(?:async|private|public|protected|static)\\s+)*(?:function\\s+)?${nom}\\s*(?:<[^>\\n]*>)?\\s*\\(`, 'm').exec(src);
    if (fonction) {
        const parametres = argumentDeLAppel(src, fonction.index + fonction[0].length - 1);
        const apres = fonction.index + fonction[0].length - 1 + parametres.length;
        const ouverture = /\{[ \t]*\n/.exec(src.slice(apres));
        return ouverture ? bloc(src, apres + ouverture.index) : null;
    }
    const constante = new RegExp(`^(?:export\\s+)?const\\s+${nom}\\b[^=\\n]*=`, 'm').exec(src);
    return constante ? expression(src, constante.index + constante[0].length, true) : null;
}
const MOTIF_APPEL = /\.(ligneEcriture|ecriture)\s*\.(findMany|findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|aggregate|groupBy|count)\s*\(/g;
function recenser() {
    const appels = [];
    const nonAdmis = [];
    const brutes = [];
    for (const chemin of fichiersSources(path.join(RACINE, 'src'))) {
        const src = fs.readFileSync(chemin, 'utf8');
        const fichier = path.relative(RACINE, chemin).split(path.sep).join('/');
        const lignes = src.split('\n');
        const entete = src;
        let m;
        MOTIF_APPEL.lastIndex = 0;
        while ((m = MOTIF_APPEL.exec(src))) {
            const arg = argumentDeLAppel(src, m.index + m[0].length - 1);
            const n = src.slice(0, m.index + m[0].length).split('\n').length - 1;
            const f = fonctionEnglobante(lignes, n);
            const contexte = lignes.slice(f.debut, n + 1).join('\n');
            const appel = { fichier, ligne: n + 1, fonction: f.nom, appel: `${m[1]}.${m[2]}`, filtre: filtreDeLAppel(arg) };
            appels.push(appel);
            if (!filtreAdmisStrict(appel.filtre, m[1] === 'ecriture' ? 'ecriture' : 'ligne', contexte, entete))
                nonAdmis.push(appel);
        }
        for (const r of src.matchAll(/\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)\s*(?:`([^`]*)`|\()/g)) {
            const texte = r[1] ?? '';
            if (/"(?:ecritures|lignes_ecriture)"/.test(texte) && !/"statut"/.test(texte))
                brutes.push(`${fichier} · ${texte.slice(0, 80)}`);
        }
    }
    return { appels, nonAdmis, brutes };
}
describe('Écritures de situation · aucune lecture ne les voit sans le dire (filet)', () => {
    const { appels, nonAdmis, brutes } = recenser();
    it('le recensement trouve encore les lectures · sinon il ne prouverait rien', () => {
        expect(appels.length).toBeGreaterThan(300);
        const balance = appels.find((a) => a.fichier.endsWith('relances.service.ts') && a.fonction === 'positions');
        expect(balance?.filtre).toMatch(/ecriture/);
    });
    it('chaque lecture sans statut est couverte par une exception nommée, au nombre près', () => {
        const parCle = new Map();
        for (const a of nonAdmis) {
            const cle = `${a.fichier} | ${a.fonction} | ${a.appel}`;
            parCle.set(cle, [...(parCle.get(cle) ?? []), a]);
        }
        const attendu = new Map(EXCEPTIONS.map((e) => [`${e.fichier} | ${e.fonction} | ${e.appel}`, e.nombre]));
        const nonCouverts = [...parCle.entries()]
            .filter(([cle, liste]) => attendu.get(cle) !== liste.length)
            .map(([cle, liste]) => `${cle} · ${liste.length} (lignes ${liste.map((a) => a.ligne).join(', ')}) · exception ${attendu.get(cle) ?? 'aucune'}`);
        const perimees = [...attendu.entries()].filter(([cle]) => !parCle.has(cle)).map(([cle, n]) => `${cle} · exception ${n} pour aucun appel`);
        expect([...nonCouverts, ...perimees]).toEqual([]);
    });
    it('chaque filtre nommé pose le statut dans sa définition, lui-même ou par un filtre nommé qui le pose', () => {
        const corps = new Map();
        for (const [nom, fichier] of Object.entries(FILTRES_NOMMES)) {
            const lu = definition(fs.readFileSync(path.join(RACINE, fichier), 'utf8'), nom);
            expect({ nom, trouve: lu !== null }).toEqual({ nom, trouve: true });
            corps.set(nom, lu ?? '');
        }
        const posent = new Set([...corps].filter(([, c]) => JETON_STATUT.test(c)).map(([n]) => n));
        for (let change = true; change;) {
            change = false;
            for (const [nom, c] of corps) {
                if (!posent.has(nom) && [...posent].some((n) => new RegExp(`\\b${n}\\b`).test(c))) {
                    posent.add(nom);
                    change = true;
                }
            }
        }
        expect([...corps.keys()].filter((n) => !posent.has(n))).toEqual([]);
    });
    it('le statut se lit au niveau de l’écriture, en position de filtre (second tour, b)', () => {
        const vide = '';
        expect(poseLeStatut('{ tenantId, statut: StatutEcriture.VALIDEE }', 'ecriture', vide, vide)).toBe(true);
        expect(poseLeStatut('{ compteId, ecriture: { tenantId, ...HORS_SITUATION } }', 'ligne', vide, vide)).toBe(true);
        expect(poseLeStatut('{ AND: [{ date }, { statut: X }] }', 'ecriture', vide, vide)).toBe(true);
        expect(poseLeStatut('{ tenantId, exercice: { statut: StatutExercice.OUVERT } }', 'ecriture', vide, vide)).toBe(false);
        expect(poseLeStatut("{ compteId, lettrage: { statut: 'PARTIEL' }, ecriture: { tenantId } }", 'ligne', vide, vide)).toBe(false);
        expect(poseLeStatut('{ compteId, statut: X, ecriture: { tenantId } }', 'ligne', vide, vide)).toBe(false);
        expect(poseLeStatut('{ OR: [{ statut: X }, { date }] }', 'ecriture', vide, vide)).toBe(false);
        expect(poseLeStatut('{ OR: [{ statut: X }, { statut: Y }] }', 'ecriture', vide, vide)).toBe(true);
        const contexte = 'const filtre = { tenantId, ...HORS_SITUATION };\nconst borne = { statut: X };';
        expect(poseLeStatut('{ ecriture: filtre }', 'ligne', contexte, vide)).toBe(true);
        expect(poseLeStatut('{ tenantId, date: { lte: borne } }', 'ecriture', contexte, vide)).toBe(false);
        expect(poseLeStatut('x ? { statut: A } : HORS_SITUATION', 'ecriture', vide, vide)).toBe(true);
        expect(poseLeStatut('x ? { statut: A } : {}', 'ecriture', vide, vide)).toBe(false);
    });
    it('chaque exception porte un motif de la liste fermée et un nombre positif', () => {
        for (const e of EXCEPTIONS) {
            expect(MOTIFS[e.motif]).toBeDefined();
            expect(e.nombre).toBeGreaterThan(0);
        }
    });
    it('aucune requête brute ne lit les écritures sans nommer le statut', () => {
        expect(brutes).toEqual([]);
    });
});
//# sourceMappingURL=lectures-hors-situation.spec.js.map