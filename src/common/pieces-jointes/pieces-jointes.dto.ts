import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Le champ texte qui accompagne le fichier envoyé · Sage, « un commentaire de
 * 69 caractères » (ligne sage-l6, fonction n° 22, comme les documents des
 * tiers).
 */
export class DeposerPieceJointeDto {
  @IsOptional()
  @IsString()
  @MaxLength(69)
  commentaire?: string;
}

/** Le commentaire retouché · vide ou `null`, il s'efface. */
export class CommentairePieceJointeDto {
  @IsOptional()
  @IsString()
  @MaxLength(69)
  commentaire?: string | null;
}
