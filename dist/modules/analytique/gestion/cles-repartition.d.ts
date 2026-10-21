export type ModeCle = 'POURCENTAGE' | 'UNITES';
export interface LigneCle {
    sectionCibleId: string;
    valeur: number;
}
export interface SectionDuPlan {
    id: string;
    planId: string;
    code: string;
    estTotal: boolean;
    estActive: boolean;
}
export declare function motifRefusCle(params: {
    planId: string;
    sectionSourceId: string;
    mode: ModeCle;
    lignes: LigneCle[];
    sections: SectionDuPlan[];
    source: string;
}): string | null;
export declare function repartirAuCentime(montant: number, poids: readonly number[]): number[];
export interface CumulCompteSection {
    compteId: string;
    numero: string;
    intitule: string;
    debit: number;
    credit: number;
}
export interface OdProposee {
    compteId: string;
    numero: string;
    intitule: string;
    solde: number;
    lignes: {
        sectionId: string;
        debit: number;
        credit: number;
    }[];
}
export declare function propositionRepartition(cumuls: readonly CumulCompteSection[], sectionSourceId: string, lignes: readonly LigneCle[]): OdProposee[];
