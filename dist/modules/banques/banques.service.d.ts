import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { BanqueDto, LibelleDto, ModifierBanqueDto, ModifierLibelleDto, RibDto } from './dto/banques.dto';
export declare class BanquesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Prisma.PrismaPromise<({
        ribs: ({
            journal: {
                id: string;
                intitule: string;
                code: string;
            } | null;
        } & {
            commentaire: string | null;
            codeBanque: string | null;
            codeGuichet: string | null;
            numeroCompte: string | null;
            cle: string | null;
            iban: string | null;
            codeBic: string | null;
            devise: string | null;
            id: string;
            tenantId: string;
            createdAt: Date;
            journalId: string | null;
            banqueId: string;
            abrege: string;
        })[];
    } & {
        email: string | null;
        id: string;
        tenantId: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        intitule: string;
        codePostal: string | null;
        contact: string | null;
    })[]>;
    private doublon;
    private banqueDuDossier;
    creer(tenantId: string, dto: BanqueDto): Promise<{
        email: string | null;
        id: string;
        tenantId: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        intitule: string;
        codePostal: string | null;
        contact: string | null;
    }>;
    modifier(tenantId: string, id: string, dto: ModifierBanqueDto): Promise<{
        email: string | null;
        id: string;
        tenantId: string;
        createdAt: Date;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        intitule: string;
        codePostal: string | null;
        contact: string | null;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    private champsRib;
    creerRib(tenantId: string, banqueId: string, dto: RibDto): Promise<{
        commentaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        devise: string | null;
        id: string;
        tenantId: string;
        createdAt: Date;
        journalId: string | null;
        banqueId: string;
        abrege: string;
    }>;
    modifierRib(tenantId: string, ribId: string, dto: RibDto): Promise<{
        commentaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        devise: string | null;
        id: string;
        tenantId: string;
        createdAt: Date;
        journalId: string | null;
        banqueId: string;
        abrege: string;
    }>;
    supprimerRib(tenantId: string, ribId: string): Promise<{
        supprime: boolean;
    }>;
    listerLibelles(tenantId: string): Prisma.PrismaPromise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        intitule: string;
        code: string;
    }[]>;
    creerLibelle(tenantId: string, dto: LibelleDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        intitule: string;
        code: string;
    }>;
    modifierLibelle(tenantId: string, id: string, dto: ModifierLibelleDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        intitule: string;
        code: string;
    }>;
    supprimerLibelle(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
