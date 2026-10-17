import { NatureAbsenceSalarie, TraitementIndemniteCaisse } from '@prisma/client';
export declare class AbsenceSalarieDto {
    nature: NatureAbsenceSalarie;
    du: string;
    au: string;
    demiJourneeDebut?: boolean;
    demiJourneeFin?: boolean;
    evenement?: string;
    piece?: string;
    observation?: string;
}
export declare class AnnulationAbsenceDto {
    motif: string;
}
export declare class IndemniteCaisseDto {
    mois: string;
    montant: number;
    traitement: TraitementIndemniteCaisse;
    piece: string;
}
