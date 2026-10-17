import { FonctionMetier, RoleUtilisateur } from '@prisma/client';
export declare class CreerUtilisateurDto {
    email: string;
    motDePasse: string;
    role: RoleUtilisateur;
}
export declare class ModifierUtilisateurDto {
    role?: RoleUtilisateur;
    estActif?: boolean;
}
export declare class ReinitialiserMotDePasseDto {
    motDePasseProvisoire: string;
}
export declare class DefinirFonctionsDto {
    restreindre: boolean;
    fonctions: FonctionMetier[];
}
export declare class DefinirJournauxDto {
    restreindre: boolean;
    journaux: string[];
}
