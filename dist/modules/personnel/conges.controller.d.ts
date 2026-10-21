import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CongesService } from './conges.service';
import { AllocationCongeDto, AnnulationCongeDto, CongeSalarieDto, RepriseCongesDto } from './dto/conges.dto';
export declare class CongesController {
    private readonly conges;
    constructor(conges: CongesService);
    compteur(user: AuthenticatedUser, salarieId: string, aLa?: string): Promise<{
        aLa: string;
        compteur: {
            refus: string;
        } | import("./conges-acquis").CompteurConges;
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
    propositions(user: AuthenticatedUser, salarieId: string, du?: string): Promise<{
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
    congesDuMois(user: AuthenticatedUser, salarieId: string, mois: string): Promise<{
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
    declarerReprise(user: AuthenticatedUser, salarieId: string, dto: RepriseCongesDto): Promise<{
        aLa: string;
        compteur: {
            refus: string;
        } | import("./conges-acquis").CompteurConges;
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
    creerConge(user: AuthenticatedUser, salarieId: string, dto: CongeSalarieDto): Promise<{
        avertissements: string[];
        aLa: string;
        compteur: {
            refus: string;
        } | import("./conges-acquis").CompteurConges;
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
    modifierAllocation(user: AuthenticatedUser, id: string, dto: AllocationCongeDto): Promise<{
        aLa: string;
        compteur: {
            refus: string;
        } | import("./conges-acquis").CompteurConges;
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
    annulerConge(user: AuthenticatedUser, id: string, dto: AnnulationCongeDto): Promise<{
        annule: boolean;
        salarieId: string;
        avertissements: string[];
    }>;
}
