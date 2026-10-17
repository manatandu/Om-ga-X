export interface LigneLegale {
    numero: string;
    intitule: string;
    solde: number;
}
export interface RegleCorrespondance {
    prefixe: string;
    rubrique: string;
}
export interface RetraitementDeclare {
    id: string;
    libelle: string;
    fondement: string;
    lignes: {
        rubrique: string;
        montant: number;
    }[];
    partMinoritairesResultat?: number | null;
    partMinoritairesOci?: number | null;
    partMinoritairesCapitauxPropres?: number | null;
}
export interface OptionsConsolidation {
    rubriqueDuPoste: (cle: string) => string | null;
    estPosteDeResultat: (cle: string) => boolean;
    resultatMinoritaires: number;
    resultatEnsemble: number;
    conversionExercice?: {
        groupe: number;
        minoritaires: number;
        me: number;
    };
}
export declare function effetsRetraitement(r: Pick<RetraitementDeclare, 'lignes'>): {
    resultat: number;
    oci: number;
    capitauxPropres: number;
};
export declare function motifRefusPartsMinoritaires(r: RetraitementDeclare, consolide: boolean): string | null;
export type ActivitePrincipale = 'AUCUNE' | 'INVESTIR_ACTIFS' | 'FINANCER_CLIENTS';
export interface LigneEtatIfrs {
    cle: string;
    libelle: string;
    ref?: string;
    nature: 'POSTE' | 'TOTAL' | 'NON_CLASSE';
    groupe?: string;
    legal: number;
    retraitements: number;
    ifrs: number;
    comptes?: {
        numero: string;
        intitule: string;
        solde: number;
    }[];
}
export interface EtatsIfrs {
    situation: LigneEtatIfrs[];
    resultat: LigneEtatIfrs[];
    resultatGlobal: LigneEtatIfrs[];
    nonClasses: {
        numero: string;
        intitule: string;
        solde: number;
    }[];
    rapprochements: {
        resultatSyscohada: number;
        retraitementsResultat: number;
        resultatIfrs: number;
        capitauxPropresSyscohada: number;
        retraitementsCapitauxPropres: number;
        capitauxPropresIfrs: number;
    };
    controles: {
        cle: string;
        libelle: string;
        ecart: number;
        ok: boolean;
    }[];
    mentions: string[];
    motifsNonPubliable: string[];
}
export declare class RefusIfrs extends Error {
}
export declare const ENTREE_EN_VIGUEUR_IFRS18: number;
export declare function rubriqueDuCompte(numero: string, regles: RegleCorrespondance[]): string | null;
export declare function motifRefusRetraitement(r: Pick<RetraitementDeclare, 'libelle' | 'fondement' | 'lignes'>): string | null;
export declare function construireEtatsIfrs(exercice: {
    dateDebut: Date;
}, lignes: LigneLegale[], regles: RegleCorrespondance[], retraitements: RetraitementDeclare[], activitePrincipale: ActivitePrincipale | null, conso?: OptionsConsolidation): EtatsIfrs;
export declare const LIBELLES_GROUPES: Record<string, string>;
