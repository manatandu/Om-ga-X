import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/** Ligne microfina-m3, idée 3 · un ordre de mission. Les règles et leurs textes sont dans `missions-salarie.ts`. */
export class MissionSalarieDto {
  @IsString() @MinLength(1) @MaxLength(200) objet!: string;
  @IsOptional() @IsString() @MaxLength(120) lieuDepart?: string;
  @IsString() @MinLength(1) @MaxLength(120) destination!: string;
  @IsDateString() dateDepart!: string;
  @IsDateString() dateRetour!: string;
  @IsOptional() @IsString() @MaxLength(120) moyenTransport?: string;
}

export class FraisMissionDto {
  @IsEnum(['HEBERGEMENT', 'RESTAURATION', 'TRANSPORT', 'DIVERS']) element!: 'HEBERGEMENT' | 'RESTAURATION' | 'TRANSPORT' | 'DIVERS';
  @IsEnum(['JUSTIFIE', 'FORFAIT', 'REGLE_PAR_ENTITE']) qualification!: 'JUSTIFIE' | 'FORFAIT' | 'REGLE_PAR_ENTITE';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) montantFc!: number;
  @IsOptional() @IsString() @MaxLength(200) piece?: string;
  @IsOptional() @IsString() @MaxLength(160) libelle?: string;
}

export class FinMissionDto {
  @IsDateString() accomplieLe!: string;
}

export class AnnulationMissionDto {
  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}
