import { Allow, IsOptional, IsUUID } from 'class-validator';

/**
 * Les corps des titres de placement (fonction 47) · la RÈGLE juge quantités,
 * prix, valeurs et références (`titres-placement.ts`, refus nommés) ; le DTO
 * les déclare au pipe global (`@Allow()`, sans quoi `forbidNonWhitelisted`
 * refuse le corps entier) et type les identifiants.
 */
export class TitrePlacementDto {
  @Allow() code?: unknown;
  @Allow() intitule?: unknown;
  @Allow() cote?: unknown;
  @IsUUID('4') compteTitreId!: string;
  @IsOptional() @IsUUID('4') compteFraisId?: string;
}

export class MouvementTitreDto {
  @IsUUID('4') journalBanqueId!: string;
  @Allow() date?: unknown;
  @Allow() quantite?: unknown;
  @Allow() prix?: unknown;
  @Allow() frais?: unknown;
  @Allow() reference?: unknown;
}

export class EvaluationTitreDto {
  @IsUUID('4') exerciceId!: string;
  @IsUUID('4') journalOdId!: string;
  @Allow() valeurUnitaire?: unknown;
  @Allow() nature?: unknown;
  @Allow() source?: unknown;
}

export class AnnulerTitreDto {
  @Allow() motif?: unknown;
}
