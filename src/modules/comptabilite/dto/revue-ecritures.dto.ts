import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { LONGUEUR_COMMENTAIRE_REVUE, PLAFOND_REVUE_PAR_LOT } from '../revue-ecritures.service';

/** Marquer revues des écritures (ligne gl-saisie, fonction 64). */
export class MarquerRevueDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PLAFOND_REVUE_PAR_LOT)
  @IsUUID(undefined, { each: true })
  ecritureIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(LONGUEUR_COMMENTAIRE_REVUE)
  commentaire?: string;
}
