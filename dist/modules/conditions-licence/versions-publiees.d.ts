export interface VersionPubliee {
    numero: number;
    date: string;
    dateLisible: string;
    communiqueeLe: string | null;
    enVigueurLe: string;
    empreinte: string;
    texte: string;
}
export declare const VERSIONS_PUBLIEES: readonly VersionPubliee[];
export declare function versionPubliee(numero: number): VersionPubliee | null;
export declare function empreinteEnVigueur(): string;
