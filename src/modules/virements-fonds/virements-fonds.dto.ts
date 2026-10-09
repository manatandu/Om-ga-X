import { NaturePieceVirement } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { FacultatifNonNul } from '../../common/facultatif-non-nul';

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

  @IsDateString()
  date!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montant!: number;

  @IsEnum(NaturePieceVirement)
  naturePiece!: NaturePieceVirement;

  @IsString()
  @Length(1, 100)
  referencePiece!: string;

  @IsDateString()
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

