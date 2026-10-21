export interface LigneDuResultat {
    compteId: string;
    numero: string;
    solde: number;
}
export interface PartsDuResultat {
    parts: Array<{
        compteId: string;
        numero: string;
        montant: number;
    }>;
    reste: number;
}
export declare function partsAuResultatEnInstance(lignes: readonly LigneDuResultat[], estBenefice: boolean, montant: number): PartsDuResultat;
