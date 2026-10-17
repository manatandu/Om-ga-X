export type NatureDuJour = 'OUVRABLE' | 'DIMANCHE' | 'FERIE' | 'CONGE_DU_FERIE_DU_DIMANCHE';
export declare function congeDuFerieDuDimanche(d: Date): string | null;
export declare function natureDuJour(d: Date): NatureDuJour;
export declare const estJourOuvrableDuCode: (d: Date) => boolean;
export declare const estJourRemunere: (d: Date) => boolean;
