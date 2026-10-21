import { IsBoolean, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

/**
 * Coordonnées bancaires d'un tiers. Chaîne vide = effacement, comme les RIB
 * du dossier (banques.dto.ts) · les longueurs sont les mêmes.
 */
export class RibTiersDto {
  @IsString() @MinLength(1) @MaxLength(100) banque!: string;
  @IsOptional() @IsString() @MaxLength(100) titulaire?: string;
  @IsOptional() @IsString() @MaxLength(20) codeBanque?: string;
  @IsOptional() @IsString() @MaxLength(20) codeGuichet?: string;
  @IsOptional() @IsString() @MaxLength(34) numeroCompte?: string;
  @IsOptional() @IsString() @MaxLength(4) cle?: string;
  @IsOptional() @IsString() @MaxLength(42) iban?: string;
  @IsOptional() @IsString() @MaxLength(11) codeBic?: string;
  @IsOptional() @ValidateIf((_, v) => v !== '') @Matches(/^[A-Za-z]{3}$/, { message: 'Devise : code ISO à trois lettres.' }) devise?: string;
  @IsOptional() @IsString() @MaxLength(200) commentaire?: string;
  @IsOptional() @IsBoolean() estPrincipal?: boolean;
}

/**
 * VISER UN RIB (`tiers/visa-rib.ts`, règle 4) · l'instant de la dernière
 * saisie des coordonnées que l'écran a MONTRÉ, `null` pour un RIB dont aucune
 * saisie n'est connue. La clé est exigée · une absence ne vaut pas `null`, et
 * un visa sans elle viserait ce que personne n'a relu.
 */
export class VisaRibDto {
  @ValidateIf((_, v) => v !== null)
  @IsISO8601({ strict: true }, { message: "L'instant de la saisie lue est exigé (ou null pour un RIB d'avant le visa)." })
  saisiLeLu!: string | null;
}
