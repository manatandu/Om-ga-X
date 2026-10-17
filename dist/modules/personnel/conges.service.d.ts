import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { type JourIso } from './conges-acquis';
import { AllocationCongeDto, CongeSalarieDto, RepriseCongesDto } from './dto/conges.dto';
import { serviceEnCours, type ContratLu } from './service-du-salarie';
import { lireAbsencesPourConges, type LecteurAbsences } from './absences-lecture';
export { serviceEnCours, lireAbsencesPourConges };
export type { LecteurAbsences };
type Db = PrismaService | Prisma.TransactionClient;
export declare const PLAFOND_CONGES_SALARIE = 500;
export declare const NATURE_ALLOCATION_CONGE = "ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE";
export declare function tauxJournalierPropose(contrat: Pick<ContratLu, 'remunerationBase' | 'periodiciteRemuneration' | 'deviseRemuneration'> | null): {
    valeur: number;
    devise: string;
    explication: string;
} | {
    valeur: null;
    motif: string;
};
export type AllocationPortee = {
    readonly congeId: string;
    readonly du: JourIso;
    readonly au: JourIso;
    readonly jours: number;
    readonly tauxJournalier: number;
    readonly devise: 'CDF' | 'USD';
    readonly montant: number;
};
export declare function allocationsAPorter(db: Db, tenantId: string, salarieId: string, moisDePaie: string, congeIds: readonly string[], deviseStipulation: 'CDF' | 'USD', lireAbsences?: LecteurAbsences): Promise<AllocationPortee[]>;
export declare const libelleAllocation: (a: AllocationPortee) => string;
export declare function lierCongesAuBulletin(tx: Prisma.TransactionClient, tenantId: string, bulletinId: string, portees: readonly AllocationPortee[]): Promise<void>;
export declare class CongesService {
    private readonly prisma;
    private readonly lireAbsences;
    constructor(prisma: PrismaService);
    compteur(tenantId: string, salarieId: string, aLaBrut?: string): Promise<{
        aLa: string;
        compteur: import("./conges-acquis").CompteurConges | {
            refus: string;
        };
        reprise: {
            arreteAu: string;
            joursNesNonPris: number;
            moisEnCoursAccomplis: number;
            source: string;
            declarePar: string;
        } | null;
        conges: {
            id: string;
            du: string;
            au: string;
            joursVoyage: number;
            moisDePaie: string;
            deviseAllocation: string | null;
            remunerationJournaliere: number | null;
            moyenneMensuelleArticle142: number | null;
            auDelaDuSolde: boolean;
            motifAuDelaDuSolde: string | null;
            annuleLe: Date | null;
            motifAnnulation: string | null;
            bulletin: {
                numero: number;
                statut: import(".prisma/client").$Enums.StatutBulletinPaie;
                moisDePaie: string;
            } | null;
            paiementAuPlusTard: string | null;
            allocation: {
                jours: null;
                montant: null;
                tauxJournalier: null;
                devise: string | null;
                motif: string;
                ouvrables?: undefined;
                maladie?: undefined;
            } | {
                jours: number;
                ouvrables: number;
                maladie: number;
                montant: number | null;
                tauxJournalier: number | null;
                devise: string | null;
                motif: string | null;
            };
        }[];
        tronque: boolean;
    }>;
    propositions(tenantId: string, salarieId: string, duBrut: string): Promise<{
        du: string;
        tauxJournalier: {
            valeur: number;
            devise: string;
            explication: string;
        } | {
            valeur: null;
            motif: string;
        };
        moyenneMensuelleArticle142: {
            valeur: number;
            explication: string;
        } | {
            valeur: null;
            motif: string;
        };
        paiementAuPlusTard: string | null;
    }>;
    declarerReprise(tenantId: string, userEmail: string, salarieId: string, dto: RepriseCongesDto): Promise<{
        aLa: string;
        compteur: import("./conges-acquis").CompteurConges | {
            refus: string;
        };
        reprise: {
            arreteAu: string;
            joursNesNonPris: number;
            moisEnCoursAccomplis: number;
            source: string;
            declarePar: string;
        } | null;
        conges: {
            id: string;
            du: string;
            au: string;
            joursVoyage: number;
            moisDePaie: string;
            deviseAllocation: string | null;
            remunerationJournaliere: number | null;
            moyenneMensuelleArticle142: number | null;
            auDelaDuSolde: boolean;
            motifAuDelaDuSolde: string | null;
            annuleLe: Date | null;
            motifAnnulation: string | null;
            bulletin: {
                numero: number;
                statut: import(".prisma/client").$Enums.StatutBulletinPaie;
                moisDePaie: string;
            } | null;
            paiementAuPlusTard: string | null;
            allocation: {
                jours: null;
                montant: null;
                tauxJournalier: null;
                devise: string | null;
                motif: string;
                ouvrables?: undefined;
                maladie?: undefined;
            } | {
                jours: number;
                ouvrables: number;
                maladie: number;
                montant: number | null;
                tauxJournalier: number | null;
                devise: string | null;
                motif: string | null;
            };
        }[];
        tronque: boolean;
    }>;
    creerConge(tenantId: string, userEmail: string, salarieId: string, dto: CongeSalarieDto): Promise<{
        avertissements: string[];
        aLa: string;
        compteur: import("./conges-acquis").CompteurConges | {
            refus: string;
        };
        reprise: {
            arreteAu: string;
            joursNesNonPris: number;
            moisEnCoursAccomplis: number;
            source: string;
            declarePar: string;
        } | null;
        conges: {
            id: string;
            du: string;
            au: string;
            joursVoyage: number;
            moisDePaie: string;
            deviseAllocation: string | null;
            remunerationJournaliere: number | null;
            moyenneMensuelleArticle142: number | null;
            auDelaDuSolde: boolean;
            motifAuDelaDuSolde: string | null;
            annuleLe: Date | null;
            motifAnnulation: string | null;
            bulletin: {
                numero: number;
                statut: import(".prisma/client").$Enums.StatutBulletinPaie;
                moisDePaie: string;
            } | null;
            paiementAuPlusTard: string | null;
            allocation: {
                jours: null;
                montant: null;
                tauxJournalier: null;
                devise: string | null;
                motif: string;
                ouvrables?: undefined;
                maladie?: undefined;
            } | {
                jours: number;
                ouvrables: number;
                maladie: number;
                montant: number | null;
                tauxJournalier: number | null;
                devise: string | null;
                motif: string | null;
            };
        }[];
        tronque: boolean;
        id: string;
        jours: number;
    }>;
    private verifierAllocation;
    modifierAllocation(tenantId: string, id: string, dto: AllocationCongeDto): Promise<{
        aLa: string;
        compteur: import("./conges-acquis").CompteurConges | {
            refus: string;
        };
        reprise: {
            arreteAu: string;
            joursNesNonPris: number;
            moisEnCoursAccomplis: number;
            source: string;
            declarePar: string;
        } | null;
        conges: {
            id: string;
            du: string;
            au: string;
            joursVoyage: number;
            moisDePaie: string;
            deviseAllocation: string | null;
            remunerationJournaliere: number | null;
            moyenneMensuelleArticle142: number | null;
            auDelaDuSolde: boolean;
            motifAuDelaDuSolde: string | null;
            annuleLe: Date | null;
            motifAnnulation: string | null;
            bulletin: {
                numero: number;
                statut: import(".prisma/client").$Enums.StatutBulletinPaie;
                moisDePaie: string;
            } | null;
            paiementAuPlusTard: string | null;
            allocation: {
                jours: null;
                montant: null;
                tauxJournalier: null;
                devise: string | null;
                motif: string;
                ouvrables?: undefined;
                maladie?: undefined;
            } | {
                jours: number;
                ouvrables: number;
                maladie: number;
                montant: number | null;
                tauxJournalier: number | null;
                devise: string | null;
                motif: string | null;
            };
        }[];
        tronque: boolean;
    }>;
    annulerConge(tenantId: string, userEmail: string, id: string, motif: string): Promise<{
        annule: boolean;
        salarieId: string;
        avertissements: string[];
    }>;
    congesDuMois(tenantId: string, salarieId: string, mois: string): Promise<{
        id: string;
        du: string;
        au: string;
        portePar: number | null;
        allocation: {
            jours: null;
            montant: null;
            tauxJournalier: null;
            devise: string | null;
            motif: string;
            ouvrables?: undefined;
            maladie?: undefined;
        } | {
            jours: number;
            ouvrables: number;
            maladie: number;
            montant: number | null;
            tauxJournalier: number | null;
            devise: string | null;
            motif: string | null;
        };
    }[]>;
}
