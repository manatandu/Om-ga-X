export interface LigneLettrable {
    lettre: string | null;
    lettrageId: string | null;
}
export declare function estTenueParUnLettrage(l: LigneLettrable): boolean;
export declare function designationLettrage(l: LigneLettrable): string;
