import { JeuEtatsFinanciersSycebnl, Referentiel, SystemeComptableSyscohada } from '@prisma/client';
export interface RegimeDossier {
    referentiel: Referentiel;
    jeuEtatsFinanciersSycebnl?: JeuEtatsFinanciersSycebnl | null;
    systemeComptableSyscohada?: SystemeComptableSyscohada | null;
}
export declare function estSystemeMinimal(t: RegimeDossier): boolean;
export declare function motifRefusDepreciationSmt(t: RegimeDossier): string | null;
export declare function motifRefusAmortissementNonLineaireSmt(t: RegimeDossier, objet: string): string | null;
export declare function motifRefusProvisionSmt(t: RegimeDossier): string | null;
