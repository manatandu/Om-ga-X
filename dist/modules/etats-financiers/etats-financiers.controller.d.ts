import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EtatsFinanciersService } from './etats-financiers.service';
import { EtatsFinanciersProjetService } from './etats-financiers-projet.service';
import { EtatsFinanciersSmtService } from './etats-financiers-smt.service';
import { EtatsFinanciersProjetBudgetService } from './etats-financiers-projet-budget.service';
export declare class EtatsFinanciersController {
    private readonly etatsFinanciersService;
    private readonly etatsFinanciersProjetService;
    private readonly etatsFinanciersSmtService;
    private readonly etatsFinanciersProjetBudgetService;
    constructor(etatsFinanciersService: EtatsFinanciersService, etatsFinanciersProjetService: EtatsFinanciersProjetService, etatsFinanciersSmtService: EtatsFinanciersSmtService, etatsFinanciersProjetBudgetService: EtatsFinanciersProjetBudgetService);
    bilan(user: AuthenticatedUser, exerciceId: string): Promise<{
        actif: import("./etats-financiers.service").PosteCalcule[];
        passif: import("./etats-financiers.service").PosteCalcule[];
        totalActif: number;
        totalPassif: number;
        totalActifN1: number | undefined;
        totalPassifN1: number | undefined;
        exerciceN1Disponible: boolean;
        comparatif: import("./etats-financiers.communs").ProvenanceComparatif | null;
        mentionComparatif: string | null;
        equilibre: boolean;
        comptesNonRattaches: import("./etats-financiers.communs").CompteDuPoste[];
        controle: {
            resultatClasses678: number;
            resultatCompte13: number;
            resultatAnterieurNonAffecte: number;
        };
        resultatAnterieurNonVire: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
        resultatAnterieurNonVireN1: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
    }>;
    compteDeResultat(user: AuthenticatedUser, exerciceId: string): Promise<{
        produits: import("./etats-financiers.service").PosteCalcule[];
        totalProduits: number;
        totalProduitsN1: number | undefined;
        charges: import("./etats-financiers.service").PosteCalcule[];
        totalCharges: number;
        totalChargesN1: number | undefined;
        resultatActivitesOrdinaires: number;
        resultatActivitesOrdinairesN1: number | undefined;
        produitsHao: import("./etats-financiers.service").PosteCalcule;
        chargesHao: import("./etats-financiers.service").PosteCalcule;
        resultatHao: number;
        resultatHaoN1: number | undefined;
        resultatNet: number;
        resultatNetN1: number | undefined;
        exerciceN1Disponible: boolean;
        motifComparatifAbsent: string | null;
        comptesNonRattaches: import("./etats-financiers.communs").CompteDuPoste[];
        controle: {
            resultatToutesClassesDeGestion: number;
            ecart: number;
            coherent: boolean;
        };
    }>;
    tableauFluxTresorerie(user: AuthenticatedUser, exerciceId: string): Promise<{
        lignes: ({
            section: string;
        } | {
            montantN1: number | undefined;
            estTotal: boolean;
            repere: string | undefined;
            ref: string;
            libelle: string;
            montant: number;
            brut?: number;
            amortissement?: number;
            comptes: import("./etats-financiers.communs").CompteDuPoste[];
            flux?: number;
            variationContrepartie?: number;
            section?: undefined;
        })[];
        exerciceN1Disponible: boolean;
        comptesNonVentiles: {
            numero: string;
            intitule: string;
            montant: number;
        }[];
        mentionOuverture: string | null;
        postesVides: string[];
        postesNonCalculables: import("./etats-financiers.communs").PosteDeFluxVide[];
        postesNonCalculablesN1: import("./etats-financiers.communs").PosteDeFluxVide[];
        controle: import("./etats-financiers.communs").ControleTableauDesFlux;
    }>;
    bilanProjet(user: AuthenticatedUser, exerciceId: string): Promise<{
        actif: import("./etats-financiers.service").PosteCalcule[];
        passif: import("./etats-financiers.service").PosteCalcule[];
        totalActif: number;
        totalPassif: number;
        totalActifN1: number | undefined;
        totalPassifN1: number | undefined;
        exerciceN1Disponible: boolean;
        comparatif: import("./etats-financiers.communs").ProvenanceComparatif | null;
        mentionComparatif: string | null;
        equilibre: boolean;
        comptesNonRattaches: import("./etats-financiers.communs").CompteDuPoste[];
        controle: {
            resultatClasses678: number;
            resultatCompte13: number;
            resultatAnterieurNonAffecte: number;
        };
        resultatAnterieurNonVire: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
        resultatAnterieurNonVireN1: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
    }>;
    compteExploitationProjet(user: AuthenticatedUser, exerciceId: string): Promise<{
        revenus: import("./etats-financiers.service").PosteCalcule[];
        totalRevenus: number;
        totalRevenusN1: number | undefined;
        charges: import("./etats-financiers.service").PosteCalcule[];
        totalCharges: number;
        totalChargesN1: number | undefined;
        solde: number;
        soldeN1: number | undefined;
        exerciceN1Disponible: boolean;
        motifComparatifAbsent: string | null;
        comptesNonRattaches: import("./etats-financiers.communs").CompteDuPoste[];
        controle: {
            boucleAZero: boolean;
        };
    }>;
    emploisRessources(user: AuthenticatedUser, exerciceId: string): Promise<{
        lignes: {
            montantCumulDebut: number;
            montantCumulFin: number;
            ref: string;
            libelle: string;
            montant: number;
            montantN1?: number;
            brut?: number;
            amortissement?: number;
            comptes: import("./etats-financiers.communs").CompteDuPoste[];
            estTotal?: boolean;
            cle: string;
        }[];
        totalRessources: number;
        totalEmplois: number;
        excedent: number;
        encaisseDisponible: number;
        fondsFinExercice: number;
        controle: {
            ecart: number;
            boucle: boolean;
            cumulDebut: {
                ecart: number;
                boucle: boolean;
            };
            cumulFin: {
                ecart: number;
                boucle: boolean;
            };
        };
        anomalies: {
            ref: string;
            libelle: string;
            brut: number;
            correction: number;
            montant: number;
            diagnostic: string;
        }[];
        avertissements: string[];
        periodes: {
            exercice: string;
            cumulDebutJusquA: string | null;
        };
    }>;
    executionBudgetaire(user: AuthenticatedUser, exerciceId: string, planId?: string): Promise<{
        plan: {
            id: string;
            code: string;
            intitule: string;
        };
        lignes: import("./etats-financiers-projet-budget.service").LigneExecutionBudgetaire[];
        total: {
            executionPourcent: number | null;
            budget: number;
            decaissement: number;
            engagementComptable: number;
            engagementHorsComptabilite: number;
            engagement: number;
            realisation: number;
            creditDisponible: number;
        };
        odAnalytiquesNonReprises: string | null;
        engagementsAnterieursNonSuivis: string | null;
        engagementsReglesSansImputation: string | null;
        engagementsHorsComptabilite: string;
    }>;
    reconciliationTresorerie(user: AuthenticatedUser, exerciceId: string, paiementsEnInstance?: string): Promise<{
        lignes: {
            rep: string;
            libelle: string;
            montant: number | null;
        }[];
        controle: {
            tresorerieBalance: number;
            ecart: number;
            boucle: boolean;
        };
        avertissements: string[];
    }>;
    noteBailleur(user: AuthenticatedUser, exerciceId: string): Promise<{
        investissement: {
            bailleur: {
                id: string;
                code: string;
                nom: string;
            };
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        }[];
        investissementNonAffecte: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
        totalInvestissement: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
        administration: {
            bailleur: {
                id: string;
                code: string;
                nom: string;
            };
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        }[];
        administrationNonAffecte: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
        totalAdministration: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
        totalFondsDuBailleur: {
            decaisse: number;
            consomme: number;
            soldeRestant: number;
        };
    }>;
    bilanSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        actif: (import("./etats-financiers.service").PosteCalcule & {
            note: string | null;
        })[];
        passif: (import("./etats-financiers.service").PosteCalcule & {
            note: string | null;
        })[];
        totalActif: number;
        totalPassif: number;
        totalActifN1: number | undefined;
        totalPassifN1: number | undefined;
        exerciceN1Disponible: boolean;
        comparatif: import("./etats-financiers.communs").ProvenanceComparatif | null;
        mentionComparatif: string | null;
        equilibre: boolean;
        renvoiImmobilisations: string;
        controle: {
            resultatClasses678: number;
            resultatCompte13: number;
            resultatAnterieurNonAffecte: number;
            compte13LuHorsDuResultat: number;
        };
        resultatAnterieurNonVire: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
        resultatAnterieurNonVireN1: import("./resultat-de-l-exercice").ResultatAnterieurNonVire | null;
    }>;
    compteDeResultatSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        recettes: (import("./etats-financiers.service").PosteCalcule & {
            note: string | null;
        } & {
            montantN1: number | undefined;
        })[];
        totalRecettes: number;
        depenses: (import("./etats-financiers.service").PosteCalcule & {
            note: string | null;
        } & {
            montantN1: number | undefined;
        })[];
        totalDepenses: number;
        soldeCaisse: number;
        retraitements: ({
            ref: string;
            libelle: string;
            montant: number;
            signe: 1 | -1;
            comptes: import("./etats-financiers.communs").CompteDuPoste[];
        } & {
            montantN1: number | undefined;
        })[];
        resultatNet: number;
        exerciceN1Disponible: boolean;
        motifComparatifAbsent: string | null;
        totalRecettesN1: number | undefined;
        totalDepensesN1: number | undefined;
        soldeCaisseN1: number | undefined;
        resultatNetN1: number | undefined;
        reglementsNonRattaches: import("./reglements-de-tresorerie").ReglementNonRattache[];
        controle: {
            resultatBilan: number;
            fluxHorsExploitation: number;
            comptesHorsExploitation: import("./etats-financiers.communs").CompteDuPoste[];
            ecart: number;
            concordant: boolean;
        };
    }>;
    journalTresorerieSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        journaux: {
            compteId: string;
            numero: string;
            intitule: string;
            reportANouveau: number;
            operations: {
                date: Date;
                libelle: string;
                reference: string | null;
                sens: "RECETTE" | "DEPENSE";
                recette: number;
                depense: number;
                solde: number;
                virementInterne: boolean;
                ventile: boolean;
                ventilation: Record<string, number>;
            }[];
            soldeAReporter: number;
            totalRecettes: number;
            totalDepenses: number;
            lignesNonVentilees: number;
            soldeBalance: number;
            boucle: boolean;
        }[];
        colonnesRecettes: {
            cle: string;
            libelle: string;
        }[];
        colonnesDepenses: {
            cle: string;
            libelle: string;
        }[];
        nb: string;
    }>;
    notesSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        fiche: import("./correspondance-smt").NoteSmt[];
        applicables: number[];
        note1: {
            lignes: ({
                origine: "REGISTRE";
                dateMiseEnService: Date | null;
                designation: string;
                montant: number;
                dateAcquisition: Date | null;
                dureeUtiliteAns: number | null;
                dateSortie: Date | null;
                prixCession: number | null;
            } | {
                origine: "BALANCE";
                dateMiseEnService: null;
                designation: string;
                montant: number;
                dateAcquisition: null;
                dureeUtiliteAns: null;
                dateSortie: null;
                prixCession: null;
            })[];
            sortiesDeLExercice: {
                origine: "REGISTRE";
                dateMiseEnService: Date | null;
                designation: string;
                montant: number;
                dateAcquisition: Date | null;
                dureeUtiliteAns: number | null;
                dateSortie: Date | null;
                prixCession: number | null;
            }[];
            total: number;
            totalRegistre: number;
            totalCautions: number;
            motifCautions: string | null;
            ecartsGA: {
                numero: string;
                intitule: string;
                soldeBalance: number;
                valeurFiches: number;
                ecart: number;
            }[];
            fichesSansSolde: {
                designation: string;
                montant: number;
            }[];
            motifEcartsGA: string | null;
        };
        note2: {
            lignes: import("./stocks-depuis-inventaire").LigneNoteStock[];
            valeurStockFinal: number;
            valeurStockInitial: number;
            quantitesTenues: boolean;
            sourceQuantites: string | null;
            motifQuantites: string;
        };
        note3: {
            creances: {
                numero: string;
                nom: string;
                montantCloture: number;
                montantOuverture: number;
                variationValeur: number;
                variationPourcent: number | null;
                montantNonEchu: number;
                montantEchu: number;
                montantNonVentile: number;
            }[];
            totalCreances: number;
            depreciationsCreances: {
                numero: string;
                intitule: string;
                montantCloture: number;
                montantOuverture: number;
                variationValeur: number;
            }[];
            totalDepreciationsCreances: number;
            totalCreancesNettes: number;
            totalCreancesNonEchues: number;
            totalCreancesEchues: number;
            totalCreancesNonVentilees: number;
            dettes: {
                numero: string;
                nom: string;
                montantCloture: number;
                montantOuverture: number;
                variationValeur: number;
                variationPourcent: number | null;
                montantNonEchu: number;
                montantEchu: number;
                montantNonVentile: number;
            }[];
            totalDettes: number;
            totalDettesNonEchues: number;
            totalDettesEchues: number;
            totalDettesNonVentilees: number;
            echeancesTenues: boolean;
            motifEcheances: string | null;
            groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        };
        note5: {
            rubriques: {
                montant: number;
                comptes: {
                    numero: string;
                    intitule: string;
                    montant: number;
                }[];
                cle: string;
                libelle: string;
            }[];
            total: number;
            horsRubriques: {
                numero: string;
                intitule: string;
                montant: number;
            }[];
            totalHorsRubriques: number;
            totalPosteHA: number;
            motifHorsRubriques: string | null;
            membres: {
                nom: string;
                nationalite: null;
                montant: number;
                precisionDroitEntree: null;
                numero: string;
            }[];
            nationaliteTenue: boolean;
            precisionDroitEntreeTenue: boolean;
            motifColonnesNonTenues: string;
            motifMembres: string;
        };
    }>;
    eligibiliteSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        categories: {
            cle: string;
            libelle: string;
            montant: number;
            comptes: {
                numero: string;
                intitule: string;
                montant: number;
            }[];
        }[];
        totalRessources: number;
        cumulBiennal: {
            cle: string;
            libelle: string;
            exerciceCourant: number;
            exercicePrecedent: number;
            cumule: number;
        }[] | null;
        exercicePrecedent: {
            id: string;
            dateDebut: Date;
            dateFin: Date;
        } | null;
        avertissementCumul: string;
        seuilParCategorieFcfa: number;
        deviseDossier: string;
        conversionAppliquee: boolean;
        avertissement: string;
    }>;
}
