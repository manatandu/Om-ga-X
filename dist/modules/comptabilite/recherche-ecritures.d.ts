import { Prisma } from '@prisma/client';
export interface CriteresRecherche {
    recherche?: string;
    compte?: string;
    montantMin?: number;
    montantMax?: number;
    numeroPiece?: number;
    reference?: string;
}
export declare function lireCriteres(q: {
    compte?: string;
    montant?: string;
    montantMax?: string;
    numeroPiece?: string;
    reference?: string;
}): {
    criteres: CriteresRecherche;
} | {
    motif: string;
};
export declare function filtreRecherche(c: CriteresRecherche): Prisma.EcritureWhereInput;
export declare function criteresOuRefus(q: Parameters<typeof lireCriteres>[0]): CriteresRecherche;
