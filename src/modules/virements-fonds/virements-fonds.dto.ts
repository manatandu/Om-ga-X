import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { FacultatifNonNul } from '../../common/facultatif-non-nul';

/**
 * LA PIÈCE D'UNE OPÉRATION · la sortie des fonds ou leur entrée. Sa date est
 * celle de l'écriture qu'elle appuie · « celle de l'émission par l'entité de
 * la pièce justificative de l'opération, ou celle de la réception des pièces
 * d'origine externe » (AUDCIF art. 16, al. 2).
 *
 * RIEN NE S'Y JUGE CHAMP PAR CHAMP · nature, référence et date se jugent dans
 * `motifRefusVirement`, qui nomme l'opération ; validés ici en objet imbriqué,
 * leurs refus sortaient préfixés « sortie. » (« sortie.Choisissez la nature
 * … », « sortie.reference must be a string »). La forme reste typée pour le
 * code ; la porte ne vérifie que l'objet. AUCUNE NATURE PAR DÉFAUT · « Ordre de virement » présélectionné se
 * retrouvait sur la pièce d'une caisse. LE JOUR, RIEN DE PLUS · @IsDateString
 * admettait « 2026 », « 2026-03 », une semaine ISO (rendue en 500 par Prisma)
 * ou une heure à décalage (`estUnJour`).
 */
export class PieceOperationDto {
  // `unknown` · non jugés à la porte, ils ne se lisent pas comme des textes
  // ailleurs que dans la règle (relecture TypeScript, mineur 1).
  nature?: unknown;
  reference?: unknown;
  date?: unknown;
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
  // `IsObject` refuse aussi l'absence et `null` · un seul message, jamais deux.
  @IsObject({ message: 'La pièce de la sortie des fonds se donne avec sa nature, sa référence et sa date.' })
  @Type(() => PieceOperationDto)
  sortie!: PieceOperationDto;

  /** La pièce de l'ENTRÉE · elle appuie et date l'écriture du journal de destination. */
  @IsObject({ message: "La pièce de l'entrée des fonds se donne avec sa nature, sa référence et sa date." })
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
