import { SensFacture } from '@prisma/client';
export declare class LigneFactureDto {
    designation: string;
    quantite: number;
    prixUnitaire: number;
    montantHT: number;
    imposable?: boolean;
    tauxTvaId?: string;
    tauxApplique?: number;
    montantTva?: number;
}
export declare class EnregistrerFactureDto {
    sens: SensFacture;
    numeroSerie: string;
    dateFacture: string;
    dateReception?: string | null;
    tiersId?: string;
    contrepartieNom?: string;
    contrepartieAdresse?: string;
    contrepartieNumeroImpot?: string;
    mentionTvaDebits?: boolean;
    autresImpotsEtTaxes?: number;
    ecritureId?: string;
    lignes: LigneFactureDto[];
}
export declare class EmettreNoteDeCreditDto {
    numeroSerie: string;
    dateNote: string;
    dateReception?: string | null;
    ecritureId?: string;
}
export declare class ComptabiliserFactureDto {
    journalId: string;
    compteGestionId?: string | null;
    comptesParLigne?: Record<string, string>;
    dateReception?: string | null;
}
export declare class ListerFacturesDto {
    sens?: SensFacture;
    du?: string;
    au?: string;
}
