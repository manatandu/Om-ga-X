import { FormeJuridiqueEbnl } from '@prisma/client';
export declare function articleTrenteSeptApplicable(formeJuridique: FormeJuridiqueEbnl, droitEtranger: boolean): boolean;
export declare const PART_MAIN_OEUVRE_LOCALE_MINIMALE = 60;
export declare const MODELE_KAHASHA: {
    readonly dureeAnnees: 10;
    readonly preavisMois: 6;
    readonly source: string;
};
export interface EtatAccordCadre {
    finDePeriode: Date;
    periodeEcoulee: boolean;
    enTaciteReconduction: boolean;
    dernierJourPourDenoncer: Date | null;
    denonciationHorsPreavis: boolean | null;
}
export declare function etatAccordCadre(params: {
    dateSignature: Date;
    dureeAnnees: number;
    taciteReconduction: boolean;
    preavisMois: number | null;
    denonceLe: Date | null;
    reference: Date;
}): EtatAccordCadre;
