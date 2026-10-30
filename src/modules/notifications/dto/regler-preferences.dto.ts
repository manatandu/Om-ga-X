import { ArrayMaxSize, IsArray, IsEnum } from 'class-validator';
import { LangueInterface, TailleTexte, TypeNotification } from '@prisma/client';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/** Ses préférences (ligne dossier-l9, fonctions 96 et 100) · ce qui n'est pas envoyé ne change pas. */
export class ReglerPreferencesDto {
  @FacultatifNonNul('La langue ne s’efface pas · « FR » ou « EN ».')
  @IsEnum(LangueInterface, { message: 'Langue inconnue · « FR » ou « EN ».' })
  langue?: LangueInterface;

  @FacultatifNonNul('La taille du texte ne s’efface pas.')
  @IsEnum(TailleTexte, { message: 'Taille du texte inconnue.' })
  tailleTexte?: TailleTexte;

  @FacultatifNonNul('La liste des notifications coupées ne s’efface pas · une liste vide les rouvre toutes.')
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(TypeNotification, { each: true, message: 'Événement de notification inconnu.' })
  notificationsCoupees?: TypeNotification[];
}
