import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UtilisateurService } from './utilisateur.service';
import { AvisAccesService } from './avis-acces.service';
import { CreerUtilisateurDto, DefinirFonctionsDto, DefinirJournauxDto, ModifierUtilisateurDto, ReinitialiserMotDePasseDto } from './dto/utilisateur.dto';
export declare class UtilisateurController {
    private readonly utilisateurService;
    private readonly avis;
    constructor(utilisateurService: UtilisateurService, avis: AvisAccesService);
    lister(user: AuthenticatedUser): Promise<{
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
    creer(user: AuthenticatedUser, dto: CreerUtilisateurDto): Promise<{
        avis: import("./avis-acces.service").AvisRemis;
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
    modifier(user: AuthenticatedUser, id: string, dto: ModifierUtilisateurDto): Promise<{
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
    reinitialiserMotDePasse(user: AuthenticatedUser, id: string, dto: ReinitialiserMotDePasseDto): Promise<{
        avis: import("./avis-acces.service").AvisRemis;
        reinitialise: boolean;
        email: string;
    }>;
    catalogueFonctions(): {
        code: string;
        libelle: string;
    }[];
    definirFonctions(user: AuthenticatedUser, id: string, dto: DefinirFonctionsDto): Promise<{
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
    definirJournaux(user: AuthenticatedUser, id: string, dto: DefinirJournauxDto): Promise<{
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
    deverrouiller(user: AuthenticatedUser, id: string): Promise<{
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
