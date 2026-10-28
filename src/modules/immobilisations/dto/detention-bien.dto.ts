import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * LIGNE MICROFINA M4 · remettre un bien à un salarié (affectation), ou le
 * remettre au salarié qui le reçoit d'un autre (transfert). Le serveur relit
 * le bien, le contrat du salarié et les détentions déjà enregistrées
 * (`detention-bien.ts`).
 */
export class RemiseBienDto {
  @IsUUID('4')
  salarieId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de la remise se lit AAAA-MM-JJ.' })
  date!: string;

  /** Le lieu où le bien est remis · facultatif ; donné, il devient le lieu du bien. */
  @IsOptional()
  @IsUUID('4')
  lieuId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observation?: string;
}

/** Le bien rendu à l'entité · la détention en cours se termine ce jour. */
export class LiberationBienDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date du retour se lit AAAA-MM-JJ.' })
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observation?: string;
}

/** La signature du reçu, DÉCLARÉE · qui a signé, quel jour. Une fois. */
export class SignatureRecuDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  signataires!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de la signature se lit AAAA-MM-JJ.' })
  date!: string;
}
