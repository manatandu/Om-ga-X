import { RoleUtilisateur } from '@prisma/client';
export interface CritereIsa240 {
    cle: string;
    source: string;
    titre: string;
    citation: string;
    mesure: string;
}
export declare const SEUILS_ISA_240: {
    readonly joursFinDePeriode: 7;
    readonly longueurLibelleCourt: 12;
    readonly pasMontantRond: 1000000;
    readonly planckMontantRond: 1000000;
    readonly mouvementsCompteRare: 2;
};
export declare const CRITERES_ISA_240: CritereIsa240[];
export declare const ROLES_NON_SAISISSEURS: RoleUtilisateur[];
