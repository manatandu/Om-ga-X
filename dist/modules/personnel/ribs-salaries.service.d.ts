import { ModePaiementSalaire } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RibTiersDto } from '../tiers/dto/ribs-tiers.dto';
export declare const PLAFOND_RIBS_SALARIE = 20;
export declare class RibsSalariesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private salarie;
    private trouver;
    private donnees;
    lire(tenantId: string, salarieId: string): Promise<{
        modePaiement: import(".prisma/client").$Enums.ModePaiementSalaire | null;
        ribs: {
            coordonnees: string;
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
            estPrincipal: boolean;
            salarieId: string;
        }[];
        total: number;
        tronque: boolean;
    }>;
    definirMode(tenantId: string, salarieId: string, mode: ModePaiementSalaire | null | undefined): Promise<{
        modePaiement: import(".prisma/client").$Enums.ModePaiementSalaire | null;
        ribs: {
            coordonnees: string;
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
            estPrincipal: boolean;
            salarieId: string;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creer(tenantId: string, salarieId: string, dto: RibTiersDto): Promise<{
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
        estPrincipal: boolean;
        salarieId: string;
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
        estPrincipal: boolean;
        salarieId: string;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
