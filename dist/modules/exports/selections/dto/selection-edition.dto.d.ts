import { EditionSelection } from '@prisma/client';
export declare class CreerSelectionEditionDto {
    edition: EditionSelection;
    nom: string;
    criteres: Record<string, unknown>;
}
export declare class RemplacerSelectionEditionDto {
    criteres: Record<string, unknown>;
}
