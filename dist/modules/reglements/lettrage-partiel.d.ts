import { Prisma, StatutLettrage } from '@prisma/client';
import { type LigneDeGroupe, type OrigineDeLigne, type ResteDeFacture } from '../lettrage/reconduction-lettrage';
import type { FactureEnDevise } from './ecart-change-realise';
import type { SensReglement } from './reglement-tiers';
export interface GroupePourReglement {
    id: string;
    code: string;
    statut: StatutLettrage;
    verrouille: boolean;
    compteId: string;
    lettrageReconduitId?: string | null;
    solde?: Prisma.Decimal | number;
    compte: {
        numero: string;
    };
    lignes: Array<{
        id: string;
        compteId: string;
        debit: Prisma.Decimal | number;
        credit: Prisma.Decimal | number;
        dateEcheance: Date | null;
        deviseId: string | null;
        montantDevise: Prisma.Decimal | number | null;
        libelle: string | null;
        ecriture: {
            exerciceId: string;
            date: Date;
            libelle: string;
        };
    }>;
}
export interface GroupesLus {
    groupes: Map<string, GroupePourReglement>;
    origines: Map<string, OrigineDeLigne>;
}
export declare function groupesDesLignes(db: unknown, tenantId: string, lettrageIds: string[]): Promise<GroupesLus>;
export declare function lignesDuGroupe(g: GroupePourReglement, origines: Map<string, OrigineDeLigne>): LigneDeGroupe[];
export declare function restesDuGroupe(g: GroupePourReglement, sens: SensReglement, origines?: Map<string, OrigineDeLigne>): Map<string, ResteDeFacture>;
export declare function factureEncoreDue(r: ResteDeFacture): boolean;
export declare function fileDuGroupeEnDevise(g: GroupePourReglement, sens: SensReglement, origines: Map<string, OrigineDeLigne>, deviseId: string): FactureEnDevise[] | null;
export declare function motifLigneDuGroupe(numero: string, g: GroupePourReglement | undefined, exerciceId: string): string | null;
export declare function motifDeuxGroupes(numero: string, codes: string[]): string | null;
export declare function motifRefusMontantDuGroupe(numero: string, montant: number, du: number, code: string, regle: number, enDevise?: boolean): string | null;
export interface EcheanceDUnGroupe {
    ligneId: string;
    groupe: {
        id: string;
        code: string;
    };
    reste: ResteDeFacture;
}
export declare function echeancesDesGroupesPartiels(db: unknown, p: {
    tenantId: string;
    exerciceId: string;
    sens: SensReglement;
}): Promise<EcheanceDUnGroupe[]>;
export declare function motifDeviseIndeterminee(numero: string, code: string): string;
export declare function avertissementImputationDuGroupe(e: {
    numero: string;
    groupe: GroupePourReglement;
    origines: Map<string, OrigineDeLigne>;
    sens: SensReglement;
    choisies: string[];
    date: Date;
    montant: number;
    deviseId: string | null;
}): string | null;
