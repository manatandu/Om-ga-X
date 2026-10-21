import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { TauxTvaService } from './taux-tva.service';
import { CreerTauxTvaDto, ModifierTauxTvaDto, ComptabiliserLiquidationDto } from './dto/taux-tva.dto';
export declare class TauxTvaController {
    private readonly tauxTvaService;
    constructor(tauxTvaService: TauxTvaService);
    lister(user: AuthenticatedUser, actifsSeuls?: string): Promise<({
        compteCollecte: {
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
        } | null;
        compteDeductible: {
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
        } | null;
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        taux: import("@prisma/client/runtime/library").Decimal;
        compteCollecteId: string | null;
        compteDeductibleId: string | null;
    })[]>;
    declaration(user: AuthenticatedUser, dateDebut?: string, dateFin?: string): Promise<{
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
            pese: import("./taux-tva.service").PeseNegatif;
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
    }>;
    comptabiliserLiquidation(user: AuthenticatedUser, dto: ComptabiliserLiquidationDto): Promise<{
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
                pese: import("./taux-tva.service").PeseNegatif;
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
    listerLiquidations(user: AuthenticatedUser): Promise<{
        id: string;
        dateDebut: string;
        dateFin: string;
        net: number;
        prorataApplique: number;
        ecriture: {
            id: string;
            date: Date;
            numeroPiece: number | null;
            libelle: string;
        };
        createdAt: Date;
    }[]>;
    annulerLiquidation(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
        ecritureId: string;
    }>;
    prorataDefinitif(user: AuthenticatedUser, annee?: string): Promise<{
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
    creer(user: AuthenticatedUser, dto: CreerTauxTvaDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        taux: import("@prisma/client/runtime/library").Decimal;
        compteCollecteId: string | null;
        compteDeductibleId: string | null;
    }>;
    modifier(user: AuthenticatedUser, id: string, dto: ModifierTauxTvaDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        estActif: boolean;
        intitule: string;
        code: string;
        taux: import("@prisma/client/runtime/library").Decimal;
        compteCollecteId: string | null;
        compteDeductibleId: string | null;
    }>;
    supprimer(user: AuthenticatedUser, id: string): Promise<{
        supprime: boolean;
    }>;
}
