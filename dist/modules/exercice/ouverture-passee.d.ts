import { Prisma } from '@prisma/client';
export declare function filtreOuverturePasseeAuPremierJour(tenantId: string, exercice: {
    id: string;
    dateDebut: Date;
}): Prisma.EcritureWhereInput;
export interface EcritureDuPremierJour {
    id: string;
    reevaluationContrePassationDeclaree?: {
        annuleeLe: Date | null;
        ecritureEcarts: {
            lignes: Array<{
                compteId: string;
                debit: unknown;
                credit: unknown;
                compte: {
                    numero: string;
                };
            }>;
        } | null;
    } | null;
}
export declare function lignesDeContrePassationDeclaree(ecritures: readonly EcritureDuPremierJour[]): Map<string, Set<string>>;
export interface NegatifTardif {
    piece: string;
    date: Date;
}
export interface EcritureDuPerimetreDatee {
    numeroPiece: number | null;
    journal: {
        code: string;
    };
    date?: Date | null;
    dateValeur?: Date | null;
    corrigeEcritureId?: string | null;
}
export declare function negatifsTardifs(ecritures: readonly EcritureDuPerimetreDatee[], premierJour: Date): NegatifTardif[];
export declare function negatifsTardifsLisibles(tardifs: readonly NegatifTardif[]): string;
export type LecteurOuverturePassee = Pick<Prisma.TransactionClient, 'ecriture' | 'ligneEcriture'>;
export declare const PLAFOND_LIGNES_JUGEMENT_OUVERTURE = 50000;
export interface OuverturePasseeNonNulle {
    nombre: number;
    pieces: string[];
}
export type PositionDOuverturePassee = {
    etat: 'AUCUNE';
} | {
    etat: 'NULLE';
    negatifsTardifs: NegatifTardif[];
} | ({
    etat: 'NON_NULLE';
} & OuverturePasseeNonNulle);
export declare function ouverturePasseeNonNulle(db: LecteurOuverturePassee, tenantId: string, exercice: {
    id: string;
    dateDebut: Date;
}, options: {
    validees: boolean;
}): Promise<OuverturePasseeNonNulle | null>;
export declare function positionDOuverturePassee(db: LecteurOuverturePassee, tenantId: string, exercice: {
    id: string;
    dateDebut: Date;
}, options: {
    validees: boolean;
}): Promise<PositionDOuverturePassee>;
