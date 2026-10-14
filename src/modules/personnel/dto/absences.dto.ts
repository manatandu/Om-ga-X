import { NatureAbsenceSalarie } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * LIGNE SAGE-L5, FONCTION 78 · une absence déclarée. Les jours se comptent au
 * serveur (`absences.ts`) ; ce DTO ne porte que ce que le cabinet constate.
 */
export class AbsenceSalarieDto {
  @IsEnum(NatureAbsenceSalarie)
  nature!: NatureAbsenceSalarie;

  @IsDateString()
  du!: string;

  @IsDateString()
  au!: string;

  @IsOptional()
  @IsBoolean()
  demiJourneeDebut?: boolean;

  @IsOptional()
  @IsBoolean()
  demiJourneeFin?: boolean;

  /** Congé de circonstance · l'événement de l'art. 146. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  evenement?: string;

  /** Certificat médical, décision de mise à pied, constat de l'Inspecteur… */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  piece?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;
}

export class AnnulationAbsenceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
