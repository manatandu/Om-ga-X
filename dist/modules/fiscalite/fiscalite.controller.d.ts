import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { FiscaliteService } from './fiscalite.service';
import { AnnulerConstatImpotDto, CreerRetraitementDto, ModifierDossierFiscalDto, ModifierRetraitementDto, PasserConstatImpotDto } from './dto/fiscalite.dto';
import { ConstatImpotService } from './constat-impot.service';
export declare class FiscaliteController {
    private readonly fiscalite;
    private readonly constats;
    constructor(fiscalite: FiscaliteService, constats: ConstatImpotService);
    exemptionIs(user: AuthenticatedUser): Promise<{
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
    catalogue(): {
        retraitements: import("./catalogue-retraitements").DefinitionRetraitement[];
        derniereVerification: string;
    };
    propositions(user: AuthenticatedUser, exerciceId: string): Promise<{
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
    resultatFiscal(user: AuthenticatedUser, exerciceId: string): Promise<{
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
        bilansSuccessifs: import("./fiscalite.service").BilansSuccessifs | null;
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
        regime: "IMPOT_SOCIETES" | "IRPP_MICRO_ENTREPRISE" | "IRPP_PETITE_ENTREPRISE" | "IRPP_REGIME_REEL";
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
    ajouterRetraitement(user: AuthenticatedUser, exerciceId: string, dto: CreerRetraitementDto): Promise<{
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
        bilansSuccessifs: import("./fiscalite.service").BilansSuccessifs | null;
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
        regime: "IMPOT_SOCIETES" | "IRPP_MICRO_ENTREPRISE" | "IRPP_PETITE_ENTREPRISE" | "IRPP_REGIME_REEL";
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
    modifierRetraitement(user: AuthenticatedUser, id: string, dto: ModifierRetraitementDto): Promise<{
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
        bilansSuccessifs: import("./fiscalite.service").BilansSuccessifs | null;
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
        regime: "IMPOT_SOCIETES" | "IRPP_MICRO_ENTREPRISE" | "IRPP_PETITE_ENTREPRISE" | "IRPP_REGIME_REEL";
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
    supprimerRetraitement(user: AuthenticatedUser, id: string): Promise<{
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
        bilansSuccessifs: import("./fiscalite.service").BilansSuccessifs | null;
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
        regime: "IMPOT_SOCIETES" | "IRPP_MICRO_ENTREPRISE" | "IRPP_PETITE_ENTREPRISE" | "IRPP_REGIME_REEL";
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
    ecritureImpot(user: AuthenticatedUser, exerciceId: string): Promise<{
        exerciceId: string;
        constat: {
            id: string;
            montantImpot: number;
            minimumApplique: boolean;
            montantImpute: number;
            attestationRegime: string | null;
            compteCharge: string;
            ecriture: {
                id: string;
                statut: import(".prisma/client").$Enums.StatutEcriture;
                date: Date;
                numeroPiece: number | null;
            } | null;
            createdAt: Date;
            impotRecalcule: number | null;
            ecartAvecCalcul: number | null;
            tropPayeLiquidation: number;
            tropPayeRecalcule: number | null;
        };
        proposition: null;
        motifsRefus: string[];
        annulees: number;
    } | {
        exerciceId: string;
        constat: null;
        proposition: {
            impot: number;
            minimumApplique: boolean;
            explication: string;
            date: Date;
            tropPaye: number;
            lignes: import("./ecriture-impot-resultat").LigneProposee[];
            imputation: {
                acomptesDeclares: number;
                solde4492: number;
                montant: number;
                motifRefus: string | null;
                lignes: import("./ecriture-impot-resultat").LigneProposee[];
            };
            conditionADeclarer: string | null;
            longueurMinAttestation: number;
        } | null;
        motifsRefus: string[];
        annulees: number;
    }>;
    passerEcritureImpot(user: AuthenticatedUser, exerciceId: string, dto: PasserConstatImpotDto): Promise<{
        constat: {
            id: string;
            montantImpot: number;
            montantImpute: number;
            tropPayeLiquidation: number;
        };
        ecriture: {
            id: string;
            numeroPiece: number | null;
        };
        journal: {
            code: string;
            repli: string | null;
        };
    }>;
    annulerEcritureImpot(user: AuthenticatedUser, exerciceId: string, dto: AnnulerConstatImpotDto): Promise<{
        annule: boolean;
        annulation: Record<string, unknown>;
    }>;
    modifierDossier(user: AuthenticatedUser, exerciceId: string, dto: ModifierDossierFiscalDto): Promise<{
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
        bilansSuccessifs: import("./fiscalite.service").BilansSuccessifs | null;
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
        regime: "IMPOT_SOCIETES" | "IRPP_MICRO_ENTREPRISE" | "IRPP_PETITE_ENTREPRISE" | "IRPP_REGIME_REEL";
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
