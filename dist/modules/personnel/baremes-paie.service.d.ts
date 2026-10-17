import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { VersionBaremePaieDto } from './dto/personnel.dto';
import { type NomBareme } from './baremes-dossier';
export declare class BaremesPaieService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        baremes: readonly NomBareme[];
        livrees: {
            CNSS: {
                aPartirDu: string | null;
                reference: string;
                valeurs: Record<string, unknown>;
            }[];
            SMIG: {
                aPartirDu: string | null;
                reference: string;
                valeurs: Record<string, unknown>;
            }[];
            INPP: {
                aPartirDu: string | null;
                reference: string;
                valeurs: Record<string, unknown>;
            }[];
            ONEM: {
                aPartirDu: string | null;
                reference: string;
                valeurs: Record<string, unknown>;
            }[];
        };
        dossier: {
            id: string;
            bareme: string;
            aPartirDu: string;
            reference: string;
            valeurs: Prisma.JsonValue;
            saisiPar: string;
            createdAt: Date;
        }[];
        reserve: string;
    }>;
    private bulletinsCouverts;
    ajouter(tenantId: string, auteur: string, dto: VersionBaremePaieDto): Promise<{
        version: {
            id: string;
            createdAt: Date;
            tenantId: string;
            reference: string;
            bareme: string;
            aPartirDu: string;
            valeurs: Prisma.JsonValue;
            saisiPar: string;
        };
        bulletinsDejaEmis: {
            numero: number;
            moisDePaie: string;
        }[];
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
