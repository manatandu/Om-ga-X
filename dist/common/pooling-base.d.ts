export interface EtatDuPooling {
    poole: boolean;
    pgbouncerDeclare: boolean;
    plafondConnexions: number | null;
}
export declare function lireEtatDuPooling(chaine: string | undefined): EtatDuPooling | null;
export declare function messageDePooling(etat: EtatDuPooling | null): string;
