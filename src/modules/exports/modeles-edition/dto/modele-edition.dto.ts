import { EditionModele } from '@prisma/client';
import { IsArray, IsEnum, IsString } from 'class-validator';
import { FacultatifNonNul } from '../../../../common/facultatif-non-nul';

/** Un modèle d'édition · nom, colonnes et saut relus par le service (`modeleOuMotif`). */
export class CreerModeleEditionDto {
  @IsEnum(EditionModele, { message: 'Édition inconnue · PLAN_COMPTABLE, PLAN_TIERS ou PLAN_ANALYTIQUE.' })
  edition!: EditionModele;

  @IsString({ message: 'Le nom du modèle est exigé.' })
  nom!: string;

  @IsArray({ message: 'Les colonnes du modèle sont exigées.' })
  colonnes!: unknown[];

  // FACULTATIF NE VEUT PAS DIRE NULLABLE (CLAUDE.md § 9) · `null` passait
  // `@IsOptional()` et posait AUCUN (relecture TypeScript, mineur 5).
  @FacultatifNonNul('Saut nul refusé · omettez le champ pour « Aucun », ou envoyez AUCUN, LIGNE ou PAGE.')
  @IsString({ message: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' })
  saut?: string;
}

/** Remplacer un modèle · son édition et son nom ne changent pas. */
export class RemplacerModeleEditionDto {
  @IsArray({ message: 'Les colonnes du modèle sont exigées.' })
  colonnes!: unknown[];

  // Absent, le saut enregistré est GARDÉ · `null` l'effaçait en AUCUN.
  @FacultatifNonNul('Saut nul refusé · omettez le champ pour garder le saut du modèle, ou envoyez AUCUN, LIGNE ou PAGE.')
  @IsString({ message: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' })
  saut?: string;
}
