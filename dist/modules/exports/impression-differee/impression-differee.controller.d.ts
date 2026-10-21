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
            id: string;
            nomFichier: string | null;
            nature: import(".prisma/client").$Enums.NatureImpressionDifferee;
            empreinte: string | null;
            numero: number;
            libelle: string;
            taille: number | null;
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
        id: string;
        nomFichier: string | null;
        nature: import(".prisma/client").$Enums.NatureImpressionDifferee;
        empreinte: string | null;
        numero: number;
        libelle: string;
        taille: number | null;
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
            id: string;
            nomFichier: string | null;
            nature: import(".prisma/client").$Enums.NatureImpressionDifferee;
            empreinte: string | null;
            numero: number;
            libelle: string;
            taille: number | null;
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
        id: string;
        nomFichier: string | null;
        nature: import(".prisma/client").$Enums.NatureImpressionDifferee;
        empreinte: string | null;
        numero: number;
        libelle: string;
        taille: number | null;
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
