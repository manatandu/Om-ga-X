import { Response } from 'express';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ExportModificationsService } from './export-modifications.service';
import { ExporterEcrituresDto } from './dto/exporter-ecritures.dto';
export declare class ExportModificationsController {
    private readonly service;
    constructor(service: ExportModificationsService);
    lister(user: AuthenticatedUser, avant?: string): Promise<{
        exports: {
            produitPar: string;
            id: string;
            nomFichier: string;
            empreinte: string;
            numero: number;
            taille: number;
            nombreEcritures: number;
            mode: import(".prisma/client").$Enums.ModeExportEcritures;
            inclureBrouillard: boolean;
            produitAt: Date;
            nombreNouvelles: number;
            nombreModifiees: number;
            nombreSupprimees: number;
            nombreLignes: number;
            nombreEnAttente: number;
        }[];
        total: number;
        tronque: boolean;
        plusAnciensAvant: number | null;
    }>;
    apercu(user: AuthenticatedUser, inclureBrouillard?: string): Promise<{
        dernierNumero: number | null;
        nouvelles: number;
        modifiees: number;
        supprimees: number;
        lignes: number;
        enAttente: number;
        plafondLignes: number;
        brouillardModifieHorsPortee: number;
        horsPlafond: string | null;
    }>;
    exporter(user: AuthenticatedUser, dto: ExporterEcrituresDto): Promise<{
        id: string;
        numero: number;
        mode: import(".prisma/client").$Enums.ModeExportEcritures;
        inclureBrouillard: boolean;
        produitAt: Date;
        produitPar: string;
        nombreEcritures: number;
        nombreNouvelles: number;
        nombreModifiees: number;
        nombreSupprimees: number;
        nombreLignes: number;
        nombreEnAttente: number;
        brouillardModifieHorsPortee: number;
        nomFichier: string;
        taille: number;
        empreinte: string;
    }>;
    fichier(user: AuthenticatedUser, id: string, res: Response): Promise<void>;
}
