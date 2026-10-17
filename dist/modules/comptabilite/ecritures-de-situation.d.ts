import { Prisma, StatutEcriture, TypeJournal } from '@prisma/client';
export declare const STATUTS_COMPTABLES: readonly StatutEcriture[];
export declare const HORS_SITUATION: {
    statut: {
        not: "SITUATION";
    };
};
export declare function avecStatut<F extends Prisma.EcritureWhereInput>(filtre: F): F | (F & typeof HORS_SITUATION);
export declare function filtreDuStatut(inclureBrouillard: boolean): Prisma.EcritureWhereInput;
export declare function libelleDuStatut(statut: StatutEcriture | string): string;
export declare function estJournalDeSituation(journal: {
    type: TypeJournal;
}): boolean;
export declare function statutDeNaissance(journal: {
    type: TypeJournal;
}): StatutEcriture;
export declare function motifSituationNeSeValidePas(pieces: string[]): string;
export declare function motifSimulationNonRattachable(piece: string, acte: string): string;
export declare function motifJournalDeSituationReserveALaSaisie(code: string): string;
export declare function motifJournalDeSituationNonCloturable(code: string): string;
export declare function motifSituationHorsSequenceDuFichier(code: string): string;
export declare const ISSUE_TRANSFERT: string;
export declare function motifTransfertSansObjet(piece: string, statut: StatutEcriture | string, situation: boolean): string | null;
export declare function motifArriveeDeSituation(code: string): string;
export declare function motifBrouillardHeriteNeSeValidePas(pieces: string[]): string;
export declare function motifImpressionDeSituationNonNumerotee(code: string): string;
