import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RegularisationService } from './regularisation.service';
import { CreerAbonnementDto, CreerRegularisationDto, GenererAbonnementDto, ModifierAbonnementDto, ReprendreRegularisationDto } from './dto/regularisation.dto';
export declare class RegularisationController {
    private readonly service;
    constructor(service: RegularisationService);
    lister(user: AuthenticatedUser, exerciceId: string): Promise<({
        compteChargeProduit: {
            numero: string;
            intitule: string;
        };
        compteDiffere: {
            numero: string;
            intitule: string;
        };
        ecritureConstatation: {
            id: string;
            date: Date;
            numeroPiece: number | null;
        } | null;
        ecritureReprise: {
            id: string;
            date: Date;
            numeroPiece: number | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeRegularisation;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        createdBy: string;
        compteChargeProduitId: string;
        compteDifferId: string;
        montantTotal: import("@prisma/client/runtime/library").Decimal;
        periodeDebut: Date;
        periodeFin: Date;
        montantDiffere: import("@prisma/client/runtime/library").Decimal;
        ecritureConstatationId: string | null;
        ecritureRepriseId: string | null;
    })[]>;
    simuler(user: AuthenticatedUser, dto: CreerRegularisationDto): Promise<{
        rattachement: boolean;
        montantDiffere: number;
        montantExercice: number;
        compteRattachement: {
            numero: string;
            intitule: string;
        };
        montantTotal: number;
        finExercice: string;
        joursTotal: number;
        joursApresCloture: number;
    } | {
        rattachement: boolean;
        montantDiffere: number;
        montantExercice: number;
        compteRattachement: null;
        montantTotal: number;
        finExercice: string;
        joursTotal: number;
        joursApresCloture: number;
    }>;
    creer(user: AuthenticatedUser, dto: CreerRegularisationDto): Promise<{
        compteChargeProduit: {
            numero: string;
            intitule: string;
        };
        compteDiffere: {
            numero: string;
            intitule: string;
        };
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeRegularisation;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        createdBy: string;
        compteChargeProduitId: string;
        compteDifferId: string;
        montantTotal: import("@prisma/client/runtime/library").Decimal;
        periodeDebut: Date;
        periodeFin: Date;
        montantDiffere: import("@prisma/client/runtime/library").Decimal;
        ecritureConstatationId: string | null;
        ecritureRepriseId: string | null;
    }>;
    reprendre(user: AuthenticatedUser, id: string, body: ReprendreRegularisationDto): Promise<{
        compteChargeProduit: {
            numero: string;
            intitule: string;
        };
        compteDiffere: {
            numero: string;
            intitule: string;
        };
        ecritureReprise: {
            id: string;
            date: Date;
            numeroPiece: number | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeRegularisation;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        createdBy: string;
        compteChargeProduitId: string;
        compteDifferId: string;
        montantTotal: import("@prisma/client/runtime/library").Decimal;
        periodeDebut: Date;
        periodeFin: Date;
        montantDiffere: import("@prisma/client/runtime/library").Decimal;
        ecritureConstatationId: string | null;
        ecritureRepriseId: string | null;
    }>;
    listerAbonnements(user: AuthenticatedUser): Promise<({
        journal: {
            intitule: string;
            code: string;
        };
        echeances: {
            id: string;
            montant: import("@prisma/client/runtime/library").Decimal;
            date: Date;
            ecritureId: string | null;
        }[];
        compteDebit: {
            numero: string;
            intitule: string;
        };
        compteCredit: {
            numero: string;
            intitule: string;
        };
    } & {
        id: string;
        createdAt: Date;
        dateDebut: Date;
        estActif: boolean;
        tenantId: string;
        dateFin: Date;
        montant: import("@prisma/client/runtime/library").Decimal;
        intitule: string;
        code: string;
        journalId: string;
        createdBy: string;
        periodicite: import(".prisma/client").$Enums.PeriodiciteAbonnement;
        compteDebitId: string;
        compteCreditId: string;
    })[]>;
    creerAbonnement(user: AuthenticatedUser, dto: CreerAbonnementDto): Promise<{
        echeances: {
            id: string;
            montant: import("@prisma/client/runtime/library").Decimal;
            date: Date;
            ecritureId: string | null;
            abonnementId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        dateDebut: Date;
        estActif: boolean;
        tenantId: string;
        dateFin: Date;
        montant: import("@prisma/client/runtime/library").Decimal;
        intitule: string;
        code: string;
        journalId: string;
        createdBy: string;
        periodicite: import(".prisma/client").$Enums.PeriodiciteAbonnement;
        compteDebitId: string;
        compteCreditId: string;
    }>;
    modifierAbonnement(user: AuthenticatedUser, id: string, dto: ModifierAbonnementDto): Promise<{
        id: string;
        createdAt: Date;
        dateDebut: Date;
        estActif: boolean;
        tenantId: string;
        dateFin: Date;
        montant: import("@prisma/client/runtime/library").Decimal;
        intitule: string;
        code: string;
        journalId: string;
        createdBy: string;
        periodicite: import(".prisma/client").$Enums.PeriodiciteAbonnement;
        compteDebitId: string;
        compteCreditId: string;
    }>;
    supprimerAbonnement(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
    generer(user: AuthenticatedUser, id: string, dto: GenererAbonnementDto): Promise<{
        generees: number;
        restantes: number;
        detail: {
            echeanceId: string;
            ecritureId: string;
            date: string;
        }[];
    }>;
}
