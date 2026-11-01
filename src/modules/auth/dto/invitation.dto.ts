import { IsString, MaxLength, MinLength } from 'class-validator';

/** Le jeton reçu par courriel avec l'invitation (ligne multi-dossiers, `utilisateurs/invitations.ts`). */
export class JetonInvitationDto {
  @IsString({ message: 'Le code de l’invitation est requis' })
  @MinLength(20, { message: 'Le code de l’invitation est incomplet' })
  @MaxLength(200)
  jeton!: string;
}

/** Une adresse neuve accepte en choisissant son mot de passe. */
export class CreerCompteParInvitationDto extends JetonInvitationDto {
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères' })
  motDePasse!: string;
}
