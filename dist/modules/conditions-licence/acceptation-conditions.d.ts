import { AbonnementAFacturer } from '../plateforme/abonnements/facturation-abonnements';
export declare const TYPES_LICENCE: readonly ["ABONNEMENT", "PERPETUEL_SAAS", "PERPETUEL_ONPREMISE", "PROPRIETAIRE"];
export type TypeLicenceConnue = (typeof TYPES_LICENCE)[number];
export declare const STATUTS_MESSAGE: readonly ["EN_ATTENTE", "SANS_TRANSPORT", "ENVOYE", "ECHEC", "ABANDONNE"];
export type StatutMessageConnu = (typeof STATUTS_MESSAGE)[number];
export type StatutAccuse = StatutMessageConnu | 'NON_MIS_EN_FILE';
export interface AcceptationEnregistree {
    version: number;
    empreinte: string | null;
    le: string;
    par: string | null;
    commande: DetailCommande | null;
}
export declare const AUTEUR_NON_ENREGISTRE = "auteur non enregistr\u00E9";
export interface LigneCommande {
    designation: string;
    quantite: number;
    prixUnitaireUsd: number;
}
export interface DetailCommande {
    formule: string;
    options: string[];
    periodicite: 'MENSUELLE' | 'ANNUELLE';
    debut: string;
    finEssai: string | null;
    lignes: LigneCommande[] | null;
    totalUsd: number | null;
    motifPrix: string | null;
    actif: boolean;
    duSiege: boolean;
}
export interface ContexteAcceptation {
    mentions: string[];
    typeLicence: TypeLicenceConnue | null;
    estDemonstration: boolean;
    surSite: boolean;
    commande: DetailCommande | null;
}
export declare function motifAcceptationFermee(c: ContexteAcceptation): string | null;
export declare function estAJour(a: AcceptationEnregistree | null, versionEnVigueur?: number, empreinte?: string): boolean;
export declare function empreinteCommande(c: DetailCommande | null): string;
export declare function motifRefusAcceptation(versionLue: number, empreinteLue: string, empreinteCommandeLue: string, c: ContexteAcceptation, versionEnVigueur?: number, empreinte?: string): string | null;
export declare function detailCommande(a: AbonnementAFacturer, duSiege?: boolean): DetailCommande;
export interface AccuseEnFile {
    statut: StatutMessageConnu;
    le: string;
}
export declare function motifRefusRenvoiAccuse(a: AcceptationEnregistree | null, aJour: boolean, dernier: AccuseEnFile | null): string | null;
export interface EtatConditions {
    version: {
        numero: number;
        date: string;
        dateLisible: string;
        empreinte: string;
    };
    acceptation: AcceptationEnregistree | null;
    aJour: boolean;
    aAccepter: boolean;
    motifFermeture: string | null;
    commande: DetailCommande | null;
    accuse: AccuseEnFile | null;
    renvoiAccusePossible: boolean;
}
export declare function etatConditions(a: AcceptationEnregistree | null, c: Omit<ContexteAcceptation, 'mentions'> & {
    mentions?: string[];
}, accuse?: AccuseEnFile | null): EtatConditions;
