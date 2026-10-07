import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsPositive, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { FacultatifNonNul } from '../../../common/facultatif-non-nul';

/** Une facture que le paiement paie, et la part qui lui revient. */
export class FactureImputeeDto {
  @IsUUID('4')
  ligneFactureId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montant!: number;
}

/**
 * DÉCLARER L'IMPUTATION D'UN PAIEMENT (Code civil, Livre III, art. 151 et 153 ;
 * décision par la loi du 2026-10-07, point 4) · le paiement, les factures
 * qu'il paie avec leur part, le fondement et la pièce qui le prouve.
 */
export class DeclarerImputationDto {
  @IsUUID('4')
  ligneReglementId!: string;

  @IsIn(['DECLARATION_DU_DEBITEUR', 'QUITTANCE_ACCEPTEE'])
  fondement!: 'DECLARATION_DU_DEBITEUR' | 'QUITTANCE_ACCEPTEE';

  /** Ordre de virement ou lettre qui cite la facture, quittance acceptée. */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  pieceReference!: string;

  /**
   * LA DATE DE LA PIÈCE EST EXIGÉE (relecture du 2026-10-07, M3) · l'art. 151
   * fait déclarer le débiteur « lorsqu'il paye », et une pièce postérieure au
   * paiement n'est pas sa déclaration ; la quittance de l'art. 153 est datée
   * de ce que le créancier « a reçu ».
   */
  @IsDateString()
  pieceDate!: string;

  /**
   * LA PREUVE DE L'ACCEPTATION, exigée pour une quittance (art. 153 · « a
   * accepté une quittance ») · contreseing, lettre ou courriel du débiteur,
   * avec sa référence. Sans objet pour la déclaration du débiteur.
   */
  @FacultatifNonNul('La preuve de l’acceptation ne peut pas être nulle · omettez-la pour une déclaration du débiteur.')
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  preuveAcceptation?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FactureImputeeDto)
  factures!: FactureImputeeDto[];
}

/** Le retrait de l'imputation déclarée d'un paiement, motivé. */
export class RetirerImputationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motif!: string;
}
