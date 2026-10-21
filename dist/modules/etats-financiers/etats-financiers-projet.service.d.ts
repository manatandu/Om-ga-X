import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import { CompteDuPoste } from './etats-financiers.communs';
import { PosteCalcule } from './etats-financiers.service';
export declare class EtatsFinanciersProjetService {
    private readonly ecritureService;
    private readonly exerciceService;
    private readonly prisma;
    constructor(ecritureService: EcritureService, exerciceService: ExerciceService, prisma: PrismaService);
    private trouverExerciceN1;
    private chargerLignes;
    private calculerPosteActif;
    private calculerPostePassif;
    private calculerDW;
    private calculerCC;
    private sourcesDuResultat;
    private resoudreTousLesPostesBilan;
    bilan(tenantId: string, exerciceId: string): Promise<{
        actif: PosteCalcule[];
        passif: PosteCalcule[];
        totalActif: number;
        totalPassif: number;
        totalActifN1: number | undefined;
        totalPassifN1: number | undefined;
        exerciceN1Disponible: boolean;
        comparatif: import("./etats-financiers.communs").ProvenanceComparatif | null;
        mentionComparatif: string | null;
        equilibre: boolean;
        comptesNonRattaches: CompteDuPoste[];
        controle: {
            resultatClasses678: number;
            resultatCompte13: number;
            resultatAnterieurNonAffecte: number;
        };
        resultatAnterieurNonVire: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
        resultatAnterieurNonVireN1: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
    }>;
    private resoudreTousLesPostesCE;
    compteExploitation(tenantId: string, exerciceId: string): Promise<{
        revenus: PosteCalcule[];
        totalRevenus: number;
        totalRevenusN1: number | undefined;
        charges: PosteCalcule[];
        totalCharges: number;
        totalChargesN1: number | undefined;
        solde: number;
        soldeN1: number | undefined;
        exerciceN1Disponible: boolean;
        motifComparatifAbsent: string | null;
        comptesNonRattaches: CompteDuPoste[];
        controle: {
            boucleAZero: boolean;
        };
    }>;
    noteBailleur(tenantId: string, exerciceId: string): Promise<{
        investissement: {
            bailleur: {
                id: string;
                code: string;
                nom: string;
            };
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        }[];
        investissementNonAffecte: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
        totalInvestissement: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
        administration: {
            bailleur: {
                id: string;
                code: string;
                nom: string;
            };
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        }[];
        administrationNonAffecte: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
        totalAdministration: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
        totalFondsDuBailleur: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
    }>;
    private soldeCrediteur;
    private brutEmploi;
    private variationDettes;
    tableauEmploisRessources(tenantId: string, exerciceId: string): Promise<{
        lignes: {
            montantCumulDebut: number;
            montantCumulFin: number;
            ref: string;
            libelle: string;
            montant: number;
            montantN1?: number;
            brut?: number;
            amortissement?: number;
            comptes: CompteDuPoste[];
            estTotal?: boolean;
            cle: string;
        }[];
        totalRessources: number;
        totalEmplois: number;
        excedent: number;
        encaisseDisponible: number;
        fondsFinExercice: number;
        controle: {
            ecart: number;
            boucle: boolean;
            cumulDebut: {
                ecart: number;
                boucle: boolean;
            };
            cumulFin: {
                ecart: number;
                boucle: boolean;
            };
        };
        anomalies: {
            ref: string;
            libelle: string;
            brut: number;
            correction: number;
            montant: number;
            diagnostic: string;
        }[];
        avertissements: string[];
        periodes: {
            exercice: string;
            cumulDebutJusquA: string | null;
        };
    }>;
    private dettesRattacheesDesColonnes;
    private construireColonne;
}
