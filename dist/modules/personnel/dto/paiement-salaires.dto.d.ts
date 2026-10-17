import { ModePaiementSalaire } from '@prisma/client';
export declare class ModePaiementSalarieDto {
    modePaiement?: ModePaiementSalaire | null;
}
export declare class ReferencePaiementDto {
    bulletinId: string;
    reference: string;
}
export declare class PaiementSalairesDto {
    mode: ModePaiementSalaire;
    exerciceId: string;
    journalId: string;
    date: string;
    bulletinIds: string[];
    references?: ReferencePaiementDto[];
    coupures?: number[];
    libelle?: string;
}
export declare class AnnulationPaiementSalairesDto {
    motif: string;
}
