export declare function lireAvant(texte: string | undefined): number | undefined;
export declare function pageDeNumeros<T extends {
    numero: number;
}>(lus: T[], taille: number): {
    page: T[];
    plusAnciensAvant: number | null;
};
