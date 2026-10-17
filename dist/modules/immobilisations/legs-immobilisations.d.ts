export declare function repartirDettesLegs(valeurs: readonly number[], dettes: number): number[];
export declare function motifRefusLegs(o: {
    referentiel: 'SYSCOHADA' | 'SYCEBNL';
    numeroFonds: string;
    numeroDettes: string | null;
    dettes: number;
    valeurs: readonly number[];
}): string | null;
