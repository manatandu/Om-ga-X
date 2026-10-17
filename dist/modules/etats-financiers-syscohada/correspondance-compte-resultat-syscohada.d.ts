export type SensPosteSyscohada = 'PRODUIT' | 'CHARGE';
export type SigneOfficiel = '+' | '-' | '-/+';
export interface PosteCompteResultatSyscohada {
    ref: string;
    libelle: string;
    sens: SensPosteSyscohada;
    signe: SigneOfficiel;
    lettre?: 'A' | 'B' | 'C' | 'D';
    comptes: string[];
    notes: string[];
    supplementaire?: true;
}
export declare const POSTES_COMPTE_RESULTAT_SYSCOHADA: PosteCompteResultatSyscohada[];
export declare const POSTES_PRODUITS_SYSCOHADA: PosteCompteResultatSyscohada[];
export declare const POSTES_CHARGES_SYSCOHADA: PosteCompteResultatSyscohada[];
export declare const REFS_POSTES_SUPPLEMENTAIRES: readonly string[];
export interface SoldeIntermediaire {
    ref: string;
    libelle: string;
    formuleOfficielle: string;
    deRefs: string[];
    compte13?: string;
    compte13ParSigne?: {
        benefice: string;
        perte: string;
    };
    notes: string[];
}
export declare const SOLDES_INTERMEDIAIRES: SoldeIntermediaire[];
export declare function compte13DuSolde(solde: SoldeIntermediaire, montant: number): string | undefined;
export declare const CODES_NOTES_CH6: readonly string[];
export declare const RENVOIS_NOTES_SUBDIVISES: Readonly<Record<string, readonly string[]>>;
export declare function resoudreRenvoiNote(renvoi: string): string[];
export declare const ORDRE_AFFICHAGE_COMPTE_RESULTAT: string[];
export declare const PREFIXES_CHIFFRE_AFFAIRES_SYSCOHADA: readonly string[];
export declare function trouvePosteCompteResultat(ref: string): PosteCompteResultatSyscohada | undefined;
export declare function trouveSoldeIntermediaire(ref: string): SoldeIntermediaire | undefined;
export declare function posteDuCompteSyscohada(numeroCompte: string): PosteCompteResultatSyscohada | null;
export declare function montantSigne(totalDebit: number, totalCredit: number): number;
export declare function signeConformeAuModele(poste: PosteCompteResultatSyscohada, montant: number): boolean;
export declare function calculerSoldesIntermediaires(montantsParRef: Record<string, number>): Record<string, number>;
