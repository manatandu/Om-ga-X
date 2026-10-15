import { NatureMajorationHeures } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** LIGNE SAGE-L5, FONCTION 78, ÉTAPE 2 · un taux de majoration déclaré avec sa source. */
export class MajorationHeuresDto {
  @IsEnum(NatureMajorationHeures)
  nature!: NatureMajorationHeures;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  libelle!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000)
  tauxPourCent!: number;

  /** Convention collective, règlement d'entreprise, arrêté · jamais vide. */
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  source!: string;

  @IsDateString()
  dateEffet!: string;
}
