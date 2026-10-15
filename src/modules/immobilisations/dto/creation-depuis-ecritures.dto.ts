import { ModeAmortissement } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/**
 * LA FICHE NÉE D'UNE LIGNE D'ACQUISITION DÉJÀ PASSÉE (ligne sage-l4,
 * fonction n° 68) · la ligne donne le compte, la valeur, la date et le
 * journal ; le cabinet donne ce que l'écriture ne dit pas (désignation, plan).
 * Le reste passe par les contrôles de la création.
 */
export class CreerDepuisEcritureDto {
  @IsUUID('4')
  ligneId!: string;

  /** Absente, le libellé de la ligne (ou de l'écriture). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroInventaire?: string;

  @IsOptional()
  @IsUUID('4')
  lieuId?: string;

  /** Absente ou `null`, le bien n'est pas encore mis en service · jamais posée d'office (AUDCIF art. 45). */
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsDateString()
  dateMiseEnService?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  natureFiscaleCle?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valeurResiduelle?: number;

  /** Absente, celle de la famille du compte. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  dureeAmortissementAns?: number;

  @IsOptional()
  @IsEnum(ModeAmortissement)
  modeAmortissement?: ModeAmortissement;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  unitesOeuvrePrevues?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  uniteOeuvreLibelle?: string;

  /**
   * Relecture M2 · une pièce du premier jour de l'exercice, hors achats et
   * trésorerie, est d'ordinaire la reprise du bilan d'ouverture (bien REPRIS)
   * · le cabinet confirme ici une acquisition faite ce jour-là.
   */
  @IsOptional()
  @IsBoolean()
  confirmerPremierJour?: boolean;
}
