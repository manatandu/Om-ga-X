import { PrismaService } from '../../common/prisma.service';
import { AbsenceSalarieDto, IndemniteCaisseDto } from './dto/absences.dto';
export declare function informationsDeLArret(nature: string, debutSuspension: Date, du: Date, au: Date): string[];
export declare class AbsencesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    catalogue(): {
        natures: {
            libelle: string;
            fondement: string;
            regime: import("./absences").RegimeRemuneration;
            conge: import("./absences").EffetSurLeConge;
            maladie: boolean;
            piece: string | null;
            demiJournees: boolean;
            cle: string;
        }[];
        evenements: ({
            libelle: "Mariage du travailleur";
            jours: 2;
            cle: string;
        } | {
            libelle: "Accouchement de l'épouse";
            jours: 2;
            cle: string;
        } | {
            libelle: "Décès du conjoint, ou d'un parent allié au 1er degré";
            jours: 4;
            cle: string;
        } | {
            libelle: "Mariage d'un enfant";
            jours: 1;
            cle: string;
        } | {
            libelle: "Décès d'un parent ou allié au second degré";
            jours: 2;
            cle: string;
        })[];
    };
    lister(tenantId: string, salarieId: string): Promise<{
        absences: {
            id: string;
            nature: import(".prisma/client").$Enums.NatureAbsenceSalarie;
            libelle: string;
            fondement: string;
            regime: import("./absences").RegimeRemuneration;
            du: string;
            au: string;
            demiJourneeDebut: boolean;
            demiJourneeFin: boolean;
            evenement: string | null;
            piece: string | null;
            observation: string | null;
            joursOuvrables: number | null;
            joursCalendaires: number | null;
            annuleLe: Date | null;
            motifAnnulation: string | null;
            creePar: string;
            debutSuspension: string | null;
            informations: string[];
            indemnitesCaisse: {
                id: string;
                mois: string;
                montant: number;
                traitement: import(".prisma/client").$Enums.TraitementIndemniteCaisse;
                piece: string;
                annuleLe: Date | null;
                motifAnnulation: string | null;
            }[];
        }[];
        total: number;
        tronque: boolean;
    }>;
    creer(tenantId: string, userEmail: string, salarieId: string, dto: AbsenceSalarieDto): Promise<{
        id: string;
    }>;
    annuler(tenantId: string, userEmail: string, id: string, motif: string): Promise<{
        annule: boolean;
    }>;
    duMois(tenantId: string, salarieId: string, mois: string, moyenneBrute?: string): Promise<{
        mois: string;
        devise: string | null;
        salaireMensuel: number | null;
        absences: {
            id: string;
            nature: import("./absences").NatureAbsence;
            libelle: string;
            du: string;
            au: string;
            joursDuMois: number;
            regimes: import("./absences").RegimeRemuneration[];
        }[];
        conges: {
            id: string;
            du: string;
            au: string;
            joursDeConge: number | null;
            ouvrablesDuMois: number;
            moisDePaie: string;
            portePar: number | null;
        }[];
        proposition: import("./absences").PropositionDuMois;
    }>;
    declarerIndemniteCaisse(tenantId: string, userEmail: string, absenceId: string, dto: IndemniteCaisseDto): Promise<{
        id: string;
    }>;
    private declarerIndemniteCaisseLue;
    annulerIndemniteCaisse(tenantId: string, userEmail: string, id: string, motif: string): Promise<{
        annule: boolean;
    }>;
    private salarie;
}
