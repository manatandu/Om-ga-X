export declare function tauxDegressifLoi(dureeAns: number): number | null;
export declare function motifRefusModeDegressif(o: {
    referentiel: 'SYSCOHADA' | 'SYCEBNL';
    numeroCompte: string;
    dureeAns: number | null | undefined;
}): string | null;
export declare function annuiteDegressive(reliquat: number, taux: number, anneesRestantes: number): number;
export type NatureRevision = 'PROSPECTIVE' | 'RETROACTIVE';
export declare function motifRefusRevision(o: {
    enService: boolean;
    debutAmortissement: Date | null;
    dureeNonLimitee: boolean;
    nonAmortissable: string | null;
    uniteOeuvre: boolean;
    degressifFiscal: boolean;
    ouvertureExercice: Date;
    exerciceClos: boolean;
    dotationDeLExercicePassee: boolean;
    nature: NatureRevision;
    nouvelleDureeAns: number;
    motif: string | null | undefined;
    degressifDureeTotale?: number | null;
}): string | null;
export declare function motifRefusRetroactive(o: {
    cumulActuel: number;
    cumulRejoue: number;
    amortissementAnterieur: number;
    partieDetachee: number;
    cumulDepreciation: number;
    lineaire: boolean;
}): string | null;
