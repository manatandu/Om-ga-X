import { Response } from 'express';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { GroupeService } from './groupe.service';
import { CreerCelluleDto, ImporterCanevasDto } from './dto/groupe.dto';
export declare class GroupeController {
    private readonly groupeService;
    constructor(groupeService: GroupeService);
    cellules(user: AuthenticatedUser): Promise<{
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
    creerCellule(user: AuthenticatedUser, dto: CreerCelluleDto): Promise<{
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
    supervision(user: AuthenticatedUser, exerciceId: string): Promise<{
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
    balanceCellule(user: AuthenticatedUser, celluleId: string, exerciceId: string): Promise<{
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
    canevas(user: AuthenticatedUser, res: Response, celluleId: string): Promise<void>;
    importerCanevas(user: AuthenticatedUser, celluleId: string, dto: ImporterCanevasDto): Promise<{
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
    balanceAgregee(user: AuthenticatedUser, exerciceId: string): Promise<{
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
        eliminations: import("./groupe.service").EliminationReciproque[];
        totauxEliminations: {
            debit: number;
            credit: number;
        };
        ecartsReciprocite: import("./groupe.service").EcartReciprocite[];
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
    liasseGroupe(user: AuthenticatedUser, res: Response, exerciceId: string): Promise<void>;
    balanceAgregeeExcel(user: AuthenticatedUser, res: Response, exerciceId: string): Promise<void>;
}
