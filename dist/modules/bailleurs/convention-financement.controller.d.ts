import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ConventionFinancementService } from './convention-financement.service';
import { CloreConventionDto, CreerConventionDto, CreerRapportDto, CreerTrancheDto, EncaisserTrancheDto, ModifierConventionDto, TransmettreRapportDto } from './dto/convention.dto';
export declare class ConventionFinancementController {
    private readonly conventions;
    constructor(conventions: ConventionFinancementService);
    lister(user: AuthenticatedUser): Promise<{
        id: string;
        bailleur: {
            nom: string;
            id: string;
            code: string;
        };
        reference: string;
        objet: string;
        ecritSigne: boolean;
        signataire: string | null;
        dateSignature: Date | null;
        dateDebut: Date;
        dateFin: Date;
        montantAccorde: number;
        caractere: import(".prisma/client").$Enums.CaractereEngagement;
        conditions: string | null;
        statut: import(".prisma/client").$Enums.StatutConvention;
        motifCloture: string | null;
        traitement: "CREANCE_A_RECEVOIR" | "MENTION_NOTES_ANNEXES";
        montantEncaisse: number;
        resteARecevoir: number;
        expiree: boolean;
        tranches: {
            id: string;
            numero: number;
            libelle: string;
            montant: number;
            datePrevue: Date;
            dateEncaissement: Date | null;
            montantEncaisse: number | null;
            enRetard: boolean;
        }[];
        rapports: {
            id: string;
            intitule: string;
            nature: import(".prisma/client").$Enums.NatureRapportBailleur;
            dateEcheance: Date;
            dateTransmission: Date | null;
            observation: string | null;
            enRetard: boolean;
        }[];
    }[]>;
    mentions(user: AuthenticatedUser): Promise<string[]>;
    creances(user: AuthenticatedUser): Promise<{
        reference: string;
        bailleur: string;
        montantAccorde: number;
        resteARecevoir: number;
    }[]>;
    creer(user: AuthenticatedUser, dto: CreerConventionDto): Promise<{
        objet: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutConvention;
        dateDebut: Date;
        bailleurId: string;
        updatedAt: Date;
        dateFin: Date;
        createdBy: string;
        reference: string;
        motifCloture: string | null;
        ecritSigne: boolean;
        signataire: string | null;
        dateSignature: Date | null;
        montantAccorde: import("@prisma/client/runtime/library").Decimal;
        caractere: import(".prisma/client").$Enums.CaractereEngagement;
        conditions: string | null;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierConventionDto): Promise<{
        objet: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutConvention;
        dateDebut: Date;
        bailleurId: string;
        updatedAt: Date;
        dateFin: Date;
        createdBy: string;
        reference: string;
        motifCloture: string | null;
        ecritSigne: boolean;
        signataire: string | null;
        dateSignature: Date | null;
        montantAccorde: import("@prisma/client/runtime/library").Decimal;
        caractere: import(".prisma/client").$Enums.CaractereEngagement;
        conditions: string | null;
    }>;
    clore(user: AuthenticatedUser, id: string, dto: CloreConventionDto): Promise<{
        objet: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutConvention;
        dateDebut: Date;
        bailleurId: string;
        updatedAt: Date;
        dateFin: Date;
        createdBy: string;
        reference: string;
        motifCloture: string | null;
        ecritSigne: boolean;
        signataire: string | null;
        dateSignature: Date | null;
        montantAccorde: import("@prisma/client/runtime/library").Decimal;
        caractere: import(".prisma/client").$Enums.CaractereEngagement;
        conditions: string | null;
    }>;
    ajouterTranche(user: AuthenticatedUser, id: string, dto: CreerTrancheDto): Promise<{
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        createdAt: Date;
        numero: number;
        libelle: string;
        conventionId: string;
        datePrevue: Date;
        dateEncaissement: Date | null;
        montantEncaisse: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    encaisserTranche(user: AuthenticatedUser, id: string, trancheId: string, dto: EncaisserTrancheDto): Promise<{
        montant: import("@prisma/client/runtime/library").Decimal;
        id: string;
        createdAt: Date;
        numero: number;
        libelle: string;
        conventionId: string;
        datePrevue: Date;
        dateEncaissement: Date | null;
        montantEncaisse: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    supprimerTranche(user: AuthenticatedUser, id: string, trancheId: string): Promise<{
        supprime: boolean;
    }>;
    ajouterRapport(user: AuthenticatedUser, id: string, dto: CreerRapportDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureRapportBailleur;
        observation: string | null;
        id: string;
        createdAt: Date;
        intitule: string;
        conventionId: string;
        dateEcheance: Date;
        dateTransmission: Date | null;
    }>;
    transmettreRapport(user: AuthenticatedUser, id: string, rapportId: string, dto: TransmettreRapportDto): Promise<{
        nature: import(".prisma/client").$Enums.NatureRapportBailleur;
        observation: string | null;
        id: string;
        createdAt: Date;
        intitule: string;
        conventionId: string;
        dateEcheance: Date;
        dateTransmission: Date | null;
    }>;
    supprimerRapport(user: AuthenticatedUser, id: string, rapportId: string): Promise<{
        supprime: boolean;
    }>;
}
