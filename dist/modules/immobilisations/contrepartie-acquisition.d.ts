import { Referentiel, TypeComposant } from '@prisma/client';
export interface OptionsContrepartie {
    typeComposant?: TypeComposant | null;
    systemeMinimal?: boolean;
}
export declare function racinesContrepartieAcquisition(referentiel: Referentiel, compteImmobilisation: string, options?: OptionsContrepartie): string[];
export declare function contrepartieAcquisitionAdmise(referentiel: Referentiel, compteImmobilisation: string, contrepartie: string, options?: OptionsContrepartie): boolean;
export declare function motifRefusContrepartie(referentiel: Referentiel, compteImmobilisation: string, contrepartie: string, options?: OptionsContrepartie): string | null;
