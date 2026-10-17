import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { EtatPersonnaliseDto } from './dto/etat-personnalise.dto';
import { LigneDefinition } from './moteur-etat-personnalise';
export declare class EtatsPersonnalisesService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    lister(tenantId: string): Prisma.PrismaPromise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        lignes: Prisma.JsonValue;
    }[]>;
    private verifier;
    private doublon;
    creer(tenantId: string, dto: EtatPersonnaliseDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        lignes: Prisma.JsonValue;
    }>;
    modifier(tenantId: string, id: string, dto: EtatPersonnaliseDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        lignes: Prisma.JsonValue;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    private lire;
    calculer(tenantId: string, id: string, exerciceIds: string[], inclureBrouillard: boolean): Promise<{
        etat: {
            id: string;
            nom: string;
            lignes: LigneDefinition[];
        };
        inclureBrouillard: boolean;
        colonnes: {
            exerciceId: string;
            dateDebut: Date;
            dateFin: Date;
            valeurs: Record<string, number>;
        }[];
    }>;
}
