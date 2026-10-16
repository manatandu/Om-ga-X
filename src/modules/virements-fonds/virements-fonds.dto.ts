import { NaturePieceVirement } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDefined, IsEnum, IsNumber, IsString, IsUUID, Length, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { FacultatifNonNul } from '../../common/facultatif-non-nul';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * LA PIÈCE D'UNE OPÉRATION · la sortie des fonds ou leur entrée. Sa date est
 * celle de l'écriture qu'elle appuie · « celle de l'émission par l'entité de
 * la pièce justificative de l'opération, ou celle de la réception des pièces
 * d'origine externe » (AUDCIF art. 16, al. 2).
 */
export class PieceOperationDto {
  // AUCUNE NATURE PAR DÉFAUT · « Ordre de virement » présélectionné se
  // retrouvait sur la pièce d'une caisse.
  @IsEnum(NaturePieceVirement, { message: 'Choisissez la nature de la pièce justificative.' })
  nature!: NaturePieceVirement;

  @IsString()
  @Length(1, 100, { message: 'La référence de la pièce se saisit en 100 caractères au plus.' })
  reference!: string;

  // LE JOUR, RIEN DE PLUS · @IsDateString admettait « 2026 », « 2026-03 »,
  // une semaine ISO (rendue en 500 par Prisma) ou une heure à décalage.
  @Matches(JOUR, { message: 'La date de la pièce se donne au jour (AAAA-MM-JJ).' })
  date!: string;
}

/** Un virement de fonds · deux journaux de trésorerie, un montant, une pièce par opération. */
export class CreerVirementDto {
  @IsUUID('4')
  exerciceId!: string;

  /** Journal de la banque ou de la caisse D'OÙ partent les fonds. */
  @IsUUID('4')
  journalOrigineId!: string;

  /** Journal de la banque ou de la caisse OÙ arrivent les fonds. */
  @IsUUID('4')
  journalDestinationId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le montant se saisit au centime près.' })
  @Min(0.01, { message: 'Le montant du virement doit être positif.' })
  montant!: number;

  /** La pièce de la SORTIE · elle appuie et date l'écriture du journal d'origine. */
  @IsDefined({ message: 'La pièce de la sortie des fonds est exigée.' })
  @ValidateNested()
  @Type(() => PieceOperationDto)
  sortie!: PieceOperationDto;

  /** La pièce de l'ENTRÉE · elle appuie et date l'écriture du journal de destination. */
  @IsDefined({ message: "La pièce de l'entrée des fonds est exigée." })
  @ValidateNested()
  @Type(() => PieceOperationDto)
  entree!: PieceOperationDto;

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
