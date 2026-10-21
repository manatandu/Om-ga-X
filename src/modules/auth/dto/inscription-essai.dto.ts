import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CourrielNormalise } from '../../../common/courriel';
import { JeuEtatsFinanciersSycebnl, Referentiel, SystemeComptableSyscohada } from '@prisma/client';

/**
 * L'inscription en libre-service avec essai · SANS mot de passe (tiré au sort
 * par le serveur, envoyé au seul courriel), SANS type de licence ni échéance
 * (l'essai est le seul régime que cette porte donne). `forbidNonWhitelisted`
 * refuse tout autre champ.
 */
export class InscriptionEssaiDto {
  @IsString()
  @MinLength(2, { message: "Le nom de l'entité compte au moins 2 caractères" })
  @MaxLength(120, { message: "Le nom de l'entité compte au plus 120 caractères" })
  nomEntite!: string;

  @IsEnum(Referentiel)
  referentiel!: Referentiel;

  @CourrielNormalise()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsEnum(JeuEtatsFinanciersSycebnl)
  jeuEtatsFinanciersSycebnl?: JeuEtatsFinanciersSycebnl;

  @IsOptional()
  @IsEnum(SystemeComptableSyscohada)
  systemeComptableSyscohada?: SystemeComptableSyscohada;
}
