import { PrismaService } from '../../common/prisma.service';
import { PeriodiciteAbonnement, Prisma, Referentiel, TypeRegularisation } from '@prisma/client';
import { EcritureService } from '../comptabilite/ecriture.service';
import { CreerAbonnementDto, CreerRegularisationDto, GenererAbonnementDto, ModifierAbonnementDto } from './dto/regularisation.dto';
export declare function dateReprise(type: TypeRegularisation, cible: {
    dateDebut: Date;
    dateFin: Date;
}): Date;
export type NatureTiersRattachement = 'FOURNISSEURS' | 'CLIENTS' | 'PERSONNEL' | 'ORGANISMES_SOCIAUX' | 'ETAT' | 'PRETEURS';
export declare class RegularisationService {
    private readonly prisma;
    private readonly ecritureService;
    constructor(prisma: PrismaService, ecritureService: EcritureService);
    static prorataDiffere(montantTotal: number, periodeDebut: Date, periodeFin: Date, finExercice: Date): number;
    private trouverCompteDiffere;
    lister(tenantId: string, exerciceId: string): Promise<({
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
        type: import(".prisma/client").$Enums.TypeRegularisation;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        compteChargeProduitId: string;
        compteDifferId: string;
        montantTotal: Prisma.Decimal;
        periodeDebut: Date;
        periodeFin: Date;
        montantDiffere: Prisma.Decimal;
        ecritureConstatationId: string | null;
        ecritureRepriseId: string | null;
    })[]>;
    private trouverCompteRattachement;
    private trouverCompteInteretsCourus;
    static compteRattachement(referentiel: Referentiel, nature: NatureTiersRattachement, type: TypeRegularisation): {
        racine: string;
        sens: 'charge' | 'produit';
    };
    static debiteLeCompteDeGestion(type: TypeRegularisation): boolean;
    static montantRattache(type: TypeRegularisation, montantTotal: number): number;
    simuler(tenantId: string, dto: CreerRegularisationDto): Promise<{
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
    static compteTvaRattachement(referentiel: Referentiel, nature: NatureTiersRattachement | undefined, type: TypeRegularisation): string | null;
    static estRattachement(type: TypeRegularisation): boolean;
    creer(tenantId: string, createdBy: string, dto: CreerRegularisationDto): Promise<{
        compteChargeProduit: {
            numero: string;
            intitule: string;
        };
        compteDiffere: {
            numero: string;
            intitule: string;
        };
    } & {
        type: import(".prisma/client").$Enums.TypeRegularisation;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        compteChargeProduitId: string;
        compteDifferId: string;
        montantTotal: Prisma.Decimal;
        periodeDebut: Date;
        periodeFin: Date;
        montantDiffere: Prisma.Decimal;
        ecritureConstatationId: string | null;
        ecritureRepriseId: string | null;
    }>;
    static contrePassation(lignes: Array<{
        compteId: string;
        debit: unknown;
        credit: unknown;
    }>, libelle: string): Array<{
        compteId: string;
        debit?: number;
        credit?: number;
        libelle: string;
    }>;
    static exercicePosterieur(cible: {
        dateDebut: Date;
    }, constatation: {
        dateDebut: Date;
    }): boolean;
    reprendre(tenantId: string, createdBy: string, regularisationId: string, exerciceCibleId: string): Promise<{
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
        type: import(".prisma/client").$Enums.TypeRegularisation;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: string;
        exerciceId: string;
        libelle: string;
        compteChargeProduitId: string;
        compteDifferId: string;
        montantTotal: Prisma.Decimal;
        periodeDebut: Date;
        periodeFin: Date;
        montantDiffere: Prisma.Decimal;
        ecritureConstatationId: string | null;
        ecritureRepriseId: string | null;
    }>;
    static echeancesDe(dateDebut: Date, dateFin: Date, periodicite: PeriodiciteAbonnement): Date[];
    listerAbonnements(tenantId: string): Promise<({
        journal: {
            intitule: string;
            code: string;
        };
        echeances: {
            montant: Prisma.Decimal;
            id: string;
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
        montant: Prisma.Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        dateDebut: Date;
        intitule: string;
        code: string;
        dateFin: Date;
        journalId: string;
        createdBy: string;
        periodicite: import(".prisma/client").$Enums.PeriodiciteAbonnement;
        compteDebitId: string;
        compteCreditId: string;
    })[]>;
    creerAbonnement(tenantId: string, createdBy: string, dto: CreerAbonnementDto): Promise<{
        echeances: {
            montant: Prisma.Decimal;
            id: string;
            date: Date;
            ecritureId: string | null;
            abonnementId: string;
        }[];
    } & {
        montant: Prisma.Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        dateDebut: Date;
        intitule: string;
        code: string;
        dateFin: Date;
        journalId: string;
        createdBy: string;
        periodicite: import(".prisma/client").$Enums.PeriodiciteAbonnement;
        compteDebitId: string;
        compteCreditId: string;
    }>;
    modifierAbonnement(tenantId: string, abonnementId: string, dto: ModifierAbonnementDto): Promise<{
        montant: Prisma.Decimal;
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        dateDebut: Date;
        intitule: string;
        code: string;
        dateFin: Date;
        journalId: string;
        createdBy: string;
        periodicite: import(".prisma/client").$Enums.PeriodiciteAbonnement;
        compteDebitId: string;
        compteCreditId: string;
    }>;
    supprimerAbonnement(tenantId: string, abonnementId: string): Promise<{
        supprime: boolean;
    }>;
    genererEcritures(tenantId: string, createdBy: string, abonnementId: string, dto: GenererAbonnementDto): Promise<{
        generees: number;
        restantes: number;
        detail: {
            echeanceId: string;
            ecritureId: string;
            date: string;
        }[];
    }>;
    private journalAccueil;
}
