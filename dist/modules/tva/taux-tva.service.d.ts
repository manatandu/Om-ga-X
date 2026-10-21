import { PrismaService } from '../../common/prisma.service';
import { CreerTauxTvaDto, ModifierTauxTvaDto } from './dto/taux-tva.dto';
import { Prisma, Referentiel, StatutEcriture } from '@prisma/client';
import { EcritureService } from '../comptabilite/ecriture.service';
export declare const SELECT_LIGNE_D_ORIGINE: {
    readonly id: true;
    readonly compteId: true;
    readonly libelle: true;
    readonly dateEcheance: true;
    readonly deviseId: true;
    readonly montantDevise: true;
    readonly debit: true;
    readonly credit: true;
    readonly lettrageId: true;
    readonly ecriture: {
        readonly select: {
            readonly id: true;
            readonly libelle: true;
            readonly date: true;
            readonly createdAt: true;
            readonly numeroPiece: true;
            readonly statut: true;
            readonly estANouveauProvisoire: true;
            readonly estGenereeParCloture: true;
            readonly corrigeEcritureId: true;
            readonly _count: {
                readonly select: {
                    readonly lignes: {
                        readonly where: Prisma.LigneEcritureWhereInput;
                    };
                };
            };
        };
    };
};
export type LigneDOrigine = {
    id: string;
    compteId: string;
    libelle: string | null;
    dateEcheance: Date | null;
    deviseId: string | null;
    montantDevise: unknown;
    debit: unknown;
    credit: unknown;
    lettrageId: string | null;
    ecriture: {
        id: string;
        libelle: string;
        date: Date;
        createdAt?: Date;
        numeroPiece?: number | null;
        statut?: StatutEcriture;
        estANouveauProvisoire: boolean;
        estGenereeParCloture: boolean;
        corrigeEcritureId?: string | null;
        _count?: {
            lignes?: number;
        };
    };
};
export type LectureDesReports = {
    reportsVers?: ReadonlyMap<string, string>;
    paiementsReportes?: ReadonlyMap<string, string>;
    motifLecture?: string | null;
};
export type NatureOperationTva = 'BIENS' | 'SERVICES' | 'INDETERMINEE';
export declare function repartirAuCentime(total: number, bruts: ReadonlyMap<string, number>, ratio: number): Map<string, number>;
export declare const MOTIF_A_NOUVEAU_AMBIGU = "plusieurs \u00E0-nouveaux candidats, rapprochement non fait";
export declare const MOTIF_GROUPE_TROP_LONG = "groupe de lettrage de plus de 500 lignes, rapprochement non fait";
export type LiquidationEncaissement = {
    id: string;
    dateDebut: Date;
    dateFin: Date;
    createdAt: Date;
    figee: Record<string, number> | null;
    regleTardifs?: boolean;
    instantLecture?: Date | null;
};
export type PeseNegatif = 'ANNULEE_ICI' | 'REPRISE_ICI' | 'RETIREE_DE_L_ATTENTE' | 'ACHAT_A_L_ENCAISSEMENT_NON_REPRIS' | 'DEDUCTION_DECHUE_RIEN_A_REPRENDRE' | 'PESE_SUR_UNE_PERIODE_NON_LIQUIDEE';
export type LiquidationVue = Pick<LiquidationEncaissement, 'dateDebut' | 'dateFin' | 'createdAt' | 'regleTardifs' | 'instantLecture'>;
export interface TaxeDeFacture {
    ttc: number;
    lignesTva: Array<{
        ligneId: string;
        compteId: string;
        numero: string;
        tauxTvaId: string;
        tva: number;
        base: 'DATE_ECRITURE' | 'ENCAISSEMENT';
        nature: NatureOperationTva;
    }>;
}
export declare class TauxTvaService {
    private readonly prisma;
    private readonly ecritureService;
    constructor(prisma: PrismaService, ecritureService: EcritureService);
    seedTauxDefaut(tenantId: string, referentiel: Referentiel, client?: Prisma.TransactionClient): Promise<void>;
    lister(tenantId: string, actifsSeuls?: boolean): Promise<({
        compteCollecte: {
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
        } | null;
        compteDeductible: {
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
        } | null;
    } & {
        id: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        taux: Prisma.Decimal;
        compteCollecteId: string | null;
        compteDeductibleId: string | null;
    })[]>;
    private trouver;
    private verifierComptes;
    creer(tenantId: string, dto: CreerTauxTvaDto): Promise<{
        id: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        taux: Prisma.Decimal;
        compteCollecteId: string | null;
        compteDeductibleId: string | null;
    }>;
    supprimer(tenantId: string, id: string): Promise<{
        supprime: boolean;
    }>;
    modifier(tenantId: string, id: string, dto: ModifierTauxTvaDto): Promise<{
        id: string;
        createdAt: Date;
        estActif: boolean;
        tenantId: string;
        intitule: string;
        code: string;
        taux: Prisma.Decimal;
        compteCollecteId: string | null;
        compteDeductibleId: string | null;
    }>;
    private static c;
    private racinesHorsDenominateur;
    calculerProrata(tenantId: string, dateDebut: Date, dateFin: Date): Promise<{
        numerateur: number;
        denominateur: number;
        pourcentage: number;
        recettesClasse7: number;
        recettesExclues: number;
        recettesNonQualifiees: number;
        racinesExclues: string[];
        mentionDenominateur: string;
    }>;
    private estLivraisonASoiMeme;
    prorataApplicable(tenantId: string, dateDebut: Date, dateFin: Date): Promise<{
        base: "ANNEE_PRECEDENTE";
        anneeReference: number;
        mention: string;
        numerateur: number;
        denominateur: number;
        pourcentage: number;
        recettesClasse7: number;
        recettesExclues: number;
        recettesNonQualifiees: number;
        racinesExclues: string[];
        mentionDenominateur: string;
    } | {
        base: "ESTIMATION_PERIODE";
        anneeReference: null;
        mention: string;
        numerateur: number;
        denominateur: number;
        pourcentage: number;
        recettesClasse7: number;
        recettesExclues: number;
        recettesNonQualifiees: number;
        racinesExclues: string[];
        mentionDenominateur: string;
    }>;
    prorataDefinitif(tenantId: string, annee: number): Promise<{
        annee: number;
        definitif: {
            numerateur: number;
            denominateur: number;
            pourcentage: number;
            recettesClasse7: number;
            recettesExclues: number;
            recettesNonQualifiees: number;
            racinesExclues: string[];
            mentionDenominateur: string;
        };
        pourcentageApplique: number;
        tvaDeductibleBrute: number;
        tvaDeductibleBruteAnnee: number;
        tvaDeductibleNonLiquidee: number;
        periodes: {
            dateDebut: string;
            dateFin: string;
            pourcentageApplique: number;
            tvaDeductibleBrute: number;
            deduite: number;
        }[];
        admiseDefinitive: number;
        admiseAppliquee: number;
        regularisation: number;
        sens: "AUCUNE" | "REVERSEMENT" | "DEDUCTION_COMPLEMENTAIRE";
        echeance: string;
    }>;
    private tvaDeductibleBrute;
    private tvaAuBrouillard;
    private exigibilite;
    private static datesDuGroupeDeMain;
    static groupeAPlusieursFactures<G extends {
        id?: string;
        statut: string;
        solde: unknown;
        lignes?: Array<{
            debit: unknown;
            credit: unknown;
            ecriture?: {
                id?: string;
                date: Date;
                estGenereeParCloture?: boolean;
                estANouveauProvisoire?: boolean;
            } | null;
        }>;
    }>(lignesTiers: ReadonlyArray<{
        debit: unknown;
        credit: unknown;
        lettrage: G | null;
    }>): {
        id: string;
        groupe: G;
        sensFacture: number;
        engage: number;
    } | null;
    static facturesDuGroupe(lignes: ReadonlyArray<{
        debit: unknown;
        credit: unknown;
        ecriture?: {
            id?: string;
        } | null;
    }> | undefined, sensFacture: number): Map<string, number> | null;
    static fractionsDuGroupe(reglements: ReadonlyArray<{
        date: Date;
        montant: number;
    }>, totalFactures: number, solde: boolean): Array<{
        date: Date | null;
        fraction: number;
    }>;
    static neutraliserLesNegatifs<L extends {
        compteId?: string;
        debit: unknown;
        credit: unknown;
        ecriture?: {
            id?: string;
            corrigeEcritureId?: string | null;
        } | null;
    }>(lignes: readonly L[] | undefined): L[] | null;
    static lectureDuGroupe<L extends {
        id?: string;
        compteId?: string;
        debit: unknown;
        credit: unknown;
        ecriture?: {
            id?: string;
            corrigeEcritureId?: string | null;
            estGenereeParCloture?: boolean;
            estANouveauProvisoire?: boolean;
        } | null;
    }>(traduit: {
        lignes?: L[];
        motifLecture?: string | null;
    }, sensFacture: number): {
        lignes: L[];
        factures: Map<string, number> | null;
        avecAvoir: boolean;
        motifEnBloc: string | null;
    };
    static imputerLeGroupe(groupe: {
        statut: string;
        lignes?: Array<{
            id?: string;
            debit: unknown;
            credit: unknown;
            dateEcheance?: Date | null;
            ecriture?: {
                id?: string;
                date: Date;
                libelle?: string;
            } | null;
        }>;
        reportsVers?: ReadonlyMap<string, string>;
    }, sensFacture: number, factures: ReadonlyMap<string, number>, declarees?: ReadonlyMap<string, ReadonlyArray<{
        detteId: string;
        montant: number;
    }>>, periode?: {
        debut: Date;
        fin: Date;
    }): {
        partLettreeDe: (ecritureId: string) => Array<{
            date: Date | null;
            fraction: number;
        }>;
        libelles: string[];
        fondement: 'LEGALE' | 'DECLAREE' | 'DECLAREE_EN_PARTIE';
        declareNonRetenu: number;
    };
    imputerLesPaiementsNonRattaches(tenantId: string, paiements: ReadonlyArray<{
        id: string;
        compteId: string;
        debit: unknown;
        credit: unknown;
        compte: {
            numero: string;
        };
        ecriture: {
            date: Date;
            exerciceId: string;
        };
    }>): Promise<Map<string, {
        imputation?: Array<{
            facture: string;
            date: string;
            montant: number;
        }>;
        avance?: number;
        imputationNonDite?: string;
    }>>;
    static repartirLibresEntreLignes(libres: ReadonlyArray<{
        date: Date;
        montant: number;
        origine: Date;
    }>, capacites: ReadonlyArray<number>): Array<Array<{
        date: Date;
        montant: number;
        origine: Date;
    }>>;
    static declareParAncienMoteur(lignesTiers: ReadonlyArray<{
        debit: unknown;
        credit: unknown;
        lettrage?: {
            statut: string;
            solde: unknown;
            createdAt?: Date;
            lignes?: Array<{
                debit: unknown;
                credit: unknown;
                ecriture?: {
                    date: Date;
                    createdAt?: Date;
                } | null;
            }>;
        } | null;
    }>, montant: number, dateEcriture: Date, liquidation: LiquidationEncaissement, ecritureSaisieLe?: Date): number;
    private static reglementsDuGroupe;
    static rattachementTardif(date: Date, valideeLe: Date | null | undefined, liquidations: ReadonlyArray<LiquidationVue>, depuis?: Date | null, options?: {
        negatif?: boolean;
    }): {
        date: Date;
        tardive: boolean;
        ancienMoteur: boolean;
        dansUnTrou: boolean;
    };
    static recuperationTardive(date: Date, valideeLe: Date | null | undefined, liquidations: ReadonlyArray<LiquidationVue>): {
        date: Date;
        ancienMoteur: boolean;
        dansUnTrou: boolean;
    } | null;
    static horsDelaiArt37(constatation: Date, portee: Date): boolean;
    static perteQuiAnnuleLaTaxe(lignes: ReadonlyArray<{
        creancesDouteusesDesignees?: ReadonlyArray<{
            id: string;
            creance?: {
                mouvements?: ReadonlyArray<{
                    date: Date;
                    detailTva: unknown;
                }>;
            } | null;
        }> | null;
    }>): {
        le: Date;
        impayeTtc: number;
    } | null;
    static partAnnuleeParLaPerte(perte: {
        impayeTtc: number;
    }, taxeDeLaLigne: number, ttcFacture: number): number;
    static bornerParLaPerte<T extends {
        date: Date;
        montant: number;
        origine: Date;
    }>(libres: ReadonlyArray<T>, dejaDeclare: number, taxeDeLaLigne: number, partAnnulee: number, perteLe: Date): {
        admises: T[];
        ecartees: T[];
    };
    private static lendemainUtc;
    private static instantVu;
    private static dansUnTrou;
    private static premierJourVuApres;
    static repartirEncaissement(p: {
        ligneId: string;
        montant: number;
        dateEcriture: Date;
        tranches: ReadonlyArray<{
            date: Date;
            montant: number;
        }>;
        liquidations: ReadonlyArray<LiquidationEncaissement>;
        declareParAncienMoteur: (liquidation: LiquidationEncaissement) => number;
    }): {
        parLiquidation: Map<string, number>;
        libres: Array<{
            date: Date;
            montant: number;
            origine: Date;
        }>;
    };
    private prolongerParLesANouveaux;
    traduireLesReports<G extends {
        id?: string;
        statut: string;
        lignes?: Array<{
            id?: string;
            compteId?: string;
            debit: unknown;
            credit: unknown;
            ecriture?: {
                date: Date;
                estGenereeParCloture?: boolean;
                estANouveauProvisoire?: boolean;
            } | null;
        }>;
        reportsVers?: ReadonlyMap<string, string>;
    }>(tenantId: string, groupe: G, sensFacture: number, connues?: ReadonlyMap<string, LigneDOrigine>): Promise<G & LectureDesReports>;
    private chercherOrigines;
    private chercherReports;
    private relierAuxANouveaux;
    private static dateDernierReglement;
    private static tranchesAuxDebits;
    static estAuxDebits(base: 'DATE_ECRITURE' | 'ENCAISSEMENT', nature: NatureOperationTva, estCollecte: boolean, regimeLigne: string, fournisseurAutorise: boolean): boolean;
    static tranchesAuxDebitsImputees(parts: ReadonlyArray<{
        date: Date | null;
        fraction: number;
    }>, dateDebit: Date): Array<{
        date: Date;
        fraction: number;
        auPaiement?: boolean;
    }>;
    private static montantsDesTranches;
    private natureOperation;
    private static natureContrepartie;
    private static plusLongue;
    private static fournisseurAuxDebits;
    private static nomDuTiers;
    private static mentionDebitsLueSurLaFacture;
    private baseExigibilite;
    taxeDesFactures(tenantId: string, ecritureIds: readonly string[]): Promise<{
        factures: Map<string, TaxeDeFacture>;
        ancienMoteur: boolean;
    }>;
    private creditReportable;
    private partExclueArt41;
    declaration(tenantId: string, dateDebut: Date, dateFin: Date, options?: {
        instantLecture?: Date;
    }): Promise<{
        dateDebut: Date;
        dateFin: Date;
        regimeExigibilite: import(".prisma/client").$Enums.RegimeExigibiliteTva;
        mentionExigibilite: string;
        tvaAuBrouillard: {
            collecte: number;
            deductible: number;
            ecritures: number;
        };
        tvaEnAttenteEncaissement: number;
        tvaEnAttenteImputationIndeterminee: number;
        groupesImputationIndeterminee: {
            factures: string[];
            encaisse: number;
            motif: string;
            declarationsNonLues?: number;
        }[];
        groupesImputationIndetermineeTotal: number;
        imputationsDesPaiements: {
            factures: string[];
            encaisse: number;
            fondement: "LEGALE" | "DECLAREE" | "DECLAREE_EN_PARTIE";
            declareNonRetenu?: number;
        }[];
        imputationsDesPaiementsTotal: number;
        rapprochementsANouveauAbandonnes: {
            facture: string;
            date: string;
            tva: number;
            motif: string;
        }[];
        rapprochementsANouveauAbandonnesTotal: number;
        lignes: {
            tauxId: string;
            code: string;
            intitule: string;
            taux: number;
            compteCollecteId: string | null;
            compteDeductibleId: string | null;
            totalCollecte: number;
            totalDeductible: number;
            enAttente: number;
            avoirsCollecteConstates: number;
            recuperationArt52: number;
            net: number;
            parCompte: {
                compteId: string;
                collecte: number;
                deductible: number;
                recuperation: number;
            }[];
        }[];
        prorata: {
            base: "ANNEE_PRECEDENTE";
            anneeReference: number;
            mention: string;
            numerateur: number;
            denominateur: number;
            pourcentage: number;
            recettesClasse7: number;
            recettesExclues: number;
            recettesNonQualifiees: number;
            racinesExclues: string[];
            mentionDenominateur: string;
        } | {
            base: "ESTIMATION_PERIODE";
            anneeReference: null;
            mention: string;
            numerateur: number;
            denominateur: number;
            pourcentage: number;
            recettesClasse7: number;
            recettesExclues: number;
            recettesNonQualifiees: number;
            racinesExclues: string[];
            mentionDenominateur: string;
        };
        totalCollecte: number;
        totalDeductible: number;
        totalDeductibleAdmise: number;
        avoirsCollecteConstates: number;
        recuperationArt52: number;
        avoirsCollecteNonImputes: number;
        avoirsSansNoteDeCredit: number;
        reprisesAvoirsCorriges: {
            piece: number | null;
            date: string;
            avoirCorrige: {
                piece: number | null;
                date: string;
            } | null;
            montant: number;
            pese: "CONSTATEE_ICI" | "DEDUCTION_REPRISE_ICI" | "NON_IMPUTEE";
        }[];
        reprisesAvoirsCorrigesTotal: number;
        reprisesAvoirsCorrigesTronque: boolean;
        negatifsDeFactures: {
            piece: number | null;
            date: string;
            factureCorrigee: {
                piece: number | null;
                date: string;
            } | null;
            sens: "VENTE" | "ACHAT";
            montant: number;
            pese: PeseNegatif;
        }[];
        negatifsDeFacturesTotal: number;
        negatifsDeFacturesTronque: boolean;
        rattachementsTardifs: {
            piece: number | null;
            libelle: string;
            dateOrigine: string;
            rattacheeAu: string;
            nature: "COLLECTE" | "DEDUCTION" | "AVOIR_SUR_VENTE" | "AVOIR_FOURNISSEUR" | "NEGATIF_DE_VENTE" | "NEGATIF_D_ACHAT";
            montant: number;
            ancienMoteur?: true;
            dansUnTrou?: true;
            horsDelaiArt37?: true;
        }[];
        rattachementsTardifsTotal: number;
        rattachementsTardifsTronque: boolean;
        negatifsNonPortesTotal: number;
        negatifsNonPortesMontant: number;
        rattachementsAncienMoteurTotal: number;
        rattachementsAncienMoteurMontant: number;
        rattachementsDansUnTrouTotal: number;
        rattachementsHorsDelaiTotal: number;
        rattachementsHorsDelaiMontant: number;
        taxeAnnuleeParUnePerte: number;
        attenteAnnuleeParUnePerte: number;
        negatifsOrphelinsDansUnGroupe: number;
        tvaExclueArt41: number;
        tvaAVerifierArt41: number;
        tvaNatureDepenseIllisible: number;
        tvaDeductibleDechue: number;
        figeEncaissement: Record<string, number>;
        recouvrementsSansFactureDesignee: {
            creanceId: string;
            compte: string;
            dateReclassement: string;
            recouvre: number;
            recouvreSansFacture: number;
            motifs: string[];
        }[];
        creancesRecouvreesTotal: number;
        recouvrementsSansFactureTronque: boolean;
        reconstitutionsIncertaines: {
            facture: string;
            dateDebut: string;
            dateFin: string;
            montantReconstitue: number;
        }[];
        reconstitutionsIncertainesTotal: number;
        paiementsARelettrer: {
            imputation?: Array<{
                facture: string;
                date: string;
                montant: number;
            }>;
            avance?: number;
            imputationNonDite?: string;
            compte: string;
            date: string;
            montant: number;
            dansLaPeriode: boolean;
        }[];
        paiementsARelettrerTotal: number;
        netAvantImputation: number;
        creditAnterieur: number;
        creditAnterieurOrigine: {
            id: string;
            dateDebut: string;
            dateFin: string;
            ecritureId: string;
        } | null;
        creditImpute: number;
        net: number;
        sens: "CREDIT" | "A_PAYER";
        liquidation: {
            faite: true;
            id: string;
            dateDebut: string;
            dateFin: string;
            ecritureId: string;
            libelleEcriture: string;
            memePeriode: boolean;
        } | {
            faite: false;
            id?: undefined;
            dateDebut?: undefined;
            dateFin?: undefined;
            ecritureId?: undefined;
            libelleEcriture?: undefined;
            memePeriode?: undefined;
        };
    }>;
    private mentionExigibilite;
    comptabiliserLiquidation(tenantId: string, userId: string, dto: {
        exerciceId: string;
        dateDebut: string;
        dateFin: string;
        date?: string;
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
        declaration: {
            dateDebut: Date;
            dateFin: Date;
            regimeExigibilite: import(".prisma/client").$Enums.RegimeExigibiliteTva;
            mentionExigibilite: string;
            tvaAuBrouillard: {
                collecte: number;
                deductible: number;
                ecritures: number;
            };
            tvaEnAttenteEncaissement: number;
            tvaEnAttenteImputationIndeterminee: number;
            groupesImputationIndeterminee: {
                factures: string[];
                encaisse: number;
                motif: string;
                declarationsNonLues?: number;
            }[];
            groupesImputationIndetermineeTotal: number;
            imputationsDesPaiements: {
                factures: string[];
                encaisse: number;
                fondement: "LEGALE" | "DECLAREE" | "DECLAREE_EN_PARTIE";
                declareNonRetenu?: number;
            }[];
            imputationsDesPaiementsTotal: number;
            rapprochementsANouveauAbandonnes: {
                facture: string;
                date: string;
                tva: number;
                motif: string;
            }[];
            rapprochementsANouveauAbandonnesTotal: number;
            lignes: {
                tauxId: string;
                code: string;
                intitule: string;
                taux: number;
                compteCollecteId: string | null;
                compteDeductibleId: string | null;
                totalCollecte: number;
                totalDeductible: number;
                enAttente: number;
                avoirsCollecteConstates: number;
                recuperationArt52: number;
                net: number;
                parCompte: {
                    compteId: string;
                    collecte: number;
                    deductible: number;
                    recuperation: number;
                }[];
            }[];
            prorata: {
                base: "ANNEE_PRECEDENTE";
                anneeReference: number;
                mention: string;
                numerateur: number;
                denominateur: number;
                pourcentage: number;
                recettesClasse7: number;
                recettesExclues: number;
                recettesNonQualifiees: number;
                racinesExclues: string[];
                mentionDenominateur: string;
            } | {
                base: "ESTIMATION_PERIODE";
                anneeReference: null;
                mention: string;
                numerateur: number;
                denominateur: number;
                pourcentage: number;
                recettesClasse7: number;
                recettesExclues: number;
                recettesNonQualifiees: number;
                racinesExclues: string[];
                mentionDenominateur: string;
            };
            totalCollecte: number;
            totalDeductible: number;
            totalDeductibleAdmise: number;
            avoirsCollecteConstates: number;
            recuperationArt52: number;
            avoirsCollecteNonImputes: number;
            avoirsSansNoteDeCredit: number;
            reprisesAvoirsCorriges: {
                piece: number | null;
                date: string;
                avoirCorrige: {
                    piece: number | null;
                    date: string;
                } | null;
                montant: number;
                pese: "CONSTATEE_ICI" | "DEDUCTION_REPRISE_ICI" | "NON_IMPUTEE";
            }[];
            reprisesAvoirsCorrigesTotal: number;
            reprisesAvoirsCorrigesTronque: boolean;
            negatifsDeFactures: {
                piece: number | null;
                date: string;
                factureCorrigee: {
                    piece: number | null;
                    date: string;
                } | null;
                sens: "VENTE" | "ACHAT";
                montant: number;
                pese: PeseNegatif;
            }[];
            negatifsDeFacturesTotal: number;
            negatifsDeFacturesTronque: boolean;
            rattachementsTardifs: {
                piece: number | null;
                libelle: string;
                dateOrigine: string;
                rattacheeAu: string;
                nature: "COLLECTE" | "DEDUCTION" | "AVOIR_SUR_VENTE" | "AVOIR_FOURNISSEUR" | "NEGATIF_DE_VENTE" | "NEGATIF_D_ACHAT";
                montant: number;
                ancienMoteur?: true;
                dansUnTrou?: true;
                horsDelaiArt37?: true;
            }[];
            rattachementsTardifsTotal: number;
            rattachementsTardifsTronque: boolean;
            negatifsNonPortesTotal: number;
            negatifsNonPortesMontant: number;
            rattachementsAncienMoteurTotal: number;
            rattachementsAncienMoteurMontant: number;
            rattachementsDansUnTrouTotal: number;
            rattachementsHorsDelaiTotal: number;
            rattachementsHorsDelaiMontant: number;
            taxeAnnuleeParUnePerte: number;
            attenteAnnuleeParUnePerte: number;
            negatifsOrphelinsDansUnGroupe: number;
            tvaExclueArt41: number;
            tvaAVerifierArt41: number;
            tvaNatureDepenseIllisible: number;
            tvaDeductibleDechue: number;
            recouvrementsSansFactureDesignee: {
                creanceId: string;
                compte: string;
                dateReclassement: string;
                recouvre: number;
                recouvreSansFacture: number;
                motifs: string[];
            }[];
            creancesRecouvreesTotal: number;
            recouvrementsSansFactureTronque: boolean;
            reconstitutionsIncertaines: {
                facture: string;
                dateDebut: string;
                dateFin: string;
                montantReconstitue: number;
            }[];
            reconstitutionsIncertainesTotal: number;
            paiementsARelettrer: {
                imputation?: Array<{
                    facture: string;
                    date: string;
                    montant: number;
                }>;
                avance?: number;
                imputationNonDite?: string;
                compte: string;
                date: string;
                montant: number;
                dansLaPeriode: boolean;
            }[];
            paiementsARelettrerTotal: number;
            netAvantImputation: number;
            creditAnterieur: number;
            creditAnterieurOrigine: {
                id: string;
                dateDebut: string;
                dateFin: string;
                ecritureId: string;
            } | null;
            creditImpute: number;
            net: number;
            sens: "CREDIT" | "A_PAYER";
            liquidation: {
                faite: true;
                id: string;
                dateDebut: string;
                dateFin: string;
                ecritureId: string;
                libelleEcriture: string;
                memePeriode: boolean;
            } | {
                faite: false;
                id?: undefined;
                dateDebut?: undefined;
                dateFin?: undefined;
                ecritureId?: undefined;
                libelleEcriture?: undefined;
                memePeriode?: undefined;
            };
        };
    }>;
    private liquidationChevauchante;
    listerLiquidations(tenantId: string): Promise<{
        id: string;
        dateDebut: string;
        dateFin: string;
        net: number;
        prorataApplique: number;
        ecriture: {
            id: string;
            libelle: string;
            date: Date;
            numeroPiece: number | null;
        };
        createdAt: Date;
    }[]>;
    annulerLiquidation(tenantId: string, id: string): Promise<{
        supprime: boolean;
        ecritureId: string;
    }>;
}
