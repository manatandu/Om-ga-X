import { StatutOrdreVirement } from '@prisma/client';
export declare class AnnulerOrdreDto {
    motif: string;
}
export declare class ListerOrdresDto {
    statut?: StatutOrdreVirement;
}
