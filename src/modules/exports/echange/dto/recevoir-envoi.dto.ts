import { IsString, MaxLength } from 'class-validator';

/**
 * L'envoi reçu (ligne dossier-l9, fonction 102) · le classeur de l'export des
 * modifications d'un autre dossier, en base64 dans le corps JSON comme
 * l'import des données. La borne vaut 8 Mo de fichier environ.
 */
export class RecevoirEnvoiDto {
  @IsString()
  @MaxLength(200)
  nomFichier!: string;

  @IsString()
  @MaxLength(11_000_000, { message: 'Fichier trop volumineux (8 Mo maximum).' })
  contenuBase64!: string;
}
