export interface FactureACourrieler {
    numeroSerie: string;
    dateFacture: string;
    periode: string;
    emetteurNom: string;
    mentionsLigne: string | null;
    contrepartieNom: string;
    lignes: {
        designation: string;
        quantite: number;
        prixUnitaire: number;
        montantHT: number;
        montantTva: number;
    }[];
    totaux: {
        montantHT: number;
        montantTva: number;
        montantTTC: number;
    };
    montantUsd: number;
    cours: number;
    echeanceLicence: string | null;
}
export interface LicenceACourrieler {
    numero: string;
    titulaire: string;
    empreinteMachine: string;
    emiseLe: string;
    finMaintenance: string;
    expiration: string | null;
    dossiersMax: number;
    fichier: string;
}
export interface Courriel {
    sujet: string;
    corps: string;
    pieceJointe: {
        nom: string;
        texte: string;
    } | null;
}
export declare function montantFc(n: number): string;
export declare function dateLisible(iso: string): string;
export declare function courrielFactureAbonnement(f: FactureACourrieler): Courriel;
export declare function courrielLicenceSurSite(l: LicenceACourrieler): Courriel;
