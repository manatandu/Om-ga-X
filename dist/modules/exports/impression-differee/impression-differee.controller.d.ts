import { Response } from 'express';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ImpressionDiffereeService } from './impression-differee.service';
import { DemanderImpressionDto } from './dto/demander-impression.dto';
export declare class ImpressionsDiffereesController {
    private readonly service;
    constructor(service: ImpressionDiffereeService);
    lister(user: AuthenticatedUser, avant?: string): Promise<{
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
    demander(user: AuthenticatedUser, dto: DemanderImpressionDto): Promise<{
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
    traiter(user: AuthenticatedUser): Promise<{
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
    retirerFichier(user: AuthenticatedUser, id: string): Promise<{
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
    fichier(user: AuthenticatedUser, id: string, res: Response): Promise<void>;
}
