import { EditionModele } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

/** Un modèle d'édition · nom, colonnes et saut relus par le service (`modeleOuMotif`). */
export class CreerModeleEditionDto {
  @IsEnum(EditionModele, { message: 'Édition inconnue · PLAN_COMPTABLE, PLAN_TIERS ou PLAN_ANALYTIQUE.' })
  edition!: EditionModele;

  @IsString({ message: 'Le nom du modèle est exigé.' })
  nom!: string;

  @IsArray({ message: 'Les colonnes du modèle sont exigées.' })
  colonnes!: unknown[];

  @IsOptional()
  @IsString({ message: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' })
  saut?: string;
}

/** Remplacer un modèle · son édition et son nom ne changent pas. */
export class RemplacerModeleEditionDto {
  @IsArray({ message: 'Les colonnes du modèle sont exigées.' })
  colonnes!: unknown[];

  @IsOptional()
  @IsString({ message: 'Saut inconnu · AUCUN, LIGNE ou PAGE.' })
  saut?: string;
}
