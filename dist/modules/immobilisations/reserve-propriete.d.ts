import { Referentiel } from '@prisma/client';
export declare const RACINE_DETTE_RESERVE_PROPRIETE = "4816";
export declare function contrepartieAReserveDePropriete(numeroContrepartie: string | null | undefined): boolean;
export declare function motifRefusReserveDePropriete(e: {
    reserveDePropriete: boolean;
    leveeLe: Date | null;
    dateAcquisition: Date;
    numeroContrepartie?: string | null;
}): string | null;
export declare function frappeDeReserveALaDate(immo: {
    reserveDePropriete: boolean;
    reserveProprieteLeveeLe: Date | null;
    dateAcquisition: Date;
    dateSortie: Date | null;
}, date: Date): boolean;
export declare function motifRefusReserveSurExerciceClos(avant: {
    reserveDePropriete: boolean;
    reserveProprieteLeveeLe: Date | null;
    dateAcquisition: Date;
    dateSortie: Date | null;
}, apres: {
    reserveDePropriete: boolean;
    reserveProprieteLeveeLe: Date | null;
}, exercicesClos: ReadonlyArray<{
    dateFin: Date;
}>): string | null;
export declare function sourceReserveDePropriete(referentiel: Referentiel): string;
