import { ArrayMaxSize, IsArray, IsEnum } from 'class-validator';
import { LangueInterface, TypeNotification } from '@prisma/client';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/** Ses préférences (ligne dossier-l9, fonctions 96 et 100) · ce qui n'est pas envoyé ne change pas. */
export class ReglerPreferencesDto {
  @FacultatifNonNul('La langue ne s’efface pas · « FR », seule langue proposée.')
  @IsEnum(LangueInterface, { message: 'Langue inconnue · « FR », seule langue proposée.' })
  langue?: LangueInterface;

  @FacultatifNonNul('La liste des notifications coupées ne s’efface pas · une liste vide les rouvre toutes.')
  @IsArray({ message: 'Les notifications coupées sont une liste.' })
  @ArrayMaxSize(20)
  @IsEnum(TypeNotification, { each: true, message: 'Événement de notification inconnu.' })
  notificationsCoupees?: TypeNotification[];
}
