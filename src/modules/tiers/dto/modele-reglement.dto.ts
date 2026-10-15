import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ConditionEcheance, TypeEcheance, TypeJournal } from '@prisma/client';

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

/**
 * L'ÉCHÉANCIER DE LA LIGNE DE FACTURE EN SAISIE (ligne sage-l2, fonction 3) ·
 * date de la pièce, montant de la ligne, son sens et le type du journal. Le
 * compte est en paramètre de route, jugé dans le dossier par le service.
 */
export class EcheancierDeLigneDto {
  @IsDateString({}, { message: 'La date de la pièce est attendue au format AAAA-MM-JJ.' })
  date!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Le montant de la ligne est illisible.' })
  @Min(0.01, { message: 'Le montant de la ligne doit être positif.' })
  montant!: number;

  @IsIn(['DEBIT', 'CREDIT'], { message: 'Le sens de la ligne vaut DEBIT ou CREDIT.' })
  sens!: 'DEBIT' | 'CREDIT';

  @IsOptional()
  @IsEnum(TypeJournal, { message: 'Type de journal inconnu.' })
  typeJournal?: TypeJournal;
}
