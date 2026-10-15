import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NatureModeReglement } from '@prisma/client';
import { FacultatifNonNul } from '../../common/facultatif-non-nul';

/**
 * UN MODE DE RÈGLEMENT (ligne sage-l2, fonction 1) · code, intitulé, nature,
 * et deux facultatifs · le code interbancaire (libre) et le journal de
 * trésorerie proposé. Les bornes de longueur sont jugées par
 * `motifRefusIdentiteMode` au service.
 */
export class CreerModeReglementDto {
  @IsString()
  @MaxLength(10)
  code!: string;

  @IsString()
  @MaxLength(200)
  intitule!: string;

  @IsEnum(NatureModeReglement, { message: 'Nature de mode de règlement inconnue' })
  nature!: NatureModeReglement;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  codeInterbancaire?: string | null;

  @IsOptional()
  @IsUUID()
  journalId?: string | null;
}

/**
 * Modifier un mode · le code reste (il nomme le mode dans les échanges),
 * le reste se retouche. `null` efface le code interbancaire ou le journal ;
 * la nature et l'intitulé ne s'effacent pas.
 */
export class ModifierModeReglementDto {
  @FacultatifNonNul('L’intitulé du mode de règlement ne s’efface pas · omettez le champ pour le garder.')
  @IsString()
  @MaxLength(200)
  intitule?: string;

  @FacultatifNonNul('La nature du mode de règlement ne s’efface pas · omettez le champ pour la garder.')
  @IsEnum(NatureModeReglement, { message: 'Nature de mode de règlement inconnue' })
  nature?: NatureModeReglement;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  codeInterbancaire?: string | null;

  @IsOptional()
  @IsUUID()
  journalId?: string | null;

  @FacultatifNonNul('Un mode est actif ou en sommeil · omettez le champ pour le garder.')
  @IsBoolean()
  estActif?: boolean;
}
