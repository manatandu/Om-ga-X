export declare class CreerDeviseDto {
    code: string;
    intitule: string;
}
export declare class ModifierDeviseDto {
    intitule?: string;
    estActive?: boolean;
}
export declare class PoserCoursDto {
    date: string;
    cours: number;
    source?: string;
}
export declare class ReevaluerDto {
    exerciceId: string;
    dateReevaluation?: string;
    positionGlobale?: boolean;
    simulation?: boolean;
}
export declare class ExtournerReevaluationDto {
    exerciceSuivantId: string;
    integrale?: boolean;
}
export declare class AnnulerReevaluationDto {
    motif: string;
}
export declare class DeclarerContrePassationManuelleDto {
    ecritureId: string;
    motif: string;
}
export declare class MotifAttestationEtatDto {
    motif: string;
}
export declare class RetirerContrePassationManuelleDto {
    motif: string;
}
export declare class DeclarerProvisionOuvertureDto {
    compteProvision: string;
    montant: number;
    dateReference: string;
    source: string;
    motif?: string;
    provisionModuleContestee?: boolean;
    motifContestation?: string;
}
export declare class LigneVentilationDisponibiliteDto {
    compteId: string;
    deviseId: string;
    ecart: number;
}
export declare class DeclarerVentilationDisponibilitesDto {
    ventilation: LigneVentilationDisponibiliteDto[];
    source: string;
}
