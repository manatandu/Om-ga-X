import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import type { Referentiel } from './passation-paie';
import { ComptabilisationPaieDto } from './dto/personnel.dto';
import { RepartitionsAnalytiquesPaieService } from './repartitions-analytiques-paie.service';
import { type VentilationDeLaPaie } from './ventilation-analytique-paie';
export type VentilationProposee = VentilationDeLaPaie & {
    readonly obligatoires: readonly string[];
};
export declare class ComptabilisationPaieService {
    private readonly prisma;
    private readonly ecritures;
    private readonly repartitions;
    constructor(prisma: PrismaService, ecritures: EcritureService, repartitions: RepartitionsAnalytiquesPaieService);
    private verifierMois;
    proposition(tenantId: string, mois: string): Promise<{
        pieces: {
            id: string;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            date: Date;
            numeroPiece: number | null;
        }[];
        ventilation: VentilationProposee;
        moisDePaie: string;
        referentiel: Referentiel;
        aPasser: readonly {
            id: string;
            numero: number;
            nomComplet: string;
        }[];
        dejaPasses: readonly {
            numero: number;
            nomComplet: string;
            ecritureId: string;
        }[];
        annulesApresPassation: readonly {
            numero: number;
            nomComplet: string;
            ecritureId: string;
            ecritureNegatifId: string | null;
        }[];
        negatifsAPasser: readonly {
            id: string;
            numero: number;
            nomComplet: string;
            ecritureId: string;
        }[];
        reprises: readonly import("./comptabilisation-paie").RepriseDuMois[];
        refus: readonly {
            numero: number;
            nomComplet: string;
            motifs: readonly string[];
        }[];
        lignes: readonly import("./comptabilisation-paie").LigneDuMois[];
        totalDebitFc: number;
        totalCreditFc: number;
        equilibree: boolean;
        solde422Fc: number;
        sommeDesNetsFc: number;
        reserves: readonly string[];
    }>;
    private ventilation;
    comptabiliser(tenantId: string, userId: string, mois: string, dto: ComptabilisationPaieDto): Promise<{
        ecriture: {
            journal: {
                type: import(".prisma/client").$Enums.TypeJournal;
                id: string;
                tenantId: string;
                createdAt: Date;
                estActif: boolean;
                intitule: string;
                code: string;
                compteTresorerieId: string | null;
                numerotation: import(".prisma/client").$Enums.NumerotationPiece;
                contrepartieChaqueLigne: boolean;
            };
            lignes: {
                id: string;
                modeReglementId: string | null;
                ecritureId: string;
                libelle: string | null;
                compteId: string;
                ligneReleveId: string | null;
                debit: import("@prisma/client/runtime/library").Decimal;
                credit: import("@prisma/client/runtime/library").Decimal;
                deviseId: string | null;
                dateEcheance: Date | null;
                lettre: string | null;
                lettrageId: string | null;
                aRelettrerDepuis: Date | null;
                tauxTvaId: string | null;
                rapprochementId: string | null;
                dateVersement: Date | null;
                montantDevise: import("@prisma/client/runtime/library").Decimal | null;
                coursApplique: import("@prisma/client/runtime/library").Decimal | null;
            }[];
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            journalId: string;
            createdBy: string;
            date: Date;
            exerciceId: string;
            reference: string | null;
            numeroPiece: number | null;
            dateValeur: Date | null;
            libelle: string;
            valideeAt: Date | null;
            valideeBy: string | null;
            secondRegardNom: string | null;
            secondRegardMotif: string | null;
            estGenereeParCloture: boolean;
            estSoldeDesComptesDeGestion: boolean;
            estANouveauProvisoire: boolean;
            motifImputationOuverture: import(".prisma/client").$Enums.MotifImputationOuverture | null;
            justificationImputationOuverture: string | null;
            corrigeEcritureId: string | null;
            motifCorrection: string | null;
        };
        bulletins: readonly {
            id: string;
            numero: number;
            nomComplet: string;
        }[];
        reprisEnNegatif: readonly {
            id: string;
            numero: number;
            nomComplet: string;
            ecritureId: string;
        }[];
        dateValeur: Date | null;
    }>;
    annulerComptabilisation(tenantId: string, ecritureId: string): Promise<{
        annule: boolean;
        bulletinsLiberes: number;
    }>;
}
