import { JeuEtatsFinanciersSycebnl } from '@prisma/client';
export declare class CreerCelluleDto {
    nom: string;
    emailAdmin: string;
    jeuEtatsFinanciersSycebnl?: JeuEtatsFinanciersSycebnl;
}
export declare class ImporterCanevasDto {
    nomFichier: string;
    contenuBase64: string;
}
