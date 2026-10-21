import { RoleUtilisateur } from '@prisma/client';
import type { AccesRolesCantonnes } from '../decorators/acces-roles-cantonnes.decorator';
export declare const ROLES_CANTONNES: readonly RoleUtilisateur[];
export declare function routeOuverteAuRoleCantonne(role: RoleUtilisateur, acces: AccesRolesCantonnes | undefined): boolean;
export declare function rolesSatisfaits(role: RoleUtilisateur, rolesRequis: readonly RoleUtilisateur[], acces: AccesRolesCantonnes | undefined): boolean;
