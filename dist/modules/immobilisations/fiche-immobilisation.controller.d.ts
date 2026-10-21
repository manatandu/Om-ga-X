import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { FicheImmobilisationService } from './fiche-immobilisation.service';
import { ModifierImmobilisationDto } from './dto/fiche-immobilisation.dto';
export declare class FicheImmobilisationController {
    private readonly fiches;
    constructor(fiches: FicheImmobilisationService);
    etat(user: AuthenticatedUser, id: string): Promise<{
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
    duplication(user: AuthenticatedUser, id: string): Promise<{
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
    modifier(user: AuthenticatedUser, id: string, dto: ModifierImmobilisationDto): Promise<{
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
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
