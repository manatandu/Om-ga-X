import { Prisma, Referentiel } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EnregistrerManuelDto } from './dto/manuel-procedures.dto';
export interface SectionManuel {
    cle: string;
    titre: string;
    texte: string;
}
export declare const SQUELETTE_MANUEL: SectionManuel[];
export declare function sourceManuel(referentiel: Referentiel): string;
export declare class ManuelProceduresService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        sections: SectionManuel[];
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        version: number;
        dateApplication: Date;
    }[]>;
    conformite(tenantId: string): Promise<{
        source: string;
        existe: boolean;
        versionEnVigueur: number;
        dateApplication: Date;
        nombreVersions: number;
        sectionsVides: string[];
        classementRenseigne: boolean;
    }>;
    enregistrer(tenantId: string, userId: string, dto: EnregistrerManuelDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        version: number;
        dateApplication: Date;
        sections: Prisma.JsonValue;
    }>;
}
