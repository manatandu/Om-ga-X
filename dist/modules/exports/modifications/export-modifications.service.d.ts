import { ModeExportEcritures, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { ExportService } from '../export.service';
import { type EcritureEchange, type EntreeRegistre, type Mouvement } from './export-modifications';
export declare const PLAFOND_EXPORTS_LISTES = 50;
interface Candidat {
    id: string;
    date: Date;
    lignes: number;
    entree?: EntreeRegistre;
    mouvement: Mouvement;
}
interface EntreeSupprimee {
    ecritureId: string;
    numeroExport: number;
    date: Date;
    journalCode: string;
    piece: string;
    libelle: string;
}
export interface InventaireExport {
    dernierNumero: number | null;
    retenues: Candidat[];
    supprimees: EntreeSupprimee[];
    lignes: number;
    nouvelles: number;
    modifiees: number;
    renvoyees: number;
    enAttente: number;
    horsPlafond: Candidat | null;
    brouillardModifieHorsPortee: number;
}
declare const CONTENU_ECRITURE: {
    journal: {
        select: {
            code: true;
        };
    };
    lignes: {
        select: {
            libelle: true;
            debit: true;
            credit: true;
            montantDevise: true;
            coursApplique: true;
            dateEcheance: true;
            compte: {
                select: {
                    numero: true;
                };
            };
            devise: {
                select: {
                    code: true;
                };
            };
        };
    };
};
type EcritureLue = Prisma.EcritureGetPayload<{
    include: typeof CONTENU_ECRITURE;
}>;
export declare function versEchange(e: EcritureLue): EcritureEchange;
export declare class ExportModificationsService {
    private readonly prisma;
    private readonly exportService;
    constructor(prisma: PrismaService, exportService: ExportService);
    lister(tenantId: string, avant?: number): Promise<{
        exports: {
            produitPar: string;
            nomFichier: string;
            empreinte: string;
            id: string;
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
    apercu(tenantId: string, inclureBrouillard: boolean): Promise<{
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
    private motifDuHorsPlafond;
    inventaire(tenantId: string, mode: ModeExportEcritures, inclureBrouillard: boolean): Promise<InventaireExport>;
    private contenus;
    private jamaisPartiesApres;
    private jamaisPartiesDepuis;
    private supprimeesDepuisLeurEnvoi;
    exporter(tenantId: string, userId: string, mode: ModeExportEcritures, inclureBrouillard: boolean): Promise<{
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
    fichier(tenantId: string, id: string): Promise<{
        nomFichier: string;
        contenu: Buffer;
    }>;
    private courriels;
}
export type ResultatExport = Awaited<ReturnType<ExportModificationsService['exporter']>>;
export {};
