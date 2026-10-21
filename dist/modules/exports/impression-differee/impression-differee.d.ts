import { EtatImpressionDifferee, NatureImpressionDifferee } from '@prisma/client';
export declare const DELAI_PRODUCTION_MS: number;
export declare const PLAFOND_IMPRESSIONS_LISTEES = 50;
export declare const MOTIF_INTERROMPUE = "Production non termin\u00E9e dans le d\u00E9lai de requ\u00EAte du serveur \u00B7 rien n'a \u00E9t\u00E9 rang\u00E9, demandez l'\u00E9dition de nouveau.";
export declare const MOTIF_NON_RANGEE = "Le livre a \u00E9t\u00E9 produit, mais son fichier n'a pas pu \u00EAtre rang\u00E9 \u00B7 rien n'est gard\u00E9, demandez l'\u00E9dition de nouveau.";
export interface CriteresJournal {
    exerciceId: string;
    journalId: string | null;
    dateDebut: string | null;
    dateFin: string | null;
    inclureBrouillard: boolean;
}
export interface CriteresGrandLivre {
    exerciceId: string;
    format: 'fpm' | 'plat';
}
export interface CriteresBalance {
    exerciceId: string;
    grandsLivres: boolean;
}
export type CriteresImpression = CriteresJournal | CriteresGrandLivre | CriteresBalance;
export declare function criteresOuMotif(nature: NatureImpressionDifferee, brut: Record<string, unknown>): {
    criteres: CriteresImpression;
} | {
    motif: string;
};
export declare function libelleDemande(nature: NatureImpressionDifferee, criteres: CriteresImpression, exercice: {
    dateDebut: Date;
    dateFin: Date;
}, journal: {
    code: string;
} | null): string;
export declare function motifEchecDe(erreur: unknown): string;
export declare function estInterrompue(etat: EtatImpressionDifferee, commenceLe: Date | null, maintenant: Date): boolean;
