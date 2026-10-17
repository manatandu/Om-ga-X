import { CaractereEngagement, NatureRapportBailleur, StatutConvention } from '@prisma/client';
export declare class CreerConventionDto {
    bailleurId: string;
    reference: string;
    objet: string;
    ecritSigne?: boolean;
    signataire?: string;
    dateSignature?: string;
    dateDebut: string;
    dateFin: string;
    montantAccorde: number;
    caractere: CaractereEngagement;
    conditions?: string;
}
export declare class ModifierConventionDto {
    objet?: string;
    ecritSigne?: boolean;
    signataire?: string;
    dateSignature?: string;
    dateDebut?: string;
    dateFin?: string;
    montantAccorde?: number;
    caractere?: CaractereEngagement;
    conditions?: string;
}
export declare class CloreConventionDto {
    statut: StatutConvention;
    motif?: string;
}
export declare class CreerTrancheDto {
    numero: number;
    libelle: string;
    montant: number;
    datePrevue: string;
}
export declare class EncaisserTrancheDto {
    dateEncaissement: string;
    montantEncaisse: number;
}
export declare class CreerRapportDto {
    intitule: string;
    nature: NatureRapportBailleur;
    dateEcheance: string;
    observation?: string;
}
export declare class TransmettreRapportDto {
    dateTransmission: string;
}
