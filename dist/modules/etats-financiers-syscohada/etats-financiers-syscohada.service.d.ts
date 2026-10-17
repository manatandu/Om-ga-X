import { EcritureService } from '../comptabilite/ecriture.service';
import { VirementsParCompte } from '../immobilisations/virements-mise-en-service';
import { ExerciceService } from '../exercice/exercice.service';
import { CompteDuPoste, ControleTableauDesFlux, LigneBalancePourEtat, ProvenanceComparatif } from '../etats-financiers/etats-financiers.communs';
import { type ResultatAnterieurNonVire } from '../etats-financiers/resultat-de-l-exercice';
export interface LigneBilanSyscohada {
    ref: string;
    libelle: string;
    montant: number;
    montantN1?: number;
    brut?: number;
    amortissement?: number;
    estTotal: boolean;
    comptes: CompteDuPoste[];
    note?: string;
    renvoi?: string;
}
export interface BilanSyscohada {
    actif: LigneBilanSyscohada[];
    passif: LigneBilanSyscohada[];
    totalActif: number;
    totalPassif: number;
    totalActifN1?: number;
    totalPassifN1?: number;
    exerciceN1Disponible: boolean;
    comparatif: ProvenanceComparatif | null;
    mentionComparatif: string | null;
    equilibre: boolean;
    comptesNonRattaches: CompteDuPoste[];
    comptesASolderALaCloture: Array<CompteDuPoste & {
        source: string;
    }>;
    controle: {
        resultatClasses678: number;
        resultatCompte13: number;
        resultatAnterieurNonAffecte: number;
    };
    resultatAnterieurNonVire: ResultatAnterieurNonVire | null;
    resultatAnterieurNonVireN1: ResultatAnterieurNonVire | null;
    resultatEnInstance: number | null;
}
export interface LigneCompteResultatSyscohada {
    ref: string;
    libelle: string;
    montant: number;
    montantN1?: number;
    montantMemePeriodeN1?: number;
    comptes: CompteDuPoste[];
    estSolde?: boolean;
    supplementaire?: true;
    formuleOfficielle?: string;
    notes: string[];
}
export interface SoldesCompteResultatSyscohada {
    margeCommerciale: number;
    chiffreAffaires: number;
    valeurAjoutee: number;
    excedentBrutExploitation: number;
    resultatExploitation: number;
    resultatFinancier: number;
    resultatActivitesOrdinaires: number;
    resultatHorsActivitesOrdinaires: number;
    resultatNet: number;
}
export interface CompteResultatSyscohada {
    lignes: LigneCompteResultatSyscohada[];
    soldes: SoldesCompteResultatSyscohada;
    soldesN1?: SoldesCompteResultatSyscohada;
    soldesMemePeriodeN1?: SoldesCompteResultatSyscohada;
    memePeriodeN1JusquAu?: string;
    exerciceN1Disponible: boolean;
    motifComparatifAbsent: string | null;
    comptesNonRattaches: CompteDuPoste[];
    controle: {
        resultatToutesClassesDeGestion: number;
        ecart: number;
        coherent: boolean;
    };
}
export interface LigneFluxSyscohada {
    ref: string;
    libelle: string;
    montant: number;
    montantN1?: number;
    comptes: CompteDuPoste[];
    estTotal?: boolean;
    repere?: string;
}
export interface SectionFluxSyscohada {
    section: string;
}
export interface PosteNonCalculable {
    ref: string;
    raison: string;
    aLever?: boolean;
}
export interface CompteTropAgrege extends CompteDuPoste {
    subdivisions: string[];
}
export declare function subdivisionsLuesParLeTft(numero: string): string[];
export interface TableauFluxTresorerieSyscohada {
    lignes: Array<LigneFluxSyscohada | SectionFluxSyscohada>;
    exerciceN1Disponible: boolean;
    comptesNonVentiles: CompteDuPoste[];
    comptesTropAgreges: CompteTropAgrege[];
    postesNonCalculables: PosteNonCalculable[];
    postesVides: string[];
    mentionOuverture: string | null;
    postesNonCalculablesN1: PosteNonCalculable[];
    controle: ControleTableauDesFlux;
}
export interface PosteBilanCalcule {
    ref: string;
    libelle: string;
    montant: number;
    brut?: number;
    amortissement?: number;
    comptes: CompteDuPoste[];
    comptesBrut: CompteDuPoste[];
}
export interface ResolutionBilan {
    parRef: Map<string, PosteBilanCalcule>;
    resultatClasses678: number;
    resultatCompte13: number;
}
export interface ResolutionCompteResultat {
    montantsParRef: Record<string, number>;
    comptesParRef: Map<string, CompteDuPoste[]>;
    comptesNonRattaches: CompteDuPoste[];
    resultatToutesClassesDeGestion: number;
}
export declare function lireDateArrete(arreteAu: string): Date;
export declare class EtatsFinanciersSyscohadaService {
    private readonly ecritureService;
    private readonly exerciceService;
    constructor(ecritureService: EcritureService, exerciceService: ExerciceService);
    private trouverExerciceN1;
    private chargerLignes;
    private bornesSituation;
    private calculerPosteActif;
    private calculerPostePassif;
    private calculerDR;
    private calculerCJ;
    private resoudreTousLesPostesBilan;
    resoudreBilanSurLignes(lignes: LigneBalancePourEtat[]): {
        resolution: ResolutionBilan;
        nonRattaches: CompteDuPoste[];
    };
    resoudreCompteResultatSurLignes(lignes: LigneBalancePourEtat[]): ResolutionCompteResultat;
    resoudreFluxSurLignes(lignesN: LigneBalancePourEtat[], lignesN1: LigneBalancePourEtat[]): Map<string, number>;
    resoudreFluxDetailleSurLignes(lignesN: LigneBalancePourEtat[], lignesN1: LigneBalancePourEtat[], reevaluations?: VirementsParCompte): {
        montants: Map<string, number>;
        reserves: string[];
    };
    private calculerTotalActif;
    private calculerTotalPassif;
    private comptesNonRattachesDuBilan;
    bilan(tenantId: string, exerciceId: string, arreteAu?: string): Promise<BilanSyscohada>;
    private resoudreTousLesPostesCR;
    private soldesNommes;
    compteDeResultat(tenantId: string, exerciceId: string, arreteAu?: string): Promise<CompteResultatSyscohada>;
    private soldeDansLeSens;
    private lirePosteBilan;
    private differenceComptes;
    private lireComptes;
    private evaluerTerme;
    private litLOuvertureOuLesMouvements;
    private exigeCompteDeResultatAnterieur;
    private calculerPosteFlux;
    private refsDeBaseDuBilan;
    private comptesNonVentiles;
    private resoudreFluxPourExercice;
    tableauFluxTresorerie(tenantId: string, exerciceId: string, arreteAu?: string): Promise<TableauFluxTresorerieSyscohada>;
}
