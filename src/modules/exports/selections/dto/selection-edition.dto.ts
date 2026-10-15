import { EditionSelection } from '@prisma/client';
import { IsEnum, IsObject, IsString } from 'class-validator';

/** Une sélection enregistrée · nom et critères relus par le service, clé par clé. */
export class CreerSelectionEditionDto {
  @IsEnum(EditionSelection, { message: 'Édition inconnue · JOURNAL ou IMPRESSION_DIFFEREE.' })
  edition!: EditionSelection;

  @IsString({ message: 'Le nom de la sélection est exigé.' })
  nom!: string;

  @IsObject({ message: 'Les critères de la sélection sont exigés.' })
  criteres!: Record<string, unknown>;
}

/** Remplacer les critères d'une sélection · son édition et son nom ne changent pas. */
export class RemplacerSelectionEditionDto {
  @IsObject({ message: 'Les critères de la sélection sont exigés.' })
  criteres!: Record<string, unknown>;
}
