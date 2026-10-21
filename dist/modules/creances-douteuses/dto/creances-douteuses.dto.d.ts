import { NatureCreanceDouteuse } from '@prisma/client';
export declare class PieceJustificativeDto {
    nature: string;
    reference: string;
    date?: string;
}
declare class MotifEtPiecesDto {
    motif: string;
    pieces: PieceJustificativeDto[];
}
export declare class FactureDesigneeDto {
    ligneEcritureId: string;
    montant: number;
}
export declare class DesignerFacturesDto {
    factures: FactureDesigneeDto[];
}
export declare class ReclasserCreanceDto extends MotifEtPiecesDto {
    factures?: FactureDesigneeDto[];
    exerciceId: string;
    journalId: string;
    date: string;
    compteCreanceId: string;
    compte416Id?: string;
    compte491Id?: string;
    nature: NatureCreanceDouteuse;
    montant: number;
}
export declare class RevoirDepreciationDto extends MotifEtPiecesDto {
    exerciceId: string;
    journalId: string;
    depreciationNecessaire: number;
}
export declare class PerteCreanceDto extends MotifEtPiecesDto {
    exerciceId: string;
    journalId: string;
    date: string;
    montant: number;
    comptePerteId?: string;
    duplicatas?: DuplicataFactureDto[];
}
export declare class RecouvrementCreanceDto extends MotifEtPiecesDto {
    exerciceId: string;
    journalId: string;
    date: string;
    montant: number;
}
export declare class AnnulerRevueDto {
    motif: string;
}
export declare class AnnulerMouvementDto extends AnnulerRevueDto {
}
export declare class RetirerDesignationDto extends AnnulerRevueDto {
}
export declare class AnnulerReclassementDto extends AnnulerRevueDto {
}
export declare class CorrigerParResultatDto extends AnnulerRevueDto {
    ecritureId: string;
}
export declare class Lettrer416Dto {
    exerciceId: string;
    ligneIds: string[];
}
export declare class DeclarerCreanceOuvertureDto {
    exerciceId: string;
    compteCreanceId: string;
    compte416Id: string;
    compte491Id?: string;
    nature: NatureCreanceDouteuse;
    montant: number;
    depreciationOuverture: number;
    source: string;
    motif?: string;
    pieces?: PieceJustificativeDto[];
}
export declare class DuplicataFactureDto {
    designationId: string;
    reference: string;
    dateEnvoi: string;
}
export declare class RecupererTvaCreanceDto extends MotifEtPiecesDto {
    exerciceId: string;
    journalId: string;
    date: string;
    duplicatas: DuplicataFactureDto[];
}
export declare class AnnulerRecuperationTvaDto extends AnnulerRevueDto {
}
export {};
