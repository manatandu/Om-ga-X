import { EditionModele } from '@prisma/client';
export declare class CreerModeleEditionDto {
    edition: EditionModele;
    nom: string;
    colonnes: unknown[];
    saut?: string;
}
export declare class RemplacerModeleEditionDto {
    colonnes: unknown[];
    saut?: string;
}
