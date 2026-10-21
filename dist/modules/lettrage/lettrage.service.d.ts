import { PrismaService } from '../../common/prisma.service';
import { OrigineLettrage, Prisma, StatutLettrage } from '@prisma/client';
export declare const MOTIF_DELETTRAGE_MODULE: (code: string) => string;
export declare function prochaineLettreDuCompte(tx: Prisma.TransactionClient, tenantId: string, compteId: string): Promise<() => string>;
export declare function poserGroupeSoldeDuModule(tx: Prisma.TransactionClient, p: {
    tenantId: string;
    compteId: string;
    ligneIds: string[];
    userId: string;
    code: string;
}): Promise<string | null>;
export declare function estRelettrageDeCloture(lignes: Array<{
    aRelettrerDepuis?: Date | null;
    ecriture: {
        estANouveauProvisoire: boolean;
        estGenereeParCloture?: boolean;
        estSoldeDesComptesDeGestion?: boolean;
    };
}>): boolean;
export declare function motifLettrageANouveauProvisoire(): string;
export declare const PLAFOND_LIGNES_LETTRAGE = 5000;
export declare const MOTIF_LETTRAGE_SITUATION: string;
export declare class LettrageService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private trouverCompte;
    private trouverCompteLettrable;
    lister(tenantId: string, compteId: string, nonLettreesSeulement?: boolean): Promise<{
        tronque: boolean;
        total: number;
        plafond: number;
        totaux: {
            debit: number;
            credit: number;
        };
        prochaineLettre: string;
        compte: {
            id: string;
            numero: string;
            intitule: string;
            lettrable: boolean;
        };
        lignes: {
            id: string;
            date: Date;
            journalCode: string;
            libelle: string;
            reference: string | null;
            debit: number;
            credit: number;
            lettre: string | null;
            lettrageId: string | null;
            codeLettrage: string | null;
            devise: string | null;
            montantDevise: number | null;
        }[];
        lettrages: {
            id: string;
            code: string;
            statut: import(".prisma/client").$Enums.StatutLettrage;
            solde: number;
            origine: import(".prisma/client").$Enums.OrigineLettrage;
            verrouille: boolean;
            ecartChange: number | null;
            createdAt: Date;
            createdBy: string;
            soldeAt: Date | null;
        }[];
    }>;
    listerGroupesDuDossier(tenantId: string, statut?: StatutLettrage): Promise<{
        id: string;
        compteId: string;
        compteNumero: string;
        compteIntitule: string;
        code: string;
        statut: import(".prisma/client").$Enums.StatutLettrage;
        solde: number;
        origine: import(".prisma/client").$Enums.OrigineLettrage;
        verrouille: boolean;
        ecartChange: number | null;
        nombreLignes: number;
        createdAt: Date;
        createdBy: string;
        soldeAt: Date | null;
    }[]>;
    private prochaineLettre;
    private refuserLettreEmployee;
    private lettresDuLot;
    static ecartCumule(dejaRealise: number | null, auDenouement: number | null, soldeNul: boolean): number | null;
    private ecartChangeRealise;
    private creerGroupe;
    private verifierLignes;
    lettrerManuel(tenantId: string, compteId: string, ligneIds: string[], userId: string, options?: {
        autoriserPartiel?: boolean;
        ecartChangeRealise?: number;
        lettre?: string | null;
    }): Promise<{
        lettre: string;
        statut: import(".prisma/client").$Enums.StatutLettrage;
        solde: number;
        ecartChange: number | null;
        nombreLignes: number;
    }>;
    completer(tenantId: string, lettrageId: string, ligneIds: string[], options?: {
        groupeTolere?: string | null;
        ecartChangeRealise?: number;
        borne?: {
            soldeAttendu: number;
            sensDesFactures: 'DEBIT' | 'CREDIT';
            deviseId?: string | null;
        };
    }): Promise<{
        lettre: string;
        statut: "SOLDE" | "PARTIEL";
        solde: number;
        nombreLignes: number;
    }>;
    propositionEcartChange(tenantId: string, lettrageId: string, compteId?: string): Promise<{
        ecart: null;
        motif: string;
        lettrageId: string;
        code: string;
        compteId: string;
        compteNumero: string;
    } | {
        aCheval: boolean;
        fige: boolean;
        ecart: number;
        sens: "PERTE" | "GAIN";
        devise: string | null;
        deviseId: string;
        date: Date;
        exerciceId: string;
        nature: import("../reglements/ecart-change-realise").NatureCreanceDette | null;
        comptePrescrit: {
            id: string;
            numero: string;
            intitule: string;
        } | null;
        numeroPrescrit: string | null;
        motif: string | null;
        lettrageId: string;
        code: string;
        compteId: string;
        compteNumero: string;
    }>;
    verrouiller(tenantId: string, lettrageId: string, verrouille: boolean): Promise<{
        code: string;
        verrouille: boolean;
    }>;
    delettrer(tenantId: string, compteId: string, lettre: string): Promise<{
        lettre: string;
        nombreLignes: number;
    }>;
    private trouverSousEnsemble;
    private sommesAtteignables;
    private trouverPartitionGenerale;
    private apparierParReference;
    private calculerPropositions;
    private apparierParExercice;
    private apparier;
    preLettrage(tenantId: string, compteId: string): Promise<{
        relettrages: {
            ligne: {
                ligneId: string;
                date: string;
                libelle: string;
                debit: number;
                credit: number;
            };
            candidates: {
                ligneId: string;
                date: string;
                libelle: string;
                debit: number;
                credit: number;
            }[];
        }[];
        reconductions: {
            lettrageId: string;
            code: string;
            reste: number;
            etat: import("./reconduction-lettrage").EtatNonReconduit;
            detail: string;
            lignes: {
                ligneId: string;
                date: string;
                libelle: string;
                debit: number;
                credit: number;
            }[];
        }[];
        reconductionsTotal: number;
        reconductionsTronque: boolean;
        propositions: {
            origine: import(".prisma/client").$Enums.OrigineLettrage;
            ligneIds: string[];
            lignes: {
                ligneId: string;
                date: string;
                libelle: string;
                reference: string;
                debit: number;
                credit: number;
            }[];
            montant: number;
            solde: number;
        }[];
        nonProposees: number;
        ecarteesReclassement: number;
        passesParMontantSuspendues: boolean;
        miseDeCote: string | null;
        avertissement: string;
    }>;
    confirmerPreLettrage(tenantId: string, compteId: string, userId: string, groupes: Array<{
        ligneIds: string[];
        origine: OrigineLettrage;
    }>): Promise<{
        groupes: number;
        lettres: string[];
    }>;
    reconduire(tenantId: string, compteId: string, lettrageId: string, userId: string): Promise<{
        lettre: string;
        reconduitDe: string;
        reste: number;
    }>;
    lettrageAutomatique(tenantId: string, compteId: string, userId: string): Promise<{
        ecarteesReclassement: number;
        passesParMontantSuspendues: boolean;
        miseDeCote: string | null;
        groupes: number;
        parPiece: number;
        parMontant: number;
        lettres: string[];
    }>;
    lettrerLignesDuModule(tenantId: string, compteId: string, ligneIds: string[], userId: string): Promise<{
        code: string;
    } | {
        motif: string;
    }>;
    lettrerLignesDuModuleDansTx(tx: Prisma.TransactionClient, tenantId: string, compteId: string, ligneIds: string[], userId: string): Promise<{
        code: string;
    } | {
        motif: string;
        nonLettrable?: true;
    }>;
    private poserGroupeDuModule;
    defaireLettrageDuModule(tx: Prisma.TransactionClient, tenantId: string, lettrageId: string): Promise<void>;
}
