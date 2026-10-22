import { ModeInteretsTresorerie, TypeOperationTresorerie } from '@prisma/client';
import { Allow, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

/**
 * Les corps de la fonction 47 · la RÈGLE juge montants, dates, taux et
 * références (`operations-tresorerie.ts`, refus nommés) ; le DTO les déclare
 * au pipe global (`@Allow()`, sans quoi `forbidNonWhitelisted` refuse la pièce
 * entière, vu sur vraie base au n° 40) et type les identifiants.
 */
export class OperationTresorerieDto {
  @IsEnum(TypeOperationTresorerie, { message: 'Le type est FINANCEMENT ou PLACEMENT.' })
  type!: TypeOperationTresorerie;

  @IsEnum(ModeInteretsTresorerie, { message: 'Les intérêts sont POST_COMPTES ou PRECOMPTES.' })
  modeInterets!: ModeInteretsTresorerie;

  @IsUUID('4') journalBanqueId!: string;
  @IsUUID('4') journalOdId!: string;
  @IsUUID('4') comptePrincipalId!: string;
  @IsUUID('4') compteInteretsId!: string;
  @IsOptional() @IsUUID('4') compteCourusId?: string;
  @IsOptional() @IsUUID('4') compteFraisId?: string;
  @IsOptional() @IsUUID('4') tauxReferenceId?: string;

  @Allow() reference?: unknown;
  @Allow() dateMiseEnPlace?: unknown;
  @Allow() dateEcheance?: unknown;
  @Allow() montant?: unknown;
  @Allow() tauxFixe?: unknown;
  @Allow() marge?: unknown;
  @Allow() baseCalcul?: unknown;
  @Allow() frais?: unknown;
  @Allow() interetsPrecomptes?: unknown;
  @Allow() deblocableAToutMoment?: unknown;
  @Allow() referenceConvention?: unknown;
  @Allow() dateConvention?: unknown;
}

export class EcheanceOperationDto {
  @Allow() date?: unknown;
  /** Les intérêts post-comptés du décompte de la banque. */
  @Allow() interets?: unknown;
}

export class RegulariserDto {
  @IsUUID('4') exerciceId!: string;
  @Allow() montant?: unknown;
}

export class ContrePasserDto {
  @IsUUID('4') regularisationId!: string;
  /**
   * AUDCIF art. 22, 4° · le premier jour est dans une période close (clôture
   * de période, ou du journal) · la contre-passation s'inscrit au premier jour
   * non clôturé, sa date de valeur gardée. DEMANDÉ, jamais d'office.
   */
  @IsOptional() @IsBoolean() reporterAuPremierJourOuvert?: boolean;
}

export class AnnulerActeTresorerieDto {
  @Allow() motif?: unknown;
}

export class TauxReferenceDto {
  @Allow() code?: unknown;
  @Allow() intitule?: unknown;
}

export class CoursTauxDto {
  @Allow() date?: unknown;
  @Allow() valeur?: unknown;
  @Allow() source?: unknown;
}
