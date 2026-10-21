export declare function estContigu(dateFin: Date, debutSuivant: Date): boolean;
export declare function motifSuivantNonContigu(dateFin: Date, suivant: {
    dateDebut: Date;
}): string;
export declare function motifCreationNonContigue(dateDebut: Date, dateFin: Date, precedent: {
    dateFin: Date;
} | null, suivant: {
    dateDebut: Date;
} | null): string | null;
