import { EditionModele } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
export declare class ModelesEditionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string, edition: EditionModele): Promise<{
        modeles: {
            id: string;
            nom: string;
            edition: import(".prisma/client").$Enums.EditionModele;
            creeLe: Date;
            modifieLe: Date;
            colonnes: string[];
            saut: import(".prisma/client").$Enums.SautEdition;
        }[];
        total: number;
        tronque: boolean;
    }>;
    creer(tenantId: string, userId: string, edition: EditionModele, brut: {
        nom: unknown;
        colonnes: unknown;
        saut?: unknown;
    }): Promise<{
        id: string;
        nom: string;
        edition: import(".prisma/client").$Enums.EditionModele;
        creeLe: Date;
        modifieLe: Date;
        colonnes: string[];
        saut: import(".prisma/client").$Enums.SautEdition;
    }>;
    remplacer(tenantId: string, id: string, brut: {
        colonnes: unknown;
        saut?: unknown;
    }): Promise<{
        id: string;
        nom: string;
        edition: import(".prisma/client").$Enums.EditionModele;
        creeLe: Date;
        modifieLe: Date;
        colonnes: string[];
        saut: import(".prisma/client").$Enums.SautEdition;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
}
