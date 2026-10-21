export type FondementImputation = 'DECLAREE' | 'LEGALE';
export interface DetteImputable {
    id: string;
    dateFacture: Date;
    dateEcheance: Date | null;
    montant: number;
}
export interface PaiementImputable {
    id: string;
    date: Date;
    montant: number;
}
export interface ImputationDeclaree {
    paiementId: string;
    detteId: string;
    montant: number;
}
export interface PartImputee {
    paiementId: string;
    date: Date;
    montant: number;
    fondement: FondementImputation;
}
export interface ResultatImputation {
    parDette: Map<string, PartImputee[]>;
    nonImpute: Array<{
        paiementId: string;
        montant: number;
    }>;
    declareesRamenees: Array<{
        paiementId: string;
        detteId: string;
        declare: number;
        retenu: number;
    }>;
}
export declare function estEchue(dette: DetteImputable, au: Date): boolean;
export interface LigneDeTiersLue {
    id: string;
    compteId: string;
    numero: string;
    sens: number;
    validee: boolean;
    lettrageId: string | null;
    date?: Date | null;
    aNouveau?: boolean;
    exerciceClos?: boolean;
}
export declare function motifPaiementExerciceClos(date: Date | null | undefined): string;
export declare function motifReportDePaiement(origine: string | null): string;
export declare function motifGroupeLuEnBloc(motif: string): string;
export declare function motifRefusDeclaration(e: {
    reglement: LigneDeTiersLue | null;
    factures: Array<{
        ligne: LigneDeTiersLue | null;
        idDemande: string;
        montant: number;
        dejaDeclare: number;
        consommePar?: string[];
    }>;
    dejaActive: boolean;
    pieceReference: string;
    fondement: 'DECLARATION_DU_DEBITEUR' | 'QUITTANCE_ACCEPTEE';
    pieceDate: Date | null;
    preuveAcceptation?: string | null;
    origineDuReport?: string | null;
    motifEnBloc?: string | null;
}): string | null;
export declare function imputerPaiements(dettes: readonly DetteImputable[], paiements: readonly PaiementImputable[], declarees?: readonly ImputationDeclaree[]): ResultatImputation;
