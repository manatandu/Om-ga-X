export declare const RACINES_DISPONIBILITES: RegExp;
export declare function estDisponibilite(numero: string): boolean;
export declare const RACINES_CHANGE_DISPONIBILITES: {
    readonly perte: "676";
    readonly gain: "776";
};
export interface LigneDEcart {
    compteNumero: string;
    debit: number;
    credit: number;
}
export interface PartageDesEcarts<L extends LigneDEcart> {
    aContrePasser: L[];
    realisees: L[];
    motifRefus: string | null;
}
export declare const MOTIF_PARTAGE_IMPOSSIBLE: string;
export declare function partagerLignesDEcarts<L extends LigneDEcart>(lignes: L[]): PartageDesEcarts<L>;
export interface EcartDeDisponibilite {
    compteId: string;
    deviseId: string;
    ecart: number;
}
export declare function ecartsDisponibilitesEnregistres(valeur: unknown): EcartDeDisponibilite[] | null;
export type CodeContrePassationIntegrale = 'EXERCICE_SUIVANT_ANCIEN_REGIME' | 'PARTAGE_IMPOSSIBLE';
export declare const LIBELLE_INTEGRALE: Record<CodeContrePassationIntegrale, string>;
export declare const AVERTISSEMENT_INTEGRALE: Record<CodeContrePassationIntegrale, string>;
export interface SommeDeviseDuCompte {
    deviseId: string;
    devise: number;
    francs: number;
}
export declare function ventilerEcartPasse(compteId: string, passe: number, sommes: SommeDeviseDuCompte[], cours: (deviseId: string) => number | null): EcartDeDisponibilite[] | null;
export declare function motifRefusVentilationDeclaree(passeParCompte: Map<string, number>, ventilation: {
    compteId: string;
    deviseId: string;
    ecart: number;
}[], devisesDuDossier: Set<string>, source: string | null | undefined, sommesLues?: Map<string, SommeDeviseDuCompte[]>): string | null;
