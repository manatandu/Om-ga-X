export type OrdreRenumerotation = 'ACQUISITION' | 'COMPTE';
export type PerimetreRenumerotation = 'EN_SERVICE' | 'SANS_NUMERO';
export interface ParametresRenumerotation {
    prefixe: string;
    premierNumero: number;
    largeur: number;
    ordre: OrdreRenumerotation;
    perimetre: PerimetreRenumerotation;
}
export interface FicheANumeroter {
    id: string;
    designation: string;
    numeroInventaire: string | null;
    dateAcquisition: Date;
    createdAt: Date;
    sortie: boolean;
    compteNumero: string;
}
export interface Attribution {
    id: string;
    designation: string;
    ancien: string | null;
    nouveau: string;
}
export declare const LONGUEUR_MAX_NUMERO = 100;
export declare const PLAFOND_RENUMEROTATION = 5000;
export declare function motifRefusParametres(p: ParametresRenumerotation): string | null;
export declare function numeroForme(p: Pick<ParametresRenumerotation, 'prefixe' | 'largeur'>, n: number): string;
export interface PlanDeRenumerotation {
    attributions: Attribution[];
    collisions: {
        numero: string;
        designation: string;
    }[];
    nombre: number;
}
export declare function planDeRenumerotation(fiches: FicheANumeroter[], p: ParametresRenumerotation): PlanDeRenumerotation;
export declare function motifRefusPlan(plan: PlanDeRenumerotation, p: ParametresRenumerotation): string | null;
export declare function motifRefusCampagneOuverte(campagnes: {
    libelle: string;
    dateInventaire: Date;
    statut: string;
}[]): string | null;
export declare function numerosEnDouble(fiches: {
    id: string;
    designation: string;
    numeroInventaire: string | null;
}[]): {
    numero: string;
    fiches: {
        id: string;
        designation: string;
    }[];
}[];
export interface LigneRapprochement {
    numero: string;
    intitule: string;
    registre: number;
    balance: number;
    ecart: number;
}
export declare function rapprocher(registre: Map<string, {
    intitule: string;
    montant: number;
}>, balance: Map<string, {
    intitule: string;
    solde: number;
}>): LigneRapprochement[];
