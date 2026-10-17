import { Prisma, StatutEcriture } from '@prisma/client';
import { type OrigineDeLigne, type ResteSelonLaLoi } from './reconduction-lettrage';
export interface LigneOuverte {
    id: string;
    debit: Prisma.Decimal | number;
    credit: Prisma.Decimal | number;
    lettrageId: string | null;
    dateEcheance: Date | null;
    deviseId: string | null;
    montantDevise: Prisma.Decimal | number | null;
    ecriture: {
        date: Date;
    };
}
export interface PoidsDesLignes {
    poids: Map<string, number>;
    nonRepartis: string[];
    motifs: Map<string, MotifGroupeNomme>;
    enBloc: Map<string, {
        ligneId: string;
        net: number;
    }>;
}
export type MotifGroupeNomme = 'NEGATIF_SANS_ORIGINE' | 'IMPUTATION_DECLAREE_NON_LUE' | 'DEVISE_SOLDEE_ECART_NON_PASSE' | 'DEVISE_REGLEE_EN_PARTIE' | 'RESTE_NON_REPARTI' | 'A_NOUVEAU_SANS_ORIGINE';
export declare function poidsOuMontant(p: PoidsDesLignes, l: {
    id: string;
    debit: Prisma.Decimal | number;
    credit: Prisma.Decimal | number;
}): number;
export interface PartDeclaree {
    ligneFactureId: string;
    montant: number;
}
export declare function poidsDesLignesOuvertes(lignes: readonly LigneOuverte[], origines?: ReadonlyMap<string, OrigineDeLigne>, exclus?: ReadonlySet<string>, declarations?: ReadonlyMap<string, ReadonlyArray<PartDeclaree>>): PoidsDesLignes;
export declare function factureOuverteLaPlusAncienne(membres: readonly LigneOuverte[], origines: ReadonlyMap<string, OrigineDeLigne>, net: number, restes?: ReadonlyMap<string, ResteSelonLaLoi>): string;
export declare const PLAFOND_GROUPES_NOMMES = 20;
export interface GroupesLusLigneALigne {
    total: number;
    groupes: Array<{
        code: string;
        compte: string;
        motif: MotifGroupeNomme;
    }>;
    tronque: boolean;
}
export declare function groupesLusLigneALigne(db: unknown, tenantId: string, motifs: ReadonlyMap<string, MotifGroupeNomme>): Promise<GroupesLusLigneALigne>;
export declare function groupesLusLigneALigneParCompte(db: unknown, tenantId: string, motifs: ReadonlyMap<string, MotifGroupeNomme>): Promise<Map<string, GroupesLusLigneALigne>>;
export interface BorneDeLEtat {
    dateMax?: Date;
    statut?: StatutEcriture;
}
export declare function poidsDesLignesLues(db: unknown, tenantId: string, lignes: readonly LigneOuverte[], borne: BorneDeLEtat, etat: string): Promise<PoidsDesLignes>;
export declare function groupesLusAPlusieurs(db: unknown, where: Prisma.LigneEcritureWhereInput): Promise<Set<string>>;
export declare function ecartsDesGroupesParEcheance(db: unknown, tenantId: string, ouvertes: Prisma.LigneEcritureWhereInput, dateFin: Date, etat: string): Promise<{
    ecarts: Map<string, {
        nonEchu: number;
        echu: number;
    }>;
    nommes: Map<string, MotifGroupeNomme>;
}>;
