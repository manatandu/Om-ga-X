import { NatureModeleImpression } from '@prisma/client';
export declare class CreerModeleImpressionDto {
    nature: NatureModeleImpression;
    intitule: string;
    texte: string;
}
export declare class ModifierModeleImpressionDto {
    intitule?: string;
    texte?: string;
}
