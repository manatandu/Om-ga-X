import { PrismaService } from '../../common/prisma.service';
import { FonctionMetier, RoleUtilisateur } from '@prisma/client';
import { CreerUtilisateurDto, ModifierUtilisateurDto } from './dto/utilisateur.dto';
export declare const MOTIF_ADRESSE_PRISE = "Un compte existe d\u00E9j\u00E0 avec cet email";
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
        id: string;
        createdAt: Date;
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        restreindreJournaux: boolean;
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }[]>;
    creer(tenantId: string, dto: CreerUtilisateurDto): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        restreindreJournaux: boolean;
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    definirFonctions(tenantId: string, userId: string, dto: {
        restreindre: boolean;
        fonctions: FonctionMetier[];
    }): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        restreindreJournaux: boolean;
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    definirJournaux(tenantId: string, userId: string, dto: {
        restreindre: boolean;
        journaux: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        restreindreJournaux: boolean;
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    modifier(tenantId: string, userId: string, utilisateurCourantId: string, dto: ModifierUtilisateurDto): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        restreindreJournaux: boolean;
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
    reinitialiserMotDePasse(tenantId: string, userId: string, motDePasseProvisoire: string): Promise<{
        reinitialise: boolean;
        email: string;
    }>;
    deverrouiller(tenantId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import(".prisma/client").$Enums.RoleUtilisateur;
        estActif: boolean;
        doitChangerMotDePasse: boolean;
        restreindreFonctions: boolean;
        fonctionsAutorisees: import(".prisma/client").$Enums.FonctionMetier[];
        restreindreJournaux: boolean;
        journauxAutorises: string[];
        verrouilleJusqua: Date | null;
        doubleAuthActiveDepuis: Date | null;
    }>;
}
