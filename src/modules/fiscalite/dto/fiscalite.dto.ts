import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { NatureActiviteFiscale, SensRetraitementFiscal } from '@prisma/client';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/**
 * LA BORNE HAUTE D'UN MONTANT FISCAL · les colonnes sont en Decimal(18, 2),
 * soit moins de 10^16. Un montant au-delà était reçu, puis refusé par la base
 * en 500 sans motif. La borne est posée à 10^15 - 1, un ordre de grandeur
 * sous la limite de la colonne · l'arrondi au centime d'un nombre JSON de
 * cette taille ne peut jamais la franchir. Refus 400 nommé.
 */
export const MONTANT_FISCAL_MAX = 999_999_999_999_999;
const MOTIF_MONTANT_MAX = `Montant hors des bornes · au plus ${MONTANT_FISCAL_MAX.toLocaleString('fr-FR')} en valeur absolue.`;

/** Les parts de l'origine d'un report · une par exercice déficitaire, trois à cinq en pratique (art. 51). */
export const ORIGINES_DEFICIT_MAX = 20;

const nonNul = (champ: string) =>
  `${champ} ne s'efface pas · la colonne n'admet pas de valeur vide. Omettez le champ pour le laisser inchangé, ou envoyez 0.`;

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
  @Max(MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
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
  @Max(MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
  montant?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

export class ModifierDossierFiscalDto {
  // FACULTATIF NE VEUT PAS DIRE NULLABLE (CLAUDE.md § 9) · `null` passait
  // `@IsOptional()`, puis `arrondir(null)` l'écrivait 0 · des acomptes
  // déclarés effacés en silence.
  @FacultatifNonNul(nonNul('Le montant des acomptes versés'))
  @IsNumber()
  @Min(0)
  @Max(MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
  acomptesVerses?: number;

  /**
   * Suppléments d'impôt établis par l'Administration · art. 57 bis LPF. Ils
   * entrent dans la base des acomptes du prochain exercice, contestés ou non.
   */
  @FacultatifNonNul(nonNul("Le montant des suppléments de l'Administration"))
  @IsNumber()
  @Min(0)
  @Max(MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
  supplementsAdministration?: number;

  /** null = OmegaX recalcule depuis les exercices précédents. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  @Max(MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
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
  @Min(-MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
  @Max(MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
  resultatPeriodeCreationSaisi?: number | null;

  /** Suppléments de l'Administration sur l'impôt de la période de création (LPF art. 57 bis). */
  @FacultatifNonNul(nonNul('Le montant des suppléments sur la période de création'))
  @IsNumber()
  @Min(0)
  @Max(MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
  supplementsPeriodeCreation?: number;

  /**
   * B2, P1 · l'origine du déficit saisi · une ligne par exercice déficitaire,
   * sa date de clôture et sa part. La somme doit égaler le déficit saisi.
   * null = origine non dite (bornée par prudence, et dit).
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsArray()
  @ArrayMaxSize(ORIGINES_DEFICIT_MAX, {
    message: `L'origine du report se déclare en ${ORIGINES_DEFICIT_MAX} parts au plus · une par exercice déficitaire encore imputable.`,
  })
  @ValidateNested({ each: true })
  @Type(() => OrigineDeficitDto)
  deficitAnterieurOrigines?: OrigineDeficitDto[] | null;
}

export class OrigineDeficitDto {
  @IsDateString()
  dateFin!: string;

  @IsNumber()
  @Min(0.01)
  @Max(MONTANT_FISCAL_MAX, { message: MOTIF_MONTANT_MAX })
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
