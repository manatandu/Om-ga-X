import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * CHANGER DE DOSSIER (ligne multi-dossiers) · le dossier visé est nommé au
 * corps d'une route dédiée, jamais en paramètre d'une autre requête · le
 * serveur le cherche parmi les seules appartenances actives de la personne.
 */
export class ChangerDossierDto {
  @IsString({ message: 'Le dossier est requis' })
  @IsNotEmpty({ message: 'Le dossier est requis' })
  @MaxLength(64)
  dossierId!: string;
}
