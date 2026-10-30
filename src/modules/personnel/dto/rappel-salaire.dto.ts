import { IsIn, IsNumber, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

const MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Ligne paie-suite, fonction 87 · le rappel de salaires · les mois couverts,
 * la nouvelle base dans l'unité du contrat, et la pièce qui fonde la hausse.
 * Aucun montant d'arriéré · le serveur le calcule (`rappel-salaire.ts`).
 */
export class RappelSalaireDto {
  @IsString() @Matches(MOIS, { message: 'Le premier mois se lit AAAA-MM.' }) moisDebut!: string;
  @IsString() @Matches(MOIS, { message: 'Le dernier mois se lit AAAA-MM.' }) moisFin!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) nouvelleBase!: number;
  @IsIn(['JOUR', 'SEMAINE', 'MOIS', 'ANNEE']) periodicite!: 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';
  /** La monnaie de la nouvelle base · celle du contrat, jamais la monnaie de tenue. */
  @IsIn(['CDF', 'USD']) deviseBase!: 'CDF' | 'USD';
  @IsString() @MinLength(3) @MaxLength(200) motif!: string;
  @IsString() @MinLength(3) @MaxLength(300) pieceJustificative!: string;
}

export class AnnulationRappelDto {
  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}
