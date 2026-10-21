import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BaremesPaieService } from './baremes-paie.service';
import { VersionBaremePaieDto } from './dto/personnel.dto';
export declare class BaremesPaieController {
    private readonly service;
    constructor(service: BaremesPaieService);
    lister(user: AuthenticatedUser): Promise<{
        baremes: readonly import("./baremes-dossier").NomBareme[];
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
            valeurs: import("@prisma/client/runtime/library").JsonValue;
            saisiPar: string;
            createdAt: Date;
        }[];
        reserve: string;
    }>;
    ajouter(user: AuthenticatedUser, dto: VersionBaremePaieDto): Promise<{
        version: {
            id: string;
            createdAt: Date;
            tenantId: string;
            reference: string;
            bareme: string;
            aPartirDu: string;
            valeurs: import("@prisma/client/runtime/library").JsonValue;
            saisiPar: string;
        };
        bulletinsDejaEmis: {
            numero: number;
            moisDePaie: string;
        }[];
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
