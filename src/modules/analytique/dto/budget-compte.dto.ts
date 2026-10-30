import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';

/**
 * LIGNE ANALYTIQUE, FONCTION N° 51 · la dotation annuelle d'un compte sur un
 * exercice · le service la répartit sur les mois de l'exercice. Le compte,
 * l'exercice et le montant se rejugent au service (`budget-compte.ts`). Les
 * messages sont écrits en français · les défauts de class-validator parlent
 * anglais.
 */
export class DoterBudgetCompteDto {
  @IsUUID('all', { message: 'Exercice illisible.' })
  exerciceId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le montant du budget se donne au centime.' })
  @Min(0, { message: "Un budget n'est pas négatif." })
  montantAnnuel!: number;
}

/** La retouche d'un mois de calendrier, après répartition · l'annuel suit. */
export class ModifierBudgetCompteMoisDto {
  @IsUUID('all', { message: 'Exercice illisible.' })
  exerciceId!: string;

  @IsInt({ message: 'Le mois est un nombre de 1 à 12.' })
  @Min(1, { message: 'Le mois est un nombre de 1 à 12.' })
  @Max(12, { message: 'Le mois est un nombre de 1 à 12.' })
  mois!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le montant du budget se donne au centime.' })
  @Min(0, { message: "Un budget n'est pas négatif." })
  montant!: number;
}
