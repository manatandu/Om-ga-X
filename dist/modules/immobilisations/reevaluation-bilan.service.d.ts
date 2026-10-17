import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ReevaluerImmobilisationsDto, RepriseProvisionReevaluationDto } from './dto/immobilisation.dto';
import { type ResultatBien } from './reevaluation-bilan';
export declare const PLAFOND_PERIMETRE = 500;
export declare class ReevaluationBilanService {
    private readonly prisma;
    private readonly ecritures;
    constructor(prisma: PrismaService, ecritures: EcritureService);
    private exerciceDuDossier;
    perimetre(tenantId: string, exerciceId: string): Promise<{
        referentiel: import(".prisma/client").$Enums.Referentiel;
        dateReevaluation: Date;
        exerciceClos: boolean;
        biens: {
            compteIntitule: string;
            enCours: boolean;
            nature: import("./reevaluation-bilan").NatureReevaluable | null;
            valeurNette: number;
            dureeAmortissementAns: number;
            modeAmortissement: import(".prisma/client").$Enums.ModeAmortissement;
            bloquant: string | null;
            motifGarde: string | null;
            id: string;
            designation: string;
            numeroCompte: string;
            valeurOrigine: number;
            valeurResiduelle: number;
            cumulAmortissements: number;
            cumulDepreciation: number;
            amortissable: boolean;
            lineaire: boolean;
            anneesRestantes: number | null;
            planCommence: boolean;
            coefficientsAnterieurs: number[];
        }[];
        tronque: boolean;
        reevaluation: ({
            lignes: ({
                immobilisation: {
                    id: string;
                    designation: string;
                    numeroInventaire: string | null;
                };
            } & {
                id: string;
                tenantId: string;
                ecart: Prisma.Decimal;
                immobilisationId: string;
                categorie: string | null;
                reevaluationId: string;
                coefficient: Prisma.Decimal | null;
                valeurActuelle: Prisma.Decimal | null;
                coefficientRetenu: Prisma.Decimal;
                brutAvant: Prisma.Decimal;
                amortissementsAvant: Prisma.Decimal;
                valeurNetteAvant: Prisma.Decimal;
                brutApres: Prisma.Decimal;
                amortissementsApres: Prisma.Decimal;
                valeurReevaluee: Prisma.Decimal;
                compteEcart: string | null;
                droitDeReprise: boolean | null;
                motifNonReevalue: string | null;
                provisionReprise: Prisma.Decimal;
                ecartImpute: Prisma.Decimal;
                ecartTransfere: Prisma.Decimal;
                valeurResiduelleAvant: Prisma.Decimal | null;
            })[];
        } & {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TypeReevaluation;
            tenantId: string;
            exerciceId: string;
            createdBy: string;
            ecritureId: string;
            dateReevaluation: Date;
            decision: string;
            methodeLibre: import(".prisma/client").$Enums.MethodeReevaluationLibre | null;
            neutraliteFiscale: boolean;
            traitementFiscal: string;
            methodeEvaluation: string;
            categories: Prisma.JsonValue;
            totalEcart: Prisma.Decimal;
        }) | null;
    }>;
    reevaluer(tenantId: string, userId: string, dto: ReevaluerImmobilisationsDto): Promise<{
        id: string;
        totalEcart: number;
        ecritureId: string;
        biens: ResultatBien[];
    }>;
    propositionRepriseProvision(tenantId: string, exerciceId: string): Promise<{
        lignes: {
            ligneId: string;
            immobilisation: {
                id: string;
                designation: string;
            };
            coefficientRetenu: number;
            produitPosterieur: number;
            dotation: number | null;
            resteProvision: number;
            montant: number;
            motif: string | null;
        }[];
        sortis: {
            ligneId: string;
            immobilisation: {
                id: string;
                designation: string;
            };
            resteProvision: number;
            motif: string;
        }[];
        total: number;
        tronque: boolean;
        dejaPassee: {
            id: string;
            montant: number;
            ecritureId: string;
        } | null;
    }>;
    passerRepriseProvision(tenantId: string, userId: string, dto: RepriseProvisionReevaluationDto): Promise<{
        id: string;
        montant: number;
        ecritureId: string;
    }>;
    private noteDuJeu;
    noteReevaluations(tenantId: string, exerciceId: string): Promise<{
        referentiel: import(".prisma/client").$Enums.Referentiel;
        codeNote: null;
        motifSansObjet: string;
        reevaluations: never[];
        postes: never[];
        sortis: never[];
        total: null;
        tronque: boolean;
    } | {
        referentiel: import(".prisma/client").$Enums.Referentiel;
        codeNote: string;
        motifSansObjet: null;
        reevaluations: {
            id: string;
            type: import(".prisma/client").$Enums.TypeReevaluation;
            methodeLibre: import(".prisma/client").$Enums.MethodeReevaluationLibre | null;
            neutraliteFiscale: boolean;
            dateReevaluation: string;
            decision: string;
            traitementFiscal: string;
            methodeEvaluation: string;
            totalEcart: number;
        }[];
        postes: {
            poste: string;
            biens: number;
            coutHistorique: number;
            valeurReevaluee: number;
            ecart106: number;
            provision154: number;
            amortissementsSupplementaires: number;
            repriseExercice: number;
        }[];
        sortis: {
            immobilisationId: string;
            designation: string;
            dateSortie: string;
            nature: string | null;
            transfereReserve: number;
            reprise861: number;
        }[];
        total: {
            biens: number;
            coutHistorique: number;
            valeurReevaluee: number;
            ecart106: number;
            provision154: number;
            amortissementsSupplementaires: number;
            repriseExercice: number;
        } | null;
        tronque: boolean;
    }>;
    declarationSpeciale(tenantId: string, exerciceId: string): Promise<{
        dossier: string;
        exercice: {
            dateDebut: string;
            dateFin: string;
        };
        reevaluation: null;
        categories: never[];
        total: null;
        mentions: {
            echeance: string;
            modele: string;
            depot: string;
        };
    } | {
        dossier: string;
        exercice: {
            dateDebut: string;
            dateFin: string;
        };
        reevaluation: {
            id: string;
            type: import(".prisma/client").$Enums.TypeReevaluation;
            methodeLibre: import(".prisma/client").$Enums.MethodeReevaluationLibre | null;
            neutraliteFiscale: boolean;
            dateReevaluation: string;
            decision: string;
            traitementFiscal: string;
            methodeEvaluation: string;
            totalEcart: number;
        };
        categories: {
            total: {
                brutAvant: number;
                amortissementsAvant: number;
                valeurNetteAvant: number;
                valeurReevaluee: number;
                brutApres: number;
                amortissementsApres: number;
                ecart: number;
            };
            cle: string;
            libelle: string;
            coefficient: number | null;
            source: string | null;
            lignes: {
                immobilisationId: string;
                designation: string;
                numeroInventaire: string | null;
                compte: string;
                dateAcquisition: string;
                brutAvant: number;
                amortissementsAvant: number;
                valeurNetteAvant: number;
                coefficient: number | null;
                coefficientRetenu: number;
                valeurActuelle: number | null;
                valeurReevaluee: number;
                brutApres: number;
                amortissementsApres: number;
                ecart: number;
                compteEcart: string | null;
                motifNonReevalue: string | null;
            }[];
        }[];
        total: {
            brutAvant: number;
            amortissementsAvant: number;
            valeurNetteAvant: number;
            valeurReevaluee: number;
            brutApres: number;
            amortissementsApres: number;
            ecart: number;
        };
        mentions: {
            echeance: string;
            modele: string;
            depot: string;
        };
    }>;
    comptesReserve(tenantId: string, retenus?: boolean): Promise<{
        comptes: {
            id: string;
            numero: string;
            intitule: string;
        }[];
        nonRetenus: number;
        impose: boolean;
        motifVide: string | null;
    }>;
    ecartALaSortie(tenantId: string, immobilisationId: string): Promise<{
        referentiel: import(".prisma/client").$Enums.Referentiel;
        sorts: import("./reevaluation-suites").SortDeLEcart[];
    }>;
}
