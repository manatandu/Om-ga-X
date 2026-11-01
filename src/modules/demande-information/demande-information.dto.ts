import { Equals, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CourrielNormalise } from '../../common/courriel';

/**
 * Le formulaire de la page publique · `forbidNonWhitelisted` (pipe global)
 * refuse tout autre champ. Le consentement est exigé VRAI · une case non
 * cochée n'est pas un consentement (Code du numérique, art. 192).
 */
export class DemandeInformationDto {
  @IsString()
  @MinLength(2, { message: 'Le nom compte au moins 2 caractères' })
  @MaxLength(120, { message: 'Le nom compte au plus 120 caractères' })
  nom!: string;

  @IsString()
  @MinLength(2, { message: "Le nom de l'organisation compte au moins 2 caractères" })
  @MaxLength(160, { message: "Le nom de l'organisation compte au plus 160 caractères" })
  organisation!: string;

  @CourrielNormalise()
  @IsEmail({}, { message: "L'adresse électronique n'est pas valide" })
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'Le téléphone compte au plus 40 caractères' })
  @Matches(/^[0-9+().\s-]*$/, { message: 'Le téléphone ne porte que des chiffres, espaces et les signes + ( ) . -' })
  telephone?: string;

  @IsString()
  @MinLength(10, { message: 'Le message compte au moins 10 caractères' })
  @MaxLength(3000, { message: 'Le message compte au plus 3 000 caractères' })
  message!: string;

  @IsBoolean()
  @Equals(true, { message: 'Cochez la case de consentement · sans elle, la demande ne peut pas être traitée.' })
  consentement!: boolean;
}
