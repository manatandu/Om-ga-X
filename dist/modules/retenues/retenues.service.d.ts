import { PrismaService } from '../../common/prisma.service';
import { SignalementDeductibilite } from './correspondance-retenues';
import { PartInppOnem } from './inpp-trimestriel';
export declare const PV_A_CONFIRMER_SANS_MANDAT = "\u00E0 confirmer \u00B7 mandat de commissaire non enregistr\u00E9";
export declare const PV_A_CONFIRMER_SANS_FORME = "\u00E0 confirmer \u00B7 forme et mandat de commissaire non renseign\u00E9s";
export declare const AVERTISSEMENT_PV_SANS_COMMISSAIRE: string;
export declare class RetenuesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private dateDeRattachement;
    private soldesDOuverture;
    private echeanceDuMois;
    private prochaineEcheance;
    private prochaineEcheanceDeclarative;
    registre(tenantId: string, params: {
        exerciceId: string;
        dateReference?: string;
        sansVentilationDOuverture?: boolean;
    }): Promise<{
        dateReference: Date;
        derniereVerificationEcheances: string;
        natures: {
            cle: string;
            libelle: string;
            beneficiaire: "ETAT" | "PROVINCE" | "ORGANISME_SOCIAL";
            echeance: string;
            baseLegale: string;
            imprime: string | null;
            reserve: string | null;
            contenu: string | null;
            sourceDonnees: string | null;
            comptes: {
                numero: string;
                intitule: string;
                retenu: number;
                reverse: number;
            }[];
            mois: {
                mois: string;
                part: PartInppOnem | null;
                anterieur: boolean;
                retenu: number;
                reverse: number;
                reverseEcritures: number;
                solde: number;
                echeance: Date;
                enRetard: boolean;
            }[];
            retenu: number;
            reverse: number;
            soldeOuverture: number;
            solde: number;
            moisEnRetard: number;
            retenuEchuNonReverse: number;
            reverseNonImpute: number;
            derniereEcheanceEchue: Date | null;
            chargeSousConditionArticle20: string | null;
            prochaineEcheance: Date;
            mentionOuvertureNonVentilee: string | null;
            reserveImputation: string | null;
            mentionNonVentilee: string | null;
            mention4428: string | null;
            retardIndetermine: boolean;
        }[];
        totalRetenu: number;
        totalReverse: number;
        totalDu: number;
        comptesNonRattaches: {
            numero: string;
            intitule: string;
        }[];
        referentiel: import(".prisma/client").$Enums.Referentiel;
        formeJuridiqueSyscohada: import(".prisma/client").$Enums.FormeJuridiqueSyscohada | null;
        venteBiensServices: boolean | null;
        signalementsDeductibilite: SignalementDeductibilite[];
        avertissements: string[];
    }>;
    private ouvertureVentileeInpp;
    echeancierFiscal(tenantId: string, params: {
        exerciceId: string;
        dateReference?: string;
    }): Promise<{
        dateReference: Date;
        derniereVerificationEcheances: string;
        echeances: ({
            cle: string;
            libelle: string;
            genre: "REVERSEMENT";
            periodicite: "MENSUELLE" | "TRIMESTRIELLE";
            beneficiaire: "ETAT" | "PROVINCE" | "ORGANISME_SOCIAL";
            date: Date;
            echeance: string;
            baseLegale: string;
            imprime: string | null;
            reserve: string | null;
            montantDu: number;
            moisEnRetard: number;
            contenu: string | null;
            sanction: string | null;
            sourceDonnees: string | null;
        } | {
            cle: string;
            libelle: string;
            genre: "DECLARATION";
            periodicite: "MENSUELLE" | "ANNUELLE" | "TRIMESTRIELLE";
            beneficiaire: "ETAT";
            date: Date;
            echeance: string;
            baseLegale: string;
            reserve: string | null;
            montantDu: number;
            moisEnRetard: number;
            imprime: string | null;
            contenu: string;
            sanction: string | null;
            sourceDonnees: string | null;
        } | {
            cle: string;
            libelle: string;
            genre: "DECLARATION";
            periodicite: "PONCTUELLE";
            beneficiaire: "ETAT";
            date: Date;
            echeance: string;
            baseLegale: string;
            reserve: string | null;
            montantDu: number;
            moisEnRetard: number;
            imprime: string | null;
            contenu: string | null;
            sanction: string | null;
            sourceDonnees: string | null;
        })[];
        totalDu: number;
        avertissements: string[];
    }>;
}
