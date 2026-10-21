import { Prisma, StatutMessage } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { ManqueTransport, TransportCourriel } from './transport-courriel';
export declare const ORIGINE_RELANCE = "RELANCE";
export declare const ORIGINE_MOT_DE_PASSE_TEMPORAIRE = "MOT_DE_PASSE_TEMPORAIRE";
export declare const ORIGINE_LICENCE_SUR_SITE = "LICENCE_SUR_SITE";
export declare const ORIGINE_FACTURE_ABONNEMENT = "FACTURE_ABONNEMENT";
export declare const ORIGINE_DOUBLE_AUTHENTIFICATION = "DOUBLE_AUTHENTIFICATION";
export declare const ORIGINE_CONDITIONS_LICENCE = "CONDITIONS_LICENCE";
export declare const ORIGINE_RAPPEL_SUPPRESSION_ESSAI = "RAPPEL_SUPPRESSION_ESSAI";
export interface MessageAMettreEnFile {
    destinataire: string;
    destinataireNom?: string | null;
    sujet: string;
    corps: string;
    origine: string;
    origineId?: string | null;
    createdBy?: string | null;
    pieceJointe?: {
        nom: string;
        texte: string;
    } | null;
}
export interface ResultatMiseEnFile {
    id: string;
    statut: StatutMessage;
    erreur: string | null;
}
export type ResultatEcritureEnFile = {
    id: string;
    statut: StatutMessage;
    motif: null;
} | {
    id: null;
    statut: null;
    motif: string;
};
export interface BilanReprise {
    transportConfigure: boolean;
    manques: ManqueTransport[];
    examines: number;
    envoyes: number;
    echoues: number;
    abandonnes: number;
    ignores: number;
    restants: number;
}
export type CompteursParStatut = Record<StatutMessage, number> & {
    aRelancer: number;
};
export declare const REPRISE_PAR_APPEL = 25;
export declare const LISTE_PAR_DEFAUT = 200;
export declare class CourrierService {
    private readonly prisma;
    private readonly transport;
    constructor(prisma: PrismaService, transport: TransportCourriel);
    etatDuTransport(): import("./transport-courriel").EtatTransport;
    mettreEnFile(tenantId: string, message: MessageAMettreEnFile): Promise<ResultatMiseEnFile>;
    envoyerUnSecret(tenantId: string, message: MessageAMettreEnFile, corpsGarde: string): Promise<ResultatMiseEnFile>;
    ecrireEnFileSansTenter(client: Prisma.TransactionClient, tenantId: string, messages: MessageAMettreEnFile[]): Promise<ResultatEcritureEnFile[]>;
    private preparer;
    reprendre(tenantId: string, limite?: number): Promise<BilanReprise>;
    retenter(tenantId: string, id: string): Promise<ResultatMiseEnFile>;
    lister(tenantId: string, options?: {
        statut?: StatutMessage;
        limite?: number;
    }): Promise<{
        messages: {
            origine: string;
            id: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutMessage;
            createdBy: string | null;
            destinataire: string;
            destinataireNom: string | null;
            sujet: string;
            origineId: string | null;
            tentatives: number;
            dernierEssaiAt: Date | null;
            prochainEssaiAt: Date | null;
            erreur: string | null;
            envoyeAt: Date | null;
        }[];
        total: number;
        plafond: number;
        tronque: boolean;
    }>;
    lire(tenantId: string, id: string): Promise<{
        origine: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutMessage;
        createdBy: string | null;
        destinataire: string;
        destinataireNom: string | null;
        sujet: string;
        corps: string;
        origineId: string | null;
        pieceJointeNom: string | null;
        pieceJointeTexte: string | null;
        tentatives: number;
        dernierEssaiAt: Date | null;
        prochainEssaiAt: Date | null;
        erreur: string | null;
        envoyeAt: Date | null;
    }>;
    compterParStatut(tenantId: string): Promise<CompteursParStatut>;
    private filtreEligibles;
    private revendiquer;
    private tenter;
    private marquer;
}
