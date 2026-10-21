import { NatureImpressionDifferee } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { ExportService } from '../export.service';
import { ExportFpmService } from '../export-fpm.service';
export declare class ImpressionDiffereeService {
    private readonly prisma;
    private readonly exportService;
    private readonly exportFpm;
    private readonly logger;
    constructor(prisma: PrismaService, exportService: ExportService, exportFpm: ExportFpmService);
    demander(tenantId: string, userId: string, nature: NatureImpressionDifferee, brut: Record<string, unknown>): Promise<{
        nomFichier: string | null;
        nature: import(".prisma/client").$Enums.NatureImpressionDifferee;
        empreinte: string | null;
        id: string;
        numero: number;
        taille: number | null;
        libelle: string;
        etat: import(".prisma/client").$Enums.EtatImpressionDifferee;
        demandeLe: Date;
        demandePar: string;
        commenceLe: Date | null;
        produitLe: Date | null;
        motifEchec: string | null;
        fichierRetireLe: Date | null;
    }>;
    traiter(tenantId: string): Promise<{
        traitee: {
            nomFichier: string | null;
            nature: import(".prisma/client").$Enums.NatureImpressionDifferee;
            empreinte: string | null;
            id: string;
            numero: number;
            taille: number | null;
            libelle: string;
            etat: import(".prisma/client").$Enums.EtatImpressionDifferee;
            demandeLe: Date;
            demandePar: string;
            commenceLe: Date | null;
            produitLe: Date | null;
            motifEchec: string | null;
            fichierRetireLe: Date | null;
        } | null;
        enAttente: number;
    }>;
    lister(tenantId: string, avant?: number): Promise<{
        impressions: {
            demandePar: string;
            interrompue: boolean;
            nomFichier: string | null;
            nature: import(".prisma/client").$Enums.NatureImpressionDifferee;
            empreinte: string | null;
            id: string;
            numero: number;
            taille: number | null;
            libelle: string;
            etat: import(".prisma/client").$Enums.EtatImpressionDifferee;
            demandeLe: Date;
            commenceLe: Date | null;
            produitLe: Date | null;
            motifEchec: string | null;
            fichierRetireLe: Date | null;
        }[];
        total: number;
        tronque: boolean;
        plusAnciensAvant: number | null;
        enAttente: number;
    }>;
    fichier(tenantId: string, id: string): Promise<{
        nomFichier: string;
        contenu: Buffer;
    }>;
    retirerFichier(tenantId: string, id: string): Promise<{
        nomFichier: string | null;
        nature: import(".prisma/client").$Enums.NatureImpressionDifferee;
        empreinte: string | null;
        id: string;
        numero: number;
        taille: number | null;
        libelle: string;
        etat: import(".prisma/client").$Enums.EtatImpressionDifferee;
        demandeLe: Date;
        demandePar: string;
        commenceLe: Date | null;
        produitLe: Date | null;
        motifEchec: string | null;
        fichierRetireLe: Date | null;
    }>;
    private produire;
    private ranger;
    private declarerInterrompues;
}
