import { PrismaService } from '../../common/prisma.service';
import { FonctionMetier, RoleUtilisateur } from '@prisma/client';
import { CreerUtilisateurDto, ModifierUtilisateurDto } from './dto/utilisateur.dto';
export declare const MOTIF_ADRESSE_PRISE = "Un compte existe d\u00E9j\u00E0 avec cet email";
export declare const MOTIF_DECONNEXION_DE_SOI: string;
export declare const MOTIF_DERNIER_ADMINISTRATEUR: string;
export declare function retireUnAdministrateur(user: {
    role: RoleUtilisateur;
    estActif: boolean;
}, dto: {
    role?: RoleUtilisateur;
    estActif?: boolean;
}): boolean;
export declare class UtilisateurService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        restreindreJournaux: boolean;
        id: string;
        createdAt: Date;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }[]>;
    creer(tenantId: string, dto: CreerUtilisateurDto): Promise<{
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        restreindreJournaux: boolean;
        id: string;
        createdAt: Date;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    definirFonctions(tenantId: string, userId: string, dto: {
        restreindre: boolean;
        fonctions: FonctionMetier[];
    }): Promise<{
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        restreindreJournaux: boolean;
        id: string;
        createdAt: Date;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    definirJournaux(tenantId: string, userId: string, dto: {
        restreindre: boolean;
        journaux: string[];
    }): Promise<{
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        restreindreJournaux: boolean;
        id: string;
        createdAt: Date;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    modifier(tenantId: string, userId: string, utilisateurCourantId: string, dto: ModifierUtilisateurDto): Promise<{
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        restreindreJournaux: boolean;
        id: string;
        createdAt: Date;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    reinitialiserMotDePasse(tenantId: string, userId: string, motDePasseProvisoire: string): Promise<{
        reinitialise: boolean;
        email: string;
    }>;
    deconnecter(tenantId: string, userId: string, utilisateurCourantId: string): Promise<{
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        restreindreJournaux: boolean;
        id: string;
        createdAt: Date;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    deverrouiller(tenantId: string, userId: string): Promise<{
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        restreindreJournaux: boolean;
        id: string;
        createdAt: Date;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
}
