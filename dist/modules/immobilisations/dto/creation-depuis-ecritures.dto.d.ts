import { ModeAmortissement } from '@prisma/client';
export declare class CreerDepuisEcritureDto {
    ligneId: string;
    designation?: string;
    numeroInventaire?: string;
    lieuId?: string;
    dateMiseEnService?: string | null;
    natureFiscaleCle?: string | null;
    valeurResiduelle?: number;
    dureeAmortissementAns?: number;
    modeAmortissement?: ModeAmortissement;
    unitesOeuvrePrevues?: number;
    uniteOeuvreLibelle?: string;
    confirmerPremierJour?: boolean;
}
