import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EcritureService } from './ecriture.service';
import { type PerimetreBalanceAgee } from './ecriture.service';
import { CreerEcritureDto, ImputationOuvertureDto } from './dto/creer-ecriture.dto';
import { CorrigerEcritureDto } from './dto/corriger-ecriture.dto';
import { FusionnerComptesDto, ReimputerDto } from './dto/reimputer.dto';
import { ModifierEcritureDto, TransfererEcritureDto, ValiderEcrituresDto, ValiderJusquaDto } from './dto/brouillard.dto';
export declare class EcritureController {
    private readonly ecritureService;
    constructor(ecritureService: EcritureService);
    creer(user: AuthenticatedUser, dto: CreerEcritureDto): Promise<{
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
    }>;
    imputerOuverture(user: AuthenticatedUser, dto: ImputationOuvertureDto): Promise<{
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
    }>;
    fusionnerComptes(user: AuthenticatedUser, dto: FusionnerComptesDto): Promise<{
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
    reimputer(user: AuthenticatedUser, dto: ReimputerDto): Promise<{
        auBrouillard: number;
        validees: number;
        ecrituresPassees: {
            numeroPiece: number | null;
            journal: string;
        }[];
    }>;
    corriger(user: AuthenticatedUser, id: string, dto: CorrigerEcritureDto): Promise<{
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
    }>;
    brouillard(user: AuthenticatedUser, exerciceId: string, journalId?: string, dateDebut?: string, dateFin?: string): Promise<{
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
    modifier(user: AuthenticatedUser, id: string, dto: ModifierEcritureDto): Promise<{
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
        lignes: ({
            compte: {
                id: string;
                tenantId: string;
                estActif: boolean;
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
                partVariableGestionPct: import("@prisma/client/runtime/library").Decimal | null;
                bailleurId: string | null;
                porteFondsContrepartieEtat: boolean;
            };
        } & {
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
        })[];
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
    }>;
    transferer(user: AuthenticatedUser, id: string, dto: TransfererEcritureDto): Promise<{
        journal: {
            code: string;
        };
        id: string;
        date: Date;
        numeroPiece: number | null;
        dateValeur: Date | null;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
        piecesDetachees: number;
    }>;
    valider(user: AuthenticatedUser, dto: ValiderEcrituresDto): Promise<{
        validees: number;
        dejaValidees: number;
        refuseesSecondRegard: number;
        sousDerogation: number;
        motifRefus: string | null;
        ecarteesJournalDeSituation: number;
    }>;
    validerJusqua(user: AuthenticatedUser, dto: ValiderJusquaDto): Promise<{
        ecarteesJournalDeSituation: number;
        motifEcarteesJournalDeSituation: string | null;
        validees: number;
        dejaValidees: number;
        refuseesSecondRegard: number;
        sousDerogation: number;
        motifRefus: string | null;
    }>;
    lister(user: AuthenticatedUser, exerciceId?: string, journalId?: string, dateDebut?: string, dateFin?: string, recherche?: string, inclureBrouillard?: string, limite?: string, compte?: string, montant?: string, montantMax?: string, numeroPiece?: string, reference?: string, plusRecentes?: string): Promise<{
        ecritures: ({
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
            lignes: ({
                compte: {
                    id: string;
                    tenantId: string;
                    estActif: boolean;
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
                    partVariableGestionPct: import("@prisma/client/runtime/library").Decimal | null;
                    bailleurId: string | null;
                    porteFondsContrepartieEtat: boolean;
                };
            } & {
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
            })[];
            corrigeEcriture: {
                id: string;
                date: Date;
                numeroPiece: number | null;
                libelle: string;
            } | null;
            correction: {
                id: string;
                date: Date;
                numeroPiece: number | null;
            } | null;
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
        })[];
        totaux: {
            debit: number;
            credit: number;
        };
        total: number;
        tronque: boolean;
        plafond: number;
    }>;
    balance(user: AuthenticatedUser, exerciceId: string, regrouperTiers?: string, du?: string, au?: string): Promise<{
        periode: {
            du: string;
            au: string;
        } | null;
        lignes: import("./balance-trois-colonnes").LigneDeBalance[];
        totaux: {
            debit: number;
            credit: number;
        };
    }>;
    echeancier(user: AuthenticatedUser, exerciceId: string, dateReference?: string): Promise<{
        dateReference: Date;
        tresorerieActuelle: number;
        tranches: import("./ecriture.service").TrancheEcheancier[];
        details: import("./ecriture.service").EcheanceDetail[];
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
    balanceAgee(user: AuthenticatedUser, exerciceId: string, dateReference?: string, type?: PerimetreBalanceAgee): Promise<{
        dateReference: string;
        debutExercice: string;
        type: PerimetreBalanceAgee;
        lecture: string;
        libellePerimetre: string;
        sensNormal: import("./ecriture.service").SensNormalAgee;
        tranches: import("./ecriture.service").TrancheAgee[];
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
    balanceAuxiliaire(user: AuthenticatedUser, exerciceId: string, type?: string): Promise<{
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
    justificatifSolde(user: AuthenticatedUser, compteId: string, exerciceId: string, dateArret?: string, masquerLettrees?: string): Promise<{
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
    evolutionSoldes(user: AuthenticatedUser, nbExercices?: string): Promise<{
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
    grandLivreComplet(user: AuthenticatedUser, exerciceId: string, du?: string, au?: string): Promise<{
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
        report?: import("./periode-extrait").ReportALaVeille | null | undefined;
        compte: {
            id: string;
            numero: string;
            intitule: string;
        };
    }[]>;
    grandLivre(user: AuthenticatedUser, compteId: string, exerciceId: string, du?: string, au?: string): Promise<{
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
        report?: import("./periode-extrait").ReportALaVeille | null | undefined;
        compte: {
            id: string;
            tenantId: string;
            estActif: boolean;
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
            partVariableGestionPct: import("@prisma/client/runtime/library").Decimal | null;
            bailleurId: string | null;
            porteFondsContrepartieEtat: boolean;
        };
    }>;
}
