import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { LONGUEUR_CORPS, LONGUEUR_OBJET, PLAFOND_DESTINATAIRES } from '../messagerie';

/** Un message à des utilisateurs du même dossier (ligne dossier-l9, fonction 95). */
export class EnvoyerMessageDto {
  @IsString()
  @MaxLength(LONGUEUR_OBJET, { message: `L'objet tient en ${LONGUEUR_OBJET} caractères au plus.` })
  objet!: string;

  @IsString()
  @MaxLength(LONGUEUR_CORPS, { message: `Un message tient en ${LONGUEUR_CORPS} caractères au plus.` })
  corps!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins un destinataire.' })
  @ArrayMaxSize(PLAFOND_DESTINATAIRES)
  @IsUUID('4', { each: true })
  destinataireIds!: string[];

  @IsOptional()
  @IsUUID()
  repondAId?: string;
}
