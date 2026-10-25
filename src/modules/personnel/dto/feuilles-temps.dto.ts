import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · les feuilles de temps. Les heures se
 * saisissent, jamais un montant ; les règles vivent dans `feuilles-temps.ts`.
 */
export class FeuilleTempsDto {
  @IsDateString()
  du!: string;

  @IsDateString()
  au!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;
}

export class HeuresCompteurDto {
  @IsUUID('4')
  compteurId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  heures!: number;
}

export class JourFeuilleTempsDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Le jour se lit AAAA-MM-JJ.' })
  jour!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  heures!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  heuresNuit?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => HeuresCompteurDto)
  compteurs?: HeuresCompteurDto[];
}

/** Les jours saisis d'une feuille · une feuille couvre au plus trente et un jours. */
export class JoursFeuilleTempsDto {
  @IsArray()
  @ArrayMaxSize(31)
  @ValidateNested({ each: true })
  @Type(() => JourFeuilleTempsDto)
  jours!: JourFeuilleTempsDto[];
}

export class AnnulationFeuilleTempsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}

export class CompteurHeuresDto {
  @IsString()
  @MaxLength(10)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  libelle!: string;
}
