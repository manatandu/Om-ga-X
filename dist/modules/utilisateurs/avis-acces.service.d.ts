import { RoleUtilisateur, StatutMessage } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CourrierService } from '../courrier/courrier.service';
export declare const LIBELLE_ROLE: Record<RoleUtilisateur, string>;
export interface AvisRemis {
    avise: boolean;
    destinataire: string;
    statut: StatutMessage | null;
    motif: string | null;
}
export interface TexteAvis {
    sujet: string;
    corps: string;
}
export declare function avisCompteCree(params: {
    entite: string;
    email: string;
    role: RoleUtilisateur;
}): TexteAvis;
export declare function avisReinitialisation(params: {
    entite: string;
    email: string;
}): TexteAvis;
export declare class AvisAccesService {
    private readonly prisma;
    private readonly courrier;
    constructor(prisma: PrismaService, courrier: CourrierService);
    annoncerCompteCree(tenantId: string, compte: {
        userId: string;
        email: string;
        role: RoleUtilisateur;
        parQui: string;
    }): Promise<AvisRemis>;
    annoncerReinitialisation(tenantId: string, compte: {
        userId: string;
        email: string;
        parQui: string;
    }): Promise<AvisRemis>;
    private nomDuDossier;
    private remettre;
}
