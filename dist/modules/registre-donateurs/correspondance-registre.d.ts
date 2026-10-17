export type LectureLiberalite = 'NET_CREDIT' | 'CREDIT_SEUL';
export interface CompteLiberalite {
    numero: string;
    intitule: string;
    lecture: LectureLiberalite;
    fondement: string;
}
export declare const COMPTES_LIBERALITE: CompteLiberalite[];
export declare const COMPTES_FRONTIERE: CompteLiberalite[];
export declare const COMPTES_HORS_PERIMETRE: CompteLiberalite[];
