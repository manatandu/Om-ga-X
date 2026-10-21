import type { VersionPubliee } from './versions-publiees';
export declare function nIemeJourOuvrableApres(jour: string, n: number): string;
export declare function entreeEnVigueurAuPlusTot(communiqueeLe: string): string;
export declare function finDuDelaiDeResiliation(enVigueurLe: string): string;
export declare function priseDEffet(enVigueurLe: string): string;
export declare function motifDelaiArticle34(v: Pick<VersionPubliee, 'numero' | 'communiqueeLe' | 'enVigueurLe'>): string | null;
