export declare class LigneEtatDto {
    cle: string;
    libelle: string;
    racines?: string;
    mesure?: 'SOLDE' | 'MOUVEMENT';
    sens?: 'DEBIT' | 'CREDIT';
    total?: string;
}
export declare class EtatPersonnaliseDto {
    nom: string;
    lignes: LigneEtatDto[];
}
