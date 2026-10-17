import { JeuEtatsFinanciersSycebnl, Referentiel, SensDepreciation } from '@prisma/client';
export declare function motifNonAmortissable(numeroCompte: string, referentiel: Referentiel): string | null;
export declare function motifSansAmortissementProjet(jeu: JeuEtatsFinanciersSycebnl | null | undefined): string | null;
export declare const RACINES_FONDS_PROJET: readonly ["162", "163", "164"];
export declare function estCompteFondsProjet(numero: string): boolean;
export declare function motifListeFondsProjetVide(o: {
    projet: boolean;
    nombre: number;
    inactifs: number;
    nonRetenus?: number;
}): string | null;
export declare function motifRefusSortieProjet(o: {
    projet: boolean;
    numeroCompteFonds: string | null;
    cumulAmorti: number;
    cumulDepreciation: number;
    compteFondsEnSommeil?: boolean;
}): string | null;
export declare function motifRefusCompteAmortissement(referentiel: Referentiel, numeroBien: string, numeroCompte28: string): string | null;
export declare function motifRefusCompteDepreciation(referentiel: Referentiel, numeroBien: string, numeroCompte29: string): string | null;
export declare const CONTREPARTIES_DEPRECIATION_SYSCOHADA: Record<SensDepreciation, readonly string[]>;
export declare function motifRefusContrepartieDepreciation(referentiel: Referentiel, sens: SensDepreciation, numeroContrepartie: string): string | null;
export declare function motifRefusContrepartieUsufruit(referentiel: Referentiel, numeroBien: string, sens: SensDepreciation, numeroContrepartie: string): string | null;
export declare function motifRefusDepreciationDivision20(referentiel: Referentiel, numeroBien: string, sens: SensDepreciation, numeroCompte29: string, numeroContrepartie: string): string | null;
export declare function motifRefusContrepartieCession(referentiel: Referentiel, cessionCourante: boolean, numeroContrepartie: string): string | null;
