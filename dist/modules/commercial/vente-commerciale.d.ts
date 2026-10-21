export type NatureOperation = 'MARCHANDISES' | 'SERVICES' | 'MIXTE_SERVICES_PREPONDERANTS' | 'USAGE_PERSONNEL' | 'REGIME_PARTICULIER';
export interface Perimetre {
    regiParLeLivre8: boolean;
    article: string;
    motif: string;
}
export declare function perimetreVenteCommerciale(nature: NatureOperation): Perimetre;
export declare const MOTIF_HORS_SYCEBNL: string;
export type ManqueOffre = 'DESTINATAIRE_INDETERMINE' | 'LIGNES_IMPRECISES' | 'VOLONTE_DETRE_LIE_NON_EXPRIMEE';
export interface LigneDevisVerifiable {
    designation: string | null;
    quantite: number | null;
    prixUnitaire: number | null;
}
export interface DevisVerifiable {
    destinataireDetermine: boolean;
    volonteDEtreLie: boolean;
    lignes: readonly LigneDevisVerifiable[];
}
export interface QualificationOffre {
    estUneOffre: boolean;
    manques: ManqueOffre[];
    article: string;
    requalification: string | null;
}
export declare function qualifierOffre(d: DevisVerifiable): QualificationOffre;
export declare function dateLimiteAcceptation(dateEmission: Date, delaiJours: number | null): Date | null;
export declare const DELAI_NON_CHIFFRE: string;
export type EtatDevis = 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE' | 'CONTRE_PROPOSITION' | 'REVOQUE' | 'CADUC';
export type NatureReponse = 'ACCEPTATION' | 'REFUS' | 'MODIFICATION_NON_SUBSTANTIELLE' | 'MODIFICATION_SUBSTANTIELLE';
export interface SituationDevis {
    dateEmission: Date;
    delaiJours: number | null;
    dateReponse: Date | null;
    natureReponse: NatureReponse | null;
    revoqueLe: Date | null;
    reference: Date;
}
export interface EtatCalcule {
    etat: EtatDevis;
    dateLimite: Date | null;
    article: string;
    explication: string;
}
export declare function etatDevis(s: SituationDevis): EtatCalcule;
export interface Revocabilite {
    revocable: boolean;
    article: string;
    motif: string;
    reserve: string;
}
export declare function revocabilite(params: {
    delaiJours: number | null;
    declareeIrrevocable: boolean;
    dejaAcceptee: boolean;
}): Revocabilite;
export declare const PRIX_PRESUME_HORS_TAXES: {
    readonly article: "AUDCG art. 263";
    readonly mention: "Le prix exprimé dans le contrat est présumé convenu hors taxes.";
};
export declare const AUCUNE_CONDITION_DE_FORME: {
    readonly article: "AUDCG art. 240";
    readonly mention: string;
};
export declare const DELAIS_DE_CONFORMITE: readonly [{
    readonly cle: "APPARENT";
    readonly libelle: "Défaut de conformité apparent le jour de la prise de livraison";
    readonly delai: "un mois à compter de la livraison, sous peine de déchéance";
    readonly article: "AUDCG art. 258";
}, {
    readonly cle: "CACHE";
    readonly libelle: "Défaut de conformité caché le jour de la prise de livraison";
    readonly delai: "un an à compter du jour où le défaut a été constaté ou aurait dû l’être";
    readonly article: "AUDCG art. 259";
}];
