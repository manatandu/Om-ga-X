import { StatutEcriture } from '@prisma/client';
import { ClotureActive } from '../exercice/gel-cloture';
import { type ImpressionLue } from './impressions-journal';
export type EtatMoisJournal = 'VIDE' | 'BROUILLARD' | 'NON_IMPRIME' | 'JOURNAL' | 'CLOTURE' | 'SITUATION';
export interface MoisExercice {
    debut: string;
    fin: string;
}
export interface ComptageJour {
    journalId: string;
    date: Date;
    statut: StatutEcriture;
    estANouveauProvisoire: boolean;
    nombre: number;
    derniereValidation?: Date | null;
}
export interface CaseJournalMois {
    mois: string;
    etat: EtatMoisJournal;
    nombreEcritures: number;
    enBrouillard: number;
    aNouveauProvisoire: number;
    figeJusquau: string | null;
}
export declare function moisDeLExercice(dateDebut: Date, dateFin: Date): MoisExercice[];
export declare function grilleJournauxSaisie(journaux: Array<{
    id: string;
    type?: string;
}>, mois: MoisExercice[], comptages: ComptageJour[], clotures: ClotureActive[], exerciceClos: boolean, impressions?: readonly ImpressionLue[]): Array<{
    journalId: string;
    cases: CaseJournalMois[];
}>;
