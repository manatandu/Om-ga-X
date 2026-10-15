import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ConditionEcheance, TypeEcheance } from '@prisma/client';

export class CreerModeleReglementDto {
  @IsString()
  intitule!: string;

  @IsInt()
  @Min(0)
  delaiJours!: number;

  @IsOptional()
  @IsEnum(ConditionEcheance)
  echeance?: ConditionEcheance;

  /** Le mode de l'échéance unique (ligne sage-l2, fonction 1) · un mode du dossier, actif. */
  @IsOptional()
  @IsUUID()
  modeReglementId?: string;
}

export class ModifierModeleReglementDto {
  @IsOptional()
  @IsString()
  intitule?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  delaiJours?: number;

  @IsOptional()
  @IsEnum(ConditionEcheance)
  echeance?: ConditionEcheance;

  @IsOptional()
  @IsBoolean()
  estActif?: boolean;

  /** null explicite = l'échéance unique ne dit plus de mode. */
  @IsOptional()
  @IsUUID()
  modeReglementId?: string | null;
}

export class CreerEcheanceReglementDto {
  @IsInt()
  @Min(1)
  ordre!: number;

  @IsEnum(TypeEcheance)
  type!: TypeEcheance;

  // Pourcentage (0-100) pour POURCENTAGE, montant fixe pour MONTANT ;
  // absent (ou ignoré) pour EQUILIBRE, qui n'a pas de valeur propre.
  @IsOptional()
  @IsNumber()
  @Min(0)
  valeur?: number;

  @IsInt()
  @Min(0)
  delaiJours!: number;

  @IsOptional()
  @IsEnum(ConditionEcheance)
  echeance?: ConditionEcheance;

  /** Le mode de cette échéance (ligne sage-l2, fonction 1 · Sage, chaque ligne du modèle porte le sien). */
  @IsOptional()
  @IsUUID()
  modeReglementId?: string;
}

export class CalculerEcheancesDto {
  @IsDateString()
  dateFacture!: string;

  @IsNumber()
  @Min(0.01)
  montantTotal!: number;
}
