export declare class ProposerModeleDto {
    codeModele: string;
    parametres?: Record<string, number>;
    comptesChoisis?: Record<string, string>;
}
export declare class AppliquerModeleDto extends ProposerModeleDto {
    exerciceId: string;
    journalId: string;
    date: string;
    libelle?: string;
    reference?: string;
}
