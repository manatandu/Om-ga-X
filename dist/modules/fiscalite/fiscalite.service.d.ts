import { FormeJuridiqueSyscohada, Prisma, SensRetraitementFiscal } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { CreerRetraitementDto, ModifierDossierFiscalDto, ModifierRetraitementDto } from './dto/fiscalite.dto';
import { arrondirImpotArt150 } from './arrondi-article-150';
import { type PeriodeCreation } from './periode-creation';
export { arrondirImpotArt150 };
type RegimeImposition = 'IMPOT_SOCIETES' | 'IRPP_MICRO_ENTREPRISE' | 'IRPP_PETITE_ENTREPRISE' | 'IRPP_REGIME_REEL';
export declare const OBSERVATIONS_PHYSIQUE_PASSE_F5: {
    readonly commun: readonly ["Art. 103 : sont exonérés les revenus des terres EXCLUSIVEMENT affectées à des cultures vivrières et d'une superficie INFÉRIEURE à dix hectares · deux conditions cumulatives qu'aucune écriture ne porte. Si elles sont remplies, ni le régime ni l'impôt annoncés ici ne sont dus sur ces revenus."];
    readonly regimeReel: readonly ["Art. 89, al. 2 et 3 : les revenus de capitaux mobiliers et les loyers d'immeubles NON inscrits à l'actif du bilan ne sont pas des produits taxables de l'entreprise ; inscrits à l'actif, ils le sont pour leur montant net. Art. 90 : sont en outre déductibles les versements définitifs pour rente viagère, pension, assurance maladie ou chômage, dans la limite de 20 % des revenus professionnels imposés l'année antérieure, et les frais médicaux du redevable résident, de son épouse et de ses enfants célibataires à charge, effectivement payés et justifiés. Ces montants se portent en déduction manuelle.", "Art. 92 à 99 : les bénéfices d'une profession libérale ou non commerciale sont l'excédent des RECETTES sur les dépenses. Les provisions et avances sur honoraires EFFECTIVEMENT ENCAISSÉES sont des recettes, sauf celles qui couvrent des débours (art. 95, 1°) · en comptabilité d'engagement, elles restent au 419 et hors du résultat, et se réintègrent ici. Les fonds des clients ne restent non imposables qu'enregistrés à un compte distinct (art. 97), et aucun loyer ne se déduit pour des locaux dont le professionnel est propriétaire (art. 99, al. 3)."];
};
export declare const OBSERVATION_UNIPERSONNELLE_PASSE_F5 = "Soci\u00E9t\u00E9 unipersonnelle \u00E0 associ\u00E9 ou actionnaire unique personne physique : le Titre 2, art. 3 la soumet \u00E0 l'imp\u00F4t sur les soci\u00E9t\u00E9s \u00AB m\u00EAme unipersonnelle \u00BB, quand l'art. 63, al. 2, 1\u00B0 soumet cet associ\u00E9 personnellement \u00E0 l'IRPP, par renvoi au r\u00E9gime des soci\u00E9t\u00E9s de personnes qui n'ont pas opt\u00E9 pour l'IS. Aucune source lue n'articule les deux textes \u00B7 le calcul reste \u00E0 l'IS, et le point est \u00E0 faire trancher.";
export declare const COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE = "La nature de l'associ\u00E9 unique n'est pas d\u00E9clar\u00E9e (Param\u00E8tres du dossier, section Immatriculation, \u00AB Associ\u00E9 unique personne morale \u00BB, sous \u00AB R\u00E9gime de la liquidation \u00BB \u00B7 la r\u00E9ponse vaut hors de toute dissolution) \u00B7 l'observation ne vaut que s'il est une personne physique.";
export declare const COMPLEMENT_UNICITE_NON_DECLAREE = "L'unicit\u00E9 de l'associ\u00E9 n'est pas d\u00E9clar\u00E9e (Param\u00E8tres du dossier, section Immatriculation, \u00AB Associ\u00E9 unique \u00BB) \u00B7 l'observation ne vaut que si la soci\u00E9t\u00E9 n'a qu'un associ\u00E9 ou actionnaire, personne physique.";
export type UnipersonnaliteArticle63 = 'ASSOCIE_PERSONNE_PHYSIQUE' | 'NATURE_NON_DECLAREE' | 'UNICITE_NON_DECLAREE';
export declare function unipersonnaliteDeLArticle63(t: {
    formeJuridiqueSyscohada: FormeJuridiqueSyscohada | null;
    associeUnique?: boolean | null;
    associeUniquePersonneMorale?: boolean | null;
}): UnipersonnaliteArticle63 | null;
export declare function observationArticle63(u: UnipersonnaliteArticle63 | null): string | null;
export declare const LECTURE_CHIFFRE_AFFAIRES = "Chiffre d'affaires lu sur les comptes 701 \u00E0 707 (poste XB du compte de r\u00E9sultat), mouvements du livre-journal, rabais compris \u00B7 la loi n\u00B0 23/053 vise le chiffre d'affaires \u00AB d\u00E9clar\u00E9 \u00BB (art. 57) ou \u00AB hors taxes \u00BB (art. 43 et 49) sans le d\u00E9finir ; si celui que le dossier d\u00E9clare diff\u00E8re de ces comptes, l'imp\u00F4t minimum et les plafonds affich\u00E9s diff\u00E8rent d'autant.";
export declare function observationBilansSuccessifs(dateFin: Date): string;
export interface BilansSuccessifs {
    role: 'PREMIERE_COTISATION' | 'COTISATION_UNIQUE' | 'SECONDE_COTISATION' | 'NON_CALCULEE';
    anneeDissolution: number;
    calculable: boolean;
    motif: string | null;
    premiereCotisation: number | null;
    sourcePremiereCotisation?: 'CONSTAT' | 'COMPTE_89' | 'RECALCUL';
    totalisation: {
        periodeActivite: {
            exerciceId: string;
            dateDebut: Date;
            dateFin: Date;
            resultatFiscalAvantReport: number;
            chiffreAffaires: number;
        };
        liquidation: {
            resultatFiscalAvantReport: number;
            chiffreAffaires: number;
        };
        total: number;
        deficitDisponible: number;
        deficitImpute: number;
        resultatFiscal: number;
        chiffreAffaires: number;
        impotTheorique: number | null;
        impotMinimum: number | null;
        impotTotal: number | null;
        minimumApplique: boolean;
        acomptesImputes: number;
        dejaRegle: number | null;
        secondeCotisation: number | null;
        excedent: number;
        cotisationDeLExercice: number | null;
        tropPayePremiereCotisation: number;
        excedentAcomptes: number;
    } | null;
    observation: string;
}
export declare class FiscaliteService {
    private readonly prisma;
    private readonly ecritureService;
    constructor(prisma: PrismaService, ecritureService: EcritureService);
    catalogue(): {
        retraitements: import("./catalogue-retraitements").DefinitionRetraitement[];
        derniereVerification: string;
    };
    tenantSyscohada(tenantId: string): Promise<{
        devise: string | null;
        id: string;
        nom: string;
        referentiel: import(".prisma/client").$Enums.Referentiel;
        jeuEtatsFinanciersSycebnl: import(".prisma/client").$Enums.JeuEtatsFinanciersSycebnl;
        systemeComptableSyscohada: import(".prisma/client").$Enums.SystemeComptableSyscohada | null;
        createdAt: Date;
        activite: string | null;
        codeActivitePrincipale: string | null;
        adresse: string | null;
        ville: string | null;
        pays: string | null;
        telephone: string | null;
        email: string | null;
        siteWeb: string | null;
        capitalSocial: Prisma.Decimal | null;
        capitalVariable: boolean;
        deviseFonctionnelle: string | null;
        numeroImpot: string | null;
        idNat: string | null;
        rccm: string | null;
        numeroDeclarationActivite: string | null;
        locataireGerantFonds: boolean | null;
        numeroRegistreCooperatives: string | null;
        varianteCooperative: import(".prisma/client").$Enums.VarianteCooperative | null;
        modeAdministrationSa: import(".prisma/client").$Enums.ModeAdministrationSa | null;
        associeUnique: boolean | null;
        entreprisePortefeuilleEtat: boolean | null;
        dateDissolution: Date | null;
        liquidateurs: string | null;
        dateNominationLiquidateur: Date | null;
        regimeLiquidation: import(".prisma/client").$Enums.RegimeLiquidation | null;
        associeUniquePersonneMorale: boolean | null;
        dateClotureLiquidation: Date | null;
        dateDeclarationCotisationActivite: Date | null;
        dateDeclarationCotisationLiquidation: Date | null;
        portefeuilleSecteurMinier: boolean | null;
        quotePartEtatCapital: Prisma.Decimal | null;
        sourceQuotePartEtat: string | null;
        formeJuridiqueSyscohadaAnterieure: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        dateTransformationForme: Date | null;
        actePersonnaliteJuridique: string | null;
        dateActePersonnalite: Date | null;
        numeroEnregistrementSecteur: string | null;
        certificatEnregistrementPlan: string | null;
        attestationExemptionIs: string | null;
        dateAttestationExemptionIs: Date | null;
        formeJuridique: import(".prisma/client").$Enums.FormeJuridiqueEbnl;
        formeJuridiqueSyscohada: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        droitEtranger: boolean;
        estDemonstration: boolean;
        conditionsLicenceVersion: number | null;
        conditionsLicenceAccepteesLe: Date | null;
        conditionsLicenceAccepteesPar: string | null;
        conditionsLicenceEmpreinte: string | null;
        conditionsLicenceCommande: Prisma.JsonValue | null;
        longueurCompte: number;
        methodeCotisations: import(".prisma/client").$Enums.MethodeCotisations | null;
        methodeInventaireStocks: import(".prisma/client").$Enums.MethodeInventaireStocks | null;
        methodeDepreciationBienSubventionne: import(".prisma/client").$Enums.MethodeDepreciationBienSubventionne | null;
        doubleRegardValidation: boolean;
        refusClotureJournalNonImprime: boolean;
        creationCompteEnSaisie: boolean;
        seuilEcartReglement: Prisma.Decimal | null;
        assujettiTva: boolean;
        assujettissementTvaRepondu: boolean;
        venteBiensServices: boolean | null;
        modulesActives: import(".prisma/client").$Enums.ModuleOptionnel[];
        dateOptionTva: Date | null;
        regimeExigibiliteTva: import(".prisma/client").$Enums.RegimeExigibiliteTva;
        dateAutorisationDebitsTva: Date | null;
        effectifPermanent: number;
        numeroAffiliationCnssEmployeur: string | null;
        plafondCellules: number | null;
        dossierMereId: string | null;
        dossierCombinaisonId: string | null;
    }>;
    exemptionIs(tenantId: string): Promise<{
        fondement: import("./exemption-is-ebnl").FondementExemptionIs;
        enonce: string;
        attestationRequise: boolean | null;
        attestationConnue: boolean;
        dateAttestationConnue: boolean;
        exemptionAffirmable: boolean;
        avertissements: string[];
        formeJuridique: import(".prisma/client").$Enums.FormeJuridiqueEbnl;
        droitEtranger: boolean;
    }>;
    private exerciceDuDossier;
    static suiviAcomptes(entree: {
        acomptesDus: boolean;
        declares: number;
        comptabilises: number;
        impotDu: number | null;
    }): {
        declares: number;
        comptabilises: number;
        ecart: number;
        excedent: number | null;
        observations: string[];
    } | null;
    static reintegrationsImpot(retraitements: {
        code: string;
        sens: SensRetraitementFiscal;
        montant: unknown;
    }[]): number;
    static observationImpotNonReintegre(impotConstateAu89: number, reintegrations: number): string | null;
    static observationDegrevement(degrevementsAu899: number): string | null;
    private lireBalance;
    propositionsRetraitements(tenantId: string, exerciceId: string): Promise<{
        propositions: {
            compteId: string;
            numero: string;
            intitule: string;
            code: string;
            sens: import(".prisma/client").$Enums.SensRetraitementFiscal;
            libelle: string;
            source: string;
            mouvement: number;
            plafondEnonce: string | null;
            montantAdmis: number | null;
            mouvementNature: number | null;
            montantAdmisNature: number | null;
            montant: number;
        }[];
        avertissements: {
            compteId: string;
            numero: string;
            intitule: string;
            code: string;
            libelle: string;
            source: string;
            mouvement: number;
            motif: string;
        }[];
        chiffreAffaires: number;
    }>;
    private droitADeductionOuvert;
    private conditionPlafondPourEcran;
    private enonceConditionFermee;
    private repartirExcedentPlafonne;
    static debutPeriodeImposable(exercice: {
        dateDebut: Date;
    }, periode: PeriodeCreation | null): Date;
    private avertissementsPerimetreLoi;
    private resultatFiscalBrut;
    private deficitsAnterieursCalcules;
    static originesDeclarees(brut: unknown, montantSaisi: number): {
        dateFin: Date;
        montant: number;
    }[] | null;
    private baseAvantReport;
    private lirePeriodeCreation;
    private trancheSelonChiffreAffaires;
    private regimePhysiqueSelonHistorique;
    private observationsRegimePhysique;
    private chiffresAffairesAnterieurs;
    private regimeSelonForme;
    private avertissementsReportDeficitaire;
    private observationsCalendrierPaiement;
    resultatFiscal(tenantId: string, exerciceId: string): Promise<{
        acomptesVerses: number;
        soldeAPayer: number | null;
        impotTotalExercice: number | null;
        suiviAcomptes: {
            declares: number;
            comptabilises: number;
            ecart: number;
            excedent: number | null;
            observations: string[];
        } | null;
        supplementsAdministration: number;
        baseAcomptes: number | null;
        bilansSuccessifs: BilansSuccessifs | null;
        acomptesProchainExercice: ({
            montant: number;
            quotite: 0.3;
            echeance: "25 juillet";
        } | {
            montant: number;
            quotite: 0.3;
            echeance: "25 septembre";
        } | {
            montant: number;
            quotite: 0.2;
            echeance: "25 novembre";
        })[];
        quotitesPetiteEntreprise: {
            rang: 1 | 2;
            quotite: 0.6 | 0.4;
            echeance: "30 avril" | "31 janvier";
            source: "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 2" | "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 3";
            reserve: string | null;
            montant: number;
        }[];
        impotTheorique: number | null;
        impotMinimum: number | null;
        impotDu: number | null;
        baseImpot: string;
        minimumApplique: boolean;
        explication: string;
        exerciceId: string;
        dateDebut: Date;
        dateFin: Date;
        derniereVerification: string;
        formeJuridiqueSyscohada: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        devise: string;
        regime: RegimeImposition;
        observations: string[];
        definitif: boolean;
        brouillard: {
            ecritures: number;
            effetSurResultat: number;
            effetSurChiffreAffaires: number;
        };
        simulationAvantLaLoi: boolean;
        natureActivite: import(".prisma/client").$Enums.NatureActiviteFiscale | null;
        resultatComptable: number;
        sourceResultat: "CLASSES_6_7_8" | "COMPTE_13";
        chiffreAffaires: number;
        chiffreAffairesMinimum: number;
        retraitements: {
            id: string;
            code: string;
            sens: import(".prisma/client").$Enums.SensRetraitementFiscal;
            libelle: string;
            montant: number;
            commentaire: string | null;
            source: string | null;
        }[];
        totalReintegrations: number;
        totalDeductions: number;
        impotConstateAu89: number;
        degrevementsAu899: number;
        impotExerciceAu89: number;
        reintegrationsImpot: number;
        acomptesAu4492: number;
        resultatFiscalBrut: number;
        deficitAnterieur: {
            montant: number;
            saisi: boolean;
            montantSaisi: number | null;
            detail: import("./report-deficitaire").DeficitReportable[];
            origines: {
                dateFin: string;
                montant: number;
            }[] | null;
        };
        periodeCreation: {
            dateDebut: Date;
            dateFin: Date;
            sousLaLoi: boolean;
            source: "LIVRE_JOURNAL" | "DECLARE";
            resultatComptable: number;
            chiffreAffaires: number;
            chiffreAffairesLu: number;
            sourceChiffreAffaires: "LIVRE_JOURNAL" | "DECLARE";
            resultatFiscal: number;
            deduction: number;
            impotTheorique: number | null;
            impotMinimum: number | null;
            impotDu: number | null;
            minimumApplique: boolean;
            explication: string;
            ecartDeclaration: number | null;
            impotNeutralise: number;
            supplements: number;
            baseAcomptesExercice: number | null;
            acomptesExercice: ({
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 juillet";
            } | {
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 septembre";
            } | {
                annee: number;
                montant: number;
                quotite: 0.2;
                echeance: "25 novembre";
            })[];
        } | null;
        deductionPeriodeCreation: number;
        deficitImpute: number;
        resultatFiscal: number;
        plafonds: {
            code: string;
            enonce: string;
            assiette: import("./catalogue-retraitements").AssiettePlafond;
            part: number;
            montantAdmis: number | null;
            conditionOuverte: boolean | null;
        }[];
    }>;
    private bilansSuccessifsDe;
    private calculerImpot;
    ajouterRetraitement(tenantId: string, exerciceId: string, dto: CreerRetraitementDto): Promise<{
        acomptesVerses: number;
        soldeAPayer: number | null;
        impotTotalExercice: number | null;
        suiviAcomptes: {
            declares: number;
            comptabilises: number;
            ecart: number;
            excedent: number | null;
            observations: string[];
        } | null;
        supplementsAdministration: number;
        baseAcomptes: number | null;
        bilansSuccessifs: BilansSuccessifs | null;
        acomptesProchainExercice: ({
            montant: number;
            quotite: 0.3;
            echeance: "25 juillet";
        } | {
            montant: number;
            quotite: 0.3;
            echeance: "25 septembre";
        } | {
            montant: number;
            quotite: 0.2;
            echeance: "25 novembre";
        })[];
        quotitesPetiteEntreprise: {
            rang: 1 | 2;
            quotite: 0.6 | 0.4;
            echeance: "30 avril" | "31 janvier";
            source: "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 2" | "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 3";
            reserve: string | null;
            montant: number;
        }[];
        impotTheorique: number | null;
        impotMinimum: number | null;
        impotDu: number | null;
        baseImpot: string;
        minimumApplique: boolean;
        explication: string;
        exerciceId: string;
        dateDebut: Date;
        dateFin: Date;
        derniereVerification: string;
        formeJuridiqueSyscohada: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        devise: string;
        regime: RegimeImposition;
        observations: string[];
        definitif: boolean;
        brouillard: {
            ecritures: number;
            effetSurResultat: number;
            effetSurChiffreAffaires: number;
        };
        simulationAvantLaLoi: boolean;
        natureActivite: import(".prisma/client").$Enums.NatureActiviteFiscale | null;
        resultatComptable: number;
        sourceResultat: "CLASSES_6_7_8" | "COMPTE_13";
        chiffreAffaires: number;
        chiffreAffairesMinimum: number;
        retraitements: {
            id: string;
            code: string;
            sens: import(".prisma/client").$Enums.SensRetraitementFiscal;
            libelle: string;
            montant: number;
            commentaire: string | null;
            source: string | null;
        }[];
        totalReintegrations: number;
        totalDeductions: number;
        impotConstateAu89: number;
        degrevementsAu899: number;
        impotExerciceAu89: number;
        reintegrationsImpot: number;
        acomptesAu4492: number;
        resultatFiscalBrut: number;
        deficitAnterieur: {
            montant: number;
            saisi: boolean;
            montantSaisi: number | null;
            detail: import("./report-deficitaire").DeficitReportable[];
            origines: {
                dateFin: string;
                montant: number;
            }[] | null;
        };
        periodeCreation: {
            dateDebut: Date;
            dateFin: Date;
            sousLaLoi: boolean;
            source: "LIVRE_JOURNAL" | "DECLARE";
            resultatComptable: number;
            chiffreAffaires: number;
            chiffreAffairesLu: number;
            sourceChiffreAffaires: "LIVRE_JOURNAL" | "DECLARE";
            resultatFiscal: number;
            deduction: number;
            impotTheorique: number | null;
            impotMinimum: number | null;
            impotDu: number | null;
            minimumApplique: boolean;
            explication: string;
            ecartDeclaration: number | null;
            impotNeutralise: number;
            supplements: number;
            baseAcomptesExercice: number | null;
            acomptesExercice: ({
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 juillet";
            } | {
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 septembre";
            } | {
                annee: number;
                montant: number;
                quotite: 0.2;
                echeance: "25 novembre";
            })[];
        } | null;
        deductionPeriodeCreation: number;
        deficitImpute: number;
        resultatFiscal: number;
        plafonds: {
            code: string;
            enonce: string;
            assiette: import("./catalogue-retraitements").AssiettePlafond;
            part: number;
            montantAdmis: number | null;
            conditionOuverte: boolean | null;
        }[];
    }>;
    modifierRetraitement(tenantId: string, id: string, dto: ModifierRetraitementDto): Promise<{
        acomptesVerses: number;
        soldeAPayer: number | null;
        impotTotalExercice: number | null;
        suiviAcomptes: {
            declares: number;
            comptabilises: number;
            ecart: number;
            excedent: number | null;
            observations: string[];
        } | null;
        supplementsAdministration: number;
        baseAcomptes: number | null;
        bilansSuccessifs: BilansSuccessifs | null;
        acomptesProchainExercice: ({
            montant: number;
            quotite: 0.3;
            echeance: "25 juillet";
        } | {
            montant: number;
            quotite: 0.3;
            echeance: "25 septembre";
        } | {
            montant: number;
            quotite: 0.2;
            echeance: "25 novembre";
        })[];
        quotitesPetiteEntreprise: {
            rang: 1 | 2;
            quotite: 0.6 | 0.4;
            echeance: "30 avril" | "31 janvier";
            source: "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 2" | "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 3";
            reserve: string | null;
            montant: number;
        }[];
        impotTheorique: number | null;
        impotMinimum: number | null;
        impotDu: number | null;
        baseImpot: string;
        minimumApplique: boolean;
        explication: string;
        exerciceId: string;
        dateDebut: Date;
        dateFin: Date;
        derniereVerification: string;
        formeJuridiqueSyscohada: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        devise: string;
        regime: RegimeImposition;
        observations: string[];
        definitif: boolean;
        brouillard: {
            ecritures: number;
            effetSurResultat: number;
            effetSurChiffreAffaires: number;
        };
        simulationAvantLaLoi: boolean;
        natureActivite: import(".prisma/client").$Enums.NatureActiviteFiscale | null;
        resultatComptable: number;
        sourceResultat: "CLASSES_6_7_8" | "COMPTE_13";
        chiffreAffaires: number;
        chiffreAffairesMinimum: number;
        retraitements: {
            id: string;
            code: string;
            sens: import(".prisma/client").$Enums.SensRetraitementFiscal;
            libelle: string;
            montant: number;
            commentaire: string | null;
            source: string | null;
        }[];
        totalReintegrations: number;
        totalDeductions: number;
        impotConstateAu89: number;
        degrevementsAu899: number;
        impotExerciceAu89: number;
        reintegrationsImpot: number;
        acomptesAu4492: number;
        resultatFiscalBrut: number;
        deficitAnterieur: {
            montant: number;
            saisi: boolean;
            montantSaisi: number | null;
            detail: import("./report-deficitaire").DeficitReportable[];
            origines: {
                dateFin: string;
                montant: number;
            }[] | null;
        };
        periodeCreation: {
            dateDebut: Date;
            dateFin: Date;
            sousLaLoi: boolean;
            source: "LIVRE_JOURNAL" | "DECLARE";
            resultatComptable: number;
            chiffreAffaires: number;
            chiffreAffairesLu: number;
            sourceChiffreAffaires: "LIVRE_JOURNAL" | "DECLARE";
            resultatFiscal: number;
            deduction: number;
            impotTheorique: number | null;
            impotMinimum: number | null;
            impotDu: number | null;
            minimumApplique: boolean;
            explication: string;
            ecartDeclaration: number | null;
            impotNeutralise: number;
            supplements: number;
            baseAcomptesExercice: number | null;
            acomptesExercice: ({
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 juillet";
            } | {
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 septembre";
            } | {
                annee: number;
                montant: number;
                quotite: 0.2;
                echeance: "25 novembre";
            })[];
        } | null;
        deductionPeriodeCreation: number;
        deficitImpute: number;
        resultatFiscal: number;
        plafonds: {
            code: string;
            enonce: string;
            assiette: import("./catalogue-retraitements").AssiettePlafond;
            part: number;
            montantAdmis: number | null;
            conditionOuverte: boolean | null;
        }[];
    }>;
    supprimerRetraitement(tenantId: string, id: string): Promise<{
        acomptesVerses: number;
        soldeAPayer: number | null;
        impotTotalExercice: number | null;
        suiviAcomptes: {
            declares: number;
            comptabilises: number;
            ecart: number;
            excedent: number | null;
            observations: string[];
        } | null;
        supplementsAdministration: number;
        baseAcomptes: number | null;
        bilansSuccessifs: BilansSuccessifs | null;
        acomptesProchainExercice: ({
            montant: number;
            quotite: 0.3;
            echeance: "25 juillet";
        } | {
            montant: number;
            quotite: 0.3;
            echeance: "25 septembre";
        } | {
            montant: number;
            quotite: 0.2;
            echeance: "25 novembre";
        })[];
        quotitesPetiteEntreprise: {
            rang: 1 | 2;
            quotite: 0.6 | 0.4;
            echeance: "30 avril" | "31 janvier";
            source: "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 2" | "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 3";
            reserve: string | null;
            montant: number;
        }[];
        impotTheorique: number | null;
        impotMinimum: number | null;
        impotDu: number | null;
        baseImpot: string;
        minimumApplique: boolean;
        explication: string;
        exerciceId: string;
        dateDebut: Date;
        dateFin: Date;
        derniereVerification: string;
        formeJuridiqueSyscohada: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        devise: string;
        regime: RegimeImposition;
        observations: string[];
        definitif: boolean;
        brouillard: {
            ecritures: number;
            effetSurResultat: number;
            effetSurChiffreAffaires: number;
        };
        simulationAvantLaLoi: boolean;
        natureActivite: import(".prisma/client").$Enums.NatureActiviteFiscale | null;
        resultatComptable: number;
        sourceResultat: "CLASSES_6_7_8" | "COMPTE_13";
        chiffreAffaires: number;
        chiffreAffairesMinimum: number;
        retraitements: {
            id: string;
            code: string;
            sens: import(".prisma/client").$Enums.SensRetraitementFiscal;
            libelle: string;
            montant: number;
            commentaire: string | null;
            source: string | null;
        }[];
        totalReintegrations: number;
        totalDeductions: number;
        impotConstateAu89: number;
        degrevementsAu899: number;
        impotExerciceAu89: number;
        reintegrationsImpot: number;
        acomptesAu4492: number;
        resultatFiscalBrut: number;
        deficitAnterieur: {
            montant: number;
            saisi: boolean;
            montantSaisi: number | null;
            detail: import("./report-deficitaire").DeficitReportable[];
            origines: {
                dateFin: string;
                montant: number;
            }[] | null;
        };
        periodeCreation: {
            dateDebut: Date;
            dateFin: Date;
            sousLaLoi: boolean;
            source: "LIVRE_JOURNAL" | "DECLARE";
            resultatComptable: number;
            chiffreAffaires: number;
            chiffreAffairesLu: number;
            sourceChiffreAffaires: "LIVRE_JOURNAL" | "DECLARE";
            resultatFiscal: number;
            deduction: number;
            impotTheorique: number | null;
            impotMinimum: number | null;
            impotDu: number | null;
            minimumApplique: boolean;
            explication: string;
            ecartDeclaration: number | null;
            impotNeutralise: number;
            supplements: number;
            baseAcomptesExercice: number | null;
            acomptesExercice: ({
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 juillet";
            } | {
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 septembre";
            } | {
                annee: number;
                montant: number;
                quotite: 0.2;
                echeance: "25 novembre";
            })[];
        } | null;
        deductionPeriodeCreation: number;
        deficitImpute: number;
        resultatFiscal: number;
        plafonds: {
            code: string;
            enonce: string;
            assiette: import("./catalogue-retraitements").AssiettePlafond;
            part: number;
            montantAdmis: number | null;
            conditionOuverte: boolean | null;
        }[];
    }>;
    modifierDossier(tenantId: string, exerciceId: string, dto: ModifierDossierFiscalDto): Promise<{
        acomptesVerses: number;
        soldeAPayer: number | null;
        impotTotalExercice: number | null;
        suiviAcomptes: {
            declares: number;
            comptabilises: number;
            ecart: number;
            excedent: number | null;
            observations: string[];
        } | null;
        supplementsAdministration: number;
        baseAcomptes: number | null;
        bilansSuccessifs: BilansSuccessifs | null;
        acomptesProchainExercice: ({
            montant: number;
            quotite: 0.3;
            echeance: "25 juillet";
        } | {
            montant: number;
            quotite: 0.3;
            echeance: "25 septembre";
        } | {
            montant: number;
            quotite: 0.2;
            echeance: "25 novembre";
        })[];
        quotitesPetiteEntreprise: {
            rang: 1 | 2;
            quotite: 0.6 | 0.4;
            echeance: "30 avril" | "31 janvier";
            source: "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 2" | "Loi de procédures fiscales, art. 57, al. 3 et art. 57 quater, al. 3";
            reserve: string | null;
            montant: number;
        }[];
        impotTheorique: number | null;
        impotMinimum: number | null;
        impotDu: number | null;
        baseImpot: string;
        minimumApplique: boolean;
        explication: string;
        exerciceId: string;
        dateDebut: Date;
        dateFin: Date;
        derniereVerification: string;
        formeJuridiqueSyscohada: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        devise: string;
        regime: RegimeImposition;
        observations: string[];
        definitif: boolean;
        brouillard: {
            ecritures: number;
            effetSurResultat: number;
            effetSurChiffreAffaires: number;
        };
        simulationAvantLaLoi: boolean;
        natureActivite: import(".prisma/client").$Enums.NatureActiviteFiscale | null;
        resultatComptable: number;
        sourceResultat: "CLASSES_6_7_8" | "COMPTE_13";
        chiffreAffaires: number;
        chiffreAffairesMinimum: number;
        retraitements: {
            id: string;
            code: string;
            sens: import(".prisma/client").$Enums.SensRetraitementFiscal;
            libelle: string;
            montant: number;
            commentaire: string | null;
            source: string | null;
        }[];
        totalReintegrations: number;
        totalDeductions: number;
        impotConstateAu89: number;
        degrevementsAu899: number;
        impotExerciceAu89: number;
        reintegrationsImpot: number;
        acomptesAu4492: number;
        resultatFiscalBrut: number;
        deficitAnterieur: {
            montant: number;
            saisi: boolean;
            montantSaisi: number | null;
            detail: import("./report-deficitaire").DeficitReportable[];
            origines: {
                dateFin: string;
                montant: number;
            }[] | null;
        };
        periodeCreation: {
            dateDebut: Date;
            dateFin: Date;
            sousLaLoi: boolean;
            source: "LIVRE_JOURNAL" | "DECLARE";
            resultatComptable: number;
            chiffreAffaires: number;
            chiffreAffairesLu: number;
            sourceChiffreAffaires: "LIVRE_JOURNAL" | "DECLARE";
            resultatFiscal: number;
            deduction: number;
            impotTheorique: number | null;
            impotMinimum: number | null;
            impotDu: number | null;
            minimumApplique: boolean;
            explication: string;
            ecartDeclaration: number | null;
            impotNeutralise: number;
            supplements: number;
            baseAcomptesExercice: number | null;
            acomptesExercice: ({
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 juillet";
            } | {
                annee: number;
                montant: number;
                quotite: 0.3;
                echeance: "25 septembre";
            } | {
                annee: number;
                montant: number;
                quotite: 0.2;
                echeance: "25 novembre";
            })[];
        } | null;
        deductionPeriodeCreation: number;
        deficitImpute: number;
        resultatFiscal: number;
        plafonds: {
            code: string;
            enonce: string;
            assiette: import("./catalogue-retraitements").AssiettePlafond;
            part: number;
            montantAdmis: number | null;
            conditionOuverte: boolean | null;
        }[];
    }>;
}
