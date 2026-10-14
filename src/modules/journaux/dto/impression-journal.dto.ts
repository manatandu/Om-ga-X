import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * L'IMPRESSION DU JOURNAL À L'ÉCRAN, ENREGISTRÉE AVANT LA BOÎTE D'IMPRESSION
 * (ligne sage-l1, fonction 60). Le périmètre seul · l'exercice, le journal
 * (absent, tous les journaux) et la période. Aucun critère de recherche n'est
 * reçu · une recherche n'est pas le journal, elle ne se marque jamais
 * imprimée (`impressions-journal.ts`).
 */
export class ImprimerJournalDto {
  @IsUUID('all', { message: 'Exercice inconnu' })
  exerciceId!: string;

  // Absent ou nul · le journal de tous les journaux de la période.
  @IsOptional()
  @IsUUID('all', { message: 'Journal inconnu' })
  journalId?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'La date de début de la période imprimée est illisible.' })
  dateDebut?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La date de fin de la période imprimée est illisible.' })
  dateFin?: string;
}
