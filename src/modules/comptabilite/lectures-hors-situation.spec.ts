import * as fs from 'fs';
import * as path from 'path';

/**
 * LE FILET DES ÉCRITURES DE SITUATION (ligne sage-l1, fonction 12, relecture
 * du premier tour). Une écriture de situation n'enregistre aucune opération ·
 * aucun livre, état, contrôle, proposition ni rattachement ne la lit
 * (`ecritures-de-situation.ts`, décision D-L1-12). La relecture a trouvé une
 * quinzaine de lectures qui la voyaient encore · une relance partait sur une
 * facture simulée, une élimination du groupe minorait le résultat combiné,
 * une simulation se rattachait à un écart d'inventaire. Chaque défaut laisse
 * la balance bouclée · il ne se voit nulle part en aval (CLAUDE.md § 10 bis).
 *
 * Ce test DÉCOUPE chaque appel `ecriture` et `ligneEcriture` (findMany,
 * findFirst, findUnique, aggregate, groupBy, count) de `src/`, en isole le
 * FILTRE (`where`), et exige qu'il pose un statut. Il s'ancre sur la
 * STRUCTURE de l'appel (parenthèses et accolades équilibrées, chaînes et
 * commentaires sautés), jamais sur une distance (CLAUDE.md § 10). Est admis :
 *  1. un filtre qui pose `statut` AU NIVEAU DE L'ÉCRITURE (tête du filtre
 *     d'une lecture des écritures, clé `ecriture` d'une lecture des lignes, à
 *     travers `AND`, `OR` · chaque branche, `NOT` et `is`), `HORS_SITUATION`
 *     ou `filtreDuStatut` · jamais le statut d'un exercice ou d'un lettrage
 *     (second tour, b) ;
 *  2. un FILTRE NOMMÉ de la liste fermée ci-dessous, dont la définition est
 *     relue et doit elle-même poser le statut ;
 *  3. une variable déclarée dans la fonction englobante, ou en tête du
 *     fichier, dont l'initialisation satisfait 1, 2 ou 4 (de proche en proche),
 *     lue en POSITION DE FILTRE seulement (le filtre entier, `...x`, la valeur
 *     de `ecriture`, une branche) · jamais la valeur d'un champ ;
 *  4. une CATÉGORIE STRUCTURELLE, liste fermée · une lecture qui, par son
 *     filtre même, ne peut rencontrer aucune simulation ;
 *  5. une EXCEPTION nommée (fichier, fonction, appel, nombre, motif), liste
 *     fermée · le nombre est exact, une exception qui ne sert plus fait tomber
 *     le test autant qu'un appel nouveau qu'elle ne couvre pas.
 * Un `$queryRaw` qui lit les tables des écritures doit nommer le statut.
 */

const RACINE = path.resolve(__dirname, '../../..');

// ---------------------------------------------------------------------------
// LES FILTRES NOMMÉS · fonction ou constante définie ailleurs, et relue ici.
// ---------------------------------------------------------------------------
const FILTRES_NOMMES: Record<string, string> = {
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

// ---------------------------------------------------------------------------
// LES CATÉGORIES STRUCTURELLES · liste fermée, chacune avec sa preuve.
// ---------------------------------------------------------------------------
const CATEGORIES: Array<{ nom: string; motif: string; repond: (filtre: string) => boolean }> = [
  {
    nom: 'LETTREES_OU_POINTEES',
    motif:
      "une ligne de situation n'est jamais lettrée ni pointée · le lettrage (manuel, automatique, du module) et le " +
      'pointage la refusent, et la reprise des journaux de situation a laissé au brouillard toute écriture déjà ' +
      'lettrée ou pointée (migration 20270171040000) · une lecture bornée aux lignes lettrées ou pointées ne la ' +
      'rencontre donc jamais',
    // `lettrageId: null` (les ouvertes) n'en est pas · `{ not: null }`, une
    // valeur ou une liste, si. De même la lettre et le rapprochement.
    // Une ligne d'un groupe PARTIEL (`lettrageId: { not: null }` et
    // `lettre: null`) est dans un groupe · elle en est (second tour, b · le
    // filet l'admettait sur le `statut` du lettrage, qui ne trie pas la ligne).
    repond: (f) =>
      /\blettrageId\s*:\s*\{\s*not\s*:\s*null\s*\}/.test(f) ||
      (/\b(?:lettrageId|lettre|rapprochementId)\b\s*(?::\s*(?!null\b)|[,}\n])/.test(f) &&
        !/\b(?:lettrageId|lettre|rapprochementId)\s*:\s*null\b/.test(f)),
  },
  {
    nom: 'ECRITURES_DE_CLOTURE',
    motif:
      "le report à-nouveau, l'à-nouveau provisoire et l'écriture qui solde les comptes de gestion naissent de la " +
      "clôture, jamais dans un journal de situation · l'extension `journal-de-situation` y refuse toute écriture " +
      "qui n'est pas une simulation saisie",
    repond: (f) =>
      /\b(?:estGenereeParCloture|estANouveauProvisoire|estSoldeDesComptesDeGestion)\s*:\s*true\b|\bA_NOUVEAU\b|\bECRITURE_D_A_NOUVEAU\b|\bfiltreANouveauEcarte\b/.test(
        f,
      ),
  },
];

/**
 * Une catégorie ne vaut que pour ce que le filtre RETIENT · sous un `NOT`, le
 * même jeton écarte, et tout le reste (simulations comprises) passe. Un
 * filtre qui porte une négation ne se range donc dans aucune catégorie.
 */
const categorieDuFiltre = (filtre: string) => (/\bNOT\b/.test(filtre) ? undefined : CATEGORIES.find((c) => c.repond(filtre)));

// ---------------------------------------------------------------------------
// LES EXCEPTIONS · liste fermée, nombre exact, motif.
// ---------------------------------------------------------------------------
type Motif =
  | 'PAR_IDENTIFIANT'
  | 'USAGE'
  | 'NUMEROTATION'
  | 'PERIMETRE_DES_JOURNAUX'
  | 'SUIT_SA_DATE'
  | 'SUIT_SA_LIGNE'
  | 'ETAT_DES_JOURNAUX'
  | 'FILTRE_DE_L_APPELANT'
  | 'DECOMPTE_DE_CE_QUI_PART';
const MOTIFS: Record<Motif, string> = {
  PAR_IDENTIFIANT:
    "l'écriture ou la ligne est désignée par son identifiant · reçue du client et JUGÉE ensuite (refus nommé d'une " +
    "simulation), tirée d'une lecture déjà filtrée, désignée par la liaison d'un module (l'extension " +
    '`journal-de-situation` refuse à un module tout journal de situation), ou relue par la garde même qui juge',
  USAGE:
    "un usage est un usage · une simulation mouvemente le compte, le journal, le taux ou le dossier aussi " +
    "sûrement qu'une opération, et le garde qui refuse de supprimer ou de transformer doit la compter",
  NUMEROTATION: 'la numérotation des pièces de SON journal · un journal de situation se numérote sur lui seul',
  PERIMETRE_DES_JOURNAUX:
    "le périmètre des journaux d'un utilisateur juge le journal de la pièce visée, simulation comprise · " +
    "un journal de situation interdit garde ses simulations",
  SUIT_SA_DATE:
    "l'arrêt à la dissolution, son annulation et la fin de liquidation font suivre à toute écriture l'exercice qui " +
    'couvre sa date · une simulation laissée derrière resterait dans un exercice qui ne la couvre plus',
  SUIT_SA_LIGNE:
    "la ventilation analytique suit la ligne qu'elle ventile · celle d'une simulation se pose et s'efface avec elle, " +
    'et aucun cumul analytique ne la lit (`cumulsPlan` pose le statut)',
  ETAT_DES_JOURNAUX:
    "l'analyse et l'état des journaux montrent CHAQUE journal sur sa ligne · celle d'un journal de situation porte " +
    'ses simulations sous leur propre sigle (jamais en brouillard), et aucun total ne les ajoute aux autres journaux',
  FILTRE_DE_L_APPELANT:
    "le filtre est reçu de l'appelant, dans le même fichier, qui pose lui-même le statut (le grand livre, " +
    '`perimetreEcriture` et `HORS_SITUATION`) · la fonction ne fait que regrouper ce qu’on lui donne',
  DECOMPTE_DE_CE_QUI_PART:
    "le décompte de ce que la suppression d'un dossier d'essai emporte compte TOUT, brouillard et situation compris " +
    "(la trace n'a que des nombres) · le filtrer sous-dirait ce qui part, et rien n'est servi comme un état comptable",
};
interface Exception {
  fichier: string;
  fonction: string;
  appel: string;
  nombre: number;
  motif: Motif;
}
const EXCEPTIONS: Exception[] = [
  { fichier: 'src/common/journal-de-situation/extension-journal-de-situation.ts', fonction: 'garderJournalDeSituation', appel: 'ecriture.groupBy', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/common/journal-de-situation/extension-journal-de-situation.ts', fonction: 'garderJournalDeSituation', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/common/perimetre/extension-perimetre-journaux.ts', fonction: 'garderLignes', appel: 'ecriture.findMany', nombre: 1, motif: 'PERIMETRE_DES_JOURNAUX' },
  { fichier: 'src/common/perimetre/extension-perimetre-journaux.ts', fonction: 'garderLignes', appel: 'ligneEcriture.findMany', nombre: 1, motif: 'PERIMETRE_DES_JOURNAUX' },
  { fichier: 'src/common/perimetre/extension-perimetre-journaux.ts', fonction: 'garderPerimetreJournaux', appel: 'ecriture.findMany', nombre: 1, motif: 'PERIMETRE_DES_JOURNAUX' },
  { fichier: 'src/modules/analytique/analytique.service.ts', fonction: 'ventilerLigne', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'SUIT_SA_LIGNE' },
  { fichier: 'src/modules/analytique/analytique.service.ts', fonction: 'effacerVentilation', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'SUIT_SA_LIGNE' },
  { fichier: 'src/modules/analytique/engagement.service.ts', fonction: 'rattacherExecution', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/modules/analytique/engagement.service.ts', fonction: 'rattacherExecution', appel: 'ligneEcriture.aggregate', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  // Ligne sage-l6 · la pièce jointe se dépose sur une écriture désignée par son identifiant, simulation comprise (une
  // simulation se justifie comme une opération) ; la règle du retrait lit son statut, elle ne le filtre pas.
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
  { fichier: 'src/modules/plateforme/essais-echus/essais-echus.service.ts', fonction: 'lire', appel: 'ecriture.groupBy', nombre: 1, motif: 'DECOMPTE_DE_CE_QUI_PART' },
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
  // Second tour (b) · la lecture structurelle ne prend plus le statut du
  // lettrage, de l'exercice ou d'une variable hors de sa position de filtre ·
  // ces lectures, admises jusque-là par un mot, sont rangées à leur motif.
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
  // Ligne sage-l4, intégrée avant la ligne sage-l1 · la pièce d'un module et
  // les écritures des traitements d'un bien, désignées par leur liaison (un
  // module n'écrit jamais dans un journal de situation), et la ligne choisie
  // pour faire naître un bien, jugée ensuite (`motifRefusLigneACreer` nomme
  // la simulation).
  { fichier: 'src/modules/comptabilite/ecriture.service.ts', fonction: 'modifierPieceDuModule', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/modules/immobilisations/annulation-traitement.service.ts', fonction: 'traitementsDuBien', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/modules/immobilisations/annulation-traitement.service.ts', fonction: 'annuler', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/modules/immobilisations/creation-depuis-ecritures.service.ts', fonction: 'creer', appel: 'ligneEcriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/modules/immobilisations/fiche-immobilisation.service.ts', fonction: 'lire', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  // Ligne sage-l5, intégrée avant la ligne sage-l1 · les pièces d'un paiement
  // des salaires et de la passation de la paie, désignées par leur liaison
  // (le 422 qu'elles confrontent pose le statut, `avecStatut`).
  { fichier: 'src/modules/personnel/paiement-salaires.service.ts', fonction: 'confronterAu422', appel: 'ecriture.findMany', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/modules/personnel/paiement-salaires.service.ts', fonction: 'payer', appel: 'ecriture.findFirst', nombre: 1, motif: 'PAR_IDENTIFIANT' },
  { fichier: 'src/modules/personnel/paiement-salaires.service.ts', fonction: 'annuler', appel: 'ecriture.findFirst', nombre: 2, motif: 'PAR_IDENTIFIANT' },
];

// ---------------------------------------------------------------------------
// LE DÉCOUPAGE
// ---------------------------------------------------------------------------
function fichiersSources(dossier: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) fichiersSources(p, acc);
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) acc.push(p);
  }
  return acc;
}

/** Saute une chaîne ou un commentaire commençant en `j` · rend la position de sa fin, ou -1. */
function sauter(src: string, j: number): number {
  const c = src[j];
  if (c === '/' && src[j + 1] === '/') return src.indexOf('\n', j) === -1 ? src.length : src.indexOf('\n', j);
  if (c === '/' && src[j + 1] === '*') return src.indexOf('*/', j) + 1;
  if (c === "'" || c === '"' || c === '`') {
    let k = j + 1;
    while (k < src.length && src[k] !== c) {
      if (src[k] === '\\') k++;
      k++;
    }
    return k;
  }
  return -1;
}

/** L'argument d'un appel, de sa parenthèse ouvrante à la fermante qui l'équilibre. */
function argumentDeLAppel(src: string, ouvrante: number): string {
  let profondeur = 0;
  for (let j = ouvrante; j < src.length; j++) {
    const s = sauter(src, j);
    if (s >= 0) {
      j = s;
      continue;
    }
    if (src[j] === '(') profondeur++;
    if (src[j] === ')' && --profondeur === 0) return src.slice(ouvrante, j + 1);
  }
  return src.slice(ouvrante);
}

/** Une expression · jusqu'à la virgule, au point-virgule ou à la fermante qui la termine, à profondeur nulle. */
function expression(src: string, debut: number, finALaLigne = false): string {
  let profondeur = 0;
  for (let j = debut; j < src.length; j++) {
    const s = sauter(src, j);
    if (s >= 0) {
      j = s;
      continue;
    }
    const c = src[j];
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) {
      if (profondeur === 0) return src.slice(debut, j);
      profondeur--;
    } else if (profondeur === 0 && (c === ',' || c === ';')) return src.slice(debut, j);
    else if (finALaLigne && profondeur === 0 && c === '\n') {
      const avant = src.slice(debut, j).trimEnd();
      const apres = src.slice(j + 1).trimStart();
      if (!/[=(,[{?:|&+]$/.test(avant) && !/^[.?:|&]/.test(apres)) return src.slice(debut, j);
    }
  }
  return src.slice(debut);
}

/**
 * Le FILTRE d'un appel · la valeur de sa clé `where`, au premier niveau de
 * l'objet passé ; le nom seul (`where`) quand la clé est abrégée ; rien quand
 * l'appel n'en porte pas (lecture du dossier entier).
 */
function filtreDeLAppel(arg: string): string {
  let profondeur = 0;
  for (let j = 0; j < arg.length; j++) {
    const s = sauter(arg, j);
    if (s >= 0) {
      j = s;
      continue;
    }
    const c = arg[j];
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    else if (profondeur === 2 && /^where\b/.test(arg.slice(j, j + 6)) && !/[\w$.]/.test(arg[j - 1] ?? '')) {
      const apres = arg.slice(j + 5).match(/^\s*(:)?/)!;
      if (apres[1]) return expression(arg, j + 5 + apres[0].length);
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

/** La fonction qui contient la ligne `n` · son nom et sa première ligne. */
function fonctionEnglobante(lignes: string[], n: number): { nom: string; debut: number } {
  for (let k = n; k >= 0; k--) {
    for (const r of ENTETES) {
      const m = r.exec(lignes[k]);
      if (m && !MOTS_CLES.has(m[1])) return { nom: m[1], debut: k };
    }
  }
  return { nom: '(module)', debut: 0 };
}

const JETON_STATUT = /\bstatut\b|\bHORS_SITUATION\b|\bfiltreDuStatut\b/;

/** Le texte sans ses commentaires · les chaînes gardées telles quelles. */
function sansCommentaires(texte: string): string {
  let sortie = '';
  for (let j = 0; j < texte.length; j++) {
    const s = sauter(texte, j);
    if (s >= 0) {
      if (texte[j] === '/') sortie += ' ';
      else sortie += texte.slice(j, s + 1);
      j = s;
      continue;
    }
    sortie += texte[j];
  }
  return sortie;
}

/** Les entrées d'un objet littéral ou les éléments d'un tableau, au premier niveau. */
function elements(texte: string): string[] {
  const interieur = sansCommentaires(texte.trim()).slice(1, -1);
  const resultat: string[] = [];
  let profondeur = 0;
  let debut = 0;
  for (let j = 0; j < interieur.length; j++) {
    const s = sauter(interieur, j);
    if (s >= 0) {
      j = s;
      continue;
    }
    const c = interieur[j];
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    else if (c === ',' && profondeur === 0) {
      resultat.push(interieur.slice(debut, j).trim());
      debut = j + 1;
    }
  }
  resultat.push(interieur.slice(debut).trim());
  return resultat.filter((x) => x !== '');
}

/** L'expression nue · parenthèses englobantes, `as T` et `satisfies T` de queue retirés. */
function nue(expr: string): string {
  let e = sansCommentaires(expr).trim();
  for (let change = true; change; ) {
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

/** Le ternaire de premier niveau · `[condition, si, sinon]`, ou null (`?.` et `??` sautés). */
function ternaire(e: string): [string, string, string] | null {
  let profondeur = 0;
  let question = -1;
  for (let j = 0; j < e.length; j++) {
    const s = sauter(e, j);
    if (s >= 0) {
      j = s;
      continue;
    }
    const c = e[j];
    if ('([{'.includes(c)) profondeur++;
    else if (')]}'.includes(c)) profondeur--;
    else if (profondeur === 0 && c === '?' && e[j + 1] !== '.' && e[j + 1] !== '?' && e[j - 1] !== '?') {
      if (question < 0) question = j;
    } else if (profondeur === 0 && c === ':' && question >= 0) {
      return [e.slice(0, question), e.slice(question + 1, j), e.slice(j + 1)];
    }
  }
  return null;
}

type Niveau = 'ecriture' | 'ligne';

/**
 * LE FILTRE POSE-T-IL LE STATUT DE L'ÉCRITURE ? (relecture du second tour, b)
 * · lu par sa STRUCTURE, à la place de la recherche d'un mot n'importe où.
 * Le statut compte au niveau de l'ÉCRITURE seulement · la tête du filtre d'une
 * lecture des écritures, la clé `ecriture` de celui d'une lecture des lignes,
 * à travers `AND`, `OR` (chaque branche), `NOT` et `is`. Un `statut` posé sur
 * l'exercice, le lettrage ou les lignes d'en face ne trie pas l'écriture lue.
 * Une variable ne se résout qu'en POSITION DE FILTRE · le filtre entier, une
 * décomposition (`...x`), la valeur de `ecriture`, une branche · jamais la
 * valeur d'un champ (`date: { lte: x }`).
 */
function poseLeStatut(expr: string, niveau: Niveau, contexte: string, entete: string, profondeur = 0): boolean {
  // `this.filtre(…)` se lit comme `filtre(…)`, `filtres[colonne]` comme `filtres.colonne`.
  const e = nue(expr).replace(/^this\./, '').replace(/^([A-Za-z_$][\w$]*)\[[^\]]*\]$/, '$1.membre');
  if (!e || profondeur > 6) return false;
  // Une catégorie structurelle vaut à chaque niveau · une branche d'un `OR`,
  // la valeur d'une variable.
  if (categorieDuFiltre(e)) return true;
  const t = ternaire(e);
  if (t) return poseLeStatut(t[1], niveau, contexte, entete, profondeur + 1) && poseLeStatut(t[2], niveau, contexte, entete, profondeur + 1);
  if (e.startsWith('{')) {
    for (const entree of elements(e)) {
      if (entree.startsWith('...')) {
        if (poseLeStatut(entree.slice(3), niveau, contexte, entete, profondeur + 1)) return true;
        continue;
      }
      const m = /^([A-Za-z_$][\w$]*)\s*(:)?/.exec(entree);
      if (!m) continue;
      const cle = m[1];
      const valeur = m[2] ? entree.slice(m[0].length) : cle;
      if (niveau === 'ecriture' && cle === 'statut') return true;
      if (cle === 'AND' || cle === 'NOT' || (cle === 'is' && niveau === 'ecriture')) {
        const v = nue(valeur);
        const branches = v.startsWith('[') ? elements(v) : [v];
        if (branches.some((b) => poseLeStatut(b, niveau, contexte, entete, profondeur + 1))) return true;
      }
      if (cle === 'OR') {
        const v = nue(valeur);
        const branches = v.startsWith('[') ? elements(v) : [v];
        if (branches.length > 0 && branches.every((b) => poseLeStatut(b, niveau, contexte, entete, profondeur + 1))) return true;
      }
      if (niveau === 'ligne' && cle === 'ecriture' && poseLeStatut(valeur, 'ecriture', contexte, entete, profondeur + 1)) return true;
    }
    return false;
  }
  if (niveau === 'ecriture' && (/^HORS_SITUATION$/.test(e) || /^filtreDuStatut\s*\(/.test(e))) return true;
  const nom = /^([A-Za-z_$][\w$]*)/.exec(e)?.[1];
  if (nom && Object.keys(FILTRES_NOMMES).includes(nom)) return true;
  // L'appel d'une fonction fléchée locale (`const lus = (e) => luesParLePv(e, …)`) · son corps.
  const appel = /^([A-Za-z_$][\w$]*)\s*\(/.exec(e);
  if (appel) {
    const fleche = new RegExp(`(?:const|let)\\s+${appel[1]}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::[^=\\n]+)?=>\\s*`, 'g');
    for (const lieu of [contexte, entete]) {
      let m: RegExpExecArray | null;
      fleche.lastIndex = 0;
      while ((m = fleche.exec(lieu))) {
        if (poseLeStatut(expression(lieu, m.index + m[0].length, true), niveau, contexte, entete, profondeur + 1)) return true;
      }
    }
    return false;
  }
  // Un membre (`filtres.mouvements`) se lit sur l'objet qui le porte · tiré
  // d'un filtre nommé (`filtresDesTroisColonnes`), il en a le statut.
  const membre = /^([A-Za-z_$][\w$]*)\.[A-Za-z_$][\w$]*$/.exec(e);
  const id = membre ? membre[1] : e;
  if (!/^[A-Za-z_$][\w$]*$/.test(id)) return false;
  // Une variable · dans la fonction englobante, puis au premier niveau du
  // fichier · déclarée seule ou décomposée (`const { mouvements } = …`).
  const lieux: Array<[string, RegExp]> = [
    [contexte, new RegExp(`(?:const|let)\\s+(?:\\{[^}=]*\\b${id}\\b[^}=]*\\}|${id})\\s*(?::[^=\\n]+)?=`, 'g')],
    [entete, new RegExp(`^(?:export\\s+)?(?:const|let)\\s+${id}\\s*(?::[^=\\n]+)?=`, 'gm')],
  ];
  for (const [lieu, r] of lieux) {
    let m: RegExpExecArray | null;
    while ((m = r.exec(lieu))) {
      if (poseLeStatut(expression(lieu, m.index + m[0].length, true), niveau, contexte, entete, profondeur + 1)) return true;
    }
  }
  return false;
}

/** Le filtre répond-il · une catégorie structurelle, ou le statut de l'écriture posé (`poseLeStatut`) ? */
function filtreAdmisStrict(filtre: string, niveau: Niveau, contexte: string, entete: string): boolean {
  if (categorieDuFiltre(filtre)) return true;
  return poseLeStatut(filtre, niveau, contexte, entete);
}

/** Le bloc équilibré qui commence à l'accolade `debut` (chaînes et commentaires sautés). */
function bloc(src: string, debut: number): string {
  let profondeur = 0;
  for (let j = debut; j < src.length; j++) {
    const s = sauter(src, j);
    if (s >= 0) {
      j = s;
      continue;
    }
    if (src[j] === '{') profondeur++;
    if (src[j] === '}' && --profondeur === 0) return src.slice(debut, j + 1);
  }
  return src.slice(debut);
}

/**
 * LA DÉFINITION d'un filtre nommé, découpée par sa STRUCTURE · le corps d'une
 * fonction (paramètres sautés, puis le bloc), ou la valeur d'une constante
 * jusqu'à la fin de son expression. Jamais une distance (CLAUDE.md § 10).
 */
function definition(src: string, nom: string): string | null {
  const fonction = new RegExp(
    `^\\s*(?:export\\s+)?(?:(?:async|private|public|protected|static)\\s+)*(?:function\\s+)?${nom}\\s*(?:<[^>\\n]*>)?\\s*\\(`,
    'm',
  ).exec(src);
  if (fonction) {
    const parametres = argumentDeLAppel(src, fonction.index + fonction[0].length - 1);
    // Le corps s'ouvre par l'accolade qui finit la ligne de la signature
    // (forme de Prettier) · une accolade de type de retour
    // (`): X & { OR: Y[] } {`) ne la finit pas.
    const apres = fonction.index + fonction[0].length - 1 + parametres.length;
    const ouverture = /\{[ \t]*\n/.exec(src.slice(apres));
    return ouverture ? bloc(src, apres + ouverture.index) : null;
  }
  const constante = new RegExp(`^(?:export\\s+)?const\\s+${nom}\\b[^=\\n]*=`, 'm').exec(src);
  return constante ? expression(src, constante.index + constante[0].length, true) : null;
}

interface Appel {
  fichier: string;
  ligne: number;
  fonction: string;
  appel: string;
  filtre: string;
}

// Un appel chaîné sur deux lignes (`.ecriture\n  .findFirst(`) est un appel ·
// les blancs entre les maillons sont admis.
const MOTIF_APPEL =
  /\.(ligneEcriture|ecriture)\s*\.(findMany|findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|aggregate|groupBy|count)\s*\(/g;

function recenser() {
  const appels: Appel[] = [];
  const nonAdmis: Appel[] = [];
  const brutes: string[] = [];
  for (const chemin of fichiersSources(path.join(RACINE, 'src'))) {
    const src = fs.readFileSync(chemin, 'utf8');
    const fichier = path.relative(RACINE, chemin).split(path.sep).join('/');
    const lignes = src.split('\n');
    // Le fichier entier · seules ses déclarations de premier niveau (colonne 0) y sont cherchées.
    const entete = src;
    let m: RegExpExecArray | null;
    MOTIF_APPEL.lastIndex = 0;
    while ((m = MOTIF_APPEL.exec(src))) {
      const arg = argumentDeLAppel(src, m.index + m[0].length - 1);
      // La ligne de l'APPEL (celle du verbe), même quand le maillon le précède.
      const n = src.slice(0, m.index + m[0].length).split('\n').length - 1;
      const f = fonctionEnglobante(lignes, n);
      const contexte = lignes.slice(f.debut, n + 1).join('\n');
      const appel: Appel = { fichier, ligne: n + 1, fonction: f.nom, appel: `${m[1]}.${m[2]}`, filtre: filtreDeLAppel(arg) };
      appels.push(appel);
      if (!filtreAdmisStrict(appel.filtre, m[1] === 'ecriture' ? 'ecriture' : 'ligne', contexte, entete)) nonAdmis.push(appel);
    }
    for (const r of src.matchAll(/\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)\s*(?:`([^`]*)`|\()/g)) {
      const texte = r[1] ?? '';
      if (/"(?:ecritures|lignes_ecriture)"/.test(texte) && !/"statut"/.test(texte)) brutes.push(`${fichier} · ${texte.slice(0, 80)}`);
    }
  }
  return { appels, nonAdmis, brutes };
}

describe('Écritures de situation · aucune lecture ne les voit sans le dire (filet)', () => {
  const { appels, nonAdmis, brutes } = recenser();

  it('le recensement trouve encore les lectures · sinon il ne prouverait rien', () => {
    expect(appels.length).toBeGreaterThan(300);
    // Le découpage isole bien le filtre · un appel connu, relu.
    const balance = appels.find((a) => a.fichier.endsWith('relances.service.ts') && a.fonction === 'positions');
    expect(balance?.filtre).toMatch(/ecriture/);
  });

  it('chaque lecture sans statut est couverte par une exception nommée, au nombre près', () => {
    const parCle = new Map<string, Appel[]>();
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
    const corps = new Map<string, string>();
    for (const [nom, fichier] of Object.entries(FILTRES_NOMMES)) {
      const lu = definition(fs.readFileSync(path.join(RACINE, fichier), 'utf8'), nom);
      expect({ nom, trouve: lu !== null }).toEqual({ nom, trouve: true });
      corps.set(nom, lu ?? '');
    }
    // Les filtres qui posent le statut eux-mêmes, puis ceux qui en nomment
    // un, de proche en proche · jamais un cycle qui se prouverait lui-même.
    const posent = new Set([...corps].filter(([, c]) => JETON_STATUT.test(c)).map(([n]) => n));
    for (let change = true; change; ) {
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
    // Le statut de l'écriture, directement, par décomposition ou dans une branche.
    expect(poseLeStatut('{ tenantId, statut: StatutEcriture.VALIDEE }', 'ecriture', vide, vide)).toBe(true);
    expect(poseLeStatut('{ compteId, ecriture: { tenantId, ...HORS_SITUATION } }', 'ligne', vide, vide)).toBe(true);
    expect(poseLeStatut('{ AND: [{ date }, { statut: X }] }', 'ecriture', vide, vide)).toBe(true);
    // Le statut d'un exercice, d'un lettrage ou de la ligne ne trie pas l'écriture lue.
    expect(poseLeStatut('{ tenantId, exercice: { statut: StatutExercice.OUVERT } }', 'ecriture', vide, vide)).toBe(false);
    expect(poseLeStatut("{ compteId, lettrage: { statut: 'PARTIEL' }, ecriture: { tenantId } }", 'ligne', vide, vide)).toBe(false);
    expect(poseLeStatut('{ compteId, statut: X, ecriture: { tenantId } }', 'ligne', vide, vide)).toBe(false);
    // Un OR ne trie que si CHAQUE branche trie.
    expect(poseLeStatut('{ OR: [{ statut: X }, { date }] }', 'ecriture', vide, vide)).toBe(false);
    expect(poseLeStatut('{ OR: [{ statut: X }, { statut: Y }] }', 'ecriture', vide, vide)).toBe(true);
    // Une variable en position de filtre se résout ; en valeur d'un champ, jamais.
    const contexte = 'const filtre = { tenantId, ...HORS_SITUATION };\nconst borne = { statut: X };';
    expect(poseLeStatut('{ ecriture: filtre }', 'ligne', contexte, vide)).toBe(true);
    expect(poseLeStatut('{ tenantId, date: { lte: borne } }', 'ecriture', contexte, vide)).toBe(false);
    // Un ternaire trie si ses deux branches trient.
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
