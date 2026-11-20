import { IsString, MaxLength, MinLength } from 'class-validator';

/** Le jeton du lien de déverrouillage reçu par courriel (`deverrouillage.ts`). */
export class JetonDeverrouillageDto {
  @IsString({ message: 'Le lien de déverrouillage est incomplet' })
  @MinLength(20, { message: 'Le lien de déverrouillage est incomplet' })
  @MaxLength(200)
  jeton!: string;
}
