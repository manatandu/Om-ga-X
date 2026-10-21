import { NumerotationPiece, Referentiel, TypeJournal } from '@prisma/client';
export declare function journauxDefaut(referentiel: Referentiel): Array<{
    code: string;
    intitule: string;
    type: TypeJournal;
    numerotation: NumerotationPiece;
    numeroCompteTresorerie?: string;
}>;
