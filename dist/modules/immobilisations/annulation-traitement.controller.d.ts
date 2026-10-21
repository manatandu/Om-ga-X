import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AnnulationTraitementService } from './annulation-traitement.service';
import { AnnulerTraitementDto } from './dto/annulation-traitement.dto';
export declare class AnnulationTraitementController {
    private readonly annulations;
    constructor(annulations: AnnulationTraitementService);
    historique(user: AuthenticatedUser, immobilisationId?: string): Promise<{
        total: number;
        tronque: boolean;
        annulations: {
            id: string;
            nature: import(".prisma/client").$Enums.NatureTraitementImmobilisation;
            libelle: string;
            immobilisation: {
                id: string;
                designation: string;
            } | null;
            exercice: {
                id: string;
                dateFin: Date;
            };
            montant: number | null;
            motif: string;
            traitement: string;
            numeroPieceOrigine: number | null;
            negatif: {
                id: string;
                date: Date;
                numeroPiece: number | null;
            } | null;
            annuleeLe: Date;
            annuleePar: string;
        }[];
    }>;
    traitements(user: AuthenticatedUser, id: string): Promise<{
        traitements: {
            nature: import("./annulation-traitement").NatureTraitement;
            acteId: string;
            libelle: string;
            exercice: {
                id: string;
                dateFin: Date;
                statut: import(".prisma/client").$Enums.StatutExercice;
            };
            enregistreLe: Date;
            montant: number | null;
            ecriture: {
                id: string;
                numeroPiece: number | null;
                statut: import(".prisma/client").$Enums.StatutEcriture;
            } | null;
            portePlusieursBiens: boolean;
            motifRefus: string | null;
        }[];
    }>;
    annuler(user: AuthenticatedUser, dto: AnnulerTraitementDto): Promise<{
        annule: boolean;
        nature: import("./annulation-traitement").NatureTraitement;
        traitement: "SANS_ECRITURE" | "SUPPRIMEE" | "INSCRITE_EN_NEGATIF";
        numeroPieceOrigine: number | null;
        negatif: {
            id: string;
            numeroPiece: number | null;
            date: string;
        } | null;
        retabli: Record<string, unknown>;
    }>;
}
