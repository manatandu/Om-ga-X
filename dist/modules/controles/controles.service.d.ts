import { PrismaService } from '../../common/prisma.service';
import { ClasseCompte } from '@prisma/client';
import { type RegleAuditeur } from './regles-auditeur';
import { EcritureService } from '../comptabilite/ecriture.service';
import { EtatsFinanciersSyscohadaService } from '../etats-financiers-syscohada/etats-financiers-syscohada.service';
export declare const SEUIL_BILAN_AUDITEUR = 100000000;
export declare const SEUIL_RESSOURCES_AUDITEUR = 200000000;
export declare const SEUIL_EFFECTIF_AUDITEUR = 20;
export interface CritereAuditeur {
    critere: string;
    valeur: number;
    seuil: number;
    mesure: boolean;
    franchi: boolean;
    detail: string;
}
export type Gravite = 'BLOQUANT' | 'AVERTISSEMENT' | 'INFORMATION';
export interface AnomalieControle {
    code: string;
    gravite: Gravite;
    libelle: string;
    consequence: string;
    action: string;
    occurrences: {
        reference: string;
        detail: string;
        montant?: number;
        date?: string;
    }[];
    nombre?: number;
}
export interface RapportControles {
    exerciceId: string;
    genereLe: string;
    anomalies: AnomalieControle[];
    totaux: {
        bloquants: number;
        avertissements: number;
        informations: number;
    };
}
export interface JourneeCaisse {
    date: string;
    mouvementDebit: number;
    mouvementCredit: number;
    soldeFinJournee: number;
    negatif: boolean;
}
export interface ControleCaisse {
    compteId: string;
    numero: string;
    intitule: string;
    journal: string | null;
    soldeFinal: number;
    premierJourNegatif: string | null;
    nombreJoursNegatifs: number;
    journees: JourneeCaisse[];
}
export declare const RACINES_RESERVE_PROPRIETE: readonly {
    racine: string;
    intitule: string;
}[];
export declare class ControlesService {
    private readonly prisma;
    private readonly ecritureService?;
    private readonly etatsSyscohada?;
    private static readonly JOURS_ANCIENNETE_TIERS;
    constructor(prisma: PrismaService, ecritureService?: EcritureService | undefined, etatsSyscohada?: EtatsFinanciersSyscohadaService | undefined);
    private exercice;
    private impayesAdherentReclasses;
    controleCaisse(tenantId: string, exerciceId: string): Promise<ControleCaisse[]>;
    controleMonnaieElectronique(tenantId: string, exerciceId: string): Promise<ControleCaisse[]>;
    private soldesJourParJour;
    evolutionMensuelle(tenantId: string, exerciceId: string, options?: {
        classe?: ClasseCompte;
        inclureBrouillard?: boolean;
    }): Promise<{
        exerciceId: string;
        mois: {
            cle: string;
            libelle: string;
        }[];
        comptes: {
            compteId: string;
            numero: string;
            intitule: string;
            classe: import(".prisma/client").$Enums.ClasseCompte;
            report: number;
            valeurs: number[];
            cumul: number;
            soldeFinal: number;
            moisAberrant: null;
        }[];
        classe: import(".prisma/client").$Enums.ClasseCompte | null;
        totaux: number[] | null;
    }>;
    comptesDormants(tenantId: string, moisSansMouvement?: number): Promise<{
        compteId: string;
        numero: string;
        intitule: string;
        classe: import(".prisma/client").$Enums.ClasseCompte;
        estActif: boolean;
        dernierMouvement: string | null;
        nombreEcritures: number;
        solde: number;
        jamaisMouvemente: boolean;
    }[]>;
    seuilsAuditeur(tenantId: string, exerciceId: string, effectifPermanent: number): Promise<{
        criteres: CritereAuditeur[];
        franchis: CritereAuditeur[];
        nonCompares: CritereAuditeur[];
        obligationDeclenchee: boolean;
        obligationIndeterminee: boolean;
        obligationSansSeuil: boolean;
        regle: RegleAuditeur;
        conversionAppliquee: boolean;
        source: string | null;
    }>;
    private controlesBanqueEtClotureInformatique;
    private parcourirEcrituresControlees;
    analyser(tenantId: string, exerciceId: string): Promise<RapportControles>;
}
