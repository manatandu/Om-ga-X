import { NaturePieceVirement, OperationVirementFonds, Referentiel, SensVirementFonds } from '@prisma/client';
export declare function estUneCaisse(numeroCompte: string): boolean;
export declare const RACINES_TRESORERIE_EN_DEVISES: Readonly<Record<Referentiel, readonly string[]>>;
export declare function estTresorerieEnDevises(numeroCompte: string, referentiel: Referentiel): boolean;
export declare function estAuCentime(montant: number): boolean;
export declare function sensDuVirement(numeroOrigine: string, numeroDestination: string): SensVirementFonds;
export declare function caisseEnJeu(sens: SensVirementFonds): boolean;
export declare const COMPTES_DE_PASSAGE: Readonly<Record<SensVirementFonds, {
    rang: number;
    intitule: string;
}>>;
export declare const COMPTE_DU_PLAN_585 = "58500000";
export declare const RACINE_585 = "585";
export declare const LIBELLES_SENS: Readonly<Record<SensVirementFonds, string>>;
export declare const LIBELLES_OPERATION: Readonly<Record<OperationVirementFonds, string>>;
export declare function deLOperation(operation: OperationVirementFonds): string;
export declare function aLOperation(operation: OperationVirementFonds): string;
export declare const LIBELLES_NATURE_PIECE: Readonly<Record<NaturePieceVirement, string>>;
export declare const NATURES_PROPOSEES: Readonly<Record<'BANQUE' | 'CAISSE', Readonly<Record<OperationVirementFonds, readonly NaturePieceVirement[]>>>>;
export declare function naturesProposees(sens: SensVirementFonds, operation: OperationVirementFonds): readonly NaturePieceVirement[];
export interface JournalDeTresorerie {
    id: string;
    code: string;
    type: string;
    estActif: boolean;
    compteTresorerie: {
        id: string;
        numero: string;
        intitule: string;
    } | null;
}
export interface PieceRecue {
    nature?: unknown;
    reference?: unknown;
    date?: unknown;
}
export interface PieceOperation {
    nature: NaturePieceVirement;
    reference: string;
    date: string;
}
export declare function estUnJour(texte: string): boolean;
export declare function estNaturePiece(v: unknown): v is NaturePieceVirement;
export declare function pieceJugee(p: PieceRecue): PieceOperation | null;
export interface DemandeVirement {
    montant: number;
    objet: string;
    sortie: PieceRecue;
    entree: PieceRecue;
    porteur: string | null | undefined;
}
export declare function motifRefusVirement(origine: JournalDeTresorerie | null, destination: JournalDeTresorerie | null, demande: DemandeVirement): string | null;
export declare function lignesDuVirement(entree: {
    compteOrigineId: string;
    compteDestinationId: string;
    comptePassageId: string;
    montant: number;
    libelle: string;
}): {
    origine: {
        compteId: string;
        debit: number;
        credit: number;
        libelle: string;
    }[];
    destination: {
        compteId: string;
        debit: number;
        credit: number;
        libelle: string;
    }[];
};
