export type ReferentielEnCours = 'SYSCOHADA' | 'SYCEBNL';
export declare const RACINES_EN_COURS: Readonly<Record<ReferentielEnCours, Readonly<Record<string, string>>>>;
export declare function estCompteEnCours(numero: string): boolean;
export declare function racineEnCours(referentiel: ReferentielEnCours, numeroDefinitif: string): string | null;
export declare function motifSansEnCours(referentiel: ReferentielEnCours, numeroDefinitif: string): string | null;
export declare function motifRefusCompteEnCours(referentiel: ReferentielEnCours, numeroDefinitif: string, numeroEnCours: string): string | null;
export declare function comptesEnCoursDuBien<C extends {
    numero: string;
}>(referentiel: ReferentielEnCours, numeroDefinitif: string, comptesDetail: readonly C[]): C[];
export declare function compteEnCoursPropose<C extends {
    numero: string;
}>(referentiel: ReferentielEnCours, numeroDefinitif: string, candidats: readonly C[]): C | null;
export declare function compteInscritALaDate(immo: {
    compteImmobilisationId: string;
    compteEnCoursId?: string | null;
    dateMiseEnService: Date | null;
}, date: Date): string;
export declare function compteInscritChargeALaDate<C extends {
    id: string;
}>(immo: {
    compteImmobilisationId: string;
    compteEnCoursId?: string | null;
    dateMiseEnService: Date | null;
    compteImmobilisation: C;
    compteEnCours?: C | null;
}, date: Date): C;
export declare function motifRefusTantQueEnCours(immo: {
    compteImmobilisationId: string;
    compteEnCoursId?: string | null;
    dateMiseEnService: Date | null;
}, date: Date, geste: string): string | null;
