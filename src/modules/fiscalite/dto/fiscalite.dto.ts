import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { NatureActiviteFiscale, SensRetraitementFiscal } from '@prisma/client';

export class CreerRetraitementDto {
  @IsString()
  @MaxLength(60)
  code!: string;

  /** Requis seulement pour une ligne libre · pour un code du catalogue, le sens est celui du catalogue. */
  @IsOptional()
  @IsEnum(SensRetraitementFiscal)
  sens?: SensRetraitementFiscal;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  libelle?: string;

  /** Toujours positif · le sens donne la direction. */
  @IsNumber()
  @Min(0.01)
  montant!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

export class ModifierRetraitementDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montant?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

export class ModifierDossierFiscalDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  acomptesVerses?: number;

  /**
   * Suppléments d'impôt établis par l'Administration · art. 57 bis LPF. Ils
   * entrent dans la base des acomptes du prochain exercice, contestés ou non.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  supplementsAdministration?: number;

  /** null = OmegaX recalcule depuis les exercices précédents. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  deficitAnterieurSaisi?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(NatureActiviteFiscale)
  natureActivite?: NatureActiviteFiscale | null;

  /**
   * Premier exercice long (loi n° 23/053, art. 12, al. 3) · bénéfice FISCAL de
   * la période de création, d'après les comptes intermédiaires arrêtés au
   * 31 décembre. Négatif admis (une perte se déclare aussi) ; null = OmegaX
   * lit le résultat comptable de la période sur le livre-journal.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  resultatPeriodeCreationSaisi?: number | null;

  /** Suppléments de l'Administration sur l'impôt de la période de création (LPF art. 57 bis). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  supplementsPeriodeCreation?: number;

  /**
   * B2, P1 · l'origine du déficit saisi · une ligne par exercice déficitaire,
   * sa date de clôture et sa part. La somme doit égaler le déficit saisi.
   * null = origine non dite (bornée par prudence, et dit).
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrigineDeficitDto)
  deficitAnterieurOrigines?: OrigineDeficitDto[] | null;
}

export class OrigineDeficitDto {
  @IsDateString()
  dateFin!: string;

  @IsNumber()
  @Min(0.01)
  montant!: number;
}

/**
 * Le clic qui passe l'écriture de l'impôt (ligne A11) · AUCUN MONTANT · le
 * serveur rejoue l'impôt. Le cabinet ne dit que s'il impute ses acomptes et,
 * pour une forme dont l'assujettissement dépend d'un fait non porté au
 * dossier, ce qui le fonde. Un `null` vaut l'absence (rien n'est stocké
 * qu'une chaîne non vide).
 */
export class PasserConstatImpotDto {
  @IsOptional()
  @IsBoolean()
  imputerAcomptes?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  attestationRegime?: string;
}

/** L'annulation (AUDCIF art. 20, al. 2) · motif de 3 à 500 caractères. */
export class AnnulerConstatImpotDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
