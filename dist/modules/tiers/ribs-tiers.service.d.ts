import { PrismaService } from '../../common/prisma.service';
import { RibTiersDto } from './dto/ribs-tiers.dto';
export declare class RibsTiersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private tiersDuDossier;
    private trouver;
    private donnees;
    lister(tenantId: string, tiersId: string): Promise<{
        devise: string | null;
        banque: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        titulaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        tiersId: string;
        estPrincipal: boolean;
    }[]>;
    creer(tenantId: string, tiersId: string, dto: RibTiersDto): Promise<{
        devise: string | null;
        banque: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        titulaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        tiersId: string;
        estPrincipal: boolean;
    }>;
    modifier(tenantId: string, id: string, dto: RibTiersDto): Promise<{
        devise: string | null;
        banque: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        commentaire: string | null;
        titulaire: string | null;
        codeBanque: string | null;
        codeGuichet: string | null;
        numeroCompte: string | null;
        cle: string | null;
        iban: string | null;
        codeBic: string | null;
        tiersId: string;
        estPrincipal: boolean;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
