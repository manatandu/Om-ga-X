export interface LigneTenue {
    lettre: string | null;
    lettrageId: string | null;
    rapprochementId: string | null;
}
export declare function motifLignesTenues(lignes: LigneTenue[], objet: string, geste: string, issue?: string, groupeTolere?: string | readonly string[] | null): string | null;
