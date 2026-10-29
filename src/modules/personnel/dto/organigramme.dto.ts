import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/** Ligne paie-suite · une unité de l'organigramme (`organigramme.ts`). */
export class UniteOrganisationDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() @MaxLength(120) intitule!: string;
  @IsOptional() @IsString() @MaxLength(40) niveau?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() parentId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() sectionAnalytiqueId?: string | null;
}

/**
 * Modifier une unité · tout est facultatif, `null` efface le niveau, la
 * parente (l'unité remonte à la racine) ou la section. Le code ne change pas ·
 * c'est lui que l'historique des salariés nomme.
 */
export class ModifierUniteOrganisationDto {
  @FacultatifNonNul("L'intitulé d'une unité ne s'efface pas.") @IsString() @MaxLength(120) intitule?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) niveau?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() parentId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() sectionAnalytiqueId?: string | null;
  @FacultatifNonNul("L'état d'une unité est actif ou en sommeil, jamais vide.") @IsBoolean() estActive?: boolean;
}

/** Le rattachement daté d'un salarié · une mutation est un rattachement nouveau. */
export class RattachementUniteDto {
  @IsUUID() uniteId!: string;
  @IsDateString() dateEffet!: string;
}

/** L'annulation d'un rattachement saisi par erreur · motif exigé, la ligne reste lue. */
export class AnnulationRattachementDto {
  @IsString() @MinLength(3) @MaxLength(500) motif!: string;
}
