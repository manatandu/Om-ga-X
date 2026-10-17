export interface LigneFacturePourEcriture {
    designation: string;
    montantHT: number;
    montantTva: number;
    compteTvaId: string | null;
    tauxTvaId: string | null;
    tauxZero?: boolean;
    compteGestionId?: string | null;
}
export interface FacturePourEcriture {
    sens: 'VENTE' | 'ACHAT';
    nature: 'FACTURE' | 'NOTE_DE_CREDIT';
    numeroSerie: string;
    dateFacture: Date;
    contrepartieNom: string;
    compteTiersId: string | null;
    autresImpotsEtTaxes: number | null;
    lignes: LigneFacturePourEcriture[];
}
export interface LigneProposee {
    compteId: string;
    libelle: string;
    debit: number;
    credit: number;
    tauxTvaId?: string;
}
export declare function ecritureDeFacture(f: FacturePourEcriture, compteGestionParDefaut: string | null): {
    lignes: LigneProposee[];
    libelle: string;
} | {
    refus: string;
};
