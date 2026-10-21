import { NatureActiviteFiscale, SensRetraitementFiscal } from '@prisma/client';
export declare const MONTANT_FISCAL_MAX = 999999999999999;
export declare const ORIGINES_DEFICIT_MAX = 20;
export declare class CreerRetraitementDto {
    code: string;
    sens?: SensRetraitementFiscal;
    libelle?: string;
    montant: number;
    commentaire?: string;
}
export declare class ModifierRetraitementDto {
    montant?: number;
    commentaire?: string;
}
export declare class ModifierDossierFiscalDto {
    acomptesVerses?: number;
    supplementsAdministration?: number;
    deficitAnterieurSaisi?: number | null;
    natureActivite?: NatureActiviteFiscale | null;
    resultatPeriodeCreationSaisi?: number | null;
    chiffreAffairesPeriodeCreationSaisi?: number | null;
    supplementsPeriodeCreation?: number;
    deficitAnterieurOrigines?: OrigineDeficitDto[] | null;
}
export declare class OrigineDeficitDto {
    dateFin: string;
    montant: number;
}
export declare class PasserConstatImpotDto {
    imputerAcomptes?: boolean;
    attestationRegime?: string;
}
export declare class AnnulerConstatImpotDto {
    motif: string;
}
