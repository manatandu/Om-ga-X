import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import { CompteDuPoste } from './etats-financiers.communs';
import { PosteCalcule } from './etats-financiers.service';
export declare const PLAFOND_MOUVEMENTS_NOTE_4_SMT_SYCEBNL = 20000;
export declare class EtatsFinanciersSmtService {
    private readonly ecritureService;
    private readonly exerciceService;
    private readonly prisma;
    constructor(ecritureService: EcritureService, exerciceService: ExerciceService, prisma: PrismaService);
    private estTresorerie;
    private chargerLignes;
    private exercice;
    private aLOuverture;
    private calculerPosteBilan;
    private sourcesDuResultat;
    private calculerHB;
    private resoudreBilan;
    bilan(tenantId: string, exerciceId: string): Promise<{
        actif: (PosteCalcule & {
            note: string | null;
        })[];
        passif: (PosteCalcule & {
            note: string | null;
        })[];
        totalActif: number;
        totalPassif: number;
        totalActifN1: number | undefined;
        totalPassifN1: number | undefined;
        exerciceN1Disponible: boolean;
        comparatif: import("./etats-financiers.communs").ProvenanceComparatif | null;
        mentionComparatif: string | null;
        equilibre: boolean;
        renvoiImmobilisations: string;
        controle: {
            resultatClasses678: number;
            resultatCompte13: number;
            resultatAnterieurNonAffecte: number;
            compte13LuHorsDuResultat: number;
        };
        resultatAnterieurNonVire: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
        resultatAnterieurNonVireN1: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
    }>;
    private filtreEcrituresDeTresorerie;
    private parcourirEcrituresDeTresorerie;
    private cumulerEcritureDeTresorerie;
    private cumulsTresorerie;
    private ventilerFlux;
    private fluxHorsExploitation;
    private construireCompteDeResultat;
    compteDeResultat(tenantId: string, exerciceId: string): Promise<{
        recettes: (PosteCalcule & {
            note: string | null;
        } & {
            montantN1: number | undefined;
        })[];
        totalRecettes: number;
        depenses: (PosteCalcule & {
            note: string | null;
        } & {
            montantN1: number | undefined;
        })[];
        totalDepenses: number;
        soldeCaisse: number;
        retraitements: ({
            ref: string;
            libelle: string;
            montant: number;
            signe: 1 | -1;
            comptes: CompteDuPoste[];
        } & {
            montantN1: number | undefined;
        })[];
        resultatNet: number;
        exerciceN1Disponible: boolean;
        motifComparatifAbsent: string | null;
        totalRecettesN1: number | undefined;
        totalDepensesN1: number | undefined;
        soldeCaisseN1: number | undefined;
        resultatNetN1: number | undefined;
        reglementsNonRattaches: import("./reglements-de-tresorerie").ReglementNonRattache[];
        controle: {
            resultatBilan: number;
            fluxHorsExploitation: number;
            comptesHorsExploitation: CompteDuPoste[];
            ecart: number;
            concordant: boolean;
        };
    }>;
    journalTresorerie(tenantId: string, exerciceId: string): Promise<{
        journaux: {
            compteId: string;
            numero: string;
            intitule: string;
            reportANouveau: number;
            operations: {
                date: Date;
                libelle: string;
                reference: string | null;
                sens: "RECETTE" | "DEPENSE";
                recette: number;
                depense: number;
                solde: number;
                virementInterne: boolean;
                ventile: boolean;
                ventilation: Record<string, number>;
            }[];
            soldeAReporter: number;
            totalRecettes: number;
            totalDepenses: number;
            lignesNonVentilees: number;
            soldeBalance: number;
            boucle: boolean;
        }[];
        colonnesRecettes: {
            cle: string;
            libelle: string;
        }[];
        colonnesDepenses: {
            cle: string;
            libelle: string;
        }[];
        nb: string;
    }>;
    note1Immobilisations(tenantId: string, exerciceId: string): Promise<{
        lignes: ({
            origine: "REGISTRE";
            dateMiseEnService: Date | null;
            designation: string;
            montant: number;
            dateAcquisition: Date | null;
            dureeUtiliteAns: number | null;
            dateSortie: Date | null;
            prixCession: number | null;
        } | {
            origine: "BALANCE";
            dateMiseEnService: null;
            designation: string;
            montant: number;
            dateAcquisition: null;
            dureeUtiliteAns: null;
            dateSortie: null;
            prixCession: null;
        })[];
        sortiesDeLExercice: {
            origine: "REGISTRE";
            dateMiseEnService: Date | null;
            designation: string;
            montant: number;
            dateAcquisition: Date | null;
            dureeUtiliteAns: number | null;
            dateSortie: Date | null;
            prixCession: number | null;
        }[];
        total: number;
        totalRegistre: number;
        totalCautions: number;
        motifCautions: string | null;
        ecartsGA: {
            numero: string;
            intitule: string;
            soldeBalance: number;
            valeurFiches: number;
            ecart: number;
        }[];
        fichesSansSolde: {
            designation: string;
            montant: number;
        }[];
        motifEcartsGA: string | null;
    }>;
    note2Stocks(tenantId: string, exerciceId: string): Promise<{
        lignes: import("./stocks-depuis-inventaire").LigneNoteStock[];
        valeurStockFinal: number;
        valeurStockInitial: number;
        quantitesTenues: boolean;
        sourceQuantites: string | null;
        motifQuantites: string;
    }>;
    private partsParEcheance;
    note3CreancesDettes(tenantId: string, exerciceId: string): Promise<{
        creances: {
            numero: string;
            nom: string;
            montantCloture: number;
            montantOuverture: number;
            variationValeur: number;
            variationPourcent: number | null;
            montantNonEchu: number;
            montantEchu: number;
            montantNonVentile: number;
        }[];
        totalCreances: number;
        depreciationsCreances: {
            numero: string;
            intitule: string;
            montantCloture: number;
            montantOuverture: number;
            variationValeur: number;
        }[];
        totalDepreciationsCreances: number;
        totalCreancesNettes: number;
        totalCreancesNonEchues: number;
        totalCreancesEchues: number;
        totalCreancesNonVentilees: number;
        dettes: {
            numero: string;
            nom: string;
            montantCloture: number;
            montantOuverture: number;
            variationValeur: number;
            variationPourcent: number | null;
            montantNonEchu: number;
            montantEchu: number;
            montantNonVentile: number;
        }[];
        totalDettes: number;
        totalDettesNonEchues: number;
        totalDettesEchues: number;
        totalDettesNonVentilees: number;
        echeancesTenues: boolean;
        motifEcheances: string | null;
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
    }>;
    note5Dotation(tenantId: string, exerciceId: string): Promise<{
        rubriques: {
            montant: number;
            comptes: {
                numero: string;
                intitule: string;
                montant: number;
            }[];
            cle: string;
            libelle: string;
        }[];
        total: number;
        horsRubriques: {
            numero: string;
            intitule: string;
            montant: number;
        }[];
        totalHorsRubriques: number;
        totalPosteHA: number;
        motifHorsRubriques: string | null;
        membres: {
            nom: string;
            nationalite: null;
            montant: number;
            precisionDroitEntree: null;
            numero: string;
        }[];
        nationaliteTenue: boolean;
        precisionDroitEntreeTenue: boolean;
        motifColonnesNonTenues: string;
        motifMembres: string;
    }>;
    ficheNotes(): import("./correspondance-smt").NoteSmt[];
    notesApplicables(tenantId: string, exerciceId: string, notes: {
        note1: Awaited<ReturnType<EtatsFinanciersSmtService['note1Immobilisations']>>;
        note2: Awaited<ReturnType<EtatsFinanciersSmtService['note2Stocks']>>;
        note3: Awaited<ReturnType<EtatsFinanciersSmtService['note3CreancesDettes']>>;
        note5: Awaited<ReturnType<EtatsFinanciersSmtService['note5Dotation']>>;
    }): Promise<number[]>;
    private ressourcesParCategorie;
    eligibilite(tenantId: string, exerciceId: string): Promise<{
        categories: {
            cle: string;
            libelle: string;
            montant: number;
            comptes: {
                numero: string;
                intitule: string;
                montant: number;
            }[];
        }[];
        totalRessources: number;
        cumulBiennal: {
            cle: string;
            libelle: string;
            exerciceCourant: number;
            exercicePrecedent: number;
            cumule: number;
        }[] | null;
        exercicePrecedent: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        } | null;
        avertissementCumul: string;
        seuilParCategorieFcfa: number;
        deviseDossier: string;
        conversionAppliquee: boolean;
        avertissement: string;
    }>;
}
