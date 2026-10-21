import { RoleUtilisateur } from '@prisma/client';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: RoleUtilisateur[]) => import("@nestjs/common").CustomDecorator<string>;
