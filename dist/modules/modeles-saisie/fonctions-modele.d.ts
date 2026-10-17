export type FonctionLigne = 'SAISIR' | 'REPETER' | 'CALCULER' | 'EQUILIBRER';
export interface LigneAVerifier {
    fonction?: FonctionLigne;
    montant?: number | null;
    tauxTvaId?: string | null;
}
export declare function motifRefusFonctions(lignes: LigneAVerifier[]): string | null;
