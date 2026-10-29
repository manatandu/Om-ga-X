import { IsString, MaxLength } from 'class-validator';

/**
 * Ligne paie-suite, fonction 82 · le fichier du personnel, en base64 comme
 * l'import des écritures (`import/dto/import.dto.ts`) · huit mégaoctets au
 * plus une fois décodé.
 */
export class FichierPersonnelDto {
  @IsString() @MaxLength(200) nomFichier!: string;
  @IsString() @MaxLength(11_000_000, { message: 'Fichier trop volumineux (8 Mo maximum).' }) contenuBase64!: string;
}
