export declare class EnregistrerAccordCadreDto {
    reference: string;
    dateSignature: string;
    dureeAnnees: number;
    taciteReconduction?: boolean;
    preavisMois?: number;
    representationRdc?: string;
    attestationsBonneConduiteLe?: string;
}
export declare class DeclarerMainOeuvreDto {
    part: number;
    source: string;
    date: string;
}
export declare class DenoncerAccordCadreDto {
    denonceLe: string;
    motif: string;
}
