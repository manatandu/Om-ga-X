import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EtatsPersonnalisesService } from './etats-personnalises.service';
import { EtatPersonnaliseDto } from './dto/etat-personnalise.dto';
export declare class EtatsPersonnalisesController {
    private readonly service;
    constructor(service: EtatsPersonnalisesService);
    lister(user: AuthenticatedUser): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        lignes: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    calculer(user: AuthenticatedUser, id: string, exercices?: string, inclureBrouillard?: string): Promise<{
        etat: {
            id: string;
            nom: string;
            lignes: import("./moteur-etat-personnalise").LigneDefinition[];
        };
        inclureBrouillard: boolean;
        colonnes: {
            exerciceId: string;
            dateDebut: Date;
            dateFin: Date;
            valeurs: Record<string, number>;
        }[];
    }>;
    creer(user: AuthenticatedUser, dto: EtatPersonnaliseDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        lignes: import("@prisma/client/runtime/library").JsonValue;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: EtatPersonnaliseDto): Promise<{
        id: string;
        nom: string;
        createdAt: Date;
        tenantId: string;
        updatedAt: Date;
        lignes: import("@prisma/client/runtime/library").JsonValue;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
