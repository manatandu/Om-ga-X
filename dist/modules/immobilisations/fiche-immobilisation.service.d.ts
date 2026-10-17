import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ImmobilisationService } from './immobilisation.service';
import type { ModifierImmobilisationDto } from './dto/fiche-immobilisation.dto';
export declare class FicheImmobilisationService {
    private readonly prisma;
    private readonly immobilisations;
    private readonly ecritures;
    private readonly journal;
    constructor(prisma: PrismaService, immobilisations: ImmobilisationService, ecritures: EcritureService);
    etat(tenantId: string, id: string): Promise<{
        valeurs: {
            designation: string;
            numeroInventaire: string | null;
            natureFiscaleCle: string | null;
            compteImmobilisationId: string;
            compteContrepartieId: string | null;
            dateAcquisition: string;
            dateMiseEnService: string | null;
            valeurOrigine: number;
            valeurResiduelle: number;
            dureeAmortissementAns: number;
            modeAmortissement: import(".prisma/client").$Enums.ModeAmortissement;
            unitesOeuvrePrevues: number | null;
            uniteOeuvreLibelle: string | null;
            amortissementAnterieur: number;
            repris: boolean;
        };
        neeDUneEcriturePassee: boolean;
        acquisition: {
            numeroPiece: number | null;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            journalId: string;
        } | null;
        modificationAEffet: {
            ouverte: boolean;
            motif: string | null;
        };
        suppression: {
            ouverte: boolean;
            motif: string | null;
        };
    }>;
    modifier(tenantId: string, userId: string, id: string, dto: ModifierImmobilisationDto): Promise<{
        valeurs: {
            designation: string;
            numeroInventaire: string | null;
            natureFiscaleCle: string | null;
            compteImmobilisationId: string;
            compteContrepartieId: string | null;
            dateAcquisition: string;
            dateMiseEnService: string | null;
            valeurOrigine: number;
            valeurResiduelle: number;
            dureeAmortissementAns: number;
            modeAmortissement: import(".prisma/client").$Enums.ModeAmortissement;
            unitesOeuvrePrevues: number | null;
            uniteOeuvreLibelle: string | null;
            amortissementAnterieur: number;
            repris: boolean;
        };
        neeDUneEcriturePassee: boolean;
        acquisition: {
            numeroPiece: number | null;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            journalId: string;
        } | null;
        modificationAEffet: {
            ouverte: boolean;
            motif: string | null;
        };
        suppression: {
            ouverte: boolean;
            motif: string | null;
        };
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    duplication(tenantId: string, id: string): Promise<{
        designation: string;
        compteImmobilisationId: string;
        natureFiscaleCle: string | null;
        lieuId: string | null;
        valeurOrigine: number;
        valeurResiduelle: number;
        dureeAmortissementAns: number;
        modeAmortissement: string;
        unitesOeuvrePrevues: number | null;
        uniteOeuvreLibelle: string | null;
    }>;
    private lire;
    private exerciceClosQuiLaPorte;
    private exercicePourLaFiche;
    private retirerEcritureOrpheline;
}
