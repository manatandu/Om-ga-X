import { NaturePieceVirement } from '@prisma/client';
import { IsEnum, IsNumber, IsString, IsUUID, Length, Matches, MaxLength, Min } from 'class-validator';
import { FacultatifNonNul } from '../../common/facultatif-non-nul';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Un virement de fonds · deux journaux de trésorerie, un montant, une pièce justificative. */
export class CreerVirementDto {
  @IsUUID('4')
  exerciceId!: string;

  /** Journal de la banque ou de la caisse D'OÙ partent les fonds. */
  @IsUUID('4')
  journalOrigineId!: string;

  /** Journal de la banque ou de la caisse OÙ arrivent les fonds. */
  @IsUUID('4')
  journalDestinationId!: string;

  // LE JOUR, RIEN DE PLUS · @IsDateString admettait « 2026 », « 2026-03 »,
  // une semaine ISO (rendue en 500 par Prisma) ou une heure à décalage.
  @Matches(JOUR, { message: 'La date du virement se donne au jour (AAAA-MM-JJ).' })
  date!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le montant se saisit au centime près.' })
  @Min(0.01, { message: 'Le montant du virement doit être positif.' })
  montant!: number;

  @IsEnum(NaturePieceVirement)
  naturePiece!: NaturePieceVirement;

  @IsString()
  @Length(1, 100)
  referencePiece!: string;

  @Matches(JOUR, { message: 'La date de la pièce se donne au jour (AAAA-MM-JJ).' })
  datePiece!: string;

  @IsString()
  @Length(3, 200)
  objet!: string;

  /** Exigé dès qu'une caisse est en jeu (virement-fonds.ts). */
  @FacultatifNonNul('Omettez le porteur, ou nommez-le.')
  @IsString()
  @MaxLength(120)
  porteur?: string;

  @FacultatifNonNul('Omettez les observations, ou écrivez-les.')
  @IsString()
  @MaxLength(500)
  observations?: string;
}

export class AnnulerVirementDto {
  @IsString()
  @Length(3, 500)
  motif!: string;
}

