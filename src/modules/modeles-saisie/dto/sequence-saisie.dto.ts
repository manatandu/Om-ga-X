import { IsString, MaxLength } from 'class-validator';

/**
 * UNE SÉQUENCE DE SAISIE (ligne sage-l1, fonction 19) · son intitulé seul ;
 * le rang (1 à 10) est pris par le serveur, le premier libre.
 */
export class CreerSequenceSaisieDto {
  @IsString()
  @MaxLength(200)
  intitule!: string;
}

export class ModifierSequenceSaisieDto {
  @IsString()
  @MaxLength(200)
  intitule!: string;
}
