import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class CoupureArreteDto {
  @IsNumber()
  valeurUnitaire!: number;

  @IsInt()
  nombre!: number;
}

/** L'arrêté du jour · les coupures font les espèces, le serveur lit le solde. */
export class EtablirArreteCaisseDto {
  @IsString()
  compteId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Le jour se donne au format AAAA-MM-JJ.' })
  jour!: string;

  @IsOptional()
  @IsString()
  heure?: string | null;

  /** L'unité lue à l'aperçu (identifiant de devise, ou null pour les francs) · rejouée, 409 si elle a changé. */
  @IsOptional()
  @IsString()
  uniteAttendue?: string | null;

  // SOIXANTE COUPURES AU PLUS · convention d'OmegaX, une borne contre un corps sans fin.
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CoupureArreteDto)
  coupures!: CoupureArreteDto[];

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  caissier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  controlePar?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string | null;
}

export class AnnulerArreteCaisseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}

/** Le plafond d'encaisse · convention du dossier, avec le motif qui le fixe. */
export class CreerPlafondEncaisseDto {
  @IsString()
  compteId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "La date d'effet se donne au format AAAA-MM-JJ." })
  dateEffet!: string;

  @IsNumber()
  montant!: number;

  @IsOptional()
  @IsString()
  deviseId?: string | null;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motif!: string;
}
