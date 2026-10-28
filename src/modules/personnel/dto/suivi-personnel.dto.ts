import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AllocationCongeDto } from './conges.dto';

/** Ligne microfina-m3, idée 7 · la demande de congé du travailleur (Code du travail, art. 140, al. 4). */
export class DemandeCongeDto {
  @IsDateString() du!: string;
  @IsDateString() au!: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) joursVoyage?: number;
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Le mois de paie se lit AAAA-MM.' }) moisDePaie!: string;
  /** La date de la demande du travailleur, déclarée. */
  @IsDateString() demandeLe!: string;
  @IsOptional() @IsString() @MaxLength(500) observation?: string;
}

/** L'accord · ce que le congé ordinaire demande en plus des dates (allocation, au-delà du solde). */
export class AccordDemandeCongeDto extends AllocationCongeDto {
  @IsOptional() @IsBoolean() auDelaDuSolde?: boolean;
  @IsOptional() @IsString() @MaxLength(500) motifAuDelaDuSolde?: string;
}

export class RefusDemandeCongeDto {
  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}

/** Ligne microfina-m3, idée 8 · une formation prévue (Code du travail, art. 8). */
export class FormationDto {
  @IsString() @MinLength(1) @MaxLength(200) intitule!: string;
  @IsOptional() @IsString() @MaxLength(200) organisme?: string;
  @IsOptional() @IsBoolean() interne?: boolean;
  @IsOptional() @IsString() @MaxLength(120) lieu?: string;
  @IsOptional() @IsString() @MaxLength(200) financement?: string;
  @IsDateString() prevueDu!: string;
  @IsDateString() prevueAu!: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) coutPrevuFc?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true }) participants?: string[];
}

export class ParticipantsFormationDto {
  @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true }) salarieIds!: string[];
}

export class RealisationFormationDto {
  @IsDateString() realiseeDu!: string;
  @IsDateString() realiseeAu!: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) coutReelFc?: number;
  /** Les participants PRÉSENTS · les autres inscrits sont dits absents, jamais présumés présents. */
  @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true }) presents!: string[];
}

export class AnnulationFormationDto {
  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}

export class EcheancierDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(366) horizon?: number;
}
