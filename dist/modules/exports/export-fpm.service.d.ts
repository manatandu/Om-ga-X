import type { Writable } from 'stream';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { type PeriodeExtrait } from '../comptabilite/periode-extrait';
import type { ExtraitNumerote } from './extraits-periode/extraits-periode.service';
import { type FamilleTiers } from '../comptabilite/familles-tiers';
import { ExportService } from './export.service';
export interface DemandeDExtrait {
    periode: PeriodeExtrait;
    numeroter: () => Promise<ExtraitNumerote>;
}
export declare class ExportFpmService {
    private readonly prisma;
    private readonly ecritureService;
    private readonly exportService;
    constructor(prisma: PrismaService, ecritureService: EcritureService, exportService: ExportService);
    lotExport: number;
    private contexte;
    private avecExtrait;
    private numeroterSiExtrait;
    private balanceFpm;
    private verifierVolume;
    private parcourirGrandLivre;
    private parcourirParCompte;
    private rattachements;
    private intitulesDesCollectifs;
    private ouvrirClasseur;
    private redacteur;
    private ecrireFinDeLivre;
    private ecrireControleLivre;
    balanceGeneraleEnFlux(tenantId: string, exerciceId: string, avecGrandsLivres: boolean, ouvrir: (nomFichier: string) => Writable, extrait?: DemandeDExtrait): Promise<{
        lignes: number;
    }>;
    private intitulesDesDivisions;
    private feuillesParCompte;
    private perimetreTiers;
    private soldesDesCollectifs;
    balanceTiersEnFlux(tenantId: string, exerciceId: string, famille: FamilleTiers, avecGrandsLivres: boolean, ouvrir: (nomFichier: string) => Writable): Promise<{
        lignes: number;
    }>;
    private ecrireControle;
    grandLivreEnFlux(tenantId: string, exerciceId: string, ouvrir: (nomFichier: string) => Writable, options?: {
        extrait?: DemandeDExtrait;
        compteId?: string;
    }): Promise<{
        lignes: number;
    }>;
    grandLivreTiersEnFlux(tenantId: string, exerciceId: string, famille: FamilleTiers, ouvrir: (nomFichier: string) => Writable): Promise<{
        lignes: number;
    }>;
    private grandLivreSurUneFeuille;
}
export declare function familleOuRefus(brut: string | undefined): FamilleTiers;
