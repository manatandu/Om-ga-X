import { Prisma } from '@prisma/client';
export interface LigneDeGroupe {
    id: string;
    debit: number;
    credit: number;
    deviseId: string | null;
    montantDevise: number | null;
    date: Date;
    cle?: string;
    dateEcheance?: Date | null;
}
export type SensDesFactures = 'DEBIT' | 'CREDIT';
export interface ResteDeFacture {
    francs: number;
    devise: number | null;
    regle: number;
    deviseIndeterminee: boolean;
}
export declare function restesDesFactures(lignes: LigneDeGroupe[], sens: SensDesFactures): Map<string, ResteDeFacture>;
export interface ResteSelonLaLoi {
    francs: number;
    devise: number | null;
}
export declare function restesParLImputationLegale(lignes: LigneDeGroupe[], sens: SensDesFactures): Map<string, ResteSelonLaLoi>;
export interface LigneLueDuGroupe {
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
}
export interface GroupePartielLu {
    id: string;
    code: string;
    compteId: string;
    ecartChange: Prisma.Decimal | number | null;
    compte: {
        numero: string;
        intitule: string;
    };
    lignes: LigneLueDuGroupe[];
}
export declare const LOT_GROUPES = 500;
export declare const OPERATIONS_PAR_GROUPE_RECONDUIT = 8;
export declare const OPERATIONS_DE_BASE_CLOTURE = 40;
export declare function operationsDeLaCloture(groupesPartiels: number): number;
export declare function parcourirGroupesPartiels(db: unknown, p: {
    tenantId: string;
    exerciceId: string;
    compteId?: string;
}, traiter: (groupes: GroupePartielLu[]) => Promise<void>): Promise<void>;
export declare function resteDuGroupe(g: {
    lignes: Array<{
        debit: Prisma.Decimal | number;
        credit: Prisma.Decimal | number;
    }>;
}): number;
export interface LigneDAccueil {
    id: string;
    compteId: string;
    debit: number;
    credit: number;
    dateEcheance: Date | null;
    deviseId: string | null;
    montantDevise: number | null;
    libelle: string | null;
}
export declare function libelleDuReport(compteNumero: string, l: {
    libelle: string | null;
    ecriture: {
        libelle: string;
    };
}): string;
export declare function apparierAuReport(lignes: Array<LigneLueDuGroupe & {
    compteNumero: string;
}>, candidates: LigneDAccueil[], dejaPrises?: ReadonlySet<string>): (string | null)[];
export interface GroupeAOrdonner {
    id: string;
    lettrageReconduitId?: string | null;
    compte: {
        numero: string;
    };
    lignes: LigneLueDuGroupe[];
}
export declare const SELECT_ORIGINE: {
    id: true;
    lettrageReconduitId: true;
    compte: {
        select: {
            numero: true;
        };
    };
    lignes: {
        select: {
            id: true;
            compteId: true;
            debit: true;
            credit: true;
            dateEcheance: true;
            deviseId: true;
            montantDevise: true;
            libelle: true;
            ecriture: {
                select: {
                    exerciceId: true;
                    date: true;
                    libelle: true;
                };
            };
        };
    };
};
export interface OrigineDeLigne {
    date: Date;
    id: string;
}
export declare function originesDesLignes(db: unknown, tenantId: string, groupes: GroupeAOrdonner[]): Promise<Map<string, OrigineDeLigne>>;
export declare function datesDOrigine(db: unknown, tenantId: string, groupes: GroupeAOrdonner[]): Promise<Map<string, Date>>;
export interface IssueReconduction {
    groupeN: {
        id: string;
        code: string;
        compte: string;
        reste: number;
    };
    codeReconduit: string | null;
    motif: string | null;
}
type Ecrivain = Pick<Prisma.TransactionClient, 'lettrage' | 'ligneEcriture'>;
export declare function poserGroupeReconduit(tx: Ecrivain, p: {
    tenantId: string;
    groupe: Pick<GroupePartielLu, 'id' | 'code' | 'compteId' | 'ecartChange'>;
    accueil: string[];
    userId: string;
    code: string;
}): Promise<{
    code: string | null;
    motif: string | null;
}>;
export declare function resteLisible(reste: number): string;
export declare function messagesDeReconduction(issues: IssueReconduction[], plafond?: number): string[];
export declare function groupesQueLaClotureReconduira(db: unknown, p: {
    tenantId: string;
    exerciceId: string;
}, plafond?: number): Promise<{
    total: number;
    groupes: Array<{
        code: string;
        compte: string;
        reste: number;
    }>;
}>;
export declare function annonceDeReconduction(r: {
    total: number;
    groupes: Array<{
        code: string;
        compte: string;
        reste: number;
    }>;
}, options?: {
    ouvertureDejaPassee?: boolean;
}): string | null;
export type EtatNonReconduit = 'A_RECONDUIRE' | 'LETTREES_AILLEURS' | 'INTROUVABLES';
export interface GroupeNonReconduit {
    lettrageId: string;
    code: string;
    compteId: string;
    compteNumero: string;
    reste: number;
    exerciceDebut: Date;
    exerciceSuivantDebut: Date;
    etat: EtatNonReconduit;
    accueil: (string | null)[];
    lettresAilleurs: string[];
    ecartChange: number | null;
}
export declare const PLAFOND_NON_RECONDUITS = 200;
export declare function groupesNonReconduits(db: unknown, p: {
    tenantId: string;
    compteId?: string;
    exerciceSuivantId?: string;
    plafond?: number;
}): Promise<{
    groupes: GroupeNonReconduit[];
    total: number;
    tronque: boolean;
}>;
export declare function detailNonReconduit(g: GroupeNonReconduit): string;
export {};
