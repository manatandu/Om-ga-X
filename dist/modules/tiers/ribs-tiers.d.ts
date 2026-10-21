export interface CoordonneesRib {
    banque?: string | null;
    titulaire?: string | null;
    codeBanque?: string | null;
    codeGuichet?: string | null;
    numeroCompte?: string | null;
    cle?: string | null;
    iban?: string | null;
    codeBic?: string | null;
    devise?: string | null;
}
export declare function motifRefusRibTiers(rib: CoordonneesRib): string | null;
export declare function coordonneesImprimees(rib: CoordonneesRib): string;
export declare function motifRefusDeviseDonneur(devise: string | null | undefined, journalCode: string): string | null;
export type StatutOrdre = 'A_IMPRIMER' | 'IMPRIME' | 'ANNULE';
export declare function motifRefusImpression(statut: StatutOrdre): string | null;
export declare function motifRefusAnnulation(statut: StatutOrdre, motif: string | null | undefined): string | null;
