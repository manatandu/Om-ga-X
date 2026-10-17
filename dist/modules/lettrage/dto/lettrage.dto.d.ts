import { OrigineLettrage } from '@prisma/client';
export declare class LettrerDto {
    ligneIds: string[];
    autoriserPartiel?: boolean;
    lettre?: string;
}
export declare class CompleterLettrageDto {
    ligneIds: string[];
}
export declare class ReconduireLettrageDto {
    lettrageId: string;
}
export declare class VerrouillerLettrageDto {
    verrouille: boolean;
}
export declare class DelettrerDto {
    lettre: string;
}
export declare class GroupePreLettrageDto {
    ligneIds: string[];
    origine: OrigineLettrage;
}
export declare class ConfirmerPreLettrageDto {
    groupes: GroupePreLettrageDto[];
}
