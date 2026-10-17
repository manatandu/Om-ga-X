export interface LigneOd {
    sectionId: string;
    debit?: number;
    credit?: number;
}
export interface SectionConnue {
    id: string;
    planId: string;
    code: string;
    estTotal: boolean;
}
export declare function motifRefusClasseVentilee(classeCompte: string, classesVentilees: string): string | null;
export declare function motifRefusMontantAnalytique(rang: number, debit: number, credit: number): string | null;
export declare function motifRefusOd(params: {
    planId: string;
    lignes: LigneOd[];
    sections: SectionConnue[];
    classeCompte: string;
    classesVentilees: string;
}): string | null;
export declare function fusionnerCumuls(ventilations: Map<string, {
    debit: number;
    credit: number;
}>, od: Map<string, {
    debit: number;
    credit: number;
}>): Map<string, {
    debit: number;
    credit: number;
}>;
