import { Prisma, StatutOrdreVirement } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
export interface PreparationOrdre {
    donneur: {
        banque: string;
        coordonnees: string;
        codeBic: string | null;
    };
    beneficiaires: Map<string, {
        tiersId: string | null;
        salarieId: string | null;
        beneficiaire: string;
        banque: string;
        coordonnees: string;
        codeBic: string | null;
    }>;
}
export interface LigneAOrdonner {
    compteId?: string;
    salarieId?: string;
    montant: number;
    reference: string | null;
    ecritureId: string;
    pieceReglement: string;
    imputationDeclaree?: string | null;
}
export declare const PLAFOND_ORDRES_LISTES = 500;
export declare class OrdresVirementService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    preparer(tenantId: string, journalId: string, compteIds: string[]): Promise<PreparationOrdre>;
    preparerSalaries(tenantId: string, journalId: string, salaries: readonly {
        id: string;
        nomComplet: string;
    }[]): Promise<PreparationOrdre>;
    private donneurDuJournal;
    creer(tenantId: string, email: string, journalId: string, date: string, preparation: PreparationOrdre, lignes: LigneAOrdonner[]): Promise<{
        id: string;
        total: Prisma.Decimal;
        numero: number;
    }>;
    creerDans(tx: Prisma.TransactionClient, tenantId: string, email: string, journalId: string, date: string, preparation: PreparationOrdre, lignes: LigneAOrdonner[]): Promise<{
        id: string;
        total: Prisma.Decimal;
        numero: number;
    }>;
    lister(tenantId: string, statut?: StatutOrdreVirement, personnelOuvert?: boolean): Promise<{
        ordres: ({
            journal: {
                intitule: string;
                code: string;
            };
            _count: {
                lignes: number;
            };
        } & {
            id: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutOrdreVirement;
            tenantId: string;
            total: Prisma.Decimal;
            numero: number;
            journalId: string;
            date: Date;
            donneurBanque: string;
            donneurCoordonnees: string;
            donneurBic: string | null;
            premiereImpressionLe: Date | null;
            premiereImpressionPar: string | null;
            nombreImpressions: number;
            annuleLe: Date | null;
            annulePar: string | null;
            motifAnnulation: string | null;
            creePar: string;
        })[];
        total: number;
        tronque: boolean;
        enAttenteImpression: number;
        statut: import(".prisma/client").$Enums.StatutOrdreVirement | null;
    }>;
    detail(tenantId: string, id: string, personnelOuvert?: boolean): Promise<{
        journal: {
            intitule: string;
            code: string;
        };
        lignes: {
            banque: string;
            id: string;
            tenantId: string;
            montant: Prisma.Decimal;
            codeBic: string | null;
            tiersId: string | null;
            reference: string | null;
            ecritureId: string | null;
            salarieId: string | null;
            beneficiaire: string;
            ordreId: string;
            coordonnees: string;
            pieceReglement: string;
            imputationDeclaree: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutOrdreVirement;
        tenantId: string;
        total: Prisma.Decimal;
        numero: number;
        journalId: string;
        date: Date;
        donneurBanque: string;
        donneurCoordonnees: string;
        donneurBic: string | null;
        premiereImpressionLe: Date | null;
        premiereImpressionPar: string | null;
        nombreImpressions: number;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        creePar: string;
    }>;
    imprimer(tenantId: string, id: string, email: string, personnelOuvert?: boolean): Promise<{
        journal: {
            intitule: string;
            code: string;
        };
        lignes: {
            banque: string;
            id: string;
            tenantId: string;
            montant: Prisma.Decimal;
            codeBic: string | null;
            tiersId: string | null;
            reference: string | null;
            ecritureId: string | null;
            salarieId: string | null;
            beneficiaire: string;
            ordreId: string;
            coordonnees: string;
            pieceReglement: string;
            imputationDeclaree: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutOrdreVirement;
        tenantId: string;
        total: Prisma.Decimal;
        numero: number;
        journalId: string;
        date: Date;
        donneurBanque: string;
        donneurCoordonnees: string;
        donneurBic: string | null;
        premiereImpressionLe: Date | null;
        premiereImpressionPar: string | null;
        nombreImpressions: number;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        creePar: string;
    }>;
    avisReglement(tenantId: string, id: string, personnelOuvert?: boolean): Promise<{
        ordre: {
            id: string;
            numero: number;
            date: Date;
            statut: import(".prisma/client").$Enums.StatutOrdreVirement;
        };
        avis: {
            ligneId: string;
            beneficiaire: string;
            montant: number;
            modele: string | null;
            texte: string;
        }[];
        lignesDeSalaires: number;
    }>;
    annuler(tenantId: string, id: string, email: string, motif: string, personnelOuvert?: boolean): Promise<{
        journal: {
            intitule: string;
            code: string;
        };
        lignes: {
            banque: string;
            id: string;
            tenantId: string;
            montant: Prisma.Decimal;
            codeBic: string | null;
            tiersId: string | null;
            reference: string | null;
            ecritureId: string | null;
            salarieId: string | null;
            beneficiaire: string;
            ordreId: string;
            coordonnees: string;
            pieceReglement: string;
            imputationDeclaree: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutOrdreVirement;
        tenantId: string;
        total: Prisma.Decimal;
        numero: number;
        journalId: string;
        date: Date;
        donneurBanque: string;
        donneurCoordonnees: string;
        donneurBic: string | null;
        premiereImpressionLe: Date | null;
        premiereImpressionPar: string | null;
        nombreImpressions: number;
        annuleLe: Date | null;
        annulePar: string | null;
        motifAnnulation: string | null;
        creePar: string;
    }>;
    annulerDans(tx: Prisma.TransactionClient, tenantId: string, ordreId: string, email: string, motif: string): Promise<void>;
}
