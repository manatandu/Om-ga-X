export declare const RACINE_4428 = "4428";
export declare const RACINES_CHARGE_INPP_ONEM: readonly ["6413", "6415"];
export type StructureEcriture4428 = {
    readonly estDePaie?: boolean;
    readonly porteUneChargeInppOnem?: boolean;
};
export type LigneDu4428 = {
    readonly debit: unknown;
    readonly credit: unknown;
    readonly lettrageId?: string | null;
    readonly compte: {
        readonly numero: string;
    };
    readonly ecriture: StructureEcriture4428;
};
export declare const estDu4428: (numero: string) => boolean;
export type Partage4428<L> = {
    readonly pur: boolean;
    readonly lues: ReadonlySet<L>;
    readonly creditsEtrangersFc: number;
    readonly reversementsNonRattachesFc: number;
};
export declare function partagerLe4428<L extends LigneDu4428>(lignes: readonly L[]): Partage4428<L>;
export declare function mentionDu4428Mele(p: Partage4428<unknown>, soldeOuverture4428Fc: number): string | null;
