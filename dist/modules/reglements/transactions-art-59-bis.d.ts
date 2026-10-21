import { Prisma } from '@prisma/client';
export declare function estDAnouveau(e: {
    estANouveauProvisoire?: boolean;
    estGenereeParCloture?: boolean;
    estSoldeDesComptesDeGestion?: boolean;
}): boolean;
export interface LigneReglee {
    id: string;
    ecritureId: string;
    compteId: string;
    debit: Prisma.Decimal | number;
    credit: Prisma.Decimal | number;
    libelle: string | null;
    dateEcheance: Date | null;
    compte: {
        numero: string;
    };
    ecriture: {
        date: Date;
        numeroPiece: number | null;
        libelle: string;
        estANouveauProvisoire?: boolean;
        estGenereeParCloture?: boolean;
        estSoldeDesComptesDeGestion?: boolean;
    };
}
export interface TransactionReglee {
    cle: string;
    reference: string;
    ligne: number;
    piece: number;
    origineRetrouvee: boolean;
}
export interface FactureNommee {
    reference: string;
    montant: number;
}
export declare function classerTransactions(transactions: Iterable<TransactionReglee>, seuil: number): {
    jugees: FactureNommee[];
    sousCondition: FactureNommee[];
    nonJugees: FactureNommee[];
};
type Lecteur = Pick<Prisma.TransactionClient, 'exercice' | 'ligneEcriture'>;
export declare function transactionsDesLignes(prisma: Lecteur, p: {
    tenantId: string;
    exerciceId: string;
    lignes: readonly LigneReglee[];
}): Promise<Map<string, TransactionReglee>>;
export {};
