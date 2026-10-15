import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/**
 * UN LIEU DE LIVRAISON (ligne sage-l2, fonction 31) · l'intitulé seul est
 * exigé ; les coordonnées vides s'effacent (`null`). Les règles du dossier
 * (client seulement, intitulé unique, principal) sont jugées par le service
 * (`tiers/lieux-livraison.ts`).
 */
export class LieuLivraisonDto {
  @IsString()
  @MaxLength(35, { message: "L'intitulé du lieu compte au plus 35 caractères." })
  intitule!: string;

  @IsOptional()
  @IsString()
  adresse?: string | null;

  @IsOptional()
  @IsString()
  complement?: string | null;

  @IsOptional()
  @IsString()
  boitePostale?: string | null;

  @IsOptional()
  @IsString()
  ville?: string | null;

  @IsOptional()
  @IsString()
  pays?: string | null;

  @IsOptional()
  @IsString()
  contact?: string | null;

  @IsOptional()
  @IsString()
  telephone?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse électronique du lieu invalide' })
  email?: string | null;

  @FacultatifNonNul('Le lieu principal vaut vrai ou faux · omettez le champ pour le garder.')
  @IsBoolean()
  estPrincipal?: boolean;

  @FacultatifNonNul('L’état du lieu vaut vrai ou faux · omettez le champ pour le garder.')
  @IsBoolean()
  estActif?: boolean;
}
