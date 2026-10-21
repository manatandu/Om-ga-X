export declare const CLE_ACCES_ROLES_CANTONNES = "acces-roles-cantonnes";
export interface AccesRolesCantonnes {
    aideComptable?: boolean;
    gestionnairePaie?: boolean;
}
export declare const AccesRolesCantonnes: (acces: AccesRolesCantonnes) => import("@nestjs/common").CustomDecorator<string>;
export declare const ReserveAuComptable: () => import("@nestjs/common").CustomDecorator<string>;
