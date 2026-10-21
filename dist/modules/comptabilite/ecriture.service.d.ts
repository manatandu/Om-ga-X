import { PrismaService } from '../../common/prisma.service';
import { Prisma } from '@prisma/client';
import { lignesEnNegatif } from './lignes-en-negatif';
import { CriteresRecherche } from './recherche-ecritures';
import { CreerEcritureDto, ImputationOuvertureDto, LigneEcritureDto } from './dto/creer-ecriture.dto';
import { CorrigerEcritureDto } from './dto/corriger-ecriture.dto';
import { ReimputerDto } from './dto/reimputer.dto';
import { ModifierEcritureDto, ValiderJusquaDto } from './dto/brouillard.dto';
import { JournalService } from '../journaux/journal.service';
import { ExerciceService } from '../exercice/exercice.service';
import { PositionDOuverturePassee } from '../exercice/ouverture-passee';
import { AnalytiqueService } from '../analytique/analytique.service';
import { type PeriodeExtrait, type ReportALaVeille } from './periode-extrait';
import { VirementsParCompte } from '../immobilisations/virements-mise-en-service';
import { type FamilleTiers } from './familles-tiers';
export interface TrancheAgee {
    cle: string;
    libellePeriode: string;
    libelleAge: string;
}
export interface LigneAgee {
    cle: string;
    libelle: string;
    codeTiers: string;
    numero: string;
    montants: number[];
    solde: number;
}
export interface EcheanceDetail {
    ligneId: string;
    date: Date;
    tranche: string;
    compteNumero: string;
    compteIntitule: string;
    tiers: string | null;
    libelle: string;
    reference: string | null;
    montant: number;
    sens: 'ENCAISSEMENT' | 'DECAISSEMENT';
}
export interface TrancheEcheancier {
    cle: string;
    libelle: string;
    deJours: number | null;
    aJours: number | null;
    encaissements: number;
    decaissements: number;
    net: number;
    tresorerieProjetee: number;
}
export declare function perimetreJournal(tenantId: string, filtres: {
    exerciceId?: string;
    journalId?: string;
    dateDebut?: string;
    dateFin?: string;
    inclureBrouillard?: boolean;
} & CriteresRecherche): Prisma.EcritureWhereInput;
export declare const PLAFOND_ECRITURES_PAR_FENETRE = 2000;
export declare const MOTIF_COMPTE_INTROUVABLE_GRAND_LIVRE = "Compte introuvable dans ce dossier : aucun grand livre ne peut \u00EAtre \u00E9tabli.";
export declare const PLAFOND_LIGNES_GRAND_LIVRE = 20000;
export type PerimetreBalanceAgee = 'TOUS' | 'CLIENTS_41' | 'FOURNISSEURS' | 'PERSONNEL_42' | 'SOCIAL_43' | 'ETAT_44' | 'DIVERS_47';
export type SensNormalAgee = 'DEBITEUR' | 'CREDITEUR' | 'LES_DEUX' | 'SELON_LE_COMPTE';
export declare function ligneVentilee(sens: SensNormalAgee, numeros: readonly string[], solde: number): boolean;
export declare const PERIMETRES_BALANCE_AGEE: Record<PerimetreBalanceAgee, {
    racines: string[];
    exclusions: string[];
    libelle: string;
    lecture: string;
    sensNormal: SensNormalAgee;
}>;
export type DetenteurEcriture = string;
export declare const DETENTEUR_LIQUIDATION_TVA: DetenteurEcriture;
export declare const DETENTEUR_PAIE_DU_MOIS: DetenteurEcriture;
export declare const DETENTEUR_RECLASSEMENT_CREANCE: DetenteurEcriture;
export declare const DETENTEUR_REVUE_CREANCE: DetenteurEcriture;
export declare const DETENTEUR_MOUVEMENT_CREANCE: DetenteurEcriture;
export declare const DETENTEUR_RECUPERATION_TVA_CREANCE: DetenteurEcriture;
export declare const DETENTEUR_DEVISE_A_NOUVEAU: DetenteurEcriture;
export declare const DETENTEUR_CORRECTION_CREANCE: DetenteurEcriture;
export declare const DETENTEUR_IMPOT_RESULTAT: DetenteurEcriture;
export declare const DETENTEUR_ACQUISITION_IMMOBILISATION: DetenteurEcriture;
export declare const DETENTEUR_DONATION: DetenteurEcriture;
export declare const DETENTEUR_EXECUTION_ENGAGEMENT: DetenteurEcriture;
export interface SuppressionPourLeModule {
    detenteur: DetenteurEcriture;
    liberer: (tx: Prisma.TransactionClient) => Promise<unknown>;
    lettrageTolere?: string | readonly string[] | null;
}
export interface LigneEntree {
    compteId: string;
    debit?: number;
    credit?: number;
    tauxTvaId?: string | null;
    ventilations?: {
        sectionId: string;
        debit?: number;
        credit?: number;
    }[];
    deviseId?: string | null;
    montantDevise?: number | null;
    coursApplique?: number | null;
    modeReglementId?: string | null;
}
export interface PieceEntree {
    exerciceId: string;
    journalId: string;
    date: string | Date;
    lignes?: LigneEntree[];
    reporterAuPremierJourOuvert?: boolean;
    exigerVentilationObligatoire?: boolean;
    journalDeSituationAdmis?: boolean;
    modesDejaPortes?: ReadonlySet<string>;
}
export declare function motifDateHorsExercice(date: Date, exercice: {
    dateDebut: Date;
    dateFin: Date;
}): string | null;
export declare function donneesLigneSaisie(l: LigneEcritureDto, sectionsParId: Map<string, {
    planId: string;
}>): {
    ventilations?: {
        create: {
            sectionId: string;
            planId: string;
            debit: number;
            credit: number;
        }[];
    } | undefined;
    modeReglementId?: string | undefined;
    compteId: string;
    libelle: string | undefined;
    debit: number;
    credit: number;
    tauxTvaId: string | undefined;
    dateEcheance: Date | undefined;
    dateVersement: Date | undefined;
    deviseId: string | undefined;
    montantDevise: number | undefined;
    coursApplique: number | undefined;
};
export type MemoireControles = Map<string, Promise<unknown>>;
export declare class EcritureService {
    private readonly prisma;
    private readonly journalService;
    private readonly exerciceService;
    private readonly analytiqueService;
    constructor(prisma: PrismaService, journalService: JournalService, exerciceService: ExerciceService, analytiqueService: AnalytiqueService);
    imputerAuxCapitauxPropresDOuverture(tenantId: string, createdBy: string, dto: ImputationOuvertureDto): Promise<{
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        journalId: string;
        createdBy: string;
        date: Date;
        reference: string | null;
        numeroPiece: number | null;
        dateValeur: Date | null;
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
    }>;
    verifierComptesEnSommeil(tenantId: string, lignes: {
        compteId: string;
    }[] | undefined, confirme: boolean | undefined): Promise<void>;
    verifierComptesPersonnalises(tenantId: string, lignes: {
        compteId: string;
    }[] | undefined, geste?: string): Promise<void>;
    verifierComptesCollectifs(tenantId: string, lignes: {
        compteId: string;
    }[] | undefined, ecritureModifieeId?: string, compteQuiSEndort?: string): Promise<void>;
    controlesDEntree(tenantId: string, piece: PieceEntree, db?: Prisma.TransactionClient | PrismaService, memoire?: MemoireControles): Promise<{
        exercice: {
            id: string;
            statut: import(".prisma/client").$Enums.StatutExercice;
            dateDebut: Date;
            tenantId: string;
            dateFin: Date;
            dateArreteComptes: Date | null;
            motifOuvertureSuivanteConservee: string | null;
            ecartsOuvertureSuivanteConservee: Prisma.JsonValue | null;
            defaitsParLaCloture: Prisma.JsonValue | null;
            nombreEtablissementsPays: number | null;
            nombreEtablissementsHorsPays: number | null;
            premiereAnneeExercicePays: number | null;
            controleEntreprise: import(".prisma/client").$Enums.ControleEntreprise | null;
            dateAssembleeGenerale: Date | null;
            dateDepotEtatsPortefeuille: Date | null;
            dateTransmissionPvPortefeuille: Date | null;
            dateDeclarationDividendeEtat: Date | null;
            dateNotePerceptionDividende: Date | null;
            datePaiementDividendeEtat: Date | null;
        };
        journal: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TypeJournal;
            estActif: boolean;
            tenantId: string;
            intitule: string;
            code: string;
            compteTresorerieId: string | null;
            numerotation: import(".prisma/client").$Enums.NumerotationPiece;
            contrepartieChaqueLigne: boolean;
        };
        date: Date;
        dateValeur: Date | null;
        sectionsParId: Map<string, {
            planId: string;
            code: string;
            planCode: string;
        }>;
    }>;
    creer(tenantId: string, createdBy: string, dto: CreerEcritureDto, options?: {
        saisie?: boolean;
    }): Promise<{
        journal: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TypeJournal;
            estActif: boolean;
            tenantId: string;
            intitule: string;
            code: string;
            compteTresorerieId: string | null;
            numerotation: import(".prisma/client").$Enums.NumerotationPiece;
            contrepartieChaqueLigne: boolean;
        };
        lignes: {
            id: string;
            libelle: string | null;
            modeReglementId: string | null;
            ecritureId: string;
            compteId: string;
            ligneReleveId: string | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            deviseId: string | null;
            dateEcheance: Date | null;
            lettre: string | null;
            lettrageId: string | null;
            aRelettrerDepuis: Date | null;
            tauxTvaId: string | null;
            rapprochementId: string | null;
            dateVersement: Date | null;
            montantDevise: Prisma.Decimal | null;
            coursApplique: Prisma.Decimal | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        journalId: string;
        createdBy: string;
        date: Date;
        reference: string | null;
        numeroPiece: number | null;
        dateValeur: Date | null;
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
    }>;
    creerAvec<T>(tenantId: string, createdBy: string, dto: CreerEcritureDto, suite: (tx: Prisma.TransactionClient, ecriture: {
        id: string;
    }) => Promise<T>, options?: {
        saisie?: boolean;
    }): Promise<{
        ecriture: {
            journal: {
                id: string;
                createdAt: Date;
                type: import(".prisma/client").$Enums.TypeJournal;
                estActif: boolean;
                tenantId: string;
                intitule: string;
                code: string;
                compteTresorerieId: string | null;
                numerotation: import(".prisma/client").$Enums.NumerotationPiece;
                contrepartieChaqueLigne: boolean;
            };
            lignes: {
                id: string;
                libelle: string | null;
                modeReglementId: string | null;
                ecritureId: string;
                compteId: string;
                ligneReleveId: string | null;
                debit: Prisma.Decimal;
                credit: Prisma.Decimal;
                deviseId: string | null;
                dateEcheance: Date | null;
                lettre: string | null;
                lettrageId: string | null;
                aRelettrerDepuis: Date | null;
                tauxTvaId: string | null;
                rapprochementId: string | null;
                dateVersement: Date | null;
                montantDevise: Prisma.Decimal | null;
                coursApplique: Prisma.Decimal | null;
            }[];
        } & {
            id: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            tenantId: string;
            exerciceId: string;
            libelle: string;
            journalId: string;
            createdBy: string;
            date: Date;
            reference: string | null;
            numeroPiece: number | null;
            dateValeur: Date | null;
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
        suite: Awaited<T>;
    }>;
    creerPlusieursAvec<T>(tenantId: string, createdBy: string, dtos: readonly CreerEcritureDto[], suite: (tx: Prisma.TransactionClient, ecritures: Array<{
        id: string;
        lignes: Array<{
            id: string;
            compteId: string;
        }>;
    }>) => Promise<T>, options?: {
        saisie?: boolean;
    }): Promise<{
        ecritures: ({
            journal: {
                id: string;
                createdAt: Date;
                type: import(".prisma/client").$Enums.TypeJournal;
                estActif: boolean;
                tenantId: string;
                intitule: string;
                code: string;
                compteTresorerieId: string | null;
                numerotation: import(".prisma/client").$Enums.NumerotationPiece;
                contrepartieChaqueLigne: boolean;
            };
            lignes: {
                id: string;
                libelle: string | null;
                modeReglementId: string | null;
                ecritureId: string;
                compteId: string;
                ligneReleveId: string | null;
                debit: Prisma.Decimal;
                credit: Prisma.Decimal;
                deviseId: string | null;
                dateEcheance: Date | null;
                lettre: string | null;
                lettrageId: string | null;
                aRelettrerDepuis: Date | null;
                tauxTvaId: string | null;
                rapprochementId: string | null;
                dateVersement: Date | null;
                montantDevise: Prisma.Decimal | null;
                coursApplique: Prisma.Decimal | null;
            }[];
        } & {
            id: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            tenantId: string;
            exerciceId: string;
            libelle: string;
            journalId: string;
            createdBy: string;
            date: Date;
            reference: string | null;
            numeroPiece: number | null;
            dateValeur: Date | null;
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
        })[];
        suite: Awaited<T>;
    }>;
    private verifierSectionsVentilees;
    private trouverEnBrouillard;
    modifier(tenantId: string, ecritureId: string, dto: ModifierEcritureDto): Promise<{
        journal: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TypeJournal;
            estActif: boolean;
            tenantId: string;
            intitule: string;
            code: string;
            compteTresorerieId: string | null;
            numerotation: import(".prisma/client").$Enums.NumerotationPiece;
            contrepartieChaqueLigne: boolean;
        };
        lignes: ({
            compte: {
                id: string;
                estActif: boolean;
                tenantId: string;
                numero: string;
                intitule: string;
                classe: import(".prisma/client").$Enums.ClasseCompte;
                typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
                modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
                estRetenu: boolean;
                lettrable: boolean;
                collectifId: string | null;
                tauxTvaDefautId: string | null;
                codeRetraitementFiscal: string | null;
                comportementGestion: import(".prisma/client").$Enums.ComportementGestion | null;
                partVariableGestionPct: Prisma.Decimal | null;
                bailleurId: string | null;
                porteFondsContrepartieEtat: boolean;
            };
        } & {
            id: string;
            libelle: string | null;
            modeReglementId: string | null;
            ecritureId: string;
            compteId: string;
            ligneReleveId: string | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            deviseId: string | null;
            dateEcheance: Date | null;
            lettre: string | null;
            lettrageId: string | null;
            aRelettrerDepuis: Date | null;
            tauxTvaId: string | null;
            rapprochementId: string | null;
            dateVersement: Date | null;
            montantDevise: Prisma.Decimal | null;
            coursApplique: Prisma.Decimal | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        journalId: string;
        createdBy: string;
        date: Date;
        reference: string | null;
        numeroPiece: number | null;
        dateValeur: Date | null;
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
    }>;
    transfererDansUnJournalOrdinaire(tenantId: string, ecritureId: string, dto: {
        journalId: string;
        reporterAuPremierJourOuvert?: boolean;
    }): Promise<{
        journal: {
            code: string;
        };
        id: string;
        date: Date;
        numeroPiece: number | null;
        dateValeur: Date | null;
    }>;
    modifierPieceDuModule(tx: Prisma.TransactionClient, tenantId: string, ecritureId: string, dto: {
        date: string;
        libelle?: string;
        lignes: LigneEcritureDto[];
    }): Promise<boolean>;
    supprimer(tenantId: string, ecritureId: string, pourLeModule?: SuppressionPourLeModule): Promise<{
        supprime: boolean;
        piecesDetachees: number;
    }>;
    retirerCompensation(tenantId: string, ecritureId: string, liberer?: (tx: Prisma.TransactionClient) => Promise<unknown>): Promise<void>;
    private detenteursDe;
    detenteursDeLEcriture(tenantId: string, ecritureId: string): Promise<DetenteurEcriture[]>;
    detenteursDesEcritures(tenantId: string, ecritureIds: string[]): Promise<DetenteurEcriture[]>;
    private verifierAucunModuleNeLaTient;
    valider(tenantId: string, valideeBy: string, ecritureIds: string[], derogation?: {
        secondRegardNom?: string;
        secondRegardMotif?: string;
    }): Promise<{
        validees: number;
        dejaValidees: number;
        refuseesSecondRegard: number;
        sousDerogation: number;
        motifRefus: string | null;
        ecarteesJournalDeSituation: number;
    }>;
    private visaSecondRegard;
    private motifDoubleRegard;
    validerJusqua(tenantId: string, valideeBy: string, dto: ValiderJusquaDto): Promise<{
        ecarteesJournalDeSituation: number;
        motifEcarteesJournalDeSituation: string | null;
        validees: number;
        dejaValidees: number;
        refuseesSecondRegard: number;
        sousDerogation: number;
        motifRefus: string | null;
    }>;
    brouillard(tenantId: string, params: {
        exerciceId: string;
        journalId?: string;
        dateDebut?: string;
        dateFin?: string;
    }): Promise<{
        lignes: {
            id: string;
            date: string;
            createdAt: string;
            journal: string;
            journalIntitule: string;
            numeroPiece: number | null;
            journalDeSituation: boolean;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            equilibree: boolean;
            ancienneteJours: number;
            invalidable: boolean;
            retardCentralisation: boolean;
            lignes: {
                compteId: string;
                compteNumero: string;
                compteIntitule: string;
                libelle: string | null;
                debit: number;
                credit: number;
                tauxTvaId: string | null;
                dateEcheance: string | null;
                dateVersement: string | null;
                modeReglementId: string | null;
                deviseId: string | null;
                montantDevise: number | null;
                coursApplique: number | null;
                ventilations: {
                    sectionId: string;
                    debit: number;
                    credit: number;
                }[];
            }[];
        }[];
        totaux: {
            nombre: number;
            debit: number;
            credit: number;
            desequilibrees: number;
            enRetard: number;
        };
        tronque: boolean;
        plafond: number;
        delaiCentralisationJours: number;
    }>;
    reimputer(tenantId: string, createdBy: string, dto: ReimputerDto, options?: {
        simuler?: boolean;
    }): Promise<{
        auBrouillard: number;
        validees: number;
        ecrituresPassees: {
            numeroPiece: number | null;
            journal: string;
        }[];
    }>;
    fusionnerComptes(tenantId: string, createdBy: string, sourceId: string, cibleId: string, motif: string): Promise<{
        fusionne: boolean;
        source: string;
        cible: string;
        auBrouillard: number;
        validees: number;
        ecrituresPassees: {
            numeroPiece: number | null;
            journal: string;
        }[];
        encoreUtilisePar: string[];
    }>;
    corrigerParInscriptionEnNegatif(tenantId: string, createdBy: string, ecritureId: string, dto: CorrigerEcritureDto): Promise<{
        journal: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TypeJournal;
            estActif: boolean;
            tenantId: string;
            intitule: string;
            code: string;
            compteTresorerieId: string | null;
            numerotation: import(".prisma/client").$Enums.NumerotationPiece;
            contrepartieChaqueLigne: boolean;
        };
        lignes: {
            id: string;
            libelle: string | null;
            modeReglementId: string | null;
            ecritureId: string;
            compteId: string;
            ligneReleveId: string | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            deviseId: string | null;
            dateEcheance: Date | null;
            lettre: string | null;
            lettrageId: string | null;
            aRelettrerDepuis: Date | null;
            tauxTvaId: string | null;
            rapprochementId: string | null;
            dateVersement: Date | null;
            montantDevise: Prisma.Decimal | null;
            coursApplique: Prisma.Decimal | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        statut: import(".prisma/client").$Enums.StatutEcriture;
        tenantId: string;
        exerciceId: string;
        libelle: string;
        journalId: string;
        createdBy: string;
        date: Date;
        reference: string | null;
        numeroPiece: number | null;
        dateValeur: Date | null;
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
    }>;
    inscrireEnNegatifPourAnnulation(tenantId: string, userId: string, ecritureId: string, motif: string, tx?: Prisma.TransactionClient, options?: {
        groupeTolere?: string | readonly string[] | null;
    }): Promise<{
        id: string;
        date: Date;
        numeroPiece: number | null;
    }>;
    private verifierCorrigeable;
    lister(tenantId: string, filtres: {
        exerciceId?: string;
        journalId?: string;
        dateDebut?: string;
        dateFin?: string;
        recherche?: string;
        compte?: string;
        montantMin?: number;
        montantMax?: number;
        numeroPiece?: number;
        reference?: string;
        inclureBrouillard?: boolean;
        limite?: number;
        plusRecentesDAbord?: boolean;
    }): Promise<{
        ecritures: ({
            journal: {
                id: string;
                createdAt: Date;
                type: import(".prisma/client").$Enums.TypeJournal;
                estActif: boolean;
                tenantId: string;
                intitule: string;
                code: string;
                compteTresorerieId: string | null;
                numerotation: import(".prisma/client").$Enums.NumerotationPiece;
                contrepartieChaqueLigne: boolean;
            };
            lignes: ({
                compte: {
                    id: string;
                    estActif: boolean;
                    tenantId: string;
                    numero: string;
                    intitule: string;
                    classe: import(".prisma/client").$Enums.ClasseCompte;
                    typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
                    modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
                    estRetenu: boolean;
                    lettrable: boolean;
                    collectifId: string | null;
                    tauxTvaDefautId: string | null;
                    codeRetraitementFiscal: string | null;
                    comportementGestion: import(".prisma/client").$Enums.ComportementGestion | null;
                    partVariableGestionPct: Prisma.Decimal | null;
                    bailleurId: string | null;
                    porteFondsContrepartieEtat: boolean;
                };
            } & {
                id: string;
                libelle: string | null;
                modeReglementId: string | null;
                ecritureId: string;
                compteId: string;
                ligneReleveId: string | null;
                debit: Prisma.Decimal;
                credit: Prisma.Decimal;
                deviseId: string | null;
                dateEcheance: Date | null;
                lettre: string | null;
                lettrageId: string | null;
                aRelettrerDepuis: Date | null;
                tauxTvaId: string | null;
                rapprochementId: string | null;
                dateVersement: Date | null;
                montantDevise: Prisma.Decimal | null;
                coursApplique: Prisma.Decimal | null;
            })[];
            corrigeEcriture: {
                id: string;
                libelle: string;
                date: Date;
                numeroPiece: number | null;
            } | null;
            correction: {
                id: string;
                date: Date;
                numeroPiece: number | null;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            statut: import(".prisma/client").$Enums.StatutEcriture;
            tenantId: string;
            exerciceId: string;
            libelle: string;
            journalId: string;
            createdBy: string;
            date: Date;
            reference: string | null;
            numeroPiece: number | null;
            dateValeur: Date | null;
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
        })[];
        totaux: {
            debit: number;
            credit: number;
        };
        total: number;
        tronque: boolean;
        plafond: number;
    }>;
    private static readonly TRI_GRAND_LIVRE;
    private chargerContreparties;
    private static versLigneGrandLivre;
    echeancier(tenantId: string, params: {
        exerciceId: string;
        dateReference?: string;
    }): Promise<{
        dateReference: Date;
        tresorerieActuelle: number;
        tranches: TrancheEcheancier[];
        details: EcheanceDetail[];
        tronque: boolean;
        nombreDetails: number;
        alerte: {
            tranche: string;
            libelle: string;
            tresorerieProjetee: number;
            message: string;
        } | null;
        lignesSansEcheance: number;
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
    }>;
    balanceAgee(tenantId: string, params: {
        exerciceId: string;
        dateReference?: string;
        type?: PerimetreBalanceAgee;
    }): Promise<{
        dateReference: string;
        debutExercice: string;
        type: PerimetreBalanceAgee;
        lecture: string;
        libellePerimetre: string;
        sensNormal: SensNormalAgee;
        tranches: TrancheAgee[];
        debiteurs: {
            montants: number[];
            solde: number;
            cle: string;
            libelle: string;
            codeTiers: string;
            numero: string;
        }[];
        crediteurs: {
            montants: number[];
            solde: number;
            cle: string;
            libelle: string;
            codeTiers: string;
            numero: string;
        }[];
        sensInverse: {
            montants: number[];
            solde: number;
            cle: string;
            libelle: string;
            codeTiers: string;
            numero: string;
        }[];
        soldesNuls: {
            montants: number[];
            solde: number;
            cle: string;
            libelle: string;
            codeTiers: string;
            numero: string;
        }[];
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        totaux: {
            parTranche: number[];
            parTrancheCrediteurs: number[];
            debiteurs: number;
            crediteurs: number;
            sensInverse: number;
            net: number;
        };
    }>;
    justificatifSolde(tenantId: string, params: {
        compteId: string;
        exerciceId: string;
        dateArret?: string;
        masquerLettrees?: boolean;
    }): Promise<{
        compte: {
            id: string;
            numero: string;
            intitule: string;
        };
        rupturesOuverture: {
            exerciceClos: {
                dateDebut: Date;
                dateFin: Date;
            };
            motif: string;
            positions: {
                numero: string | null;
                devise: string | null;
                cloture: number;
                ouverture: number;
            }[];
        }[];
        dateArret: string;
        masquerLettrees: boolean;
        lignes: {
            ligneId: string;
            date: Date;
            journal: string;
            numeroPiece: number | null;
            reference: string;
            libelle: string;
            debit: number;
            credit: number;
            deviseTransaction: string;
            montantDevise: number | null;
            lettre: string;
            estANouveau: boolean;
        }[];
        totaux: {
            debit: number;
            credit: number;
            solde: number;
        };
        recoupement: {
            applicable: boolean;
            soldeBalance: number;
            ecart: number;
            concordant: boolean;
        };
    }>;
    evolutionSoldes(tenantId: string, params?: {
        nbExercices?: number;
    }): Promise<{
        exercices: {
            id: string;
            libelle: string;
            dateFin: string;
            statut: import(".prisma/client").$Enums.StatutExercice;
        }[];
        lignes: {
            compteId: string;
            numero: string;
            intitule: string;
            classe: import(".prisma/client").$Enums.ClasseCompte;
            soldes: (number | null)[];
        }[];
    }>;
    grandLivre(tenantId: string, compteId: string, exerciceId?: string, plafond?: number, periode?: PeriodeExtrait): Promise<{
        lignes: {
            id: string;
            date: Date;
            journalCode: string;
            numeroPiece: number | null;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            lettre: string | null;
            soldeProgressif: number;
            contrepartie: string[];
        }[];
        soldeFinal: number;
        report?: ReportALaVeille | null | undefined;
        compte: {
            id: string;
            estActif: boolean;
            tenantId: string;
            numero: string;
            intitule: string;
            classe: import(".prisma/client").$Enums.ClasseCompte;
            typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
            modeReportANouveau: import(".prisma/client").$Enums.ModeReportANouveau;
            estRetenu: boolean;
            lettrable: boolean;
            collectifId: string | null;
            tauxTvaDefautId: string | null;
            codeRetraitementFiscal: string | null;
            comportementGestion: import(".prisma/client").$Enums.ComportementGestion | null;
            partVariableGestionPct: Prisma.Decimal | null;
            bailleurId: string | null;
            porteFondsContrepartieEtat: boolean;
        };
    }>;
    periodeDemandee(tenantId: string, exerciceId: string, demande: {
        du?: string;
        au?: string;
    }): Promise<PeriodeExtrait | null>;
    reportsALaVeille(perimetreExercice: Prisma.EcritureWhereInput, periode: PeriodeExtrait, compteIds: string[] | null): Promise<Map<string, ReportALaVeille>>;
    grandLivreComplet(tenantId: string, exerciceId?: string, periode?: PeriodeExtrait): Promise<{
        lignes: {
            id: string;
            date: Date;
            journalCode: string;
            numeroPiece: number | null;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            lettre: string | null;
            soldeProgressif: number;
            contrepartie: string[];
        }[];
        soldeFinal: number;
        totalDebit: number;
        totalCredit: number;
        report?: ReportALaVeille | null | undefined;
        compte: {
            id: string;
            numero: string;
            intitule: string;
        };
    }[]>;
    balance(tenantId: string, exerciceId: string, inclureBrouillard?: boolean, arreteAu?: Date, options?: {
        avantLaCloture?: boolean;
        periode?: PeriodeExtrait;
    }): Promise<{
        lignes: import("./balance-trois-colonnes").LigneDeBalance[];
        totaux: {
            debit: number;
            credit: number;
        };
    }>;
    virementsDeMiseEnService(tenantId: string, exerciceId: string | null): Promise<VirementsParCompte>;
    nombreAuBrouillard(tenantId: string, exerciceId: string): Promise<number>;
    ouverturePasseeAuPremierJour(tenantId: string, exerciceId: string): Promise<{
        nombre: number;
        pieces: string[];
    } | null>;
    positionDOuvertureAuPremierJour(tenantId: string, exerciceId: string): Promise<PositionDOuverturePassee>;
    mouvementsDeReevaluation(tenantId: string, exerciceId: string | null, arreteAu?: Date): Promise<VirementsParCompte>;
    mouvementsDeCoutsEmpruntIncorpores(tenantId: string, exerciceId: string | null): Promise<VirementsParCompte>;
    private mouvementsLiesParCompte;
    balanceRegroupeeParCollectif(tenantId: string, exerciceId: string, periode?: PeriodeExtrait): Promise<{
        lignes: (import("./balance-trois-colonnes").LigneDeBalance & {
            regroupe: number;
        })[];
        totaux: {
            debit: number;
            credit: number;
        };
    }>;
    private rupturesDOuverture;
    balanceCumulee(tenantId: string, exerciceId: string, inclureBrouillard?: boolean): Promise<{
        lignes: {
            compteId: string;
            numero: string;
            intitule: string;
            classe: import(".prisma/client").$Enums.ClasseCompte;
            typeCompte: import(".prisma/client").$Enums.TypeCompteDetailTotal;
            totalDebit: number;
            totalCredit: number;
            reportDebit: number;
            reportCredit: number;
            mouvementDebit: number;
            mouvementCredit: number;
            solde: number;
        }[];
        totaux: {
            debit: number;
            credit: number;
        };
        rupturesOuverture: {
            exerciceClos: {
                dateDebut: Date;
                dateFin: Date;
            };
            motif: string;
            positions: {
                numero: string | null;
                devise: string | null;
                cloture: number;
                ouverture: number;
            }[];
        }[];
    }>;
    balanceAuxiliaire(tenantId: string, params: {
        exerciceId: string;
        type?: FamilleTiers | 'TOUS';
        inclureBrouillard?: boolean;
    }): Promise<{
        type: "FOURNISSEURS" | "AUTRES" | "TOUS" | "CLIENTS" | "SALARIES";
        comptes: {
            compteId: string;
            numero: string;
            intitule: string;
            codeTiers: string;
            nomTiers: string;
            sansTiers: boolean;
            reportDebit: number;
            reportCredit: number;
            mouvementDebit: number;
            mouvementCredit: number;
            soldeDebit: number;
            soldeCredit: number;
            solde: number;
        }[];
        totaux: {
            reportDebit: number;
            reportCredit: number;
            mouvementDebit: number;
            mouvementCredit: number;
            soldeDebit: number;
            soldeCredit: number;
            solde: number;
        };
    }>;
}
export { lignesEnNegatif };
