import { NatureModeleImpression } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { type Cadre } from './modeles-impression';
import { CreerModeleImpressionDto, ModifierModeleImpressionDto } from './dto/modeles-impression.dto';
type LecteurModeles = Pick<PrismaService, 'modeleImpressionTiers'>;
type LecteurCadres = Pick<PrismaService, 'modeleImpressionTiers' | 'tiers'>;
export declare function modeleDuDossierPourLaZone(prisma: LecteurModeles, tenantId: string, id: string, nature: NatureModeleImpression): Promise<{
    nature: import(".prisma/client").$Enums.NatureModeleImpression;
    id: string;
    intitule: string;
}>;
export declare function cadresDesTiers(prisma: LecteurCadres, tenantId: string, tiersIds: readonly string[], nature: NatureModeleImpression, contexte: {
    entite: string;
    jour: Date;
}, cadreParDefaut?: string): Promise<Map<string, Cadre>>;
export declare class ModelesImpressionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        nombreTiers: number;
        nature: import(".prisma/client").$Enums.NatureModeleImpression;
        id: string;
        intitule: string;
        texte: string;
    }[]>;
    creer(tenantId: string, userId: string, dto: CreerModeleImpressionDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureModeleImpression;
        id: string;
        intitule: string;
        texte: string;
    }>;
    modifier(tenantId: string, id: string, dto: ModifierModeleImpressionDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureModeleImpression;
        id: string;
        intitule: string;
        texte: string;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    private dejaPris;
}
export {};
