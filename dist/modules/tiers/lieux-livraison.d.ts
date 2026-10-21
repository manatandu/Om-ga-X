import type { TypeTiers } from '@prisma/client';
export declare const LONGUEUR_INTITULE_LIEU = 35;
export declare const LIEUX_SERVIS_PAR_CLIENT = 200;
export declare function motifRefusTypeLieu(type: TypeTiers): string | null;
export declare function intituleDuLieu(v: string): string;
export declare function motifRefusIntitule(intitule: string, autres: ReadonlyArray<{
    id: string;
    intitule: string;
}>, idCourant: string | null): string | null;
export declare function principalApres(p: {
    demande: boolean | undefined;
    actuel: boolean;
    actifApres: boolean;
    autresLieuxActifs: number;
}): {
    estPrincipal: boolean;
} | {
    motif: string;
};
export declare function intituleRenomme(intitule: string, codeDoublon: string): string;
export declare function renommagesALaFusion(conserves: readonly string[], duDoublon: ReadonlyArray<{
    id: string;
    intitule: string;
}>, codeDoublon: string): Map<string, string>;
