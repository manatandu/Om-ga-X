import { NumerotationPiece, TypeJournal } from '@prisma/client';
export declare class CreerJournalDto {
    code: string;
    intitule: string;
    type: TypeJournal;
    compteTresorerieId?: string;
    ouvrirCompteSousId?: string;
    numeroCompte?: string;
    numerotation?: NumerotationPiece;
    contrepartieChaqueLigne?: boolean;
}
export declare class CompteDuJournalProposeDto {
    sousId: string;
}
export declare class ModifierJournalDto {
    intitule?: string;
    compteTresorerieId?: string;
    numerotation?: NumerotationPiece;
    estActif?: boolean;
    contrepartieChaqueLigne?: boolean;
}
