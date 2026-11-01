import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

/** Ligne paie-declarations, point 3 · les règles et leurs textes sont dans `avance-mission.ts`. */
export class AvanceMissionDto {
  @IsUUID() exerciceId!: string;
  @IsUUID() journalId!: string;
  @IsDateString() date!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) montantFc!: number;
  @IsString() @MinLength(1) @MaxLength(190) pieceJustificative!: string;
}

export class RegularisationMissionDto {
  @IsUUID() exerciceId!: string;
  @IsUUID() journalId!: string;
  @IsDateString() date!: string;
  @IsString() @MinLength(1) @MaxLength(190) pieceJustificative!: string;
  /** Le sort du trop-versé · exigé seulement quand les frais n'épuisent pas l'avance. */
  @IsOptional() @IsIn(['RENDU', 'RETENU']) tropVerse?: 'RENDU' | 'RETENU';
}

export class AnnulationAvanceMissionDto {
  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}

export class LigneRepartitionMissionDto {
  @IsUUID() sectionId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) pourcentage!: number;
}

export class RepartitionMissionDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LigneRepartitionMissionDto)
  lignes!: LigneRepartitionMissionDto[];
}
