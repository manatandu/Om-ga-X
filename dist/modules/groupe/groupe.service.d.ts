import { JeuEtatsFinanciersSycebnl, Referentiel, SystemeComptableSyscohada } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { AuthService } from '../auth/auth.service';
import { ClasseurExporte, ExportService } from '../exports/export.service';
import { CreerCelluleDto, ImporterCanevasDto } from './dto/groupe.dto';
export interface EliminationReciproque {
    dossier: string;
    contrepartie: string;
    numero: string;
    intitule: string;
    motif: string;
    debit: number;
    credit: number;
    horsMouvement?: PartsHorsMouvement;
}
export interface PartsHorsMouvement {
    reportDebit: number;
    reportCredit: number;
    clotureDebit: number;
    clotureCredit: number;
}
export interface EcartReciprocite {
    dossier: string;
    contrepartie: string;
    solde: number;
    soldeContrepartie: number;
    ecart: number;
}
export declare class GroupeService {
    private readonly prisma;
    private readonly ecritureService;
    private readonly authService;
    private readonly exportService;
    constructor(prisma: PrismaService, ecritureService: EcritureService, authService: AuthService, exportService: ExportService);
    private assurerDossierCombinaison;
    static partsHorsMouvement(l: Partial<PartsHorsMouvement>): PartsHorsMouvement;
    static colonnesDeCombinaison(lignes: Array<PartsHorsMouvement & {
        numero: string;
        totalDebit: number;
        totalCredit: number;
    }>): Record<'report' | 'mouvement' | 'cloture', Array<{
        numero: string;
        debit: number;
        credit: number;
    }>>;
    static caracteresCombinaison(mere: {
        referentiel: Referentiel;
        systemeComptableSyscohada: SystemeComptableSyscohada | null;
        jeuEtatsFinanciersSycebnl?: JeuEtatsFinanciersSycebnl | null;
    }): {
        referentiel: "SYSCOHADA";
        systemeComptableSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada;
        jeuEtatsFinanciersSycebnl?: undefined;
    } | {
        referentiel: "SYCEBNL";
        jeuEtatsFinanciersSycebnl: "ASSOCIATIONS_ORDRES_PROFESSIONNELS" | "PROJETS_DEVELOPPEMENT";
        systemeComptableSyscohada: null;
    };
    virements585DuGroupe(tenantId: string, dateArrete: Date): Promise<{
        solde: number;
    }>;
    private dansLeGroupe;
    cellules(tenantId: string): Promise<{
        plafondCellules: number | null;
        peutCreerCellule: boolean;
        cellules: {
            id: string;
            nom: string;
            jeuEtatsFinanciersSycebnl: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl;
            ville: string | null;
            nbEcritures: number;
        }[];
    }>;
    creerCellule(tenantId: string, dto: CreerCelluleDto): Promise<{
        tenant: {
            id: string;
            nom: string;
            referentiel: import(".prisma/client").$Enums.Referentiel;
            jeuEtatsFinanciersSycebnl: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl | null;
            systemeComptableSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
            numeroImpot: string | null;
        };
        adminEmail: string;
        motDePasseTemporaire: string;
    }>;
    private static jour;
    private exercicePourLaPeriode;
    balanceAgregee(tenantId: string, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        dossiers: {
            id: string;
            nom: string;
            estMere: boolean;
            exerciceId: string;
            totalDebit: number;
            totalCredit: number;
            solde58: number;
            soldeLiaison18: number | null;
            equilibre: boolean;
        }[];
        cellulesSansExercice: {
            id: string;
            nom: string;
        }[];
        cellulesPeriodeDiscordante: {
            id: string;
            nom: string;
            dateDebut: Date;
            dateFin: Date;
        }[];
        lignes: {
            solde: number;
            numero: string;
            intitule: string;
            totalDebit: number;
            totalCredit: number;
            reportDebit: number;
            reportCredit: number;
            clotureDebit: number;
            clotureCredit: number;
        }[];
        totaux: {
            debit: number;
            credit: number;
        };
        eliminations: EliminationReciproque[];
        totauxEliminations: {
            debit: number;
            credit: number;
        };
        ecartsReciprocite: EcartReciprocite[];
        rattachementsRefuses: {
            dossier: string;
            codeTiers: string;
            nomTiers: string;
            motif: string;
        }[];
        avertissements: string[];
        controles: {
            ecartLiaison: number;
            liaisonNeutralisee: boolean;
            tousEquilibres: boolean;
            periodesConcordantes: boolean;
            reciprocitesEquilibrees: boolean;
            ecartElimination: number;
            eliminationsSymetriques: boolean;
            rattachementsValides: boolean;
            ecartLiaison18: number | null;
            liaison18Neutralisee: boolean | null;
        };
        referentiel: "SYCEBNL" | "SYSCOHADA";
        detailParDossier: {
            dossier: string;
            numero: string;
            intitule: string;
            totalDebit: number;
            totalCredit: number;
        }[];
    }>;
    private balanceAgregeeDuGroupe;
    private eliminerOperationsReciproques;
    balanceAgregeeExcel(tenantId: string, exerciceId: string): Promise<ClasseurExporte>;
    private balanceAgregeeExcelDuGroupe;
    private celluleDuGroupe;
    private exerciceOuvert;
    supervision(tenantId: string, exerciceId: string): Promise<{
        exercice: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        };
        cellules: ({
            id: string;
            nom: string;
            jeuEtatsFinanciersSycebnl: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl;
            exerciceId: null;
            periodeDiscordante: null;
            derniereEcriture: null;
            nbEcritures: number;
            nbBrouillard: number;
            tresorerie: number;
            solde58: number;
            soldeLiaison18: number | null;
            equilibre: boolean;
            prete: boolean;
        } | {
            id: string;
            nom: string;
            jeuEtatsFinanciersSycebnl: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl;
            exerciceId: string;
            periodeDiscordante: {
                dateDebut: Date;
                dateFin: Date;
            } | null;
            derniereEcriture: Date | null;
            nbEcritures: number;
            nbBrouillard: number;
            tresorerie: number;
            solde58: number;
            soldeLiaison18: number | null;
            equilibre: boolean;
            prete: boolean;
        })[];
    }>;
    private supervisionDuGroupe;
    balanceCellule(tenantId: string, celluleId: string, exerciceId: string): Promise<{
        lignes: import("../comptabilite/balance-trois-colonnes").LigneDeBalance[];
        totaux: {
            debit: number;
            credit: number;
        };
        cellule: {
            nom: string;
            id: string;
        };
    }>;
    private balanceCelluleDuGroupe;
    canevas(tenantId: string, celluleId: string): Promise<ClasseurExporte>;
    private canevasDuGroupe;
    importerCanevas(tenantId: string, celluleId: string, createdBy: string, dto: ImporterCanevasDto): Promise<{
        importe: boolean;
        lignesImportees: number;
        anomalies: {
            ligne: number;
            message: string;
        }[];
        reference?: undefined;
        readonly statut?: undefined;
    } | {
        importe: boolean;
        lignesImportees: number;
        reference: string;
        statut: string;
        anomalies: never[];
    }>;
    private importerCanevasDuGroupe;
    liasseGroupe(tenantId: string, exerciceId: string, createdBy: string): Promise<ClasseurExporte>;
    private liasseGroupeDuGroupe;
}
