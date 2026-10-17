import { JeuEtatsFinanciersSycebnl, JeuNotesAnnexes, Referentiel, StatutProvision, SystemeComptableSyscohada } from '@prisma/client';
import { LigneNoteCalculee } from './note-annexe.types';
export declare const TABLEAU_PASSIFS_EVENTUELS: Record<JeuNotesAnnexes, {
    code: string;
    sousTableau?: string;
} | null>;
export declare function notePassifsEventuelsDuDossier(dossier: {
    referentiel: Referentiel;
    jeuEtatsFinanciersSycebnl?: JeuEtatsFinanciersSycebnl | null;
    systemeComptableSyscohada?: SystemeComptableSyscohada | null;
}): string | null;
export interface PassifEventuelDuRegistre {
    objet: string;
    statut: StatutProvision;
    incertitudes: string | null;
    echeanceAttendue: Date | null;
    motifNonComptabilisation: string | null;
    remboursementAttendu: {
        toString(): string;
    } | number | null;
    remboursementCertain: boolean;
    remboursementTiers: string | null;
}
export declare function lignesPassifsEventuels(registre: PassifEventuelDuRegistre[], nombreDeColonnes: number): LigneNoteCalculee[];
