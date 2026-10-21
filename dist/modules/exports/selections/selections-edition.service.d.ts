import { EditionSelection, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
export declare class SelectionsEditionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string, edition: EditionSelection): Promise<{
        selections: {
            creePar: string;
            journalIntrouvable: boolean;
            nom: string;
            id: string;
            criteres: Prisma.JsonValue;
            edition: import(".prisma/client").$Enums.EditionSelection;
            creeLe: Date;
            modifieLe: Date;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creer(tenantId: string, userId: string, edition: EditionSelection, nomBrut: unknown, brut: unknown): Promise<{
        nom: string;
        id: string;
        criteres: Prisma.JsonValue;
        edition: import(".prisma/client").$Enums.EditionSelection;
    }>;
    remplacer(tenantId: string, id: string, brut: unknown): Promise<{
        nom: string;
        id: string;
        criteres: Prisma.JsonValue;
        edition: import(".prisma/client").$Enums.EditionSelection;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprimee: boolean;
    }>;
    private criteresDuDossier;
}
