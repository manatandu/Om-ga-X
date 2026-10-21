import { PrismaService } from '../../common/prisma.service';
import { type ModeDenouement } from './consignation';
import { CreerConsignationDto, DenouerConsignationDto } from './dto/consignation.dto';
export declare class EmballagesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    lister(tenantId: string): Promise<{
        referentiel: import(".prisma/client").$Enums.Referentiel;
        consignations: {
            id: string;
            tiers: {
                nom: string;
                code: string;
            };
            sens: import(".prisma/client").$Enums.SensConsignation;
            nature: import(".prisma/client").$Enums.NatureObjetConsigne;
            designation: string;
            quantite: number | null;
            dateConsignation: string;
            montant: number;
            etat: import(".prisma/client").$Enums.EtatConsignation;
            dateDenouement: string | null;
            prixDeReprise: number | null;
            ecritureConsignationId: string | null;
            ecritureDenouementId: string | null;
        }[];
        enAttente: {
            nombre: number;
            detteEmise: number;
            creanceRecue: number;
        };
    }>;
    creer(tenantId: string, userId: string, dto: CreerConsignationDto): Promise<{
        consignation: {
            nature: import(".prisma/client").$Enums.NatureObjetConsigne;
            montant: import("@prisma/client/runtime/library").Decimal;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string;
            tiersId: string;
            designation: string;
            sens: import(".prisma/client").$Enums.SensConsignation;
            etat: import(".prisma/client").$Enums.EtatConsignation;
            quantite: import("@prisma/client/runtime/library").Decimal | null;
            dateConsignation: Date;
            dateDenouement: Date | null;
            prixDeReprise: import("@prisma/client/runtime/library").Decimal | null;
            ecritureConsignationId: string | null;
            ecritureDenouementId: string | null;
        };
        proposition: import("./consignation").PropositionDenouement;
    }>;
    supprimer(tenantId: string, consignationId: string): Promise<{
        supprimee: boolean;
    }>;
    propositionOuverture(tenantId: string, consignationId: string): Promise<import("./consignation").PropositionDenouement>;
    propositionDenouement(tenantId: string, consignationId: string, mode: ModeDenouement, prixDeReprise?: number | null): Promise<import("./consignation").PropositionDenouement>;
    denouer(tenantId: string, consignationId: string, dto: DenouerConsignationDto): Promise<{
        consignation: {
            nature: import(".prisma/client").$Enums.NatureObjetConsigne;
            montant: import("@prisma/client/runtime/library").Decimal;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string;
            tiersId: string;
            designation: string;
            sens: import(".prisma/client").$Enums.SensConsignation;
            etat: import(".prisma/client").$Enums.EtatConsignation;
            quantite: import("@prisma/client/runtime/library").Decimal | null;
            dateConsignation: Date;
            dateDenouement: Date | null;
            prixDeReprise: import("@prisma/client/runtime/library").Decimal | null;
            ecritureConsignationId: string | null;
            ecritureDenouementId: string | null;
        };
        proposition: import("./consignation").PropositionDenouement;
    }>;
    private comptePrincipal;
    private chargerPourCalcul;
    private lignesAttendues;
    ecrituresCandidates(tenantId: string, consignationId: string, roleBrut: string): Promise<{
        id: string;
        date: string;
        numeroPiece: number | null;
        libelle: string;
        statut: import(".prisma/client").$Enums.StatutEcriture;
    }[]>;
    rattacherEcriture(tenantId: string, consignationId: string, roleBrut: string, ecritureId: string): Promise<{
        rattache: boolean;
        role: RoleEcritureConsignation;
        ecritureId: string;
    }>;
    detacherEcriture(tenantId: string, consignationId: string, roleBrut: string): Promise<{
        detache: boolean;
        role: RoleEcritureConsignation;
    }>;
}
export type RoleEcritureConsignation = 'OUVERTURE' | 'DENOUEMENT';
