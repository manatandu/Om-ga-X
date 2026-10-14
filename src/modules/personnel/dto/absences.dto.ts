import { NatureAbsenceSalarie, TraitementIndemniteCaisse } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

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

/** Étape 3 · une indemnité journalière de la Caisse sur un arrêt, déclarée avec sa pièce. */
export class IndemniteCaisseDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Le mois se lit AAAA-MM.' })
  mois!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montant!: number;

  @IsEnum(TraitementIndemniteCaisse)
  traitement!: TraitementIndemniteCaisse;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  piece!: string;
}
