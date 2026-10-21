import { TypeCompteDetailTotal } from '@prisma/client';
export declare const LONGUEUR_SECTIONS_MIN = 2;
export declare const LONGUEUR_SECTIONS_MAX = 13;
export declare const SECTIONS_NOMMEES_AU_PLUS = 20;
export interface SectionAMesurer {
    code: string;
    type: TypeCompteDetailTotal;
}
export declare function longueurDuCode(code: string): number;
export declare function motifRefusBornesLongueur(longueur: number): string | null;
export declare function ecartALaLongueur(section: SectionAMesurer, longueur: number): string | null;
export declare function motifRefusCodeSection(section: SectionAMesurer, longueur: number | null): string | null;
export interface SectionHorsLongueur {
    code: string;
    type: TypeCompteDetailTotal;
    ecart: string;
}
export declare class ReleveLongueurs {
    private readonly longueur;
    readonly horsLongueur: SectionHorsLongueur[];
    nombreHorsLongueur: number;
    nombreSections: number;
    private readonly longueursDetail;
    private longueurTotalMax;
    constructor(longueur: number | null);
    ajouter(section: SectionAMesurer): void;
    get proposee(): number | null;
}
export declare function motifRefusLongueurSections(planCode: string, longueur: number | null, releve: ReleveLongueurs): string | null;
