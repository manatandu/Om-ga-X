import { Referentiel } from '@prisma/client';
export interface LigneACreer {
    referentiel: Referentiel;
    statutEcriture: string;
    exerciceClos: boolean;
    estANouveau: boolean;
    debit: number;
    numeroCompte: string;
    dejaRattacheeA: string | null;
    acquisitionDuModule: string | null;
    autresModules: string[];
    lignesDeBien: number;
    fondsAuCredit: string[];
    corrigeeParLaPiece: string | null;
    credits: string[];
    negatifSurUnCompteDeBien: boolean;
    premierJourHorsAchats: string | null;
    memeMontantEnNegatifAilleurs: string | null;
}
export declare function creditsQuiSortentUnBien(referentiel: Referentiel, numeroCompteDuBien: string, credits: readonly string[]): string[];
export declare function motifRefusLigneACreer(l: LigneACreer): string | null;
export declare function avertissementsLigneACreer(l: LigneACreer): string[];
export declare function confirmationPremierJour(l: LigneACreer): string | null;
