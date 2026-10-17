export type NatureLigne = 'PRODUIT' | 'CHARGE';
export type Jauge = 'VERT' | 'ORANGE' | 'ROUGE';
export type Hypotheses = {
    croissanceProduitsPct: number;
    variations: Record<string, number>;
};
export type Seuils = {
    orangePct: number;
    rougePct: number;
};
export type MouvementCompte = {
    numero: string;
    mouvementDebit: number;
    mouvementCredit: number;
};
export declare function racineDeGestion(numero: string): string | null;
export declare const natureDeLaRacine: (racine: string) => NatureLigne;
export declare function montantsParRacine(lignes: readonly MouvementCompte[]): Map<string, number>;
export declare function motifRefusSimulation(h: Hypotheses, s: Seuils): string | null;
export declare function prorataTemporis(dateDebut: Date, dateFin: Date, arreteAu: Date): number;
export declare function ecartDefavorablePct(nature: NatureLigne, prevu: number, realise: number): number | null;
export declare function jaugeDe(ecartPct: number | null, s: Seuils): Jauge | null;
export type LigneSimulee = {
    racine: string;
    intitule: string;
    nature: NatureLigne;
    reference: number;
    tauxPct: number;
    prevuAnnuel: number;
    prevuADate: number;
    realise: number | null;
    ecartDefavorablePct: number | null;
    jauge: Jauge | null;
};
export declare function simuler(p: {
    reference: Map<string, number>;
    realise: Map<string, number> | null;
    intitules: Map<string, string>;
    hypotheses: Hypotheses;
    seuils: Seuils;
    prorata: number;
}): {
    lignes: LigneSimulee[];
    totaux: {
        reference: {
            produits: number;
            charges: number;
            resultatActivitesOrdinaires: number;
        };
        prevuAnnuel: {
            produits: number;
            charges: number;
            resultatActivitesOrdinaires: number;
        };
        prevuADate: {
            produits: number;
            charges: number;
            resultatActivitesOrdinaires: number;
        };
        realise: {
            produits: number;
            charges: number;
            resultatActivitesOrdinaires: number;
        } | null;
        jaugeResultat: Jauge | null;
        ecartResultatPct: number | null;
    };
};
