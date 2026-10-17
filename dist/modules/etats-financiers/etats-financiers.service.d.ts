import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import { CompteDuPoste, PosteDeFluxVide } from './etats-financiers.communs';
export interface PosteCalcule {
    ref: string;
    libelle: string;
    montant: number;
    montantN1?: number;
    brut?: number;
    amortissement?: number;
    comptes: CompteDuPoste[];
    estTotal?: boolean;
}
export declare class EtatsFinanciersService {
    private readonly ecritureService;
    private readonly exerciceService;
    constructor(ecritureService: EcritureService, exerciceService: ExerciceService);
    private trouverExerciceN1;
    private chargerLignes;
    private calculerPosteActif;
    private calculerPostePassif;
    private calculerDW;
    private calculerCH;
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
    private resoudreTousLesPostesCR;
    compteDeResultat(tenantId: string, exerciceId: string): Promise<{
        produits: PosteCalcule[];
        totalProduits: number;
        totalProduitsN1: number | undefined;
        charges: PosteCalcule[];
        totalCharges: number;
        totalChargesN1: number | undefined;
        resultatActivitesOrdinaires: number;
        resultatActivitesOrdinairesN1: number | undefined;
        produitsHao: PosteCalcule;
        chargesHao: PosteCalcule;
        resultatHao: number;
        resultatHaoN1: number | undefined;
        resultatNet: number;
        resultatNetN1: number | undefined;
        exerciceN1Disponible: boolean;
        motifComparatifAbsent: string | null;
        comptesNonRattaches: CompteDuPoste[];
        controle: {
            resultatToutesClassesDeGestion: number;
            ecart: number;
            coherent: boolean;
        };
    }>;
    private fluxDuPoste;
    private contrepartieDuPoste;
    private calculerPosteFlux;
    private tresorerieNette;
    private resoudreFluxPourExercice;
    tableauFluxTresorerie(tenantId: string, exerciceId: string): Promise<{
        lignes: ({
            section: string;
        } | {
            montantN1: number | undefined;
            estTotal: boolean;
            repere: string | undefined;
            ref: string;
            libelle: string;
            montant: number;
            brut?: number;
            amortissement?: number;
            comptes: CompteDuPoste[];
            flux?: number;
            variationContrepartie?: number;
            section?: undefined;
        })[];
        exerciceN1Disponible: boolean;
        comptesNonVentiles: {
            numero: string;
            intitule: string;
            montant: number;
        }[];
        mentionOuverture: string | null;
        postesVides: string[];
        postesNonCalculables: PosteDeFluxVide[];
        postesNonCalculablesN1: PosteDeFluxVide[];
        controle: import("./etats-financiers.communs").ControleTableauDesFlux;
    }>;
}
