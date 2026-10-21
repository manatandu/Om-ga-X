import { ModeReportANouveau, NatureCompteType } from '@prisma/client';
export interface Fourchette {
    du: string;
    au: string;
}
export interface NatureParametree {
    nature: NatureCompteType;
    fourchettes: Fourchette[];
    modeReportANouveau: ModeReportANouveau;
    lettrable: boolean;
}
export declare const LIBELLES_NATURE: Record<NatureCompteType, string>;
export declare const NATURES_PAR_DEFAUT: NatureParametree[];
export declare function dansFourchette(numero: string, f: Fourchette): boolean;
export declare function natureDe(numero: string, natures: NatureParametree[]): NatureParametree | null;
export declare function motifRefusFourchettes(nature: NatureCompteType, fourchettes: Fourchette[], autres: NatureParametree[]): string | null;
export declare function lireFourchettes(json: unknown): Fourchette[];
export declare function incoherencesDeReport<C extends {
    numero: string;
    typeCompte: string;
    modeReportANouveau: ModeReportANouveau;
}>(comptes: C[], natures: NatureParametree[]): Array<C & {
    nature: NatureCompteType;
    modeAttendu: ModeReportANouveau;
}>;
