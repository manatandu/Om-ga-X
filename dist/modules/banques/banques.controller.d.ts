import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BanquesService } from './banques.service';
import { BanqueDto, LibelleDto, ModifierBanqueDto, ModifierLibelleDto, RibDto } from './dto/banques.dto';
export declare class BanquesController {
    private readonly service;
    constructor(service: BanquesService);
    lister(user: AuthenticatedUser): import(".prisma/client").Prisma.PrismaPromise<({
        ribs: ({
            journal: {
                id: string;
                intitule: string;
                code: string;
            } | null;
        } & {
            devise: string | null;
            id: string;
            createdAt: Date;
            tenantId: string;
            commentaire: string | null;
            codeBanque: string | null;
            codeGuichet: string | null;
            numeroCompte: string | null;
            cle: string | null;
            iban: string | null;
            codeBic: string | null;
            journalId: string | null;
            banqueId: string;
            abrege: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        email: string | null;
        tenantId: string;
        intitule: string;
        codePostal: string | null;
        contact: string | null;
    })[]>;
    creer(user: AuthenticatedUser, dto: BanqueDto): Promise<{
        id: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        email: string | null;
        tenantId: string;
        intitule: string;
        codePostal: string | null;
        contact: string | null;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierBanqueDto): Promise<{
        id: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        email: string | null;
        tenantId: string;
        intitule: string;
        codePostal: string | null;
        contact: string | null;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    creerRib(user: AuthenticatedUser, id: string, dto: RibDto): Promise<{
        devise: string | null;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        journalId: string | null;
        banqueId: string;
        abrege: string;
    }>;
    modifierRib(user: AuthenticatedUser, id: string, dto: RibDto): Promise<{
        devise: string | null;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        journalId: string | null;
        banqueId: string;
        abrege: string;
    }>;
    supprimerRib(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    listerLibelles(user: AuthenticatedUser): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        intitule: string;
        code: string;
    }[]>;
    creerLibelle(user: AuthenticatedUser, dto: LibelleDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        intitule: string;
        code: string;
    }>;
    modifierLibelle(user: AuthenticatedUser, id: string, dto: ModifierLibelleDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        intitule: string;
        code: string;
    }>;
    supprimerLibelle(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
