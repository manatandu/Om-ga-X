import { NatureModeReglement } from '@prisma/client';
export declare class CreerModeReglementDto {
    code: string;
    intitule: string;
    nature: NatureModeReglement;
    codeInterbancaire?: string | null;
    journalId?: string | null;
}
export declare class ModifierModeReglementDto {
    intitule?: string;
    nature?: NatureModeReglement;
    codeInterbancaire?: string | null;
    journalId?: string | null;
    estActif?: boolean;
}
