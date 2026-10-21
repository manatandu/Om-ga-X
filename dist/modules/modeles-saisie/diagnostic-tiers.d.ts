import { Referentiel } from '@prisma/client';
export interface LigneADiagnostiquer {
    numero: string;
    sens: 'DEBIT' | 'CREDIT';
}
export declare function diagnostiquerTiers(lignes: LigneADiagnostiquer[], referentiel: Referentiel): string[];
