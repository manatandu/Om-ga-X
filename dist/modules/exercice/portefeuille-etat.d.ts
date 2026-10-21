import { FormeJuridiqueSyscohada } from '@prisma/client';
export declare const ENTREE_EN_VIGUEUR_OL_13_003: Date;
export declare const ENTREE_EN_VIGUEUR_ARRETE_PORTEFEUILLE_2025: Date;
export interface JalonServi {
    etape: number;
    libelle: string;
    detail: string;
    nature: 'INTERNE' | 'LEGALE';
    source: string;
    sanction: string | null;
    debut: Date | null;
    echeance: Date | null;
    sansDelai?: true;
    enAttente?: string;
    montant?: number | null;
    montantProvisoire?: true;
    montantEnAttente?: true;
    enRetard: boolean;
    observation?: ObservationJalon;
}
export interface ObservationJalon {
    libelle: string;
    satisfait: boolean;
    horsDelai?: true;
}
export declare function closAu31Decembre(dateFin: Date): boolean;
export declare function jourFr(d: Date): string;
export declare function observationDuFait(fait: {
    passe: string;
    prevu: string;
}, date: Date | null, echeance: Date | null, aujourdHui: Date): ObservationJalon | undefined;
export interface FaitsPortefeuille {
    dateFin: Date;
    forme: FormeJuridiqueSyscohada;
    commissaireDesigne: boolean | null;
    exerciceClos: boolean;
    dateArreteComptes?: Date | null;
    dateAssembleeGenerale: Date | null;
    dateDepotEtatsPortefeuille: Date | null;
    dateTransmissionPvPortefeuille: Date | null;
    dateDecisionAffectation: Date | null;
    secteurMinier?: boolean | null;
    quotePartEtat?: number | null;
    sourceQuotePartEtat?: string | null;
    resultatNet?: number | null;
    dateDeclarationDividendeEtat?: Date | null;
    dateNotePerceptionDividende?: Date | null;
    datePaiementDividendeEtat?: Date | null;
    dateDissolution?: Date | null;
    capitauxPropres?: {
        capital: number;
        capitauxPropres: number;
        reportANouveau: number;
    } | null;
}
export declare function appliquerPortefeuilleEtat(jalons: JalonServi[], faits: FaitsPortefeuille, aujourdHui: Date): JalonServi[];
export declare function jalonsDividendePrioritaire(faits: FaitsPortefeuille, aujourdHui: Date): JalonServi[];
interface RegleARebours {
    jours: 45 | 15;
    joursAvant: 46 | 16 | 15;
    franc: boolean;
    source: string;
    motif: string;
}
export declare const MENTION_DELAI_NON_FRANC = "D\u00E9lai servi en jours francs, ni le jour de l\u2019envoi ni celui de l\u2019assembl\u00E9e n\u2019\u00E9tant compt\u00E9s \u00B7 un jour plus tard si le d\u00E9lai n\u2019est pas franc.";
export declare function delaisAvantAssemblee(forme: FormeJuridiqueSyscohada, commissaireDesigne: boolean | null): {
    commissaire140: RegleARebours | null;
    commissaire71: RegleARebours | null;
    documents: RegleARebours;
};
export declare function inviterADeclarerPortefeuille(jalons: JalonServi[]): JalonServi[];
export {};
