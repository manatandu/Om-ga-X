import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { FiscaliteService, type BilansSuccessifs } from './fiscalite.service';
import { AnnulerConstatImpotDto, PasserConstatImpotDto } from './dto/fiscalite.dto';
export declare class ConstatImpotService {
    private readonly prisma;
    private readonly fiscalite;
    private readonly ecritures;
    private readonly journal;
    constructor(prisma: PrismaService, fiscalite: FiscaliteService, ecritures: EcritureService);
    private constatEnPlace;
    static impotDeLExercice(calcul: {
        impotDu: number | null;
        minimumApplique: boolean;
        bilansSuccessifs?: {
            role: BilansSuccessifs['role'];
            calculable: boolean;
            motif: string | null;
            totalisation: {
                minimumApplique: boolean;
                cotisationDeLExercice: number | null;
                tropPayePremiereCotisation: number;
            } | null;
        } | null;
    }): {
        impotDu: number | null;
        minimumApplique: boolean;
        tropPaye: number;
        motifTotalisation: string | null;
        secondeCotisation: boolean;
    };
    private rejouer;
    etat(tenantId: string, exerciceId: string): Promise<{
        exerciceId: string;
        constat: {
            id: string;
            montantImpot: number;
            minimumApplique: boolean;
            montantImpute: number;
            attestationRegime: string | null;
            compteCharge: string;
            ecriture: {
                id: string;
                statut: import(".prisma/client").$Enums.StatutEcriture;
                date: Date;
                numeroPiece: number | null;
            } | null;
            createdAt: Date;
            impotRecalcule: number | null;
            ecartAvecCalcul: number | null;
            tropPayeLiquidation: number;
            tropPayeRecalcule: number | null;
        };
        proposition: null;
        motifsRefus: string[];
        annulees: number;
    } | {
        exerciceId: string;
        constat: null;
        proposition: {
            impot: number;
            minimumApplique: boolean;
            explication: string;
            date: Date;
            tropPaye: number;
            lignes: import("./ecriture-impot-resultat").LigneProposee[];
            imputation: {
                acomptesDeclares: number;
                solde4492: number;
                montant: number;
                motifRefus: string | null;
                lignes: import("./ecriture-impot-resultat").LigneProposee[];
            };
            conditionADeclarer: string | null;
            longueurMinAttestation: number;
        } | null;
        motifsRefus: string[];
        annulees: number;
    }>;
    private compte;
    private journalOd;
    passer(tenantId: string, userId: string, exerciceId: string, dto: PasserConstatImpotDto): Promise<{
        constat: {
            id: string;
            montantImpot: number;
            montantImpute: number;
            tropPayeLiquidation: number;
        };
        ecriture: {
            id: string;
            numeroPiece: number | null;
        };
        journal: {
            code: string;
            repli: string | null;
        };
    }>;
    annuler(tenantId: string, userId: string, exerciceId: string, dto: AnnulerConstatImpotDto): Promise<{
        annule: boolean;
        annulation: Record<string, unknown>;
    }>;
}
