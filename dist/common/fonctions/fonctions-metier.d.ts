import { FonctionMetier } from '@prisma/client';
export declare const LIBELLES_FONCTION: Record<FonctionMetier, string>;
export declare const FONCTION_PAR_CONTROLEUR: Record<string, FonctionMetier>;
export declare const FONCTION_PAR_METHODE: Record<string, FonctionMetier>;
export declare const FONCTION_PAR_METHODE_DU_GESTIONNAIRE_PAIE: Record<string, FonctionMetier>;
export declare const CONTROLEURS_HORS_PROFIL: Record<string, string>;
export declare function fonctionDeRoute(classe: string, methode: string, role?: string): FonctionMetier | null;
export declare function motifRefusFonction(utilisateur: {
    role: string;
    restreindreFonctions?: boolean;
    fonctionsAutorisees?: string[];
}, verbeHttp: string, fonction: FonctionMetier | null): string | null;
