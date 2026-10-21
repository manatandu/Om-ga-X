import { PrismaService } from '../../common/prisma.service';
import { CourrierService } from '../courrier/courrier.service';
import { EtatConditions, StatutAccuse } from './acceptation-conditions';
export declare class ConditionsLicenceService {
    private readonly prisma;
    private readonly courrier?;
    private readonly logger;
    constructor(prisma: PrismaService, courrier?: CourrierService | undefined);
    private commande;
    private lire;
    etat(tenantId: string): Promise<EtatConditions>;
    private dernierAccuse;
    renvoyerAccuse(tenantId: string, auteur: {
        userId: string;
        email: string;
    }): Promise<{
        etat: EtatConditions;
        accuse: {
            statut: StatutAccuse;
        } | null;
    }>;
    accepter(tenantId: string, auteur: {
        userId: string;
        email: string;
    }, versionLue: number, empreinteLue: string, empreinteCommandeLue: string): Promise<{
        etat: EtatConditions;
        deja: boolean;
        accuse: {
            statut: StatutAccuse;
        } | null;
    }>;
    private accuserReception;
    private consignerAccuseManque;
}
