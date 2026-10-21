export interface LigneLot {
    compteId: string;
    montant: number;
}
export interface CompteLu {
    id: string;
    numero: string;
    typeCompte: 'DETAIL' | 'TOTAL';
}
export declare function motifRefusLot(nom: string, lignes: LigneLot[], comptes: CompteLu[]): string | null;
