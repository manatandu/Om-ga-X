import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';

/**
 * LIGNE ANALYTIQUE, FONCTION N° 51 · la dotation annuelle d'un compte sur un
 * exercice · le service la répartit sur les mois de l'exercice. Le compte,
 * l'exercice et le montant se rejugent au service (`budget-compte.ts`).
 */
export class DoterBudgetCompteDto {
  @IsUUID()
  exerciceId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montantAnnuel!: number;
}

/** La retouche d'un mois de calendrier, après répartition · l'annuel suit. */
export class ModifierBudgetCompteMoisDto {
  @IsUUID()
  exerciceId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  mois!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montant!: number;
}
