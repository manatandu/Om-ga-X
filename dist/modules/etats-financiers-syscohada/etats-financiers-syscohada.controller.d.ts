import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EtatsFinanciersSyscohadaService } from './etats-financiers-syscohada.service';
import { EtatsFinanciersSmtSyscohadaService } from './etats-financiers-smt-syscohada.service';
import { NoteAnnexeService } from '../notes-annexes/note-annexe.service';
export declare class EtatsFinanciersSyscohadaController {
    private readonly etatsFinanciersSyscohadaService;
    private readonly etatsFinanciersSmtSyscohadaService;
    private readonly noteAnnexeService;
    constructor(etatsFinanciersSyscohadaService: EtatsFinanciersSyscohadaService, etatsFinanciersSmtSyscohadaService: EtatsFinanciersSmtSyscohadaService, noteAnnexeService: NoteAnnexeService);
    bilan(user: AuthenticatedUser, exerciceId: string, arreteAu?: string): Promise<import("./etats-financiers-syscohada.service").BilanSyscohada>;
    compteDeResultat(user: AuthenticatedUser, exerciceId: string, arreteAu?: string): Promise<import("./etats-financiers-syscohada.service").CompteResultatSyscohada>;
    tableauFluxTresorerie(user: AuthenticatedUser, exerciceId: string, arreteAu?: string): Promise<import("./etats-financiers-syscohada.service").TableauFluxTresorerieSyscohada>;
    notes(user: AuthenticatedUser, exerciceId: string): Promise<{
        notes: import("../notes-annexes/note-annexe.types").NoteCalculee[];
        exerciceN1Disponible: boolean;
        rattachementsSansRubrique: import("../notes-annexes/note-annexe.service").RattachementSansRubrique[];
        groupesLusLigneALigne: import("../lettrage/reste-des-lignes-ouvertes").GroupesLusLigneALigne;
        ficheRecapitulative: {
            code: string;
            titre: string;
            applicable: boolean;
            rubriquesEnAttente: import("../notes-annexes/note-annexe.types").RubriqueEnAttente[];
        }[];
        couverture: {
            transcrites: number;
            attendues: number;
        };
    }>;
    bilanSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        actif: import("./etats-financiers-smt-syscohada.service").PosteCalculeSmtSyscohada[];
        passif: import("./etats-financiers-smt-syscohada.service").PosteCalculeSmtSyscohada[];
        totalActif: number;
        totalPassif: number;
        totalActifN1: number | undefined;
        totalPassifN1: number | undefined;
        exerciceN1Disponible: boolean;
        comparatif: import("../etats-financiers/etats-financiers.communs").ProvenanceComparatif | null;
        mentionComparatif: string | null;
        equilibre: boolean;
        comptesNonRattaches: import("../etats-financiers/etats-financiers.communs").CompteDuPoste[];
        renvoiImmobilisations: string;
        controle: {
            resultatClasses678: number;
            resultatCompte13: number;
            resultatAnterieurNonAffecte: number;
        };
        resultatAnterieurNonVire: import("../etats-financiers/resultat-de-l-exercice").ResultatAnterieurNonVire | null;
        resultatAnterieurNonVireN1: import("../etats-financiers/resultat-de-l-exercice").ResultatAnterieurNonVire | null;
        resultatEnInstance: number | null;
    }>;
    compteDeResultatSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        lignes: {
            montantN1: number | undefined;
            ref: string;
            libelle: string;
            note: string | null;
            montant: number;
            comptes: import("../etats-financiers/etats-financiers.communs").CompteDuPoste[];
            estTotal?: boolean;
            lettre?: "A" | "B" | "C" | "D" | "E" | "F" | "G";
            signeOfficiel?: 1 | -1;
        }[];
        recettes: import("./etats-financiers-smt-syscohada.service").PosteCalculeSmtSyscohada[];
        totalRecettes: number;
        depenses: import("./etats-financiers-smt-syscohada.service").PosteCalculeSmtSyscohada[];
        totalDepenses: number;
        soldeCaisse: number;
        retraitements: import("./etats-financiers-smt-syscohada.service").PosteCalculeSmtSyscohada[];
        lettres: {
            D: number;
            E: number;
            F: number;
        };
        lettresDE: {
            readonly D: readonly ["SV1", "SV2"];
            readonly E: readonly ["SV3"];
        };
        definitionVariation: "N1_MOINS_N";
        resultatExercice: number;
        exerciceN1Disponible: boolean;
        motifComparatifAbsent: string | null;
        fluxHorsResultat: {
            cle: string;
            intitule: string;
            montant: number;
            comptes: import("../etats-financiers/etats-financiers.communs").CompteDuPoste[];
        }[];
        contrepartiesNonRattachees: import("../etats-financiers/etats-financiers.communs").CompteDuPoste[];
        reglementsNonRattaches: import("../etats-financiers/reglements-de-tresorerie").ReglementNonRattache[];
        controle: {
            resultatBilan: number;
            ecart: number;
            concordant: boolean;
            composantesEcart: {
                classe1: number;
                classe2: number;
                depreciationsTresorerie: number;
                autresComptes: number;
                dotations: number;
                total: number;
            };
            residuel: number;
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
            rajoutAutorise: boolean;
        }[];
        colonnesDepenses: {
            cle: string;
            libelle: string;
            rajoutAutorise: boolean;
        }[];
        nb: string;
    }>;
    notesSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        fiche: {
            documents: readonly ["BILAN", "COMPTE_DE_RESULTAT", "NOTES_ANNEXES"];
            notes: import("./correspondance-smt-syscohada").NoteSmtSyscohada[];
            journauxDeSuivi: readonly [{
                readonly cle: "creancesImpayees";
                readonly intitule: "Journal de suivi des créances impayées SMT";
                readonly colonnes: readonly ["Date", "N° facture", "Nom du client", "Montant", "Date paiement"];
            }, {
                readonly cle: "dettesAPayer";
                readonly intitule: "Journal de suivi des dettes à payer SMT";
                readonly colonnes: readonly ["Date", "N° facture", "Nom du fournisseur", "Montant", "Date paiement"];
            }];
            inventaireExtraComptable: readonly ["le montant des créances et des dettes d'exploitation, dans le cas où les ventes et les achats ne sont pas totalement réglés", "le montant des stocks (produits finis, matières premières, consommables...) et des travaux en cours", "le montant des immobilisations acquises ou cédées au cours de l'exercice", "le montant des emprunts souscrits ou remboursés au cours de l'exercice"];
            amortissement: {
                readonly mode: "LINEAIRE";
                readonly prorataTemporis: false;
            };
        };
        note1: {
            lignes: ({
                origine: "REGISTRE";
                date: Date | null;
                designation: string;
                montant: number;
                dateSortie: Date | null;
                prixCession: number | null;
            } | {
                origine: "BALANCE";
                date: null;
                designation: string;
                montant: number;
                dateSortie: null;
                prixCession: null;
            })[];
            sortiesDeLExercice: {
                origine: "REGISTRE";
                date: Date | null;
                designation: string;
                montant: number;
                dateSortie: Date | null;
                prixCession: number | null;
            }[];
            total: number;
            totalRegistre: number;
            totalCautions: number;
            amortissement: {
                readonly mode: "LINEAIRE";
                readonly prorataTemporis: false;
            };
            motifCautions: string;
            ecartsImmobilisations: {
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
            motifEcartsImmobilisations: string | null;
        };
        note2: {
            lignes: import("../etats-financiers/stocks-depuis-inventaire").LigneNoteStock[];
            lignesSynthese: readonly ["VALEUR DU STOCK FINAL", "VALEUR DU STOCK INITIAL"];
            valeurStockFinal: number;
            valeurStockInitial: number;
            variationSv1: number;
            quantitesTenues: boolean;
            sourceQuantites: string | null;
            motifQuantites: string;
        };
        note3: {
            creances: {
                date: null;
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
            totalCreancesNonEchues: number;
            totalCreancesEchues: number;
            totalCreancesNonVentilees: number;
            dettes: {
                date: null;
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
            variationSv2: number;
            variationSv3: number;
            reserveVariationPourcent: string;
        };
        journauxDeSuivi: {
            journaux: {
                cle: "creancesImpayees" | "dettesAPayer";
                intitule: "Journal de suivi des créances impayées SMT" | "Journal de suivi des dettes à payer SMT";
                colonnes: ("Date" | "Montant" | "N° facture" | "Nom du client" | "Date paiement" | "Nom du fournisseur")[];
                lignes: {
                    date: Date;
                    numeroFacture: string | null;
                    nom: string;
                    montant: number;
                    datePaiement: Date | null;
                    paiementPartiel: boolean;
                }[];
            }[];
            limite: string;
        };
        etatsDesGaranties: import("./etats-garanties-smt").EtatsDesGarantiesDus | null;
    }>;
    eligibiliteSmt(user: AuthenticatedUser, exerciceId: string): Promise<{
        exercice: {
            dateDebut: Date;
            dateFin: Date;
        };
        chiffreAffaires: number;
        ventilation: {
            ref: string;
            libelle: string;
            lettre: "A" | "B" | "D" | "C" | undefined;
            montant: number;
            comptes: {
                numero: string;
                intitule: string;
                montant: number;
            }[];
        }[];
        comptesHorsVentilation: import("../etats-financiers/etats-financiers.communs").CompteDuPoste[];
        deviseDossier: string;
        systemeActuel: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        conversionAppliquee: boolean;
        seuils: {
            clause: string;
            cle: "negoce" | "artisanat" | "services";
            categorie: string;
            montantFcfa: number;
        }[];
        qualificationParLEntite: string;
        rappelArticle11: string;
        avertissementConversion: string;
    }>;
}
