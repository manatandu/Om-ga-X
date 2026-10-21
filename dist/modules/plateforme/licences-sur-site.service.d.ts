import { PrismaService } from '../../common/prisma.service';
export interface DemandeLicence {
    titulaire: string;
    empreinteMachine: string;
    finMaintenance: string;
    expiration: string | null;
    dossiersMax: number;
}
export declare function jourKinshasa(d?: Date): string;
export declare function numeroSuivant(annee: string, numerosDeLAnnee: string[]): string;
export declare class LicencesSurSiteService {
    private readonly prisma;
    private readonly env;
    private readonly clePublique;
    constructor(prisma: PrismaService, env?: NodeJS.ProcessEnv, clePublique?: string | null);
    lister(): Promise<{
        total: number;
        tronque: boolean;
        plafond: number;
        licences: {
            titulaire: string;
            id: string;
            createdAt: Date;
            numero: string;
            empreinteMachine: string;
            emiseLe: string;
            finMaintenance: string;
            expiration: string | null;
            dossiersMax: number;
            emisePar: string;
        }[];
    }>;
    fichier(id: string): Promise<{
        numero: string;
        fichier: string;
    }>;
    emettre(demande: DemandeLicence, operateur: string, maintenant?: Date): Promise<{
        id: string;
        numero: string;
        fichier: string;
    }>;
}
