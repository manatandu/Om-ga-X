import { PeriodiciteFacturationEditeur, TypeFormuleAbonnement } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { FacturationService } from '../../facturation/facturation.service';
import { PlateformeService } from '../plateforme.service';
import { CourrielsEditeurService } from './courriels-editeur.service';
export declare const LOT_ABONNEMENTS_A_FACTURER = 500;
export declare const FORMULES_INITIALES: {
    code: string;
    libelle: string;
    type: TypeFormuleAbonnement;
    contenu: string;
}[];
export interface DemandeAbonnement {
    cabinetId: string;
    formuleCode: string;
    options: string[];
    dossiersSupplementaires: number;
    periodicite: PeriodiciteFacturationEditeur;
    debut: string;
    essai: boolean;
    tiersId: string;
}
export declare class AbonnementsService {
    private readonly prisma;
    private readonly facturation;
    private readonly plateforme;
    private readonly courriels?;
    constructor(prisma: PrismaService, facturation: FacturationService, plateforme: PlateformeService, courriels?: CourrielsEditeurService | undefined);
    formules(): Promise<{
        prixMensuelUsd: number | null;
        prixAnnuelUsd: number | null;
        id: string;
        type: import(".prisma/client").$Enums.TypeFormuleAbonnement;
        libelle: string;
        code: string;
        actif: boolean;
        contenu: string | null;
    }[]>;
    fixerPrix(code: string, prixMensuelUsd: number | null, prixAnnuelUsd: number | null): Promise<{
        prixMensuelUsd: number | null;
        prixAnnuelUsd: number | null;
        id: string;
        type: import(".prisma/client").$Enums.TypeFormuleAbonnement;
        libelle: string;
        code: string;
        actif: boolean;
        contenu: string | null;
    }[]>;
    private dossierEditeur;
    lister(): Promise<{
        total: number;
        tronque: boolean;
        plafond: number;
        abonnements: {
            id: string;
            cabinetId: string;
            cabinet: string;
            formule: {
                libelle: string;
                code: string;
            };
            options: {
                libelle: string;
                code: string;
            }[];
            dossiersSupplementaires: number;
            periodicite: import(".prisma/client").$Enums.PeriodiciteFacturationEditeur;
            debut: string | null;
            finEssai: string | null;
            tiers: string;
            actif: boolean;
            echeanceLicence: string | null;
            licenceSuspendue: boolean;
            factures: {
                id: string;
                periode: string;
                montantUsd: number;
                numero: string;
                emiseLe: string | null;
                payeeLe: string | null;
                joursImpayee: number | null;
            }[];
        }[];
    }>;
    enregistrer(d: DemandeAbonnement): Promise<{
        id: string;
    }>;
    marquerPayee(factureAbonnementId: string, payeeLe: string): Promise<{
        echeanceLicence: string;
    }>;
    activer(id: string, actif: boolean): Promise<{
        id: string;
        actif: boolean;
    }>;
    facturer(operateurTenantId: string, periode: string, dateFacture: string, tauxTvaId: string | null, envoi?: {
        userId: string;
    } | null): Promise<{
        periode: string;
        cours: number;
        assujetti: boolean;
        resultats: {
            cabinet: string;
            statut: "FACTURE" | "DEJA_FACTURE" | "NON_DU";
            motif?: string;
            numero?: string;
            totalUsd?: number;
            courriel?: string;
        }[];
    }>;
}
