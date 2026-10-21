import { ModeAmortissement } from '@prisma/client';
export declare class ModifierImmobilisationDto {
    designation?: string;
    numeroInventaire?: string | null;
    natureFiscaleCle?: string | null;
    compteImmobilisationId?: string;
    compteContrepartieId?: string;
    dateAcquisition?: string;
    dateMiseEnService?: string | null;
    valeurOrigine?: number;
    valeurResiduelle?: number;
    dureeAmortissementAns?: number;
    modeAmortissement?: ModeAmortissement;
    unitesOeuvrePrevues?: number;
    uniteOeuvreLibelle?: string;
    amortissementAnterieur?: number;
}
