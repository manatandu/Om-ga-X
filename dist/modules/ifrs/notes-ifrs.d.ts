import { EtatsIfrs, RetraitementDeclare } from './etats-ifrs';
import { PremiereApplication } from './premiere-application-ifrs';
export type SousTotalReference = 'RESULTAT_OPERATIONNEL' | 'RESULTAT_AVANT_FINANCEMENT_IMPOTS' | 'RESULTAT_NET';
export declare const SOUS_TOTAUX_REFERENCE: Record<SousTotalReference, string>;
export interface ElementRapprochement {
    libelle: string;
    rubrique: string;
    montant: number;
    effetImpot: number | null;
    description: string | null;
}
export interface MesurePerformance {
    libelle: string;
    aspect: string;
    calcul: string;
    sousTotalReference: SousTotalReference;
    elements: ElementRapprochement[];
    methodeImpot: string | null;
    changement: string | null;
}
export interface CategorieActions {
    intitule: string;
    autorisees: number | null;
    emisesLiberees: number | null;
    emisesNonLiberees: number | null;
    valeurNominale: number | null;
    sansValeurNominale: boolean;
    enCirculationOuverture: number | null;
    enCirculationCloture: number | null;
    droitsRestrictions: string | null;
    autoDetenues: number | null;
    reserveesOptions: string | null;
}
export interface DeclarationsNotesIfrs {
    entite: {
        domicile: string | null;
        formeJuridique: string | null;
        paysConstitution: string | null;
        adresseSiege: string | null;
        natureOperations: string | null;
        sansSocieteMere: boolean | null;
        societeMere: string | null;
        societeMereUltime: string | null;
        dureeVieLimitee: boolean | null;
        informationsDureeVie: string | null;
    };
    conformiteDeclaree: boolean | null;
    continuite: {
        retenue: boolean | null;
        incertitudesSignificatives: boolean | null;
        incertitudes: string | null;
        baseRetenue: string | null;
        raison: string | null;
    };
    methodes: {
        intitule: string;
        texte: string;
    }[];
    jugements: {
        intitule: string;
        texte: string;
    }[];
    aucunJugement: boolean | null;
    estimations: {
        nature: string;
        rubrique: string;
        valeurComptable: number | null;
        informations: string | null;
    }[];
    aucuneEstimation: boolean | null;
    aucuneMesurePerformance: boolean | null;
    mesuresPerformance: MesurePerformance[];
    capital: {
        description: string | null;
        commentObjectifsAtteints: string | null;
        soumisExigencesExternes: boolean | null;
        natureExigences: string | null;
        exigencesRespectees: boolean | null;
        consequencesNonRespect: string | null;
        changements: string | null;
        quantitatif: {
            libelle: string;
            montantN: number;
            montantN1: number | null;
        }[];
    };
    sansCapitalSocial: boolean | null;
    informationsEquivalentes: string | null;
    categoriesActions: CategorieActions[];
    reserves: Record<string, string>;
    dividendes: {
        proposesNonComptabilises: number | null;
        proposesParAction: number | null;
        preferentielsCumulesNonComptabilises: number | null;
        comptabilisesParAction: number | null;
    };
    impotOci: Record<string, number>;
}
export declare function normaliserDeclarationsNotes(brut: unknown): DeclarationsNotesIfrs;
export declare function motifsRefusDeclarationsNotes(d: DeclarationsNotesIfrs): string[];
export type BlocNote = {
    type: 'texte';
    texte: string;
    source?: 'DECLARE' | 'FICHE_DOSSIER' | 'CALCULE' | 'TEXTE_NORME';
} | {
    type: 'manque';
    texte: string;
} | {
    type: 'tableau';
    titre?: string;
    colonnes: string[];
    lignes: {
        libelle: string;
        valeurs: (number | string | null)[];
        total?: boolean;
    }[];
};
export interface NoteIfrs {
    numero: number;
    cle: string;
    titre: string;
    ref: string;
    postes: string[];
    blocs: BlocNote[];
}
export interface JeuNotesIfrs {
    notes: NoteIfrs[];
    renvois: Record<string, number[]>;
    motifsNonPubliable: string[];
}
export interface EntreesNotesIfrs {
    declarations: DeclarationsNotesIfrs;
    ficheDossier: {
        nom: string;
        formeJuridique: string | null;
        pays: string | null;
        adresse: string | null;
        activite: string | null;
    };
    n: EtatsIfrs;
    n1: EtatsIfrs | null;
    retraitements: RetraitementDeclare[];
    premiereApplication: PremiereApplication | null;
    distributionsDeclarees: boolean;
    applicationAnticipee: boolean;
    declarationsN1: DeclarationsNotesIfrs | null;
    motifsJeu: string[];
}
export declare const ENONCE_MESURES_PERFORMANCE = "Les mesures de la performance d\u00E9finies par la direction communiquent le point de vue de la direction sur un aspect de la performance financi\u00E8re de l\u2019entit\u00E9 dans son ensemble et elles ne sont pas n\u00E9cessairement comparables aux mesures ayant des appellations ou des descriptions similaires communiqu\u00E9es par d\u2019autres entit\u00E9s.";
export declare function construireNotesIfrs(p: EntreesNotesIfrs): JeuNotesIfrs;
