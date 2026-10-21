import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { NatureTraitement } from './annulation-traitement';
import { AnnulerTraitementDto } from './dto/annulation-traitement.dto';
export declare class AnnulationTraitementService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    traitementsDuBien(tenantId: string, immobilisationId: string): Promise<{
        traitements: {
            nature: NatureTraitement;
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
    annulations(tenantId: string, immobilisationId?: string): Promise<{
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
    annuler(tenantId: string, userId: string, dto: AnnulerTraitementDto): Promise<{
        annule: boolean;
        nature: NatureTraitement;
        traitement: "SANS_ECRITURE" | "SUPPRIMEE" | "INSCRITE_EN_NEGATIF";
        numeroPieceOrigine: number | null;
        negatif: {
            id: string;
            numeroPiece: number | null;
            date: string;
        } | null;
        retabli: Record<string, unknown>;
    }>;
    private motifPour;
    private cible;
    private ciblesDuBien;
    private actesDesBiens;
    private retablir;
    private retirerLActe;
    private revisionsLues;
    private revisionsPoseesPar;
}
export declare function posteeParUneReevaluation(r: {
    reevaluationBilanId: string | null;
}): boolean;
