import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * LIGNE SAGE-L5, FONCTION 79 · les congés acquis chaque mois. Règles dans
 * `conges-acquis.ts` ; le service rejoue tout, ces DTO ne portent que ce que
 * le cabinet déclare.
 */

/** La reprise des congés acquis avant OmegaX · déclarée avec sa source. */
export class RepriseCongesDto {
  @IsDateString()
  arreteAu!: string;

  /** Jours nés (art. 140, al. 3) et non pris à cette date, demi-jours admis. */
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(400)
  joursNesNonPris!: number;

  /** Mois entiers de service accomplis dans la période annuelle en cours. */
  @IsInt()
  @Min(0)
  @Max(11)
  moisEnCoursAccomplis!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  source!: string;
}

/** Ce qui fonde l'allocation de l'art. 142 · dans la monnaie de la rémunération convenue. */
export class AllocationCongeDto {
  @IsOptional()
  @IsIn(['CDF', 'USD'])
  deviseAllocation?: 'CDF' | 'USD';

  /** Taux journalier de la rémunération au moment du départ (art. 142, al. 1). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  remunerationJournaliere?: number;

  /** Moyenne MENSUELLE des douze mois des commissions, primes, prestations supplémentaires et participation (al. 2) · zéro est une réponse. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  moyenneMensuelleArticle142?: number;
}

export class CongeSalarieDto extends AllocationCongeDto {
  @IsDateString()
  du!: string;

  @IsDateString()
  au!: string;

  /** Art. 141, al. 3 · « La durée du voyage n'est pas comprise dans le congé. » */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  joursVoyage?: number;

  /** AAAA-MM · le bulletin qui porte l'allocation (art. 145, payée au départ). */
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Le mois de paie se lit AAAA-MM.' })
  moisDePaie!: string;

  /** Pris au-delà des droits nés · se dit, avec son motif. */
  @IsOptional()
  @IsBoolean()
  auDelaDuSolde?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motifAuDelaDuSolde?: string;
}

export class AnnulationCongeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
