import { CaractereEngagement } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CloreConventionDto, CreerConventionDto, CreerRapportDto, CreerTrancheDto, EncaisserTrancheDto, ModifierConventionDto } from './dto/convention.dto';
export declare class ConventionFinancementService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    static traitement(convention: {
        caractere: CaractereEngagement;
        ecritSigne: boolean;
    }): 'CREANCE_A_RECEVOIR' | 'MENTION_NOTES_ANNEXES';
    private static resteARecevoir;
    lister(tenantId: string, aujourdhui?: Date): Promise<{
        id: string;
        bailleur: {
            id: string;
            nom: string;
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
    mentionsEngagementsConditionnels(tenantId: string): Promise<string[]>;
    creancesARecevoir(tenantId: string): Promise<{
        reference: string;
        bailleur: string;
        montantAccorde: number;
        resteARecevoir: number;
    }[]>;
    creer(tenantId: string, userId: string, dto: CreerConventionDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutConvention;
        dateDebut: Date;
        tenantId: string;
        dateFin: Date;
        objet: string;
        updatedAt: Date;
        bailleurId: string;
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
    private verifierCoherence;
    modifier(tenantId: string, conventionId: string, dto: ModifierConventionDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutConvention;
        dateDebut: Date;
        tenantId: string;
        dateFin: Date;
        objet: string;
        updatedAt: Date;
        bailleurId: string;
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
    clore(tenantId: string, conventionId: string, dto: CloreConventionDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutConvention;
        dateDebut: Date;
        tenantId: string;
        dateFin: Date;
        objet: string;
        updatedAt: Date;
        bailleurId: string;
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
    ajouterTranche(tenantId: string, conventionId: string, dto: CreerTrancheDto): Promise<{
        id: string;
        createdAt: Date;
        montant: import("@prisma/client/runtime/library").Decimal;
        numero: number;
        libelle: string;
        conventionId: string;
        datePrevue: Date;
        dateEncaissement: Date | null;
        montantEncaisse: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    encaisserTranche(tenantId: string, conventionId: string, trancheId: string, dto: EncaisserTrancheDto): Promise<{
        id: string;
        createdAt: Date;
        montant: import("@prisma/client/runtime/library").Decimal;
        numero: number;
        libelle: string;
        conventionId: string;
        datePrevue: Date;
        dateEncaissement: Date | null;
        montantEncaisse: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    supprimerTranche(tenantId: string, conventionId: string, trancheId: string): Promise<{
        supprime: boolean;
    }>;
    ajouterRapport(tenantId: string, conventionId: string, dto: CreerRapportDto): Promise<{
        id: string;
        createdAt: Date;
        nature: import(".prisma/client").$Enums.NatureRapportBailleur;
        observation: string | null;
        intitule: string;
        conventionId: string;
        dateEcheance: Date;
        dateTransmission: Date | null;
    }>;
    transmettreRapport(tenantId: string, conventionId: string, rapportId: string, dateTransmission: string): Promise<{
        id: string;
        createdAt: Date;
        nature: import(".prisma/client").$Enums.NatureRapportBailleur;
        observation: string | null;
        intitule: string;
        conventionId: string;
        dateEcheance: Date;
        dateTransmission: Date | null;
    }>;
    supprimerRapport(tenantId: string, conventionId: string, rapportId: string): Promise<{
        supprime: boolean;
    }>;
}
