import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MethodeArrondi } from '@prisma/client';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

const METHODES = Object.values(MethodeArrondi);

/** Mode d'arrondi du prix proposé (ligne commercial-l8, fonction 94). */
export class ModeArrondiDto {
  @IsString() @MinLength(1) @MaxLength(35) intitule!: string;
  @IsIn(METHODES, { message: 'La méthode d’arrondi est PROCHE, SUPERIEUR ou INFERIEUR.' }) methode!: MethodeArrondi;
  @IsNumber() pas!: number;
}

export class ModifierModeArrondiDto {
  @FacultatifNonNul('L’intitulé ne s’efface pas · omettez le champ pour le garder.') @IsString() @MinLength(1) @MaxLength(35) intitule?: string;
  @FacultatifNonNul('La méthode ne s’efface pas · omettez le champ pour la garder.') @IsIn(METHODES) methode?: MethodeArrondi;
  @FacultatifNonNul('Le pas ne s’efface pas · omettez le champ pour le garder.') @IsNumber() pas?: number;
  @FacultatifNonNul('Un mode est actif ou en sommeil · omettez le champ, ou portez true ou false.') @IsBoolean() actif?: boolean;
}

const ROLE = 'Un rôle est coché ou non · omettez le champ, ou portez true ou false.';

/** Collaborateur et ses rôles commerciaux (ligne commercial-l8, fonction 91). */
export class CollaborateurDto {
  @IsString() @MinLength(1) @MaxLength(35) nom!: string;
  @IsOptional() @IsString() @MaxLength(35) prenom?: string | null;
  @IsOptional() @IsString() @MaxLength(35) fonction?: string | null;
  @IsOptional() @IsString() @MaxLength(30) telephone?: string | null;
  @IsOptional() @IsEmail({}, { message: 'Adresse électronique invalide.' }) @MaxLength(120) email?: string | null;
  @FacultatifNonNul(ROLE) @IsBoolean() vendeur?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() caissier?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() acheteur?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() controleur?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() financier?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() recouvrement?: boolean;
}

export class ModifierCollaborateurDto {
  @FacultatifNonNul('Le nom ne s’efface pas · omettez le champ pour le garder.') @IsString() @MinLength(1) @MaxLength(35) nom?: string;
  @IsOptional() @IsString() @MaxLength(35) prenom?: string | null;
  @IsOptional() @IsString() @MaxLength(35) fonction?: string | null;
  @IsOptional() @IsString() @MaxLength(30) telephone?: string | null;
  @IsOptional() @IsEmail({}, { message: 'Adresse électronique invalide.' }) @MaxLength(120) email?: string | null;
  @FacultatifNonNul(ROLE) @IsBoolean() vendeur?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() caissier?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() acheteur?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() controleur?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() financier?: boolean;
  @FacultatifNonNul(ROLE) @IsBoolean() recouvrement?: boolean;
  @FacultatifNonNul('Un collaborateur est actif ou en sommeil · omettez le champ, ou portez true ou false.') @IsBoolean() actif?: boolean;
}
