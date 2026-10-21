export interface LigneAchatFacturee {
    designation: string;
    quantite: number;
    prixHT: number;
    montantTva: number;
    imposable: boolean;
}
export interface FactureAchatSource {
    numeroSerie: string;
    dateFacture: Date;
    fournisseurNom: string | null;
    fournisseurNumeroImpot: string | null;
    lignes: readonly LigneAchatFacturee[];
    annuleePar?: {
        numeroSerie: string;
        dateFacture: Date;
    } | null;
}
export interface FactureAnnuleeEtat {
    numeroFacture: string;
    dateFacture: string;
    fournisseurNom: string | null;
    noteDeCredit: string;
    dateNote: string;
    montantHT: number;
    tvaFacturee: number;
    ecarteeDesTotaux: boolean;
    motif: string;
}
export interface LigneEtatDetaille {
    fournisseurNom: string | null;
    fournisseurNumeroImpot: string | null;
    numeroFacture: string;
    dateFacture: string;
    designation: string;
    quantite: number;
    prixHT: number;
    tvaFacturee: number;
    montantTTC: number;
}
export type ManqueLigne = 'NUMERO_IMPOT_FOURNISSEUR' | 'NOM_FOURNISSEUR' | 'DESIGNATION';
export interface EtatDetailleTva {
    periode: string;
    lignes: LigneEtatDetaille[];
    totalHT: number;
    totalTva: number;
    totalTTC: number;
    facturesAnnulees: FactureAnnuleeEtat[];
    incompletudes: {
        numeroFacture: string;
        designation: string;
        manques: ManqueLigne[];
    }[];
    complet: boolean;
    voletImportations: {
        couvert: false;
        motif: string;
    };
    source: string;
    consequenceDuDefaut: string;
}
export declare function construireEtatDetaille(periode: string, factures: readonly FactureAchatSource[]): EtatDetailleTva;
