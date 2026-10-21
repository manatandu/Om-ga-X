import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EmballagesService } from './emballages.service';
import { CreerConsignationDto, DenouerConsignationDto, RattacherEcritureConsignationDto } from './dto/consignation.dto';
import type { ModeDenouement } from './consignation';
export declare class EmballagesController {
    private readonly emballages;
    constructor(emballages: EmballagesService);
    lister(user: AuthenticatedUser): Promise<{
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
    creer(user: AuthenticatedUser, dto: CreerConsignationDto): Promise<{
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
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprimee: boolean;
    }>;
    ouverture(user: AuthenticatedUser, id: string): Promise<import("./consignation").PropositionDenouement>;
    simuler(user: AuthenticatedUser, id: string, mode: ModeDenouement, prixDeReprise?: string): Promise<import("./consignation").PropositionDenouement>;
    denouer(user: AuthenticatedUser, id: string, dto: DenouerConsignationDto): Promise<{
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
    candidates(user: AuthenticatedUser, id: string, role: string): Promise<{
        id: string;
        date: string;
        numeroPiece: number | null;
        libelle: string;
        statut: import(".prisma/client").$Enums.StatutEcriture;
    }[]>;
    rattacher(user: AuthenticatedUser, id: string, role: string, dto: RattacherEcritureConsignationDto): Promise<{
        rattache: boolean;
        role: import("./emballages.service").RoleEcritureConsignation;
        ecritureId: string;
    }>;
    detacher(user: AuthenticatedUser, id: string, role: string): Promise<{
        detache: boolean;
        role: import("./emballages.service").RoleEcritureConsignation;
    }>;
}
