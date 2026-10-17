import { TypeRelance } from '@prisma/client';
export declare class CreerNiveauDto {
    niveau: number;
    libelle: string;
    type: TypeRelance;
    joursApresEcheance: number;
    modeleTexte: string;
}
export declare class ModifierNiveauDto {
    libelle?: string;
    joursApresEcheance?: number;
    modeleTexte?: string;
    estActif?: boolean;
}
export declare const PLAFOND_COMPTES_PAR_EMISSION = 500;
export declare class EmettreRelancesDto {
    exerciceId: string;
    compteIds: string[];
    niveauId: string;
    dateReference?: string;
}
export declare class HorsRelanceDto {
    horsRelance: boolean;
    motif?: string;
}
