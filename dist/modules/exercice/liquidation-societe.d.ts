import { FormeJuridiqueSyscohada, RegimeLiquidation } from '@prisma/client';
import { type JalonServi } from './portefeuille-etat';
export declare const ETAPE_LIQUIDATION = 27;
export declare const FORMES_EN_LIQUIDATION: readonly FormeJuridiqueSyscohada[];
export declare function formeEnLiquidation(forme: FormeJuridiqueSyscohada | null | undefined): boolean;
export declare function plusMois(d: Date, n: number): Date;
export declare function autreLectureDuMois(evenement: Date, n: number): Date | null;
export declare function lendemainDe(d: Date): Date;
export declare function estExerciceDeLiquidation(exercice: {
    dateDebut: Date;
}, dateDissolution: Date | null): boolean;
export declare function situationsAnnuelles(dissolution: Date, exercice: {
    dateDebut: Date;
    dateFin: Date;
}, clotureLiquidation: Date | null): Date[];
export declare function sansLiquidation(faits: {
    forme: FormeJuridiqueSyscohada | null;
    regimeLiquidation: RegimeLiquidation | null;
    associeUniquePersonneMorale?: boolean | null;
}): boolean;
export declare function estFinSansLiquidation(exercice: {
    dateFin: Date;
}, dossier: {
    dateDissolution: Date | null;
    formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null;
    regimeLiquidation: RegimeLiquidation | null;
    associeUniquePersonneMorale?: boolean | null;
}): boolean;
export declare const TOTALISATION_ARTICLE_12_AL_4: string;
export interface FaitsLiquidation {
    forme: FormeJuridiqueSyscohada | null;
    dateDissolution: Date | null;
    dateNominationLiquidateur: Date | null;
    regimeLiquidation: RegimeLiquidation | null;
    associeUniquePersonneMorale?: boolean | null;
    dateClotureLiquidation?: Date | null;
}
export declare function jalonsLiquidation(faits: FaitsLiquidation, exercice: {
    dateDebut: Date;
    dateFin: Date;
}, aujourdHui: Date): JalonServi[];
export interface FaitsCotisationsSpeciales extends FaitsLiquidation {
    dateDeclarationCotisationActivite?: Date | null;
    dateDeclarationCotisationLiquidation?: Date | null;
}
export declare function cotisationsDues(faits: {
    forme: FormeJuridiqueSyscohada | null;
    dateDissolution: Date | null;
}): boolean;
export declare function echeanceDansLeMois(evenement: Date): Date;
export declare function echeanceDerniereCotisation(faits: FaitsCotisationsSpeciales): Date | null;
export declare function exercicePorteurSecondeCotisation(exercices: Array<{
    id: string;
    dateDebut: Date;
    dateFin: Date;
}>, faits: FaitsCotisationsSpeciales): string | null;
export declare function impotAnnuelCedeAuxCotisations(faits: {
    forme: FormeJuridiqueSyscohada | null;
    dateDissolution: Date | null;
}, exercice: {
    dateFin: Date;
}): boolean;
export declare function cotisationsSpeciales(faits: FaitsCotisationsSpeciales, exercice: {
    dateDebut: Date;
    dateFin: Date;
    clos: boolean;
}, aujourdHui: Date, options?: {
    porteurSeconde?: boolean;
}): JalonServi[];
export interface EcheanceCotisation {
    cle: 'cotisationSpecialeActivite' | 'cotisationSpecialeLiquidation';
    libelle: string;
    date: Date;
    echeance: string;
    baseLegale: string;
    reserve: string | null;
}
export declare function echeancierDissolution(faits: FaitsCotisationsSpeciales, reference: Date): {
    cotisationsDues: boolean;
    retenir: (cle: string, prochaine: Date) => boolean;
    mentionAcompte: string | null;
    cotisations: EcheanceCotisation[];
    avertissements: string[];
};
