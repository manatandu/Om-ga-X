export declare const COMPORTEMENTS: readonly ["CHARGE_FIXE", "CHARGE_VARIABLE", "CHARGE_SEMI_VARIABLE", "PRODUIT_ACTIVITE", "HORS_CALCUL"];
export declare class DeclarationComportementDto {
    compteId: string;
    comportement?: (typeof COMPORTEMENTS)[number] | null;
    partVariablePct?: number | null;
}
export declare class DeclarerComportementsDto {
    declarations: DeclarationComportementDto[];
}
export declare class LigneCleDto {
    sectionCibleId: string;
    valeur: number;
}
export declare class CreerCleRepartitionDto {
    exerciceId: string;
    planId: string;
    sectionSourceId: string;
    libelle: string;
    mode: 'POURCENTAGE' | 'UNITES';
    unite?: string;
    source: string;
    lignes: LigneCleDto[];
}
export declare class ReprendreClesDto {
    exerciceId: string;
}
export declare class RepartirDto {
    date: string;
    soldes: Record<string, number>;
}
export declare class DeclarerCoutProductionDto {
    exerciceId: string;
    sectionId: string;
    unite: string;
    capaciteNormale: number;
    activiteReelle: number;
    quantiteProduite?: number | null;
    source: string;
}
